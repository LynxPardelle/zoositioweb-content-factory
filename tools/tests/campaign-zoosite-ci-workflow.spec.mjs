import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../../.github/workflows/ci.yml', import.meta.url);

test('CI checkout fetches complete history for repository scanning', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.match(
    workflow,
    /uses: actions\/checkout@[0-9a-f]+[\s\S]*?with:\s*[\s\S]*?fetch-depth: 0/,
  );
});

test('CI runs Gitleaks from the approved immutable action revision', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.match(
    workflow,
    /^\s+uses:\s+gitleaks\/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7\s*$/m,
  );
});

test('CI grants read-only PR metadata and scans only after exact validation', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.match(workflow, /^permissions:\n  contents: read\n  pull-requests: read$/m);
  assert.ok(
    workflow.indexOf('Verify exact clean commit') < workflow.indexOf('Scan repository history for secrets'),
  );
  assert.ok(
    workflow.indexOf('Test and validate campaign') < workflow.indexOf('Scan repository history for secrets'),
  );
});
