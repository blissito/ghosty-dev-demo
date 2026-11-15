import http from 'node:http';
import { readFileSync } from 'node:fs';

// Lee la versión del package.json que está junto a este archivo (no depende del cwd).
// Si falta o está mal formado, lanza un error con un mensaje que se entiende solo.
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

export function createServer({ version = readVersion() } = {}) {
  // Rutas del servidor: cada una regresa [status, cuerpo JSON]
  const routes = {
    'GET /health': () => [200, { ok: true }],
    'GET /version': () => [200, { version }],
  };

  return http.createServer((req, res) => {
    let path;
    try {
      path = new URL(req.url, 'http://localhost').pathname;
    } catch {
      // Una URL malformada no debe tumbar el proceso: se responde 400
      path = null;
    }
    // Barra final opcional: /health/ es lo mismo que /health
    if (path && path.length > 1) path = path.replace(/\/+$/, '') || '/';
    // HEAD usa la misma ruta que GET; Node omite el cuerpo en respuestas a HEAD
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    const key = `${method} ${path}`;
    const handler = path !== null && Object.hasOwn(routes, key) && routes[key];
    const [status, body] =
      path === null ? [400, { error: 'bad request' }] : handler ? handler() : [404, { error: 'not found' }];
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
}
