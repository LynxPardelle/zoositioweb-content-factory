import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCaptionEvents,
  parseArgs,
  renderAssSubtitles,
} from '../campaigns/zoositioweb/render-pilot-video.mjs';

test('parseArgs supports pilot video render flags', () => {
  assert.deepEqual(parseArgs([
    '--render-id=render-servicios-locales-001',
    '--audio-dir=tmp/audio',
    '--output-dir=tmp/renders',
  ]), {
    renderId: 'render-servicios-locales-001',
    audioDir: 'tmp/audio',
    outputDir: 'tmp/renders',
  });
});

test('buildCaptionEvents creates timed hook, body, and CTA events', () => {
  const events = buildCaptionEvents({
    totalDurationSeconds: 20,
    script: {
      hook: 'Hook corto para abrir.',
      bodyLines: [
        'Primera linea del cuerpo.',
        'Segunda linea del cuerpo con mas contexto.',
      ],
      cta: 'Revisa zoositioweb.com.mx.',
    },
  });

  assert.equal(events.length, 4);
  assert.equal(events[0].kind, 'hook');
  assert.equal(events.at(-1).kind, 'cta');
  assert.equal(events[0].start, 0.2);
  assert.ok(events[0].end > events[0].start);
  assert.ok(events.at(-1).end <= 19.9);
});

test('renderAssSubtitles escapes text and uses CTA style for final event', () => {
  const ass = renderAssSubtitles({
    title: 'Titulo {seguro}',
    events: [
      { kind: 'hook', start: 0.2, end: 4.2, text: 'Texto {uno}\\Nsegunda linea' },
      { kind: 'cta', start: 4.2, end: 8.2, text: 'CTA final' },
    ],
  });

  assert.match(ass, /Title: Titulo \\{seguro\\}/);
  assert.match(ass, /Dialogue: 0,0:00:00\.20,0:00:04\.20,Default,,0,0,0,,Texto \\{uno\\}\\Nsegunda linea/);
  assert.match(ass, /Dialogue: 0,0:00:04\.20,0:00:08\.20,CTA,,0,0,0,,CTA final/);
});

test('ffprobeDuration is available for alternate renderers', async () => {
  const { ffprobeDuration } = await import('../campaigns/zoositioweb/render-pilot-video.mjs');

  assert.equal(typeof ffprobeDuration, 'function');
});
