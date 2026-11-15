import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from '../server.js';

// La versión esperada se lee del mismo package.json, no se escribe a mano en el test
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('GET /version responde 200 con la versión de package.json', async () => {
  const res = await fetch(`${base}/version`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await res.json(), { version: pkg.version });
});

test('server.js no trae la versión escrita a mano', () => {
  const src = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(!src.includes(pkg.version), `server.js contiene "${pkg.version}"`);
});
