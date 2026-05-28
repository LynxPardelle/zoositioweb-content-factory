import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateCostUsd,
  parseArgs,
  scriptVoiceoverText,
} from '../campaigns/zoositioweb/synthesize-polly-audio.mjs';

test('parseArgs supports Polly dry run and execution flags', () => {
  assert.deepEqual(parseArgs([
    '--execute',
    '--render-id=render-servicios-locales-001',
    '--voice-id=Andres',
    '--engine=generative',
    '--language-code=es-MX',
    '--region=us-east-1',
  ]), {
    execute: true,
    renderId: 'render-servicios-locales-001',
    voiceId: 'Andres',
    engine: 'generative',
    languageCode: 'es-MX',
    region: 'us-east-1',
  });
});

test('scriptVoiceoverText joins hook, body lines, and CTA in reading order', () => {
  assert.equal(scriptVoiceoverText({
    hook: 'Hook.',
    bodyLines: ['Line one.', 'Line two.'],
    cta: 'CTA.',
  }), 'Hook.\n\nLine one.\n\nLine two.\n\nCTA.');
});

test('estimateCostUsd uses Polly per-million-character rates', () => {
  assert.equal(estimateCostUsd({ characters: 1000, engine: 'standard' }), 0.004);
  assert.equal(estimateCostUsd({ characters: 1000, engine: 'neural' }), 0.016);
  assert.equal(estimateCostUsd({ characters: 1000, engine: 'generative' }), 0.03);
  assert.equal(estimateCostUsd({ characters: 1000, engine: 'long-form' }), 0.1);
});
