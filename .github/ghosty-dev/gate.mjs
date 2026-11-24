// Puerta de evidencia del PR (Ley 2 + «proof of work» antes del merge, OpenAI Symphony).
// La corre la Action `ghosty-dev/evidencia`: falla si algún pendiente que el PR cierra no tiene
// un comentario de evidencia válido. Autocontenido: `ghosty-dev init` lo copia a .github/ghosty-dev/.
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { findValidEvidence, findRevisionFor, crossPreviewProblems, pendingVerification } from './evidence.mjs';

const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;

export function closingRefs(body = '') {
  return [...new Set([...body.matchAll(CLOSING)].map((m) => Number(m[1])))];
}

// Revisión por check externo (opcional): un revisor con OTRA identidad publica un check sobre el commit del PR.
// Se configura en `.github/ghosty-dev/config.json` de la rama base: { "reviewCheck": { "name": "…", "app": "…" } }.
// Cierra lo que la puerta no puede probar con comentarios: que quien revisó no es quien escribió (SPEC §4b).
// Revisor por defecto (23-nov): sin `reviewCheck` en la base, la puerta acepta el check «Ghosty Review» de la app de Ghosty Studio.
// Es un revisor con OTRA identidad (name + app obligatorios, no se falsifica con un nombre), tan estricto como `ghosty-dev review`.
// Un `config.json` explícito sigue mandando. Así un PR de preparación no se bloquea a sí mismo por faltar el config (Formmy #116).
export const DEFAULT_REVIEW_CHECK = Object.freeze({ name: 'Ghosty Review', app: 'ghosty-studio' });

export function reviewCheckConfig(raw) {
  try {
    const rc = JSON.parse(raw || '{}').reviewCheck;
    const name = typeof rc?.name === 'string' ? rc.name.trim() : '';
    const app = typeof rc?.app === 'string' ? rc.app.trim() : '';
    // Sin `app` cualquiera con permiso de checks podría publicar uno con ese nombre: se exigen los dos.
    return name && app ? { name, app } : null;
  } catch {
    return null;
  }
}

// Puro: el check del revisor externo sobre el commit exacto. { state: 'passed' | 'findings' | 'pending' | 'missing' }.
export function externalReview(config, checkRuns = [], sha = '') {
  if (!config) return null;
  const runs = checkRuns.filter((r) => r?.name === config.name && r?.app?.slug === config.app && r?.head_sha === sha);
  if (runs.length === 0) return { state: 'missing', ...config };
  // El más reciente manda: un re-run sustituye al anterior.
  const last = runs.sort((a, b) => String(b.completed_at || b.started_at || '').localeCompare(String(a.completed_at || a.started_at || '')))[0];
  if (last.status !== 'completed') return { state: 'pending', ...config };
  return { state: last.conclusion === 'success' ? 'passed' : 'findings', ...config };
}

// Puro: la vista previa del commit (check «Ghosty · Preview» de Ghosty Studio). Un build o arranque roto es ROJO
// (Formmy, fila 52: el #100 rompió el build de Vite y pasó pruebas, tsc y dos revisiones; sólo la preview lo vio).
// Neutral (variables faltantes, falla de infraestructura) no bloquea. { state: 'failed' | 'ok' | 'pending' | 'missing', title }.
export const PREVIEW_CHECK = 'Ghosty · Preview';
export function previewBuild(checkRuns = [], sha = '') {
  const runs = checkRuns.filter((r) => r?.name === PREVIEW_CHECK && (!r.head_sha || r.head_sha === sha));
  if (!runs.length) return { state: 'missing', title: null };
  const last = runs.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
  const title = last.output?.title ?? null;
  if (last.status !== 'completed') return { state: 'pending', title };
  return { state: ['failure', 'timed_out', 'cancelled', 'action_required'].includes(last.conclusion) ? 'failed' : 'ok', title };
}

// Un PR fuera de la bitácora (no cierra ningún pendiente) BLOQUEA por defecto (falla cerrada), con el comando exacto
// que lo liga. Sólo con `"unlinked": "warn"` en .github/ghosty-dev/config.json de la base pasa con aviso.
export function unlinkedPolicy(raw) {
  try {
    return JSON.parse(raw || '{}').unlinked === 'warn' ? 'inform' : 'block';
  } catch {
    return 'block';
  }
}

