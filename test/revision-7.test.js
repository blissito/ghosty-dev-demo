import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let server;
let port;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Manda una petición cruda por socket y regresa la primera línea de la respuesta
function raw(request) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => sock.write(request));
    let data = '';
    sock.on('data', (c) => (data += c));
    sock.on('end', () => resolve(data.split('\r\n')[0]));
    sock.on('error', reject);
    sock.setTimeout(2000, () => { sock.destroy(); resolve(data.split('\r\n')[0]); });
  });
}

test('query string no rompe /health', async () => {
  const res = await fetch(`http://localhost:${port}/health?x=1`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('POST /health no responde el cuerpo de health', async () => {
  const res = await fetch(`http://localhost:${port}/health`, { method: 'POST' });
  assert.notEqual(res.status, 200);
});

test('ruta larguísima no tumba el servidor', async () => {
  const res = await fetch(`http://localhost:${port}/${'a'.repeat(8000)}`);
  assert.equal(res.status, 404);
});

test('request-target malformado (http://[) no tumba el proceso y responde 4xx', async () => {
  const line = await raw('GET http://[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
  assert.match(line, /^HTTP\/1\.1 4\d\d/);
  // y el servidor sigue vivo
  const res = await fetch(`http://localhost:${port}/health`);
  assert.equal(res.status, 200);
});

function startVia(cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn('npm', ['start'], { cwd, env: { ...process.env, PORT: '0', ...env } });
    let out = '';
    child.stdout.on('data', (c) => {
      out += c;
      if (/Escuchando/.test(out)) { child.kill(); resolve({ listened: true, out }); }
    });
    child.stderr.on('data', (c) => (out += c));
    child.on('exit', (code) => resolve({ listened: /Escuchando/.test(out), code, out }));
    setTimeout(() => { child.kill(); resolve({ listened: /Escuchando/.test(out), out }); }, 5000);
  });
}

test('npm start arranca y escucha', async () => {
  const r = await startVia(root);
  assert.ok(r.listened, r.out);
});

test('npm start arranca desde una ruta con symlink', async () => {
  const link = path.join(os.tmpdir(), `rev7-link-${process.pid}`);
  fs.symlinkSync(root, link);
  try {
    const r = await startVia(link);
    assert.ok(r.listened, `no escuchó; salida: ${r.out}`);
  } finally {
    fs.unlinkSync(link);
  }
});
