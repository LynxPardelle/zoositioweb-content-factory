import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMptCaptionEvents,
  parseArgs,
  renderSrtSubtitles,
  selectSourceVideos,
} from '../campaigns/zoositioweb/render-pilot-video-mpt.mjs';

test('parseArgs supports MoneyPrinterTurbo render flags', () => {
  assert.deepEqual(parseArgs([
    '--render-id=render-servicios-locales-001',
    '--mpt-root=C:/tmp/MoneyPrinterTurbo',
    '--python=C:/tmp/MoneyPrinterTurbo/.venv/Scripts/python.exe',
    '--preset=enhanced',
    '--transition=Shuffle',
    '--concat-mode=random',
    '--clip-duration=3',
    '--bgm-type=random',
    '--bgm-volume=0.07',
    '--font-size=54',
    '--stroke-width=3',
    '--cta=true',
  ]), {
    renderId: 'render-servicios-locales-001',
    mptRoot: 'C:/tmp/MoneyPrinterTurbo',
    pythonPath: 'C:/tmp/MoneyPrinterTurbo/.venv/Scripts/python.exe',
    preset: 'enhanced',
    transition: 'Shuffle',
    concatMode: 'random',
    clipDuration: 3,
    bgmType: 'random',
    bgmVolume: 0.07,
    fontSize: 54,
    strokeWidth: 3,
    cta: true,
  });
});

test('buildMptCaptionEvents creates short caption events for MoneyPrinterTurbo', () => {
  const events = buildMptCaptionEvents({
    totalDurationSeconds: 20,
    script: {
      hook: 'Hook corto para abrir.',
      bodyLines: [
        'Primera linea del cuerpo con una frase suficientemente larga para partir.',
      ],
      cta: 'Revisa zoositioweb.com.mx.',
    },
  });

  assert.ok(events.length > 3);
  assert.ok(events.every(event => event.text.length <= 42));
  assert.equal(events[0].start, 0.2);
  assert.ok(events.at(-1).end <= 19.9);
});

test('renderSrtSubtitles writes plain SRT text', () => {
  const srt = renderSrtSubtitles({
    events: [
      { start: 0.2, end: 2.4, text: 'Linea uno' },
      { start: 2.4, end: 5, text: 'CTA final' },
    ],
  });

  assert.match(srt, /1\n00:00:00,200 --> 00:00:02,400\nLinea uno/);
  assert.match(srt, /2\n00:00:02,400 --> 00:00:05,000\nCTA final/);
});

test('selectSourceVideos uses same-sector assets for enhanced renders', () => {
  const primaryAsset = {
    id: 'asset-1',
    renderId: 'render-1',
    sector: 'servicios-locales',
    mediaType: 'video',
    status: 'selected',
    localFilePath: 'a.mp4',
  };
  const dataset = {
    assetPicks: [
      primaryAsset,
      {
        id: 'asset-2',
        renderId: 'render-2',
        sector: 'servicios-locales',
        mediaType: 'video',
        status: 'selected',
        localFilePath: 'b.mp4',
      },
      {
        id: 'asset-3',
        renderId: 'render-3',
        sector: 'servicios-locales',
        mediaType: 'video',
        status: 'selected',
        localFilePath: 'c.mp4',
      },
      {
        id: 'asset-4',
        renderId: 'render-4',
        sector: 'consultorios',
        mediaType: 'video',
        status: 'selected',
        localFilePath: 'd.mp4',
      },
    ],
    renderQueue: [
      readyRender('render-1', 'asset-1'),
      readyRender('render-2', 'asset-2'),
      readyRender('render-3', 'asset-3'),
      {
        id: 'render-4',
        status: 'needs-review',
        humanApprovalStatus: 'pending',
        assetLicenseStatus: 'pending-local-asset-selection',
      },
    ],
  };

  assert.deepEqual(
    selectSourceVideos({ dataset, primaryAsset, preset: 'enhanced' }).map(item => item.id),
    ['asset-1', 'asset-2', 'asset-3'],
  );
  assert.deepEqual(
    selectSourceVideos({ dataset, primaryAsset, preset: 'standard' }).map(item => item.id),
    ['asset-1'],
  );
});

function readyRender(id, approvedAssetId) {
  return {
    id,
    status: 'approved',
    humanApprovalStatus: 'approved',
    humanApprovalBy: 'Campaign approver',
    humanApprovalAt: '2026-08-17T18:00:00.000Z',
    assetLicenseStatus: 'verified',
    assetLicenseVerifiedBy: 'License reviewer',
    assetLicenseVerifiedAt: '2026-08-17T18:05:00.000Z',
    approvedAssetId,
  };
}
