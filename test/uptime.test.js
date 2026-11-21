import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../app.js';

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('GET /uptime responde 200 con {seconds} entero mayor o igual a 0', async () => {
  const res = await fetch(`${base}/uptime`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const body = await res.json();
  assert.deepEqual(Object.keys(body), ['seconds']);
  assert.ok(Number.isInteger(body.seconds));
  assert.ok(body.seconds >= 0);
});
