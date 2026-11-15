import { readFileSync } from 'node:fs';

// Lee la versión del package.json que está junto a este archivo (no depende del cwd).
// Si falta o está mal formado, lanza un error con un mensaje que se entiende solo.
// Es .mjs para que Node no tenga que leer package.json antes de correrlo.
export function readVersion(pkgUrl = new URL('./package.json', import.meta.url)) {
  let text;
  try {
    text = readFileSync(pkgUrl, 'utf8');
  } catch {
    throw new Error(`No encuentro package.json en ${pkgUrl.pathname}`);
  }
  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch {
    throw new Error(`package.json está mal formado (${pkgUrl.pathname})`);
  }
  if (typeof pkg.version !== 'string') throw new Error('package.json no tiene un campo "version"');
  return pkg.version;
}
