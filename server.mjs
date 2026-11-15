// Arranque del servidor (npm start, node server.mjs; node server.js y node server pasan por aquí).
// Es .mjs para que Node no lea package.json antes de este código: así un package.json mal formado
// termina con un mensaje claro. app.js (.js) se importa hasta después de validar package.json.
import { readVersion } from './version.mjs';

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

const { createServer } = await import('./app.js');
const server = createServer({ version });
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') fail(`el puerto ${port} ya está ocupado; usa otro con PORT=<n>`);
  if (err.code === 'EACCES') fail(`no hay permiso para escuchar en el puerto ${port}`);
  fail(err.message);
});
server.listen(port, () => console.log(`Escuchando en http://localhost:${server.address().port}`));
