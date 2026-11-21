import http from 'node:http';
import { readVersion } from './version.mjs';

export { readVersion };

export function createServer({ version = readVersion() } = {}) {
  // Rutas del servidor: cada una regresa [status, cuerpo JSON]
  const routes = {
    'GET /health': () => [200, { ok: true }],
    'GET /version': () => [200, { version }],
    // Segundos enteros desde que arrancó el proceso
    'GET /uptime': () => [200, { seconds: Math.floor(process.uptime()) }],
    // Ruta mínima para comprobar que el servidor contesta
    'GET /ping': () => [200, { pong: true }],
    // Hora del servidor en ISO 8601 (UTC), para comprobar su reloj desde fuera
    'GET /time': () => [200, { now: new Date().toISOString() }],
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
