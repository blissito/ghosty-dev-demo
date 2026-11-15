import { createServer } from 'node:http';

// Rutas del servidor: cada una regresa [status, cuerpo JSON]
const routes = {
  'GET /health': () => [200, { ok: true }],
};

export function createApp() {
  return createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const handler = routes[`${req.method} ${path}`];
    const [status, body] = handler ? handler() : [404, { error: 'not found' }];
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
}

// Sólo escucha cuando se corre directo (npm start), no cuando lo importa un test
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`Escuchando en http://localhost:${port}`));
}
