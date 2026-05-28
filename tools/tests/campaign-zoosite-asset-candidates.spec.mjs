import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAssetSearchPlans,
  normalizePexelsPhoto,
  normalizePixabayVideo,
  parseArgs,
} from '../campaigns/zoositioweb/find-asset-candidates.mjs';

test('parseArgs supports asset candidate fetch flags', () => {
  assert.deepEqual(parseArgs([
    '--execute',
    '--render-id=render-servicios-locales-001',
    '--provider=pexels',
    '--media=video',
    '--per-provider=3',
    '--env-file=.env.local',
  ]), {
    execute: true,
    renderId: 'render-servicios-locales-001',
    provider: 'pexels',
    media: 'video',
    perProvider: 3,
    envFile: '.env.local',
  });
});

test('buildAssetSearchPlans creates provider and media combinations per render', () => {
  const plans = buildAssetSearchPlans({
    renderQueue: [
      {
        id: 'render-servicios-locales-001',
        scriptId: 'script-servicios-locales-001',
        sector: 'servicios-locales',
      },
    ],
    provider: 'all',
    media: 'all',
    perProvider: 3,
  });

  assert.equal(plans.length, 4);
  assert.deepEqual(plans.map(plan => `${plan.provider}:${plan.mediaType}`), [
    'pexels:video',
    'pexels:image',
    'pixabay:video',
    'pixabay:image',
  ]);
  assert.equal(plans[0].query, 'small business storefront');
});

test('normalizePexelsPhoto preserves license evidence and render linkage', () => {
  const candidate = normalizePexelsPhoto({
    plan: {
      renderId: 'render-servicios-locales-001',
      scriptId: 'script-servicios-locales-001',
      sector: 'servicios-locales',
      provider: 'pexels',
      mediaType: 'image',
      query: 'small business storefront',
    },
    photo: {
      id: 123,
      url: 'https://www.pexels.com/photo/example-123/',
      photographer: 'Creator',
      photographer_url: 'https://www.pexels.com/@creator/',
      width: 1200,
      height: 1800,
      src: {
        medium: 'https://images.pexels.com/medium.jpg',
        large2x: 'https://images.pexels.com/large.jpg',
      },
    },
    index: 0,
  });

  assert.equal(candidate.id, 'render-servicios-locales-001-pexels-image-123');
  assert.equal(candidate.orientation, 'portrait');
  assert.equal(candidate.licenseName, 'Pexels License');
  assert.equal(candidate.commercialUseAllowed, true);
  assert.equal(candidate.attributionRequired, false);
});

test('normalizePixabayVideo selects the largest portrait-capable video file', () => {
  const candidate = normalizePixabayVideo({
    plan: {
      renderId: 'render-despachos-001',
      scriptId: 'script-despachos-001',
      sector: 'despachos',
      provider: 'pixabay',
      mediaType: 'video',
      query: 'professional office meeting',
    },
    video: {
      id: 456,
      pageURL: 'https://pixabay.com/videos/example-456/',
      user: 'PixabayCreator',
      user_id: 999,
      videos: {
        large: { url: 'https://cdn.pixabay.com/landscape.mp4', width: 1920, height: 1080 },
        medium: { url: 'https://cdn.pixabay.com/portrait.mp4', width: 720, height: 1280, thumbnail: 'https://cdn.pixabay.com/thumb.jpg' },
      },
    },
    index: 0,
  });

  assert.equal(candidate.id, 'render-despachos-001-pixabay-video-456');
  assert.equal(candidate.downloadUrl, 'https://cdn.pixabay.com/portrait.mp4');
  assert.equal(candidate.orientation, 'portrait');
  assert.equal(candidate.licenseName, 'Pixabay Content License');
});
