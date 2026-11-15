import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../app.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

// Corre node con args; regresa si llegó a escuchar, el código de salida y lo que imprimió.
// Mata el grupo de procesos completo para no dejar huérfanos.
function run(args, { cwd = root, env = {}, cmd = process.execPath } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, detached: true, env: { ...process.env, PORT: '0', ...env } });
    let out = '';
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({ out, ...r });
    };
    child.stdout.on('data', (c) => { out += c; if (/Escuchando/.test(out)) finish({ listened: true }); });
    child.stderr.on('data', (c) => (out += c));
    child.on('exit', (code) => finish({ listened: false, code }));
    setTimeout(() => finish({ listened: false, code: null }), 5000);
  });
}

// Falla limpia: no escucha, código distinto de 0, mensaje «Error: …» y sin stack de Node
function assertCleanFailure(r, pattern) {
  assert.equal(r.listened, false, r.out);
  assert.ok(r.code !== 0 && r.code !== null, `código ${r.code}: ${r.out}`);
  assert.match(r.out, pattern);
  assert.doesNotMatch(r.out, /\n\s+at |RangeError|node:internal/, r.out);
}

test('HEAD /health responde 200 sin cuerpo', async () => {
  const res = await fetch(`${base}/health`, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');
});

test('/health/ con barra final responde igual que /health', async () => {
  const a = await fetch(`${base}/health`);
  const b = await fetch(`${base}/health/`);
  assert.equal(b.status, a.status);
  assert.deepEqual(await b.json(), await a.json());
  assert.equal((await fetch(`${base}/version/`)).status, 200);
});

test('PORT=99999 termina con un mensaje claro, sin RangeError', async () => {
  assertCleanFailure(await run(['server.js'], { env: { PORT: '99999' } }), /Error: PORT debe ser un número de 0 a 65535/);
});

test('PORT=abc termina con un mensaje claro y código distinto de 0', async () => {
  assertCleanFailure(await run(['server.js'], { env: { PORT: 'abc' } }), /Error: PORT debe ser un número de 0 a 65535/);
});

test('puerto ocupado termina con un mensaje claro, sin el stack de EADDRINUSE', async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(0, resolve));
  try {
    const r = await run(['server.js'], { env: { PORT: String(blocker.address().port) } });
    assertCleanFailure(r, /Error: el puerto \d+ ya está ocupado/);
  } finally {
    blocker.close();
  }
});

// Copia app.js y server.js a una carpeta temporal con el package.json que se le pase (o ninguno)
function withCopy(pkgText, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd11-'));
  fs.copyFileSync(path.join(root, 'app.js'), path.join(dir, 'app.js'));
  fs.copyFileSync(path.join(root, 'server.js'), path.join(dir, 'server.js'));
  if (pkgText !== null) fs.writeFileSync(path.join(dir, 'package.json'), pkgText);
  return fn(dir).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

test('sin package.json termina con un mensaje claro', () =>
  withCopy(null, async (dir) => {
    // type: module viene del package.json que falta, así que se fuerza ESM por flag
    assertCleanFailure(await run(['--experimental-default-type=module', 'server.js'], { cwd: dir }), /Error: No encuentro package.json/);
  }));

// Con el JSON roto, Node y npm leen package.json antes que nuestro código: el arranque documentado
// (npm start) es el que debe dar el mensaje claro
test('package.json mal formado: npm start termina con un mensaje claro', () =>
  withCopy('{"type":"module", "scripts": {"start": "node server.js"}, "version": ', async (dir) => {
    assertCleanFailure(await run(['start'], { cwd: dir, cmd: 'npm' }), /Invalid package\.json/);
  }));

test('package.json válido pero sin "version" termina con un mensaje claro', () =>
  withCopy('{"type":"module"}', async (dir) => {
    assertCleanFailure(await run(['server.js'], { cwd: dir }), /Error: package\.json no tiene un campo "version"/);
  }));

test('node server (sin .js) arranca y escucha', async () => {
  const r = await run(['server']);
  assert.ok(r.listened, `código ${r.code}: ${r.out}`);
});

test('el README dice qué responde una URL mal formada y package.json declara engines node >=20', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /URL mal formada\s+responde 400/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.engines?.node, '>=20');
});
