// Formato y validación del comentario de evidencia (Ley 2: se revisa la evidencia, no el código).
// Archivo autocontenido: `ghosty-dev init` lo copia a .github/ghosty-dev/ para que lo use la Action.

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
  return [...text.matchAll(/^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/gm)].map((m) => ({
    done: m[1] !== ' ',
    text: m[2],
  }));
}

export function acceptanceCriteria(issueBody = '') {
  return parseChecklist(section(parseSections(issueBody), 'criterios'));
}

const CI_GREEN = /✅|\bverde\b|\bpass(ed|ing)?\b|\bsuccess\b/i;
const CI_RED = /❌|\brojo\b|\bfail(ed|ing|ure)?\b/i;

// Valida el cuerpo de una evidencia contra el pendiente. Regresa { ok, errors }.
export function validateEvidence(md, issueBody = '') {
  const errors = [];
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

  const ci = section(s, 'ci');
  if (!ci) errors.push('Falta «CI» (resultado y liga del run).');
  else if (CI_RED.test(ci)) errors.push('El CI está en rojo: no se cierra un pendiente con CI rojo.');
  else if (!CI_GREEN.test(ci)) errors.push('«CI» debe decir el resultado (✅ / verde / passed).');

  // Cada criterio de aceptación del pendiente debe venir marcado en la evidencia.
  const wanted = acceptanceCriteria(issueBody);
  if (wanted.length) {
    const given = parseChecklist(section(s, 'criterios'));
    for (const c of wanted) {
      const hit = given.find((g) => norm(g.text) === norm(c.text));
      if (!hit || !hit.done) errors.push(`Criterio sin cumplir en la evidencia: «${c.text}».`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// Arma el comentario que se publica en el issue.
export function formatEvidence(number, md) {
  return `${EVIDENCE_MARKER}\n## Evidencia del pendiente #${number}\n\n${md.trim()}\n`;
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
