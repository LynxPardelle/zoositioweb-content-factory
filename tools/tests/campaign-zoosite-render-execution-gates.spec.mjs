import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { renderPilotVideoWithMpt } from '../campaigns/zoositioweb/render-pilot-video-mpt.mjs';
import { renderPilotVideo } from '../campaigns/zoositioweb/render-pilot-video.mjs';
import { synthesizePollyAudio } from '../campaigns/zoositioweb/synthesize-polly-audio.mjs';

test('standard renderer rejects pending approval before FFmpeg or output writes', async () => {
  const fixture = await pendingPilotFixture();
  const outputDir = path.join(fixture.root, 'renders');

  try {
    await withNoExecutablePath(() => assert.rejects(renderPilotVideo({
      pilotDir: fixture.pilotDir,
      audioDir: path.join(fixture.root, 'audio'),
      outputDir,
      renderId: fixture.renderId,
    }), /final human approval/i));
    assert.equal(existsSync(outputDir), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('Polly execute rejects pending approval before AWS or output writes', async () => {
  const fixture = await pendingPilotFixture();
  const outputDir = path.join(fixture.root, 'polly');

  try {
    await withNoExecutablePath(() => assert.rejects(synthesizePollyAudio({
      execute: true,
      pilotDir: fixture.pilotDir,
      outputDir,
      renderId: fixture.renderId,
    }), /final human approval/i));
    assert.equal(existsSync(outputDir), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('MPT renderer rejects pending approval before checkout or media processes', async () => {
  const fixture = await pendingPilotFixture();
  const mptRoot = path.join(fixture.root, 'mpt');
  const pythonPath = path.join(mptRoot, 'python.exe');
  const outputDir = path.join(fixture.root, 'mpt-renders');
  await mkdir(mptRoot);
  await writeFile(pythonPath, 'not executable');

  try {
    await withNoExecutablePath(() => assert.rejects(renderPilotVideoWithMpt({
      pilotDir: fixture.pilotDir,
      audioDir: path.join(fixture.root, 'audio'),
      outputDir,
      renderId: fixture.renderId,
      mptRoot,
      pythonPath,
    }), /final human approval/i));
    assert.equal(existsSync(outputDir), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('standard renderer verifies selected asset bytes before FFmpeg', async () => {
  const fixture = await pendingPilotFixture({ approved: true, recordedSha256: '0'.repeat(64) });
  const outputDir = path.join(fixture.root, 'renders');

  try {
    await withNoExecutablePath(() => assert.rejects(renderPilotVideo({
      pilotDir: fixture.pilotDir,
      audioDir: path.join(fixture.root, 'audio'),
      outputDir,
      renderId: fixture.renderId,
    }), /SHA-256 mismatch/i));
    assert.equal(existsSync(outputDir), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('MPT renderer verifies selected asset bytes before checkout or media processes', async () => {
  const fixture = await pendingPilotFixture({ approved: true, recordedSha256: '0'.repeat(64) });
  const mptRoot = path.join(fixture.root, 'mpt');
  const pythonPath = path.join(mptRoot, 'python.exe');
  const outputDir = path.join(fixture.root, 'mpt-renders');
  await mkdir(mptRoot);
  await writeFile(pythonPath, 'not executable');

  try {
    await withNoExecutablePath(() => assert.rejects(renderPilotVideoWithMpt({
      pilotDir: fixture.pilotDir,
      audioDir: path.join(fixture.root, 'audio'),
      outputDir,
      renderId: fixture.renderId,
      mptRoot,
      pythonPath,
    }), /SHA-256 mismatch/i));
    assert.equal(existsSync(outputDir), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('MPT renderer fails closed when no immutable source review is approved', async () => {
  const fixture = await pendingPilotFixture({ approved: true });
  const mptRoot = path.join(fixture.root, 'mpt');
  const pythonPath = path.join(mptRoot, 'python.exe');
  const outputDir = path.join(fixture.root, 'mpt-renders');
  await mkdir(mptRoot);
  await writeFile(pythonPath, 'not executable');

  try {
    await withNoExecutablePath(() => assert.rejects(renderPilotVideoWithMpt({
      pilotDir: fixture.pilotDir,
      audioDir: path.join(fixture.root, 'audio'),
      outputDir,
      renderId: fixture.renderId,
      mptRoot,
      pythonPath,
    }), /no immutable MoneyPrinterTurbo source is approved/i));
    assert.equal(existsSync(outputDir), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function pendingPilotFixture({ approved = false, recordedSha256 } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'zoosite-pending-pilot-'));
  const pilotDir = path.join(root, 'pilot');
  const selectedAssetsDir = path.join(pilotDir, 'selected-assets');
  const assetPath = path.join(selectedAssetsDir, 'asset.mp4');
  const assetBytes = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
  const assetSha256 = createHash('sha256').update(assetBytes).digest('hex');
  const renderId = 'render-servicios-locales-001';
  await mkdir(selectedAssetsDir, { recursive: true });
  await writeFile(assetPath, assetBytes);

  const render = approved
    ? {
        id: renderId,
        scriptId: 'script-servicios-locales-001',
        status: 'approved',
        humanApprovalRequired: true,
        humanApprovalStatus: 'approved',
        humanApprovalBy: 'Campaign approver',
        humanApprovalAt: '2026-08-17T18:00:00.000Z',
        assetLicenseStatus: 'verified',
        assetLicenseVerifiedBy: 'License reviewer',
        assetLicenseVerifiedAt: '2026-08-17T18:05:00.000Z',
        approvedAssetId: 'asset-render-servicios-locales-001',
      }
    : {
        id: renderId,
        scriptId: 'script-servicios-locales-001',
        status: 'needs-review',
        humanApprovalRequired: true,
        humanApprovalStatus: 'pending',
        assetLicenseStatus: 'pending-local-asset-selection',
      };

  await Promise.all([
    writeJson(path.join(pilotDir, 'sectors.json'), { sectors: [] }),
    writeJson(path.join(pilotDir, 'approved-claims.json'), { claims: [] }),
    writeJsonl(path.join(pilotDir, 'scripts.jsonl'), [{
      id: 'script-servicios-locales-001',
      hook: 'Hook',
      bodyLines: ['Body'],
      cta: 'CTA',
      title: 'Title',
    }]),
    writeJsonl(path.join(pilotDir, 'render-queue.jsonl'), [render]),
    writeJsonl(path.join(pilotDir, 'asset-picks.jsonl'), [{
      id: 'asset-render-servicios-locales-001',
      renderId,
      status: 'selected',
      mediaType: 'video',
      localFilePath: assetPath,
      byteLength: assetBytes.length,
      contentType: 'video/mp4',
      sha256: recordedSha256 || assetSha256,
    }]),
    ...['ideas.jsonl', 'knowledge-cards.jsonl', 'qa-decisions.jsonl', 'publish-log.jsonl', 'blog-backlog.jsonl']
      .map(file => writeFile(path.join(pilotDir, file), '', 'utf8')),
  ]);

  return { root, pilotDir, renderId };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

async function writeJsonl(filePath, values) {
  await writeFile(filePath, `${values.map(value => JSON.stringify(value)).join('\n')}\n`, 'utf8');
}

async function withNoExecutablePath(operation) {
  const originalPath = process.env.PATH;
  process.env.PATH = '';

  try {
    return await operation();
  } finally {
    process.env.PATH = originalPath;
  }
}
