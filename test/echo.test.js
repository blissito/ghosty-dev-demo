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

test('GET /echo?msg=hola responde 200 con {"echo":"hola"}', async () => {
  const res = await fetch(`${base}/echo?msg=hola`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(await res.text(), '{"echo":"hola"}');
});

test('GET /echo sin msg responde 400', async () => {
  const res = await fetch(`${base}/echo`);
  assert.equal(res.status, 400);
});

test('GET /echo?msg=hola%20mundo devuelve el valor decodificado', async () => {
  const res = await fetch(`${base}/echo?msg=hola%20mundo`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { echo: 'hola mundo' });
});

test('GET /echo?msg=a%26b%3Dc devuelve a&b=c íntegro', async () => {
  const res = await fetch(`${base}/echo?msg=a%26b%3Dc`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { echo: 'a&b=c' });
});
