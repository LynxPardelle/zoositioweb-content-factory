import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertRenderReady,
  verifySelectedAssetFile,
} from '../campaigns/zoositioweb/render-safety.mjs';

test('render safety module exposes the fail-closed approval gate', async () => {
  const module = await import('../campaigns/zoositioweb/render-safety.mjs').catch(() => ({}));

  assert.equal(typeof module.assertRenderReady, 'function');
});

test('render safety module exposes selected-asset verification', async () => {
  const module = await import('../campaigns/zoositioweb/render-safety.mjs');

  assert.equal(typeof module.verifySelectedAssetFile, 'function');
});

test('assertRenderReady rejects the current pending queue before execution', () => {
  assert.throws(() => assertRenderReady({
    render: pendingRender(),
    asset: selectedAsset(),
  }), /final human approval/i);
});

test('assertRenderReady accepts only audited terminal states tied to the selected asset', () => {
  assert.doesNotThrow(() => assertRenderReady({
    render: approvedRender(),
    asset: selectedAsset(),
  }));

  assert.throws(() => assertRenderReady({
    render: approvedRender({ approvedAssetId: 'asset-other' }),
    asset: selectedAsset(),
  }), /approved asset/i);

  assert.throws(() => assertRenderReady({
    render: approvedRender({ humanApprovalBy: '' }),
    asset: selectedAsset(),
  }), /auditable human approval/i);
});

test('verifySelectedAssetFile verifies containment, byte length, media type, and SHA-256', async () => {
  const fixture = await assetFixture();

  try {
    const result = await verifySelectedAssetFile({
      asset: selectedAsset({
        localFilePath: fixture.assetPath,
        byteLength: fixture.bytes.length,
        contentType: 'video/mp4',
        sha256: fixture.sha256,
      }),
      selectedAssetsDir: fixture.selectedAssetsDir,
    });

    assert.equal(result.path, await import('node:fs/promises').then(module => module.realpath(fixture.assetPath)));
    assert.equal(result.sha256, fixture.sha256);
    assert.equal(result.byteLength, fixture.bytes.length);
    assert.equal(result.contentType, 'video/mp4');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('verifySelectedAssetFile rejects mismatched metadata and paths outside selected-assets', async () => {
  const fixture = await assetFixture();
  const outsidePath = path.join(fixture.root, 'outside.mp4');
  await writeFile(outsidePath, fixture.bytes);

  try {
    const base = selectedAsset({
      localFilePath: fixture.assetPath,
      byteLength: fixture.bytes.length,
      contentType: 'video/mp4',
      sha256: fixture.sha256,
    });

    await assert.rejects(
      verifySelectedAssetFile({ asset: { ...base, byteLength: base.byteLength + 1 }, selectedAssetsDir: fixture.selectedAssetsDir }),
      /byte length/i,
    );
    await assert.rejects(
      verifySelectedAssetFile({ asset: { ...base, contentType: 'image/jpeg' }, selectedAssetsDir: fixture.selectedAssetsDir }),
      /content type/i,
    );
    await assert.rejects(
      verifySelectedAssetFile({ asset: { ...base, sha256: '0'.repeat(64) }, selectedAssetsDir: fixture.selectedAssetsDir }),
      /SHA-256/i,
    );
    await assert.rejects(
      verifySelectedAssetFile({ asset: { ...base, localFilePath: outsidePath }, selectedAssetsDir: fixture.selectedAssetsDir }),
      /outside selected-assets/i,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('verifySelectedAssetFile rejects a symlink or junction escaping selected-assets', async t => {
  const fixture = await assetFixture();
  const outsideDir = path.join(fixture.root, 'outside');
  const outsidePath = path.join(outsideDir, 'outside.mp4');
  const linkPath = path.join(fixture.selectedAssetsDir, 'escape');
  await mkdir(outsideDir);
  await writeFile(outsidePath, fixture.bytes);

  try {
    try {
      await symlink(outsideDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (error.code === 'EPERM') {
        t.skip('The local platform does not permit creating a symlink/junction fixture.');
        return;
      }
      throw error;
    }

    await assert.rejects(verifySelectedAssetFile({
      asset: selectedAsset({
        localFilePath: path.join(linkPath, 'outside.mp4'),
        byteLength: fixture.bytes.length,
        contentType: 'video/mp4',
        sha256: fixture.sha256,
      }),
      selectedAssetsDir: fixture.selectedAssetsDir,
    }), /outside selected-assets/i);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('verifySelectedAssetFile rejects unknown bytes even when metadata declares the detected fallback type', async () => {
  const fixture = await assetFixture();
  const unknownPath = path.join(fixture.selectedAssetsDir, 'unknown.bin');
  const unknownBytes = Buffer.from('not a supported media file');
  await writeFile(unknownPath, unknownBytes);

  try {
    await assert.rejects(verifySelectedAssetFile({
      asset: selectedAsset({
        localFilePath: unknownPath,
        byteLength: unknownBytes.length,
        contentType: 'application/octet-stream',
        sha256: createHash('sha256').update(unknownBytes).digest('hex'),
      }),
      selectedAssetsDir: fixture.selectedAssetsDir,
    }), /content type.*media type|unsupported content type/i);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

function pendingRender(overrides = {}) {
  return {
    id: 'render-servicios-locales-001',
    status: 'needs-review',
    humanApprovalRequired: true,
    humanApprovalStatus: 'pending',
    assetLicenseStatus: 'pending-local-asset-selection',
    ...overrides,
  };
}

function approvedRender(overrides = {}) {
  return {
    ...pendingRender(),
    status: 'approved',
    humanApprovalStatus: 'approved',
    humanApprovalBy: 'Campaign approver',
    humanApprovalAt: '2026-08-17T18:00:00.000Z',
    assetLicenseStatus: 'verified',
    assetLicenseVerifiedBy: 'License reviewer',
    assetLicenseVerifiedAt: '2026-08-17T18:05:00.000Z',
    approvedAssetId: 'asset-render-servicios-locales-001',
    ...overrides,
  };
}

function selectedAsset(overrides = {}) {
  return {
    id: 'asset-render-servicios-locales-001',
    status: 'selected',
    mediaType: 'video',
    ...overrides,
  };
}

async function assetFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'zoosite-render-safety-'));
  const selectedAssetsDir = path.join(root, 'selected-assets');
  const assetPath = path.join(selectedAssetsDir, 'asset.mp4');
  const bytes = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
  await mkdir(selectedAssetsDir);
  await writeFile(assetPath, bytes);

  return {
    root,
    selectedAssetsDir,
    assetPath,
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
