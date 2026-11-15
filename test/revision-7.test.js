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

const url = (p) => `http://localhost:${port}${p}`;

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

// Arranca un comando y dice si llegó a escuchar
function start(cmd, args, cwd, env = {}) {
  return new Promise((resolve) => {
    // detached: el hijo encabeza su propio grupo de procesos, así se puede matar completo
    const child = spawn(cmd, args, { cwd, detached: true, env: { ...process.env, PORT: '0', ...env } });
    let out = '';
    let done = false;
    // Mata el grupo entero: en Linux, matar sólo a npm deja vivo al node server.js que lanzó
    const finish = (r) => {
      if (done) return;
      done = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      child.stdout.destroy();
      child.stderr.destroy();
      resolve(r);
    };
    child.stdout.on('data', (c) => {
      out += c;
      if (/Escuchando/.test(out)) finish({ listened: true, out });
    });
    child.stderr.on('data', (c) => (out += c));
    child.on('exit', (code) => finish({ listened: /Escuchando/.test(out), code, out }));
    setTimeout(() => finish({ listened: /Escuchando/.test(out), out }), 5000);
  });
}

function withSymlink(fn) {
  const link = path.join(os.tmpdir(), `rev7-link-${process.pid}-${Math.random().toString(36).slice(2)}`);
  fs.symlinkSync(root, link);
  return fn(link).finally(() => fs.unlinkSync(link));
}

test('query string no rompe /health', async () => {
  const res = await fetch(url('/health?x=1'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('el cuerpo es exactamente {"ok":true}', async () => {
  const res = await fetch(url('/health'));
  assert.equal(await res.text(), '{"ok":true}');
});

test('POST /health no responde 200', async () => {
  const res = await fetch(url('/health'), { method: 'POST', body: 'x'.repeat(100000) });
  assert.notEqual(res.status, 200);
});

test('ruta larguísima no tumba el servidor', async () => {
  const res = await fetch(url(`/${'a'.repeat(8000)}`));
  assert.equal(res.status, 404);
});

test('request-target malformado (http://[) no tumba el proceso y responde 4xx', async () => {
  const line = await raw('GET http://[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
  assert.match(line, /^HTTP\/1\.1 4\d\d/);
  const res = await fetch(url('/health'));
  assert.equal(res.status, 200);
});

test('nombres de propiedades de Object en la ruta no rompen el lookup', async () => {
  for (const p of ['/__proto__', '/constructor', '/toString']) {
    const res = await fetch(url(p));
    assert.equal(res.status, 404, p);
  }
});

test('ráfaga de 200 peticiones concurrentes', async () => {
  const all = await Promise.all(Array.from({ length: 200 }, () => fetch(url('/health')).then((r) => r.status)));
  assert.ok(all.every((s) => s === 200));
});

test('HEAD /health responde 200 (RFC 9110: todo servidor soporta GET y HEAD)', async () => {
  const res = await fetch(url('/health'), { method: 'HEAD' });
  assert.equal(res.status, 200);
});

test('npm start arranca y escucha', async () => {
  const r = await start('npm', ['start'], root);
  assert.ok(r.listened, r.out);
});

test('npm start arranca desde una ruta con symlink', () =>
  withSymlink(async (link) => {
    const r = await start('npm', ['start'], link);
    assert.ok(r.listened, `no escuchó; salida: ${r.out}`);
  }));

test('node <symlink>/server.js arranca (despliegues con carpeta current -> release)', () =>
  withSymlink(async (link) => {
    const r = await start(process.execPath, [path.join(link, 'server.js')], os.tmpdir());
    assert.ok(r.listened, `no escuchó; código de salida ${r.code}; salida: ${JSON.stringify(r.out)}`);
  }));

test('PORT inválido falla rápido con código distinto de 0', async () => {
  const r = await start(process.execPath, ['server.js'], root, { PORT: '99999' });
  assert.equal(r.listened, false);
  assert.notEqual(r.code, 0);
});

// --- Segunda revisión (contexto limpio) ---

// Ocupa el 3000 mientras corre fn, para simular un dev server ya abierto
function with3000Busy(fn) {
  return new Promise((resolve, reject) => {
    const blocker = net.createServer();
    blocker.once('error', () => fn().then(resolve, reject)); // ya estaba ocupado
    blocker.listen(3000, () => fn().finally(() => blocker.close()).then(resolve, reject));
  });
}

test('PORT=0 pide un puerto libre al sistema (no cae al 3000)', () =>
  with3000Busy(async () => {
    const r = await start(process.execPath, ['server.js'], root, { PORT: '0' });
    assert.ok(r.listened, `no escuchó con PORT=0; salida: ${JSON.stringify(r.out.slice(0, 120))}`);
    assert.doesNotMatch(r.out, /:3000\b/);
  }));

test('HEAD /health no manda cuerpo', async () => {
  const line = await new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1', () =>
      sock.write('HEAD /health HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    let d = '';
    sock.on('data', (c) => (d += c));
    sock.on('end', () => resolve(d));
  });
  assert.match(line, /^HTTP\/1\.1 200/);
  assert.equal(line.split('\r\n\r\n')[1], '');
});

test('absolute-form se comportan', async () => {
  assert.match(await raw('GET http://otro/health HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'), / 200 /);
  assert.match(await raw('GET //health HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'), / 404 /);
  assert.match(await raw('OPTIONS * HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'), / 404 /);
});

test('CONNECT y Upgrade no tumban el servidor', async () => {
  await raw('CONNECT a:443 HTTP/1.1\r\nHost: a:443\r\n\r\n');
  await raw('GET /health HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  const res = await fetch(url('/health'));
  assert.equal(res.status, 200);
});

test('cliente que corta a media petición no tumba el servidor', async () => {
  await new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write('POST /health HTTP/1.1\r\nHost: x\r\nContent-Length: 1000000\r\n\r\nabc');
      setTimeout(() => { sock.destroy(); resolve(); }, 50);
    });
  });
  const res = await fetch(url('/health'));
  assert.equal(res.status, 200);
});
