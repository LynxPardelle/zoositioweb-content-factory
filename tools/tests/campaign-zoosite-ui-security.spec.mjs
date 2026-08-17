import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_PATH = path.join(REPO_ROOT, 'tools/serve-ui.mjs');

test('UI server rejects a non-loopback HOST before listening', async () => {
  const child = spawnUiServer({ HOST: '0.0.0.0', PORT: '0' });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });

  const exit = new Promise(resolve => {
    child.once('exit', code => resolve({ kind: 'exit', code }));
  });
  const started = waitForText(child.stdout, 'UI running at').then(() => ({ kind: 'started' }));

  try {
    const outcome = await raceWithTimeout([exit, started], 3_000);
    assert.equal(outcome.kind, 'exit', 'non-loopback HOST started an HTTP listener');
    assert.notEqual(outcome.code, 0);
    assert.match(stderr, /loopback/i);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await exit;
    }
  }
});

test('UI server returns a generic HTTP 500 without internal exception details', async () => {
  const child = spawnUiServer({ HOST: '127.0.0.1', PORT: '0' });
  const exit = new Promise(resolve => {
    child.once('exit', code => resolve({ kind: 'exit', code }));
  });
  const started = waitForText(child.stdout, 'UI running at').then(output => ({
    kind: 'started',
    output,
  }));

  try {
    const outcome = await raceWithTimeout([exit, started], 3_000);
    assert.equal(outcome.kind, 'started', `UI server exited before listening (code ${outcome.code})`);
    const port = Number(/127\.0\.0\.1:(\d+)\//.exec(outcome.output)?.[1]);
    assert.ok(Number.isInteger(port) && port > 0, `could not read UI port from: ${outcome.output}`);

    const response = await requestPath(port, '/%');
    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(response.body), { error: 'Internal server error' });
    assert.doesNotMatch(response.body, /URI malformed/i);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await exit;
    }
  }
});

test('UI server serves requests on the IPv6 loopback address', async () => {
  const child = spawnUiServer({ HOST: '::1', PORT: '0' });
  const exit = new Promise(resolve => {
    child.once('exit', code => resolve({ kind: 'exit', code }));
  });
  const started = waitForText(child.stdout, 'UI running at').then(output => ({
    kind: 'started',
    output,
  }));

  try {
    const outcome = await raceWithTimeout([exit, started], 3_000);
    assert.equal(outcome.kind, 'started', `IPv6 UI server exited before listening (code ${outcome.code})`);
    const port = Number(/:(\d+)\/$/.exec(outcome.output.trim())?.[1]);
    assert.ok(Number.isInteger(port) && port > 0, `could not read UI port from: ${outcome.output}`);

    const response = await requestPath(port, '/', '::1');
    assert.equal(response.status, 200);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await exit;
    }
  }
});

function spawnUiServer(env) {
  return spawn(process.execPath, [SERVER_PATH], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function waitForText(stream, expected) {
  stream.setEncoding('utf8');
  return new Promise(resolve => {
    let output = '';
    stream.on('data', chunk => {
      output += chunk;
      if (output.includes(expected)) {
        resolve(output);
      }
    });
  });
}

function requestPath(port, requestPath, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const clientRequest = request({
      host,
      port,
      path: requestPath,
      method: 'GET',
    }, response => {
      response.setEncoding('utf8');
      let body = '';
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    clientRequest.once('error', reject);
    clientRequest.end();
  });
}

async function raceWithTimeout(promises, milliseconds) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), milliseconds);
  });

  try {
    return await Promise.race([...promises, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
