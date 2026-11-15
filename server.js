// Arranque del servidor (npm start, node server.js o node server).
// La lógica vive en app.js; aquí sólo se valida la configuración y se escucha.
import { createServer, readVersion } from './app.js';

// Termina con un mensaje claro y código 1, sin stack
function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// PORT vacío o ausente → 3000; si viene, debe ser un entero de 0 a 65535 (0 = puerto libre del sistema)
function parsePort(raw) {
  if (raw === undefined || raw === '') return 3000;
  if (!/^\d+$/.test(raw) || Number(raw) > 65535) fail(`PORT debe ser un número de 0 a 65535 (llegó "${raw}")`);
  return Number(raw);
}

const port = parsePort(process.env.PORT);
let version;
try {
  version = readVersion();
} catch (err) {
  fail(err.message);
}

const server = createServer({ version });
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') fail(`el puerto ${port} ya está ocupado; usa otro con PORT=<n>`);
  if (err.code === 'EACCES') fail(`no hay permiso para escuchar en el puerto ${port}`);
  fail(err.message);
});
server.listen(port, () => console.log(`Escuchando en http://localhost:${server.address().port}`));
