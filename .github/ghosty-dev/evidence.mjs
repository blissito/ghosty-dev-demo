// Formato y validación del comentario de evidencia (Ley 2: se revisa la evidencia, no el código).
// Archivo autocontenido: `ghosty-dev init` lo copia a .github/ghosty-dev/ para que lo use la Action.

// Versión de ghosty-dev que instaló esta puerta (la lee readiness para distinguir «distinta» de «rota»). Se sube con cada release.
export const GATE_VERSION = '0.9.45';
export const EVIDENCE_MARKER = '<!-- ghosty-dev:evidencia v0.1 -->';

// Normaliza un encabezado: minúsculas, sin acentos ni signos.
const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

// Parte un markdown en secciones por encabezados ## o ###.
export function parseSections(md) {
  const sections = {};
  let current = null;
  for (const line of md.split('\n')) {
    const m = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (m) {
      current = norm(m[1]);
      sections[current] = '';
    } else if (current) {
      sections[current] += line + '\n';
    }
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].trim();
  return sections;
}

// Busca una sección cuyo nombre empiece con alguna de las claves.
function section(sections, ...keys) {
  const name = Object.keys(sections).find((s) => keys.some((k) => s.startsWith(k)));
  return name === undefined ? null : sections[name];
}

// Criterios de aceptación de un pendiente: renglones «- [ ] …» o «- [x] …».
export function parseChecklist(text) {
  if (!text) return [];
  // `[~]` = «pendiente de la persona»: ni cumplido ni error de formato (ver `manualParts`).
  return [...text.matchAll(/^\s*[-*]\s+\[([ xX~])\]\s+(.+?)\s*$/gm)].map((m) => ({
    done: m[1] === 'x' || m[1] === 'X',
    text: m[2],
    ...(m[1] === '~' ? { pending: true } : {}),
  }));
}

export function acceptanceCriteria(issueBody = '') {
  return parseChecklist(section(parseSections(issueBody), 'criterios'));
}

const CI_GREEN = /✅|\bverde\b|\bpass(ed|ing)?\b|\bsuccess\b/i;
const CI_RED = /❌|\brojo\b|\bfail(ed|ing|ure)?\b/i;

// La puerta y su redisparo NO son CI: la puerta sólo se pone verde con esta evidencia, así que contarla como CI es un
// círculo (Formmy #117/#95: la evidencia citaba «ghosty-dev/evidencia: failure» y se rechazaba por «CI en rojo»).
// Una sola lista, compartida por la validación, `isCiCheck` de commands.mjs y el CI_IGNORE de gs.
export const GATE_CHECKS = Object.freeze(['ghosty-dev/evidencia', 'ghosty-dev/redisparo']);
// También la prosa que habla de la puerta («el único check en rojo es la propia puerta de evidencia»).
const GATE_MENTION = /ghosty-dev\/(evidencia|redisparo)|\bla\s+(propia\s+)?puerta\b|\bpuerta\s+de\s+evidencia\b/i;
// La sección CI sin los renglones que hablan de la puerta propia. Puro.
export function ciWithoutGate(ci = '') {
  return ci.split('\n').filter((l) => !GATE_MENTION.test(l)).join('\n');
}

// El primer renglón de la sección CI que dispara el rojo (o null). Puro.
export function ciRedLine(ci = '') {
  return ciWithoutGate(ci).split('\n').find((l) => CI_RED.test(l))?.trim() ?? null;
}

// ---------- verificación de la persona (`- [~] …`): sign-off de QA, explícito, rastreable y bloqueante para el merge ----------
// Algunos criterios sólo los comprueba una persona (p. ej. /admin con sesión de administrador que el escritor de la nube
// no tiene). En vez de obligarlo a mentir con `[x]`, los declara `- [~] <criterio> — verificación de la persona: <qué
// comprobar y cómo>`. La puerta los acepta, pero el merge espera a que la persona dueña los confirme (`ghosty-dev confirm`).
export const MANUAL_SEP = /\s+[—–-]{1,2}\s+verificaci[oó]n de la persona\s*:\s*/i;
export const MANUAL_MIN = 15;

// Separa «criterio — verificación de la persona: qué comprobar». `check` es '' si no hay separador.
export function manualParts(text = '') {
  const m = MANUAL_SEP.exec(text);
  if (!m) return { criterion: text.trim(), check: '' };
  return { criterion: text.slice(0, m.index).trim(), check: text.slice(m.index + m[0].length).trim() };
}

// Clave estable de un criterio (va en el marcador del comentario de confirmación). Puro.
export const criterionKey = (text = '') => norm(manualParts(text).criterion).replace(/\s+/g, '-').slice(0, 80);

