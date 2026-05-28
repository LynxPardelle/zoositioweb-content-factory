import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PILOT_DIR, readPilotDataset } from './validate-pilot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUTPUT_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/asset-candidates';
const DEFAULT_ENV_FILE = '.env';
const DEFAULT_PER_PROVIDER = 3;
const TARGET_VERTICAL_VIDEO_AREA = 1080 * 1920;
const PROVIDERS = new Set(['all', 'pexels', 'pixabay']);
const MEDIA_TYPES = new Set(['all', 'image', 'video']);
const SECTOR_ASSET_QUERIES = {
  'servicios-locales': [
    'small business storefront',
    'customer service counter',
    'cleaning service worker',
  ],
  consultorios: [
    'clinic reception healthcare',
    'doctor office patient',
    'medical appointment',
  ],
  despachos: [
    'professional office meeting',
    'law office documents',
    'accounting office consultation',
  ],
};

export function parseArgs(rawArgs) {
  const options = {};

  for (const arg of rawArgs) {
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg.startsWith('--pilot-dir=')) {
      options.pilotDir = arg.slice('--pilot-dir='.length);
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.slice('--output-dir='.length);
    } else if (arg.startsWith('--env-file=')) {
      options.envFile = arg.slice('--env-file='.length);
    } else if (arg.startsWith('--render-id=')) {
      options.renderId = arg.slice('--render-id='.length);
    } else if (arg.startsWith('--provider=')) {
      options.provider = arg.slice('--provider='.length);
    } else if (arg.startsWith('--media=')) {
      options.media = arg.slice('--media='.length);
    } else if (arg.startsWith('--per-provider=')) {
      options.perProvider = Number(arg.slice('--per-provider='.length));
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

export async function findAssetCandidates({
  execute = false,
  pilotDir = DEFAULT_PILOT_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  envFile = DEFAULT_ENV_FILE,
  renderId,
  provider = 'all',
  media = 'all',
  perProvider = DEFAULT_PER_PROVIDER,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!PROVIDERS.has(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  if (!MEDIA_TYPES.has(media)) {
    throw new Error(`Unsupported media type: ${media}`);
  }

  if (!Number.isInteger(perProvider) || perProvider < 3 || perProvider > 10) {
    throw new Error('perProvider must be an integer between 3 and 10');
  }

  const dataset = await readPilotDataset(pilotDir);
  const plans = buildAssetSearchPlans({
    renderQueue: dataset.renderQueue,
    renderId,
    provider,
    media,
    perProvider,
  });
  const summary = {
    dryRun: !execute,
    planCount: plans.length,
    outputDir: path.resolve(outputDir),
    plans,
  };

  if (!execute) {
    return {
      ...summary,
      candidates: [],
    };
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available in this Node runtime');
  }

  const env = await readEnvFile(path.resolve(REPO_ROOT, envFile));
  requireProviderKeys(env, provider);

  const candidates = [];

  for (const plan of plans) {
    const results = await fetchProviderCandidates({ plan, env, fetchImpl });
    candidates.push(...results);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    pilotDir,
    provider,
    media,
    perProvider,
    licenseReviewRequired: true,
    notes: [
      'Candidates are not approved assets.',
      'Before selection, verify trademarks, visible brands, people/context risk, and whether the local downloaded file fits the render.',
      'Do not hotlink provider URLs in final rendered videos.',
    ],
    candidates,
  };

  await mkdir(path.resolve(outputDir), { recursive: true });
  await writeFile(path.join(path.resolve(outputDir), 'candidates.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(path.join(path.resolve(outputDir), 'index.md'), renderCandidateMarkdown(manifest), 'utf8');

  return {
    ...summary,
    candidates,
    candidateCount: candidates.length,
    manifestPath: path.join(path.resolve(outputDir), 'candidates.json'),
    indexPath: path.join(path.resolve(outputDir), 'index.md'),
  };
}

export function buildAssetSearchPlans({
  renderQueue,
  renderId,
  provider = 'all',
  media = 'all',
  perProvider = DEFAULT_PER_PROVIDER,
}) {
  const providerList = provider === 'all' ? ['pexels', 'pixabay'] : [provider];
  const mediaList = media === 'all' ? ['video', 'image'] : [media];
  const sectorIndexes = new Map();
  const renders = renderId
    ? renderQueue.filter(render => render.id === renderId)
    : renderQueue;

  if (renderId && renders.length === 0) {
    throw new Error(`Render ID not found in render queue: ${renderId}`);
  }

  return renders.flatMap(render => {
    const queries = SECTOR_ASSET_QUERIES[render.sector] || [render.sector.replaceAll('-', ' ')];
    const sectorIndex = sectorIndexes.get(render.sector) || 0;
    sectorIndexes.set(render.sector, sectorIndex + 1);
    const query = queries[sectorIndex % queries.length];

    return providerList.flatMap(source => mediaList.map(mediaType => ({
      renderId: render.id,
      scriptId: render.scriptId,
      sector: render.sector,
      provider: source,
      mediaType,
      query,
      perProvider,
    })));
  });
}

export async function readEnvFile(envFile) {
  const text = await readFile(envFile, 'utf8');
  const env = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }

  return env;
}

function requireProviderKeys(env, provider) {
  const missing = [];

  if ((provider === 'all' || provider === 'pexels') && !env.PEXELS_API_KEY) {
    missing.push('PEXELS_API_KEY');
  }

  if ((provider === 'all' || provider === 'pixabay') && !env.PIXABAY_API_KEY) {
    missing.push('PIXABAY_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env values: ${missing.join(', ')}`);
  }
}

async function fetchProviderCandidates({ plan, env, fetchImpl }) {
  if (plan.provider === 'pexels' && plan.mediaType === 'image') {
    const payload = await fetchJson({
      fetchImpl,
      url: `https://api.pexels.com/v1/search?query=${encodeURIComponent(plan.query)}&orientation=portrait&per_page=${plan.perProvider}`,
      headers: { Authorization: env.PEXELS_API_KEY },
      label: `Pexels image search for ${plan.renderId}`,
    });
    return (payload.photos || []).map((photo, index) => normalizePexelsPhoto({ plan, photo, index }));
  }

  if (plan.provider === 'pexels' && plan.mediaType === 'video') {
    const payload = await fetchJson({
      fetchImpl,
      url: `https://api.pexels.com/videos/search?query=${encodeURIComponent(plan.query)}&orientation=portrait&per_page=${plan.perProvider}`,
      headers: { Authorization: env.PEXELS_API_KEY },
      label: `Pexels video search for ${plan.renderId}`,
    });
    return (payload.videos || []).map((video, index) => normalizePexelsVideo({ plan, video, index }));
  }

  if (plan.provider === 'pixabay' && plan.mediaType === 'image') {
    const payload = await fetchJson({
      fetchImpl,
      url: `https://pixabay.com/api/?key=${encodeURIComponent(env.PIXABAY_API_KEY)}&q=${encodeURIComponent(plan.query)}&image_type=photo&orientation=vertical&safesearch=true&per_page=${plan.perProvider}`,
      label: `Pixabay image search for ${plan.renderId}`,
    });
    return (payload.hits || []).map((image, index) => normalizePixabayImage({ plan, image, index }));
  }

  const payload = await fetchJson({
    fetchImpl,
    url: `https://pixabay.com/api/videos/?key=${encodeURIComponent(env.PIXABAY_API_KEY)}&q=${encodeURIComponent(plan.query)}&video_type=film&safesearch=true&per_page=${plan.perProvider}`,
    label: `Pixabay video search for ${plan.renderId}`,
  });
  return (payload.hits || []).map((video, index) => normalizePixabayVideo({ plan, video, index }));
}

async function fetchJson({ fetchImpl, url, headers = {}, label }) {
  const response = await fetchImpl(url, { headers });

  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}`);
  }

  return response.json();
}

export function normalizePexelsPhoto({ plan, photo, index }) {
  return baseCandidate({ plan, index, providerAssetId: photo.id, creator: photo.photographer, sourcePageUrl: photo.url }, {
    width: photo.width,
    height: photo.height,
    previewImageUrl: photo.src?.medium || photo.src?.large || '',
    downloadUrl: photo.src?.large2x || photo.src?.original || '',
    creatorUrl: photo.photographer_url || '',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
  });
}

export function normalizePexelsVideo({ plan, video, index }) {
  const file = selectVideoFile(video.video_files || []);

  return baseCandidate({ plan, index, providerAssetId: video.id, creator: video.user?.name, sourcePageUrl: video.url }, {
    width: video.width,
    height: video.height,
    previewImageUrl: video.image || '',
    downloadUrl: file?.link || '',
    creatorUrl: video.user?.url || '',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
  });
}

export function normalizePixabayImage({ plan, image, index }) {
  return baseCandidate({ plan, index, providerAssetId: image.id, creator: image.user, sourcePageUrl: image.pageURL }, {
    width: image.imageWidth,
    height: image.imageHeight,
    previewImageUrl: image.webformatURL || image.previewURL || '',
    downloadUrl: image.largeImageURL || image.webformatURL || '',
    creatorUrl: image.user_id ? `https://pixabay.com/users/${encodeURIComponent(image.user || 'user')}-${image.user_id}/` : '',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
  });
}

export function normalizePixabayVideo({ plan, video, index }) {
  const file = selectPixabayVideoFile(video.videos || {});

  return baseCandidate({ plan, index, providerAssetId: video.id, creator: video.user, sourcePageUrl: video.pageURL }, {
    width: file?.width || 0,
    height: file?.height || 0,
    previewImageUrl: file?.thumbnail || video.userImageURL || '',
    downloadUrl: file?.url || '',
    creatorUrl: video.user_id ? `https://pixabay.com/users/${encodeURIComponent(video.user || 'user')}-${video.user_id}/` : '',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
  });
}

function baseCandidate({ plan, index, providerAssetId, creator, sourcePageUrl }, extra) {
  return {
    id: `${plan.renderId}-${plan.provider}-${plan.mediaType}-${providerAssetId || index}`,
    renderId: plan.renderId,
    scriptId: plan.scriptId,
    sector: plan.sector,
    source: plan.provider,
    mediaType: plan.mediaType,
    query: plan.query,
    providerAssetId: String(providerAssetId || ''),
    sourcePageUrl: sourcePageUrl || '',
    creator: creator || 'Unknown',
    creatorUrl: extra.creatorUrl || '',
    previewImageUrl: extra.previewImageUrl || '',
    downloadUrl: extra.downloadUrl || '',
    width: extra.width || 0,
    height: extra.height || 0,
    orientation: orientationFor(extra.width, extra.height),
    licenseName: extra.licenseName,
    licenseUrl: extra.licenseUrl,
    commercialUseAllowed: true,
    attributionRequired: false,
    standaloneRedistributionProhibited: true,
    status: 'candidate',
    reviewRequired: [
      'Check visible trademarks or branded products.',
      'Check recognizable people and context before publication.',
      'Download locally before rendering; do not hotlink provider URLs.',
    ],
  };
}

function selectVideoFile(files) {
  return [...files]
    .filter(file => file.link && (!file.file_type || file.file_type.includes('mp4')))
    .sort((a, b) => videoFileScore(a) - videoFileScore(b))[0] || null;
}

function selectPixabayVideoFile(videos) {
  const files = [videos.large, videos.medium, videos.small, videos.tiny].filter(Boolean);
  return [...files].sort((a, b) => videoFileScore(a) - videoFileScore(b))[0] || null;
}

function videoFileScore(file) {
  const portraitPenalty = file.height > file.width ? 0 : 1_000_000_000;
  const area = (file.width || 0) * (file.height || 0);
  return portraitPenalty + Math.abs(area - TARGET_VERTICAL_VIDEO_AREA);
}

function orientationFor(width, height) {
  if (!width || !height) {
    return 'unknown';
  }

  if (height > width) {
    return 'portrait';
  }

  if (width > height) {
    return 'landscape';
  }

  return 'square';
}

function renderCandidateMarkdown(manifest) {
  const rows = manifest.candidates.map(candidate => [
    candidate.renderId,
    candidate.source,
    candidate.mediaType,
    candidate.orientation,
    candidate.creator,
    candidate.query,
    candidate.sourcePageUrl,
  ]);

  return [
    '# Asset Candidates',
    '',
    `Generated at: ${manifest.generatedAt}`,
    '',
    '> Candidates are not approved assets. Verify license/context and download locally before rendering.',
    '',
    '| Render | Source | Type | Orientation | Creator | Query | Source page |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.map(markdownCell).join(' | ')} |`),
    '',
  ].join('\n');
}

function markdownCell(value) {
  return String(value || '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function isCliMode() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

function printableSummary(result) {
  return {
    dryRun: result.dryRun,
    planCount: result.planCount,
    candidateCount: result.candidateCount || 0,
    outputDir: result.outputDir,
    manifestPath: result.manifestPath,
    indexPath: result.indexPath,
    plans: result.plans.map(plan => ({
      renderId: plan.renderId,
      source: plan.provider,
      mediaType: plan.mediaType,
      query: plan.query,
      perProvider: plan.perProvider,
    })),
  };
}

if (isCliMode()) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await findAssetCandidates(options);
    console.log(JSON.stringify(printableSummary(result), null, 2));

    if (result.dryRun) {
      console.log('Dry run only. Add --execute to call Pexels/Pixabay APIs and write candidate files.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
