import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const STRICT_UTC_ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CONTENT_TYPES_BY_MEDIA_TYPE = new Map([
  ['image', new Set(['image/jpeg', 'image/png'])],
  ['video', new Set(['video/mp4'])],
  ['audio', new Set(['audio/mpeg', 'audio/wav'])],
]);

export function assertRenderReady({ render, asset }) {
  if (render?.status !== 'approved' || render?.humanApprovalStatus !== 'approved') {
    throw new Error(`Render ${render?.id || 'unknown'} requires final human approval before execution.`);
  }

  if (!hasAudit(render.humanApprovalBy, render.humanApprovalAt)) {
    throw new Error(`Render ${render.id} requires auditable human approval metadata.`);
  }

  if (render.assetLicenseStatus !== 'verified') {
    throw new Error(`Render ${render.id} requires verified asset-license approval before execution.`);
  }

  if (!hasAudit(render.assetLicenseVerifiedBy, render.assetLicenseVerifiedAt)) {
    throw new Error(`Render ${render.id} requires auditable asset-license approval metadata.`);
  }

  if (asset?.status !== 'selected') {
    throw new Error(`Render ${render.id} requires a selected asset.`);
  }

  if (!render.approvedAssetId || render.approvedAssetId !== asset.id) {
    throw new Error(`Render ${render.id} approved asset does not match selected asset ${asset.id}.`);
  }
}

export async function verifySelectedAssetFile({ asset, selectedAssetsDir }) {
  requireAssetMetadata(asset);

  const approvedRoot = await realpath(selectedAssetsDir);
  const assetPath = await realpath(asset.localFilePath);
  const relativePath = path.relative(approvedRoot, assetPath);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Asset ${asset.id} resolves outside selected-assets: ${assetPath}`);
  }

  const fileStat = await stat(assetPath);
  if (!fileStat.isFile()) {
    throw new Error(`Asset ${asset.id} is not a regular file.`);
  }
  if (fileStat.size !== asset.byteLength) {
    throw new Error(`Asset ${asset.id} byte length mismatch: expected ${asset.byteLength}, found ${fileStat.size}.`);
  }

  const contentType = await detectContentType(assetPath);
  if (contentType !== asset.contentType) {
    throw new Error(`Asset ${asset.id} content type mismatch: expected ${asset.contentType}, found ${contentType}.`);
  }

  const sha256 = await hashFile(assetPath);
  if (sha256 !== asset.sha256) {
    throw new Error(`Asset ${asset.id} SHA-256 mismatch.`);
  }

  return {
    path: assetPath,
    byteLength: fileStat.size,
    contentType,
    sha256,
  };
}

export function selectedAssetsDirectoryForPilot(pilotDir) {
  return path.isAbsolute(pilotDir)
    ? path.join(pilotDir, 'selected-assets')
    : path.resolve('devonly', pilotDir, 'selected-assets');
}

function hasAudit(reviewer, reviewedAt) {
  if (typeof reviewer !== 'string' || reviewer.trim() === '') {
    return false;
  }
  if (typeof reviewedAt !== 'string' || !STRICT_UTC_ISO_TIMESTAMP_REGEX.test(reviewedAt)) {
    return false;
  }

  const parsed = new Date(reviewedAt);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === reviewedAt;
}

function requireAssetMetadata(asset) {
  if (!asset || typeof asset.localFilePath !== 'string' || asset.localFilePath.trim() === '') {
    throw new Error('Selected asset requires a localFilePath.');
  }
  if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength <= 0) {
    throw new Error(`Asset ${asset.id} requires a positive byteLength.`);
  }
  const allowedContentTypes = CONTENT_TYPES_BY_MEDIA_TYPE.get(asset.mediaType);
  if (!allowedContentTypes?.has(asset.contentType)) {
    throw new Error(
      `Asset ${asset.id} content type ${asset.contentType || 'missing'} does not match media type ${asset.mediaType || 'missing'}.`,
    );
  }
  if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
    throw new Error(`Asset ${asset.id} requires a lowercase SHA-256 digest.`);
  }
}

async function detectContentType(filePath) {
  const file = await open(filePath, 'r');
  const header = Buffer.alloc(16);

  try {
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);

    if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
      return 'video/mp4';
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return 'image/png';
    }
    if (bytes.length >= 3 && bytes.subarray(0, 3).toString('ascii') === 'ID3') {
      return 'audio/mpeg';
    }
    if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE') {
      return 'audio/wav';
    }

    return 'application/octet-stream';
  } finally {
    await file.close();
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