// Los criterios `[~]` de una evidencia: [{ criterion, check }]. Puro.
export function manualCriteria(md = '') {
  return parseChecklist(section(parseSections(md), 'criterios'))
    .filter((g) => g.pending)
    .map((g) => manualParts(g.text));
}

// Valida el cuerpo de una evidencia contra el pendiente. Regresa { ok, errors, manual }.
export function validateEvidence(md, issueBody = '') {
  const errors = [];
  const manual = [];
  const s = parseSections(md);

  const done = section(s, 'que se hizo');
  if (!done) errors.push('Falta «Qué se hizo» (o está vacío).');

  // Oráculo: al menos un comando ($ …) con su salida, dentro de un bloque de código.
  const verification = section(s, 'verificacion');
  if (!verification) {
    errors.push('Falta «Verificación».');
  } else {
    const blocks = [...verification.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
    const lines = blocks.join('\n').split('\n').filter((l) => l.trim());
    const commands = lines.filter((l) => l.trimStart().startsWith('$ '));
    if (commands.length === 0) errors.push('«Verificación» necesita un bloque de código con comandos que empiecen con «$ ».');
    else if (lines.length === commands.length) errors.push('«Verificación» trae comandos pero no su salida.');
  }

  const ci = ciWithoutGate(section(s, 'ci') ?? '');
  if (!section(s, 'ci')) errors.push('Falta «CI» (resultado y liga del run).');
  else if (CI_RED.test(ci)) errors.push(`El CI está en rojo (renglón que lo dice: «${ciRedLine(section(s, 'ci') ?? '')}»): no se cierra un pendiente con CI rojo. Si el renglón habla de la puerta, nómbrala como «ghosty-dev/evidencia».`);
  else if (!CI_GREEN.test(ci)) errors.push('«CI» debe decir el resultado (✅ / verde / passed).');

  // El flujo principal ejercido con sesión (Formmy, filas 44 y 46): smoke, revisión y evidencia pasaron con el chat
  // roto porque nadie lo usó. Se exige el renglón con su prueba (captura o salida), o «no aplica» con el motivo.
  const flow = mainFlowProblem(mainFlowOf(md));
  if (flow) errors.push(flow);

  // Cada criterio de aceptación del pendiente debe venir marcado en la evidencia (o `[~]` con qué comprobar).
  const wanted = acceptanceCriteria(issueBody);
  if (wanted.length) {
    const given = parseChecklist(section(s, 'criterios'));
    for (const c of wanted) {
      const hit = given.find((g) => norm(manualParts(g.text).criterion) === norm(c.text));
      if (hit?.pending) {
        const { check } = manualParts(hit.text);
        if (check.length < MANUAL_MIN) errors.push(`Criterio «${c.text}» marcado [~] sin «qué comprobar»: escribe «- [~] ${c.text} — verificación de la persona: <qué debe comprobar y cómo, mínimo ${MANUAL_MIN} caracteres>».`);
        else manual.push({ criterion: c.text, check });
      } else if (!hit || !hit.done) {
        errors.push(`Criterio sin cumplir en la evidencia: «${c.text}». Si sólo una persona puede comprobarlo (p. ej. una sesión de administrador que no tienes), NO lo marques [x] ni pidas publicar sin él: márcalo «- [~] ${c.text} — verificación de la persona: <qué comprobar y cómo>» y publica; la puerta espera su confirmación (ghosty-dev confirm).`);
      }
    }
  }
  // Un `[~]` suelto (sin criterio que lo respalde en el issue) también necesita su «qué comprobar».
  for (const g of parseChecklist(section(s, 'criterios'))) {
    if (g.pending && manualParts(g.text).check.length < MANUAL_MIN && !errors.some((e) => e.includes(manualParts(g.text).criterion))) {
      errors.push(`«- [~] ${manualParts(g.text).criterion}» necesita «— verificación de la persona: <qué debe comprobar y cómo>» (mínimo ${MANUAL_MIN} caracteres).`);
    }
  }

  // `manual` sólo aparece si hay `[~]`: sin ellos el resultado es idéntico al de siempre.
  return manual.length ? { ok: errors.length === 0, errors, manual } : { ok: errors.length === 0, errors };
}

// ---------- «Flujo principal probado con sesión» (Formmy, filas 44 y 46) ----------

export const MAIN_FLOW_LABEL = 'Flujo principal probado con sesión';
const MAIN_FLOW_KEY = 'flujo principal';

// El texto del renglón: la sección «## Flujo principal probado con sesión» o el renglón «Flujo principal probado con
// sesión: …» con lo que lo sigue hasta el siguiente encabezado. null si no está.
export function mainFlowOf(md = '') {
  const sec = section(parseSections(md), MAIN_FLOW_KEY);
  if (sec !== null) return sec;
  const lines = String(md).split('\n');
  const i = lines.findIndex((l) => norm(l.replace(/[*_`>-]/g, ' ')).startsWith('flujo principal probado con sesion') && l.includes(':'));
  if (i === -1) return null;
  const rest = [lines[i].slice(lines[i].indexOf(':') + 1)];
  for (let j = i + 1; j < lines.length && !/^#{1,6}\s/.test(lines[j]); j++) rest.push(lines[j]);
  return rest.join('\n').trim();
}

const IMAGE = /!\[[^\]]*\]\(\s*\S+?\s*\)|<img\s[^>]*src=|https:\/\/\S+\.(?:png|jpe?g|gif|webp|mp4|webm|mov)\b|https:\/\/github\.com\/user-attachments\/\S+/i;

// Puro: null si el renglón vale; si no, el error. Vale con una captura (imagen o video) o con un bloque de código con
// un comando «$ …» y su salida; «no aplica: <motivo>» sólo con motivo (una biblioteca sin interfaz, por ejemplo).
export function mainFlowProblem(text) {
  const how = `«${MAIN_FLOW_LABEL}: <qué hiciste y cómo>» con una captura o un bloque «$ …» con su salida`;
  if (text == null || !text.replace(/<!--[\s\S]*?-->/g, '').trim()) return `Falta ${how} (entra con sesión a la vista previa y usa la función principal, no sólo abras la página).`;
  const clean = text.replace(/<!--[\s\S]*?-->/g, '').trim();
  const na = clean.match(/^no aplica\b[\s:—-]*(.*)$/is);
  if (na) return na[1].trim().length >= 15 ? null : `«${MAIN_FLOW_LABEL}: no aplica» necesita el motivo (p. ej. «no aplica: es una biblioteca sin interfaz ni login»).`;
  if (IMAGE.test(clean)) return null;
  const blocks = [...clean.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].split('\n').filter((l) => l.trim()));
  if (blocks.some((b) => b.some((l) => l.trimStart().startsWith('$ ')) && b.some((l) => !l.trimStart().startsWith('$ ')))) return null;
  return `«${MAIN_FLOW_LABEL}» necesita la prueba: una captura (imagen) o un bloque con el comando «$ …» y su salida.`;
}

// ---------- «probado en la preview del PR #N» (Formmy, fila 40) ----------
// Un PR basado en main a veces no puede probar logueado en su propia preview y la prueba se hace en la de otro PR.
// Esa referencia vale SÓLO si el otro PR contiene el mismo commit que se va a mergear: si no, lo probado es otro código.

const PREVIEW_REF = /(?:preview|vista previa)\s+(?:del?\s+)?(?:PR\s*)?#(\d+)/gi;

// Los números de PR que la evidencia cita como «preview del PR #N». Puro.
export function previewPrRefs(md = '') {
  return [...new Set([...String(md).matchAll(PREVIEW_REF)].map((m) => Number(m[1])))];
}

// Puro: los problemas de esas referencias. `commitsOf(n)` = shas del PR n (null = no se pudo leer).
export function crossPreviewProblems(md, { pr, sha }, commitsOf) {
  const problems = [];
  if (!sha) return problems;
  for (const n of previewPrRefs(md)) {
    if (pr && n === pr) continue;
    const shas = commitsOf(n);
    if (shas == null) problems.push(`La evidencia cita la preview del PR #${n}, pero no pude leer sus commits.`);
    else if (!shas.some((s) => s === sha || s.startsWith(sha) || sha.startsWith(s)))
      problems.push(`La evidencia cita la preview del PR #${n}, pero #${n} no contiene el commit ${sha.slice(0, 7)}: lo probado ahí es otro código. Prueba en la preview de este PR (login: identidad de Ghosty en previews u OAuth de previews, ver ghosty-dev doctor) o quita esa referencia.`);
  }
  return problems;
}

// Arma el comentario que se publica en el issue.
// El PR va enlazado arriba para que la persona llegue al merge desde el issue.
export function formatEvidence(number, md, pr = null) {
  const prLine = pr?.url ? `PR: ${pr.url}\n\n` : '';
  return `${EVIDENCE_MARKER}\n## Evidencia del pendiente #${number}\n\n${prLine}${md.trim()}\n`;
}

// De los comentarios de un issue, el último que sea evidencia válida (o null).
export function findValidEvidence(comments = [], issueBody = '') {
  for (const c of [...comments].reverse()) {
    const body = c.body || '';
    if (!body.includes(EVIDENCE_MARKER)) continue;
    if (validateEvidence(body, issueBody).ok) return c;
  }
  return null;
}

// ---------- confirmación de la persona ----------

export const CONFIRM_MARKER = '<!-- ghosty-dev:confirmacion v0.1';
const CONFIRM_RE = /<!-- ghosty-dev:confirmacion v0\.1 sha=([0-9a-f]{7,40}) criterio=([a-z0-9-]*) -->/;
// Quién puede confirmar: quien tiene permiso de escritura (author_association de GitHub; sin el dato, se acepta).
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export function formatConfirmation(number, { sha, criterion, index, by, at, note, check }) {
  return `${CONFIRM_MARKER} sha=${sha} criterio=${criterionKey(criterion)} -->\n✅ **Verificación de la persona, pendiente #${number}, criterio ${index}** (commit ${String(sha).slice(0, 7)})\n\n- Quién: ${by}\n- Cuándo: ${at}\n- Criterio: ${criterion}\n${check ? `- Qué debía comprobar: ${check}\n` : ''}- Nota: ${note?.trim() || '—'}\n\n<sub>Confirmado con ghosty-dev confirm</sub>\n`;
}

// Puro. De los comentarios del issue: la evidencia vigente, sus `[~]`, cuáles ya confirmó una persona de confianza y
// cuáles faltan. Una confirmación vale para el commit en que se dio y sobrevive a commits nuevos; lo que la invalida
// es que la evidencia nueva ya no declare el `[~]` (entonces el criterio se juzga como cualquier otro).
export function pendingVerification(comments = [], issueBody = '') {
  const ev = findValidEvidence(comments, issueBody);
  if (!ev) return { evidence: null, manual: [], confirmed: [], missing: [] };
  const manual = validateEvidence(ev.body || '', issueBody).manual ?? [];
  const confirms = comments.filter((c) => CONFIRM_RE.test(c.body || '') && (!c.author_association || TRUSTED.has(c.author_association)));
  const confirmed = [];
  const missing = [];
  for (const m of manual) {
    const key = criterionKey(m.criterion);
    const hit = [...confirms].reverse().find((c) => CONFIRM_RE.exec(c.body)[2] === key);
    if (hit) confirmed.push({ ...m, by: hit.user?.login ?? null, sha: CONFIRM_RE.exec(hit.body)[1] });
    else missing.push(m);
  }
  return { evidence: ev, manual, confirmed, missing };
}

// ---------- revisión (Cognition: el revisor no comparte contexto; Anthropic: quien escribe se califica de más) ----------

export const REVISION_MARKER = '<!-- ghosty-dev:revision v0.1';
const OPEN_FINDINGS = /hallazgos abiertos:\s*(\d+)/i;

// Valida el cuerpo que publica el revisor. Regresa { ok, errors, open }.
export function validateRevision(md) {
  const errors = [];
  const s = parseSections(md);
  const body = section(s, 'revision');
  if (body === null) return { ok: false, errors: ['Falta la sección «Revisión».'], open: null };
  const blocks = [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const lines = blocks.join('\n').split('\n').filter((l) => l.trim());
  const commands = lines.filter((l) => l.trimStart().startsWith('$ '));
  if (commands.length === 0) errors.push('«Revisión» necesita un bloque con las pruebas que corriste («$ …») y su salida.');
  else if (lines.length === commands.length) errors.push('«Revisión» trae comandos pero no su salida.');
  const attacks = parseChecklist(body);
  if (attacks.length === 0) errors.push('«Revisión» necesita la lista de ataques: «- [x] aguantó …» o «- [ ] lo rompió …».');
  const m = body.match(OPEN_FINDINGS);
  if (!m) errors.push('Falta el renglón «Hallazgos abiertos: N».');
  const open = m ? Number(m[1]) : null;
  const failed = attacks.filter((a) => !a.done).length;
  if (m && open !== failed) errors.push(`«Hallazgos abiertos: ${open}» no cuadra con ${failed} ataque(s) sin palomear.`);
  return { ok: errors.length === 0, errors, open };
}

export function formatRevision(number, sha, md, pr = null) {
  const prPart = pr?.url ? ` · PR: ${pr.url}` : '';
  return `${REVISION_MARKER} sha=${sha} -->\n**Revisión del pendiente #${number}, commit ${sha.slice(0, 7)}**${prPart}\n\n${md.trim()}\n`;
}

// La última revisión válida del commit exacto (o null). Un push nuevo invalida las anteriores.
export function findRevisionFor(comments = [], sha) {
  for (const c of [...comments].reverse()) {
    const body = c.body || '';
    const m = body.match(/<!-- ghosty-dev:revision v0\.1 sha=([0-9a-f]{7,40}) -->/);
    if (!m || !sha || !(sha.startsWith(m[1]) || m[1].startsWith(sha))) continue;
    const r = validateRevision(body);
    if (r.ok) return { comment: c, open: r.open };
  }
  return null;
}
