import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectStrings,
  extractApprovedClaims,
  parseArgs,
  writeApprovedClaimsFile,
} from '../campaigns/zoositioweb/extract-approved-claims.mjs';

test('parseArgs supports draft root and output flags', () => {
  assert.deepEqual(parseArgs([
    '--draft-root=../draft-zoositioweb-com-mx',
    '--output=tmp/approved-claims.json',
  ]), {
    draftRoot: '../draft-zoositioweb-com-mx',
    output: 'tmp/approved-claims.json',
  });
});

test('extractApprovedClaims returns stable claim records from draft i18n JSON files', async () => {
  const draftRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-claims-'));

  try {
    await writeJson(path.join(draftRoot, 'default/i18n/es.json'), {
      hero: {
        title: 'Consigue mas clientes con un sitio profesional.',
        empty: '',
        whitespace: '   ',
      },
      whitespaceOnlyItems: [' ', '\n'],
    });
    await writeJson(path.join(draftRoot, 'sector-servicios-locales/i18n/es.json'), {
      hero: {
        title: 'Muestra servicios, zonas y horarios antes del WhatsApp.',
      },
    });

    const claims = await extractApprovedClaims({
      draftRoot,
      sourceFiles: [
        'default/i18n/es.json',
        'sector-servicios-locales/i18n/es.json',
      ],
    });

    assert.deepEqual(claims, [
      {
        id: 'claim-default-i18n-es-json-001',
        sourceDraftPath: 'default/i18n/es.json',
        jsonPath: '$.hero.title',
        text: 'Consigue mas clientes con un sitio profesional.',
      },
      {
        id: 'claim-sector-servicios-locales-i18n-es-json-001',
        sourceDraftPath: 'sector-servicios-locales/i18n/es.json',
        jsonPath: '$.hero.title',
        text: 'Muestra servicios, zonas y horarios antes del WhatsApp.',
      },
    ]);
  } finally {
    await rm(draftRoot, { recursive: true, force: true });
  }
});

test('extractApprovedClaims filters contact strings and technical config keys', async () => {
  const draftRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-claims-'));
  const shortlinkContact = `https://${'wa'}.me/${'1234'}`;
  const apiContact = `https://${'api'}.${'whatsapp'}.com/send?phone=${'1234'}`;

  try {
    await writeJson(path.join(draftRoot, 'default/i18n/es.json'), {
      domain: 'zoositioweb.com.mx',
      pageId: 'default',
      lang: 'es',
      hero: {
        title: 'Consigue mas clientes con un sitio profesional.',
        imageUrl: 'https://assets.example.com/hero.png',
        cta: {
          href: shortlinkContact,
          label: 'Pide una propuesta para tu negocio.',
        },
      },
      footer: {
        contactUrl: apiContact,
        phone: '0000 0000',
      },
    });

    const claims = await extractApprovedClaims({
      draftRoot,
      sourceFiles: ['default/i18n/es.json'],
    });

    assert.deepEqual(claims, [
      {
        id: 'claim-default-i18n-es-json-001',
        sourceDraftPath: 'default/i18n/es.json',
        jsonPath: '$.hero.title',
        text: 'Consigue mas clientes con un sitio profesional.',
      },
      {
        id: 'claim-default-i18n-es-json-002',
        sourceDraftPath: 'default/i18n/es.json',
        jsonPath: '$.hero.cta.label',
        text: 'Pide una propuesta para tu negocio.',
      },
    ]);
  } finally {
    await rm(draftRoot, { recursive: true, force: true });
  }
});

test('extractApprovedClaims fails when a configured source file is missing', async () => {
  const draftRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-claims-'));

  try {
    await assert.rejects(
      extractApprovedClaims({
        draftRoot,
        sourceFiles: ['default/i18n/es.json'],
      }),
      /Missing configured source file: default\/i18n\/es\.json/,
    );
  } finally {
    await rm(draftRoot, { recursive: true, force: true });
  }
});

test('extractApprovedClaims rejects source file traversal outside draft root', async () => {
  const draftRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-claims-'));

  try {
    await assert.rejects(
      extractApprovedClaims({
        draftRoot,
        sourceFiles: ['../secret.json'],
      }),
      /Source file must stay under draft root: \.\.\/secret\.json/,
    );
  } finally {
    await rm(draftRoot, { recursive: true, force: true });
  }
});

test('collectStrings returns nested non-empty strings from objects and arrays', () => {
  const claims = collectStrings({
    hero: {
      title: 'Titulo',
      bullets: ['Primera idea', ' ', '', { label: 'Etiqueta' }],
    },
  });

  assert.deepEqual(claims, [
    { jsonPath: '$.hero.title', text: 'Titulo' },
    { jsonPath: '$.hero.bullets[0]', text: 'Primera idea' },
    { jsonPath: '$.hero.bullets[3].label', text: 'Etiqueta' },
  ]);
});

test('collectStrings excludes technical final keys while retaining content keys', () => {
  const claims = collectStrings({
    domain: 'zoositioweb.com.mx',
    pageId: 'default',
    lang: 'es',
    hero: {
      title: 'Titulo principal',
      imageSrc: 'https://assets.example.com/hero.png',
      ariaLabel: 'Etiqueta tecnica',
      price: '3000',
      whatsappPhone: '0000 0000',
      items: [
        { slug: 'servicios-locales' },
        { text: 'Contenido util' },
      ],
    },
  });

  assert.deepEqual(claims, [
    { jsonPath: '$.hero.title', text: 'Titulo principal' },
    { jsonPath: '$.hero.price', text: '3000' },
    { jsonPath: '$.hero.items[1].text', text: 'Contenido util' },
  ]);
});

test('collectStrings filters grouped phone-like strings without filtering ordinary content', () => {
  // Test-only placeholders: grouped zeroes exercise phone-like filtering without a real routeable number.
  const claims = collectStrings({
    hero: {
      title: 'Agenda tu sitio web profesional.',
      phone: '0000 0000',
      secondaryPhone: '(000) 000-0000',
    },
  });

  assert.deepEqual(claims, [
    { jsonPath: '$.hero.title', text: 'Agenda tu sitio web profesional.' },
  ]);
});

test('writeApprovedClaimsFile writes pretty JSON with metadata', async () => {
  const draftRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-claims-'));
  const output = path.join(draftRoot, 'out/approved-claims.json');

  try {
    await writeJson(path.join(draftRoot, 'default/i18n/es.json'), {
      hero: {
        title: 'Consigue mas clientes con un sitio profesional.',
      },
    });

    const payload = await writeApprovedClaimsFile({
      draftRoot,
      sourceFiles: ['default/i18n/es.json'],
      output,
    });
    const written = JSON.parse(await readFile(output, 'utf8'));

    assert.deepEqual(written, payload);
    assert.equal(written.draftRepo, 'draft-zoositioweb-com-mx');
    assert.equal(Object.hasOwn(written, 'draftRoot'), false);
    assert.deepEqual(written.sourceFiles, ['default/i18n/es.json']);
    assert.equal(written.claims[0].id, 'claim-default-i18n-es-json-001');
    assert.match(written.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  } finally {
    await rm(draftRoot, { recursive: true, force: true });
  }
});

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
