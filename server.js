import http from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Rutas del servidor: cada una regresa [status, cuerpo JSON]
const routes = {
  'GET /health': () => [200, { ok: true }],
};

export function createServer() {
  return http.createServer((req, res) => {
    let path;
    try {
      path = new URL(req.url, 'http://localhost').pathname;
    } catch {
      // Una URL malformada no debe tumbar el proceso: se responde 400
      path = null;
    }
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

// Sólo escucha si se corre directo (npm start), no al importarlo en los tests.
// Se comparan rutas reales para que funcione desde un symlink (current -> release)
const isMain = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) {
  // PORT=0 es válido (puerto libre que asigna el sistema); sólo sin PORT se usa el 3000
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  createServer().listen(port, () => console.log(`Escuchando en http://localhost:${port}`));
}
