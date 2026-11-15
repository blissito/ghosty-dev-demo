import http from 'node:http';
import { fileURLToPath } from 'node:url';

// Rutas del servidor: cada una regresa [status, cuerpo JSON]
const routes = {
  'GET /health': () => [200, { ok: true }],
};

export function createServer() {
  return http.createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const handler = routes[`${req.method} ${path}`];
    const [status, body] = handler ? handler() : [404, { error: 'not found' }];
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
}

// Sólo escucha si se corre directo (npm start), no al importarlo en los tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`Escuchando en http://localhost:${port}`));
}