// Puro: recibe el PR y una función que trae cada issue ({ body, comments }). `external` = externalReview(…) o null.
// `prCommits(n)` = shas del PR n (null = no se pudo): valida «probado en la preview del PR #N» (Formmy, fila 40).
export function evaluatePullRequest(pr, fetchIssue, external = null, { unlinked = 'block', prCommits = null, preview = null } = {}) {
  const refs = closingRefs(pr.body || '');
  if (refs.length === 0) {
    // «Refs #95» enlaza pero no cierra: si la descripción nombra un solo pendiente, el comando sale exacto (sin «<n>»).
    const mentioned = [...new Set([...(pr.body || '').matchAll(/(?:^|[^\w&])#(\d+)\b/g)].map((m) => Number(m[1])))].filter((n) => n !== pr.number);
    const fix =
      mentioned.length === 1
        ? `ghosty-dev claim --pr ${pr.number ?? '<m>'} --issue ${mentioned[0]} (o cambia «Refs #${mentioned[0]}» por «Closes #${mentioned[0]}» en la descripción: «Refs» sólo enlaza, «Closes» cierra)`
        : `ghosty-dev claim --pr ${pr.number ?? '<m>'} --issue <n> (o agrega «Closes #n» a la descripción)`;
    if (unlinked === 'block') {
      const line = `El PR no cierra ningún pendiente: ${fix}.`;
      return { ok: false, lines: [line], failures: [line] };
    }
    // Sólo con "unlinked": "warn".
    return { ok: true, informative: true, failures: [], lines: [`El PR no está ligado a un pendiente: la puerta no tiene qué juzgar (informativo). Regularízalo: ${fix}.`] };
  }
  const sha = pr.head?.sha || '';
  const short = sha.slice(0, 7);
  const lines = [];
  // Cada causa que falla va también a `failures`: main() la imprime como anotación ::error (gs la lee por
  // /check-runs/{id}/annotations; la primera es la causa principal).
  const failures = [];
  // Criterios `[~]` que una persona debe confirmar: no son fallo (CI no se pone rojo), pero el merge espera.
  const awaiting = [];
  const fail = (line) => {
    lines.push(line);
    failures.push(line);
  };
  // Rama fuera del patrón ghosty-dev/<n>-…: informativo, no cambia el veredicto (lo que juzga es el pendiente).
  const ref = pr.head?.ref;
  if (preview?.state === 'failed') fail(`La vista previa del commit ${short} no compila o no arranca${preview.title ? ` (${preview.title})` : ''}: corre el build del repo (npm run build), arréglalo y sube. Ni pruebas ni revisión sustituyen al build.`);
  if (ref && !/^ghosty-dev\/\d+-/.test(ref)) lines.push(`Informativo: la rama ${ref} no sigue el patrón ghosty-dev/<n>-…; la puerta juzga ${refs.map((r) => '#' + r).join(', ')} igual.`);
  for (const n of refs) {
    const issue = fetchIssue(n);
    // Revisión: otro agente con contexto limpio, del commit exacto que se va a mergear.
    const rev = findRevisionFor(issue.comments, sha);
    if (external?.state === 'passed') {
      lines.push(`#${n}: revisión del commit ${short} por el check «${external.name}» (${external.app}), sin hallazgos.`);
    } else if (external && external.state !== 'missing') {
      fail(
        external.state === 'pending'
          ? `#${n}: el check «${external.name}» del commit ${short} sigue corriendo.`
          : `#${n}: el check «${external.name}» del commit ${short} dejó hallazgos abiertos.`,
      );
    } else if (!rev) {
      fail(`#${n}: falta la revisión del commit ${short} (ghosty-dev review ${n}).`);
    } else if (rev.open > 0) {
      fail(`#${n}: la revisión del commit ${short} tiene ${rev.open} hallazgo(s) abierto(s).`);
    } else {
      lines.push(`#${n}: revisión del commit ${short} sin hallazgos abiertos.`);
    }
    const ev = findValidEvidence(issue.comments, issue.body);
    const cross = ev && prCommits ? crossPreviewProblems(ev.body || '', { pr: pr.number, sha }, prCommits) : [];
    if (ev && cross.length) {
      for (const c of cross) fail(`#${n}: ${c}`);
    } else if (ev) {
      lines.push(`#${n}: evidencia válida.`);
      const pv = pendingVerification(issue.comments, issue.body);
      for (const c of pv.confirmed) lines.push(`#${n}: verificación de la persona confirmada por @${c.by ?? '?'}: ${c.criterion}.`);
      for (const m of pv.missing) {
        awaiting.push(m.criterion);
        lines.push(`#${n}: Falta tu verificación: ${m.criterion} — comprueba: ${m.check} (ghosty-dev confirm ${n} --criterion <i>).`);
      }
    } else {
      fail(`#${n}: sin comentario de evidencia válido (ghosty-dev evidence ${n} --file evidencia.md).`);
    }
  }
  return { ok: failures.length === 0, lines, failures, awaiting };
}

// Una anotación de GitHub (::error) en una sola línea: %, \r y \n escapados como pide su formato.
export const annotation = (line, level = 'error') => `::${level} title=evidencia::${String(line).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`;

// Un borrador todavía se está iterando: se valida al cerrar, no mientras tanto. La puerta sale en verde con la
// explicación, y el workflow vuelve a correr con `ready_for_review` (al marcarlo listo), donde ya se exige todo.
export const DRAFT_NOTE = 'Borrador: la evidencia se exige al marcarlo listo.';

// Commit status con el nombre de la puerta (para el estado «pendiente de la persona»). true si GitHub lo aceptó.
function setStatus(gh, sha, state, description) {
  try {
    execFileSync(gh, ['api', '-X', 'POST', `repos/{owner}/{repo}/statuses/${sha}`, '-f', `state=${state}`, '-f', 'context=ghosty-dev/evidencia', '-f', `description=${description}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}
function hasPendingStatus(gh, sha) {
  try {
    const out = execFileSync(gh, ['api', '-X', 'GET', `repos/{owner}/{repo}/commits/${sha}/status`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return (JSON.parse(out).statuses || []).some((x) => x.context === 'ghosty-dev/evidencia' && x.state === 'pending');
  } catch {
    return false;
  }
}

function report(lines) {
  const text = lines.map((l) => `- ${l}`).join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ghosty-dev/evidencia\n${text}\n`);
}

export function main() {
  const gh = process.env.GHOSTY_DEV_GH || 'gh';
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const pr = event.pull_request;
  if (pr?.draft) {
    report([DRAFT_NOTE]);
    process.exit(0);
  }
  // REST, igual que el CLI (nada de `gh issue view`, que usa GraphQL).
  const get = (path) => JSON.parse(execFileSync(gh, ['api', '-X', 'GET', path], { encoding: 'utf8' }));
  const fetchIssue = (n) => ({
    body: get(`repos/{owner}/{repo}/issues/${n}`).body || '',
    comments: get(`repos/{owner}/{repo}/issues/${n}/comments?per_page=100`),
  });
  // La configuración sale de la rama base (el checkout de la Action), igual que este script.
  let config = null;
  let unlinked = 'block';
  try {
    const raw = readFileSync(new URL('./config.json', import.meta.url), 'utf8');
    config = reviewCheckConfig(raw);
    unlinked = unlinkedPolicy(raw);
  } catch {}
  config = config ?? { ...DEFAULT_REVIEW_CHECK };
  let external = null;
  let preview = null;
  if (pr.head?.sha) {
    let runs = [];
    try {
      const out = execFileSync(gh, ['api', '-X', 'GET', `repos/{owner}/{repo}/commits/${pr.head.sha}/check-runs?per_page=100`], { encoding: 'utf8' });
      runs = JSON.parse(out).check_runs || [];
    } catch {}
    if (config) external = externalReview(config, runs, pr.head.sha);
    preview = previewBuild(runs, pr.head.sha);
  }
  const prCommits = (n) => {
    try {
      return get(`repos/{owner}/{repo}/pulls/${n}/commits?per_page=100`).map((c) => c.sha);
    } catch {
      return null;
    }
  };
  const { ok, lines, informative, failures, awaiting = [] } = evaluatePullRequest(pr, fetchIssue, external, { unlinked, prCommits, preview });
  if (informative) console.log(annotation(lines[0], 'warning'));
  for (const f of failures) console.log(annotation(f));
  // Estado «pendiente de la persona»: el job termina sin rojo, pero el contexto obligatorio queda `pending` (commit status
  // con el mismo nombre) hasta que la persona confirme; al confirmar, la puerta vuelve a correr y lo pasa a `success`.
  let exit = ok ? 0 : 1;
  if (ok && pr.head?.sha) {
    const sha = pr.head.sha;
    if (awaiting.length) {
      const desc = `Falta tu verificación: ${awaiting.join('; ')}`.slice(0, 140);
      if (!setStatus(gh, sha, 'pending', desc)) {
        // Falla cerrada: sin poder marcar «pendiente» no se deja pasar en verde un criterio sin confirmar.
        lines.push('No pude marcar la puerta como pendiente (¿falta `statuses: write` en el workflow?): se bloquea hasta que se pueda.');
        console.log(annotation(lines.at(-1)));
        exit = 1;
      }
    } else if (hasPendingStatus(gh, sha)) {
      setStatus(gh, sha, 'success', 'Verificación de la persona confirmada');
    }
  }
  report(lines);
  process.exit(exit);
}

// Corre sólo como script (no al importarlo en los tests); realpath por los symlinks de /tmp en macOS.
const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : '';
if (import.meta.url === pathToFileURL(invokedPath).href) main();
