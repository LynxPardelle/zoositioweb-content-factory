import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DRAFT_ROOT = path.resolve(process.cwd(), '..', 'draft-zoositioweb-com-mx');
const DEFAULT_OUTPUT = 'campaigns/zoositioweb/pilot-2026-05-sector-shortform/approved-claims.json';
const DRAFT_REPO = 'draft-zoositioweb-com-mx';
const SOURCE_FILES = [
  'default/i18n/es.json',
  'sector-servicios-locales/i18n/es.json',
  'sector-consultorios/i18n/es.json',
  'sector-despachos/i18n/es.json',
  'planes/i18n/es.json',
  'servicios/i18n/es.json',
];
const EXCLUDED_FINAL_KEYS = new Set([
  'domain',
  'pageId',
  'lang',
  'icon',
  'image',
  'imageSrc',
  'imageUrl',
  'url',
  'href',
  'id',
  'slug',
  'variant',
  'type',
  'target',
  'rel',
  'ariaLabel',
]);
const CONTACT_STRING_PATTERNS = [
  /\bwa\.me\/\d+/i,
  /\bapi\.whatsapp\.com\b/i,
  /\+\d[\d\s().-]{7,}\d/,
];

export function parseArgs(rawArgs) {
  const options = {};

  for (const arg of rawArgs) {
    if (arg.startsWith('--draft-root=')) {
      options.draftRoot = arg.slice('--draft-root='.length);
      continue;
    }

    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

export function collectStrings(value, jsonPath = '$') {
  if (typeof value === 'string') {
    if (value.trim() === '' || isExcludedContactString(value)) {
      return [];
    }

    return [{ jsonPath, text: value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, `${jsonPath}[${index}]`));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, item]) => {
      if (EXCLUDED_FINAL_KEYS.has(key)) {
        return [];
      }

      return collectStrings(item, `${jsonPath}.${key}`);
    });
  }

  return [];
}

export async function extractApprovedClaims({ draftRoot = DEFAULT_DRAFT_ROOT, sourceFiles = SOURCE_FILES } = {}) {
  const resolvedDraftRoot = path.resolve(draftRoot);
  const claims = [];

  for (const sourceDraftPath of sourceFiles) {
    const sourcePath = path.resolve(resolvedDraftRoot, sourceDraftPath);
    const relativeSourcePath = path.relative(resolvedDraftRoot, sourcePath);

    if (relativeSourcePath.startsWith('..') || path.isAbsolute(relativeSourcePath)) {
      throw new Error(`Source file must stay under draft root: ${sourceDraftPath}`);
    }

    if (!existsSync(sourcePath)) {
      throw new Error(`Missing configured source file: ${sourceDraftPath} (resolved: ${sourcePath})`);
    }

    const parsed = JSON.parse(await readFile(sourcePath, 'utf8'));
    const sourceClaims = collectStrings(parsed).map((claim, index) => ({
      id: `${claimIdPrefix(sourceDraftPath)}-${String(index + 1).padStart(3, '0')}`,
      sourceDraftPath,
      jsonPath: claim.jsonPath,
      text: claim.text,
    }));

    claims.push(...sourceClaims);
  }

  return claims;
}

export async function writeApprovedClaimsFile({
  draftRoot = DEFAULT_DRAFT_ROOT,
  output = DEFAULT_OUTPUT,
  sourceFiles = SOURCE_FILES,
} = {}) {
  const resolvedDraftRoot = path.resolve(draftRoot);
  const claims = await extractApprovedClaims({ draftRoot: resolvedDraftRoot, sourceFiles });
  const payload = {
    generatedAt: new Date().toISOString(),
    draftRepo: DRAFT_REPO,
    sourceFiles,
    claims,
  };
  const outputPath = path.resolve(output);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

  return payload;
}

function claimIdPrefix(sourceDraftPath) {
  return `claim-${sourceDraftPath.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExcludedContactString(value) {
  return CONTACT_STRING_PATTERNS.some(pattern => pattern.test(value)) || isPhoneLikeString(value);
}

function isPhoneLikeString(value) {
  const trimmed = value.trim();

  if (!/^[\d\s().-]+$/.test(trimmed)) {
    return false;
  }

  return trimmed.replace(/\D/g, '').length >= 8;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const payload = await writeApprovedClaimsFile(options);
    console.log(`Wrote ${payload.claims.length} approved claims to ${path.resolve(options.output ?? DEFAULT_OUTPUT)}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
