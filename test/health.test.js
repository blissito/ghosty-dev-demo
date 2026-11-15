import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('GET /health responde 200 con {"ok":true}', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await res.json(), { ok: true });
});

test('una ruta desconocida responde 404', async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
});
