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

test('GET /hello?name=Ana responde 200 con {"hello":"Ana"}', async () => {
  const res = await fetch(`${base}/hello?name=Ana`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(await res.text(), '{"hello":"Ana"}');
});

test('GET /hello sin name responde 200 con {"hello":"mundo"}', async () => {
  const res = await fetch(`${base}/hello`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '{"hello":"mundo"}');
});
