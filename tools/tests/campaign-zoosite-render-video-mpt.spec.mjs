import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMptCaptionEvents,
  parseArgs,
  renderSrtSubtitles,
} from '../campaigns/zoositioweb/render-pilot-video-mpt.mjs';

test('parseArgs supports MoneyPrinterTurbo render flags', () => {
  assert.deepEqual(parseArgs([
    '--render-id=render-servicios-locales-001',
    '--mpt-root=C:/tmp/MoneyPrinterTurbo',
    '--python=C:/tmp/MoneyPrinterTurbo/.venv/Scripts/python.exe',
  ]), {
    renderId: 'render-servicios-locales-001',
    mptRoot: 'C:/tmp/MoneyPrinterTurbo',
    pythonPath: 'C:/tmp/MoneyPrinterTurbo/.venv/Scripts/python.exe',
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
