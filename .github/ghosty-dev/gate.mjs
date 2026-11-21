// Puerta de evidencia del PR (Ley 2 + «proof of work» antes del merge, OpenAI Symphony).
// La corre la Action `ghosty-dev/evidencia`: falla si algún pendiente que el PR cierra no tiene
// un comentario de evidencia válido. Autocontenido: `ghosty-dev init` lo copia a .github/ghosty-dev/.
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { findValidEvidence, findRevisionFor } from './evidence.mjs';

const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;

export function closingRefs(body = '') {
  return [...new Set([...body.matchAll(CLOSING)].map((m) => Number(m[1])))];
}

// Revisión por check externo (opcional): un revisor con OTRA identidad publica un check sobre el commit del PR.
// Se configura en `.github/ghosty-dev/config.json` de la rama base: { "reviewCheck": { "name": "…", "app": "…" } }.
// Cierra lo que la puerta no puede probar con comentarios: que quien revisó no es quien escribió (SPEC §4b).
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

// Puro: recibe el PR y una función que trae cada issue ({ body, comments }). `external` = externalReview(…) o null.
export function evaluatePullRequest(pr, fetchIssue, external = null) {
  const refs = closingRefs(pr.body || '');
  if (refs.length === 0) {
    return { ok: false, lines: ['El PR no cierra ningún pendiente: agrega «Closes #n» a la descripción.'] };
  }
  const sha = pr.head?.sha || '';
  const short = sha.slice(0, 7);
  const lines = [];
  let ok = true;
  for (const n of refs) {
    const issue = fetchIssue(n);
    // Revisión: otro agente con contexto limpio, del commit exacto que se va a mergear.
    const rev = findRevisionFor(issue.comments, sha);
    if (external?.state === 'passed') {
      lines.push(`#${n}: revisión del commit ${short} por el check «${external.name}» (${external.app}), sin hallazgos.`);
    } else if (external && external.state !== 'missing') {
      ok = false;
      lines.push(
        external.state === 'pending'
          ? `#${n}: el check «${external.name}» del commit ${short} sigue corriendo.`
          : `#${n}: el check «${external.name}» del commit ${short} dejó hallazgos abiertos.`,
      );
    } else if (!rev) {
      ok = false;
      lines.push(`#${n}: falta la revisión del commit ${short} (ghosty-dev review ${n}).`);
    } else if (rev.open > 0) {
      ok = false;
      lines.push(`#${n}: la revisión del commit ${short} tiene ${rev.open} hallazgo(s) abierto(s).`);
    } else {
      lines.push(`#${n}: revisión del commit ${short} sin hallazgos abiertos.`);
    }
    if (findValidEvidence(issue.comments, issue.body)) {
      lines.push(`#${n}: evidencia válida.`);
    } else {
      ok = false;
      lines.push(`#${n}: sin comentario de evidencia válido (ghosty-dev evidence ${n} --file evidencia.md).`);
    }
  }
  return { ok, lines };
}

function main() {
  const gh = process.env.GHOSTY_DEV_GH || 'gh';
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const pr = event.pull_request;
  // REST, igual que el CLI (nada de `gh issue view`, que usa GraphQL).
  const get = (path) => JSON.parse(execFileSync(gh, ['api', '-X', 'GET', path], { encoding: 'utf8' }));
  const fetchIssue = (n) => ({
    body: get(`repos/{owner}/{repo}/issues/${n}`).body || '',
    comments: get(`repos/{owner}/{repo}/issues/${n}/comments?per_page=100`),
  });
  // La configuración sale de la rama base (el checkout de la Action), igual que este script.
  let config = null;
  try {
    config = reviewCheckConfig(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
  } catch {}
  let external = null;
  if (config && pr.head?.sha) {
    let runs = [];
    try {
      const out = execFileSync(gh, ['api', '-X', 'GET', `repos/{owner}/{repo}/commits/${pr.head.sha}/check-runs?per_page=100`], { encoding: 'utf8' });
      runs = JSON.parse(out).check_runs || [];
    } catch {}
    external = externalReview(config, runs, pr.head.sha);
  }
  const { ok, lines } = evaluatePullRequest(pr, fetchIssue, external);
  const report = lines.map((l) => `- ${l}`).join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ghosty-dev/evidencia\n${report}\n`);
  process.exit(ok ? 0 : 1);
}

// Corre sólo como script (no al importarlo en los tests); realpath por los symlinks de /tmp en macOS.
const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : '';
if (import.meta.url === pathToFileURL(invokedPath).href) main();
