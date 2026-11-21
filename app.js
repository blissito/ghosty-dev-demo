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
    // Saluda a ?name=X; sin name, saluda al mundo
    'GET /hello': (url) => [200, { hello: url.searchParams.get('name') ?? 'mundo' }],
    // Devuelve el valor de ?msg= tal cual (ya decodificado); sin msg, 400
    'GET /echo': (url) =>
      url.searchParams.has('msg')
        ? [200, { echo: url.searchParams.get('msg') }]
        : [400, { error: 'falta msg' }],
  };

  return http.createServer((req, res) => {
    let path;
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
      path = url.pathname;
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
      path === null ? [400, { error: 'bad request' }] : handler ? handler(url) : [404, { error: 'not found' }];
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
}
