import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Arranca server.mjs desde una copia del proyecto y regresa {proc, base} cuando ya escucha
function start(dir) {
  const proc = spawn(process.execPath, ['server.mjs'], { cwd: dir, env: { ...process.env, PORT: '0' } });
  return new Promise((resolve, reject) => {
    let out = '';
    proc.stdout.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/http:\/\/localhost:(\d+)/);
      if (m) resolve({ proc, base: `http://localhost:${m[1]}` });
    });
    proc.on('error', reject);
    proc.on('exit', (code) => reject(new Error(`el servidor terminó con código ${code}`)));
  });
}

function stop(proc) {
  return new Promise((resolve) => {
    proc.removeAllListeners('exit');
    proc.on('exit', resolve);
    proc.kill();
  });
}

test('al cambiar version en package.json y reiniciar, GET /version devuelve el valor nuevo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-restart-'));
  try {
    for (const file of ['app.js', 'server.mjs', 'version.mjs', 'package.json']) {
      copyFileSync(new URL(`../${file}`, import.meta.url), join(dir, file));
    }
    const pkgPath = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    let { proc, base } = await start(dir);
    assert.deepEqual(await (await fetch(`${base}/version`)).json(), { version: pkg.version });
    await stop(proc);

    // Versión distinta a la actual, armada en el momento para no escribirla a mano
    const next = `${pkg.version}-restart.${Date.now()}`;
    writeFileSync(pkgPath, JSON.stringify({ ...pkg, version: next }, null, 2));

    ({ proc, base } = await start(dir));
    assert.deepEqual(await (await fetch(`${base}/version`)).json(), { version: next });
    await stop(proc);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
