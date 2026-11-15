import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

test('GET /health responde 200 y {"ok":true}', async () => {
  const server = createApp().listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://localhost:${port}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  } finally {
    server.close();
  }
});
