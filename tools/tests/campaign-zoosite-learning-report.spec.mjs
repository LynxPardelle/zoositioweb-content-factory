import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildLearningReport,
  scoreBlogPriority,
} from '../campaigns/zoositioweb/build-learning-report.mjs';

test('scoreBlogPriority ranks high cards with engagement before pending high and medium cards', () => {
  assert.equal(scoreBlogPriority({ blogPotential: 'high', scriptId: 'script-a' }, [
    { renderId: 'render-a', views: 25 },
  ]), 1);
  assert.equal(scoreBlogPriority({ blogPotential: 'high', scriptId: 'script-b' }, []), 2);
  assert.equal(scoreBlogPriority({ blogPotential: 'medium', scriptId: 'script-c' }, []), 3);
});

test('buildLearningReport groups metrics, marks missing metrics pending, and creates cited blog backlog', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-learning-report-'));
  const pilotDir = path.join(tempRoot, 'pilot');

  try {
    await writeFixturePilot(pilotDir);

    const { markdown, blogBacklogLines } = await buildLearningReport({ pilotDir });
    const backlogRecords = blogBacklogLines.map(line => JSON.parse(line));

    assert.match(markdown, /## Sector Metrics/);
    assert.match(markdown, /servicios-locales: 1 published, 1 pending metrics, 42 views, 5 likes, 2 comments, 1 shares, 3 link clicks, 1 WhatsApp conversations/);
    assert.match(markdown, /consultorios: 0 published, 1 pending metrics/);
    assert.match(markdown, /render-servicios-locales-002 \(script-servicios-locales-002\): metrics pending/);
    assert.match(markdown, /render-consultorios-001 \(script-consultorios-001\): metrics pending/);
    assert.match(markdown, /Best Hooks/);
    assert.match(markdown, /Zona antes de contacto/);

    assert.equal(backlogRecords.length, 2);
    assert.deepEqual(backlogRecords.map(record => record.id), [
      'blog-knowledge-servicios-locales-001',
      'blog-knowledge-consultorios-001',
    ]);

    for (const record of backlogRecords) {
      assert.equal(record.status, 'candidate');
      assert.equal(typeof record.knowledgeCardId, 'string');
      assert.equal(typeof record.scriptId, 'string');
      assert.equal(typeof record.sourceDraftPath, 'string');
      assert.ok(record.knowledgeCardId.length > 0);
      assert.ok(record.scriptId.length > 0);
      assert.ok(record.sourceDraftPath.length > 0);
    }

    assert.equal(backlogRecords[0].priority, 1);
    assert.equal(backlogRecords[0].title, 'Como aclarar zonas de atencion');
    assert.equal(backlogRecords[0].sector, 'servicios-locales');
    assert.equal(backlogRecords[0].faqCandidate, 'Que debe mostrar mi pagina si atiendo por zonas?');
    assert.match(backlogRecords[0].notes, /publish engagement/);

    assert.equal(backlogRecords[1].priority, 2);
    assert.equal(backlogRecords[1].title, 'Checklist para presentar un consultorio');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildLearningReport aggregates multiple publish records for the same render ID', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-learning-report-'));
  const pilotDir = path.join(tempRoot, 'pilot');

  try {
    await writeFixturePilot(pilotDir, {
      publishLog: [
        validPublishLogRecord({
          renderId: 'render-servicios-locales-001',
          platform: 'tiktok',
          views: 42,
          likes: 5,
          comments: 2,
          shares: 1,
          linkClicks: 3,
          whatsappConversations: 1,
        }),
        validPublishLogRecord({
          renderId: 'render-servicios-locales-001',
          platform: 'instagram-reels',
          views: 8,
          likes: 1,
          comments: 1,
          shares: 2,
          linkClicks: 4,
          whatsappConversations: 2,
        }),
      ],
    });

    const { markdown, blogBacklogLines } = await buildLearningReport({ pilotDir });
    const backlogRecords = blogBacklogLines.map(line => JSON.parse(line));

    assert.match(markdown, /servicios-locales: 2 published, 1 pending metrics, 50 views, 6 likes, 3 comments, 3 shares, 7 link clicks, 3 WhatsApp conversations/);
    assert.doesNotMatch(markdown, /render-servicios-locales-001 \(script-servicios-locales-001\): metrics pending/);
    assert.match(markdown, /render-servicios-locales-002 \(script-servicios-locales-002\): metrics pending/);
    assert.equal(backlogRecords[0].priority, 1);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildLearningReport marks metrics and best hooks pending when publish log is empty', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-learning-report-'));
  const pilotDir = path.join(tempRoot, 'pilot');

  try {
    await writeFixturePilot(pilotDir, { publishLog: [] });

    const { markdown } = await buildLearningReport({ pilotDir });

    assert.match(markdown, /Render\/publish metrics are pending\. No videos have been rendered or published in this pilot log\./);
    assert.match(markdown, /Pending: no published videos or engagement metrics yet\./);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

async function writeFixturePilot(pilotDir, overrides = {}) {
  await mkdir(pilotDir, { recursive: true });

  const ideas = [
    {
      id: 'idea-servicios-locales-001',
      sector: 'servicios-locales',
      hookType: 'mistake',
      audience: 'duenos de servicios locales',
      problem: 'El visitante no sabe si el negocio atiende su zona.',
      usefulAngle: 'Mostrar zonas, horarios y contacto antes del WhatsApp.',
      ctaProduct: 'zoositioweb.com.mx',
      sourceDraftPaths: ['sector-servicios-locales/i18n/es.json'],
      status: 'draft',
    },
    {
      id: 'idea-servicios-locales-002',
      sector: 'servicios-locales',
      hookType: 'checklist',
      audience: 'duenos de servicios locales',
      problem: 'La pagina no responde lo minimo.',
      usefulAngle: 'Ordenar servicio, zona y proceso.',
      ctaProduct: 'zoositioweb.com.mx',
      sourceDraftPaths: ['servicios/i18n/es.json'],
      status: 'draft',
    },
    {
      id: 'idea-consultorios-001',
      sector: 'consultorios',
      hookType: 'checklist',
      audience: 'duenos de consultorios',
      problem: 'El paciente no encuentra servicios u horarios.',
      usefulAngle: 'Mostrar servicios, ubicacion y horarios.',
      ctaProduct: 'zoositioweb.com.mx',
      sourceDraftPaths: ['sector-consultorios/i18n/es.json'],
      status: 'draft',
    },
    {
      id: 'idea-despachos-001',
      sector: 'despachos',
      hookType: 'faq',
      audience: 'duenos de despachos',
      problem: 'El despacho no explica su proceso.',
      usefulAngle: 'Aclarar servicios y primer contacto.',
      ctaProduct: 'zoositioweb.com.mx',
      sourceDraftPaths: ['sector-despachos/i18n/es.json'],
      status: 'draft',
    },
  ];
  const scripts = [
    {
      id: 'script-servicios-locales-001',
      ideaId: 'idea-servicios-locales-001',
      sector: 'servicios-locales',
      durationSecondsEstimate: 29,
      title: 'Zona antes de contacto',
      hook: 'Si tu cliente no sabe si atiendes su zona, el primer mensaje ya empieza con duda.',
      bodyLines: ['La pagina debe decir que haces y donde atiendes.'],
      cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
      approvedClaimIds: ['claim-servicios-locales-001'],
      status: 'draft',
    },
    {
      id: 'script-servicios-locales-002',
      ideaId: 'idea-servicios-locales-002',
      sector: 'servicios-locales',
      durationSecondsEstimate: 31,
      title: 'Checklist de servicio local',
      hook: 'Antes de pedir que te escriban, revisa si tu pagina responde lo basico.',
      bodyLines: ['La pagina debe ordenar servicio, zona y proceso.'],
      cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
      approvedClaimIds: ['claim-servicios-locales-002'],
      status: 'draft',
    },
    {
      id: 'script-consultorios-001',
      ideaId: 'idea-consultorios-001',
      sector: 'consultorios',
      durationSecondsEstimate: 30,
      title: 'Checklist de consultorio',
      hook: 'Tu pagina de consultorio necesita mas que una foto y un boton.',
      bodyLines: ['Debe explicar servicios, zona y contacto.'],
      cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
      approvedClaimIds: ['claim-consultorios-001'],
      status: 'draft',
    },
    {
      id: 'script-despachos-001',
      ideaId: 'idea-despachos-001',
      sector: 'despachos',
      durationSecondsEstimate: 30,
      title: 'Despacho claro',
      hook: 'Tu despacho debe explicar su proceso antes del primer mensaje.',
      bodyLines: ['La pagina debe aclarar servicios y contacto.'],
      cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
      approvedClaimIds: ['claim-despachos-001'],
      status: 'draft',
    },
  ];
  const knowledgeCards = [
    {
      id: 'knowledge-servicios-locales-001',
      scriptId: 'script-servicios-locales-001',
      sector: 'servicios-locales',
      audience: 'duenos de servicios locales',
      problem: 'El visitante no sabe si el negocio atiende su zona.',
      insight: 'La pagina debe unir servicio, zona y forma de contacto.',
      approvedProductClaim: 'Zoositioweb presenta que haces, donde atiendes y contacto por WhatsApp.',
      sourceDraftPath: 'sector-servicios-locales/i18n/es.json',
      ctaProduct: 'zoositioweb.com.mx',
      blogPotential: 'high',
      blogTitleCandidate: 'Como aclarar zonas de atencion',
      faqCandidate: 'Que debe mostrar mi pagina si atiendo por zonas?',
      evidenceNeeded: [],
      status: 'draft',
    },
    {
      id: 'knowledge-servicios-locales-002',
      scriptId: 'script-servicios-locales-002',
      sector: 'servicios-locales',
      audience: 'duenos de servicios locales',
      problem: 'La pagina no responde lo minimo.',
      insight: 'Servicios, zonas y proceso deben aparecer en una lista facil.',
      approvedProductClaim: 'Zoositioweb ordena la oferta en secciones faciles de recorrer.',
      sourceDraftPath: 'servicios/i18n/es.json',
      ctaProduct: 'zoositioweb.com.mx',
      blogPotential: 'high',
      blogTitleCandidate: 'Como aclarar zonas de atencion',
      faqCandidate: 'Que informacion necesito preparar?',
      evidenceNeeded: [],
      status: 'draft',
    },
    {
      id: 'knowledge-consultorios-001',
      scriptId: 'script-consultorios-001',
      sector: 'consultorios',
      audience: 'duenos de consultorios',
      problem: 'El paciente no encuentra servicios u horarios.',
      insight: 'La informacion basica debe estar visible.',
      approvedProductClaim: 'Zoositioweb presenta servicios, ubicacion, horarios y contacto por WhatsApp.',
      sourceDraftPath: 'sector-consultorios/i18n/es.json',
      ctaProduct: 'zoositioweb.com.mx',
      blogPotential: 'high',
      blogTitleCandidate: 'Checklist para presentar un consultorio',
      faqCandidate: 'Que secciones necesita el sitio de un consultorio?',
      evidenceNeeded: [],
      status: 'draft',
    },
    {
      id: 'knowledge-despachos-001',
      scriptId: 'script-despachos-001',
      sector: 'despachos',
      audience: 'duenos de despachos',
      problem: 'El despacho no explica su proceso.',
      insight: 'La pagina debe aclarar servicios y contacto.',
      approvedProductClaim: 'Zoositioweb adapta el contenido al tipo de cliente.',
      sourceDraftPath: 'sector-despachos/i18n/es.json',
      ctaProduct: 'zoositioweb.com.mx',
      blogPotential: 'medium',
      blogTitleCandidate: 'Como explicar servicios de un despacho',
      faqCandidate: 'Que proceso debo mostrar?',
      evidenceNeeded: [],
      status: 'draft',
    },
  ];
  const renderQueue = [
    {
      id: 'render-servicios-locales-001',
      scriptId: 'script-servicios-locales-001',
      sector: 'servicios-locales',
      format: 'vertical-9x16',
      voice: 'manual-selection',
      assetSource: 'approved-local-assets-only',
      captionStyle: 'large-readable-spanish',
      status: 'needs-review',
      humanApprovalRequired: true,
      humanApprovalStatus: 'pending',
      assetLicenseStatus: 'pending-local-asset-selection',
    },
    {
      id: 'render-servicios-locales-002',
      scriptId: 'script-servicios-locales-002',
      sector: 'servicios-locales',
      format: 'vertical-9x16',
      voice: 'manual-selection',
      assetSource: 'approved-local-assets-only',
      captionStyle: 'large-readable-spanish',
      status: 'needs-review',
      humanApprovalRequired: true,
      humanApprovalStatus: 'pending',
      assetLicenseStatus: 'pending-local-asset-selection',
    },
    {
      id: 'render-consultorios-001',
      scriptId: 'script-consultorios-001',
      sector: 'consultorios',
      format: 'vertical-9x16',
      voice: 'manual-selection',
      assetSource: 'approved-local-assets-only',
      captionStyle: 'large-readable-spanish',
      status: 'needs-review',
      humanApprovalRequired: true,
      humanApprovalStatus: 'pending',
      assetLicenseStatus: 'pending-local-asset-selection',
    },
  ];
  const publishLog = overrides.publishLog ?? [
    validPublishLogRecord({
      renderId: 'render-servicios-locales-001',
      platform: 'tiktok',
      views: 42,
      threeSecondRetention: 20,
      averageWatchTimeSeconds: 12,
      likes: 5,
      comments: 2,
      saves: 0,
      shares: 1,
      profileVisits: 4,
      linkClicks: 3,
      whatsappConversations: 1,
      notes: 'Fixture engagement.',
    }),
  ];

  await writeFile(path.join(pilotDir, 'sectors.json'), JSON.stringify({
    pilotId: 'fixture-pilot',
    product: 'zoositioweb.com.mx',
    sectors: [
      { id: 'servicios-locales', label: 'Servicios locales' },
      { id: 'consultorios', label: 'Consultorios' },
      { id: 'despachos', label: 'Despachos' },
    ],
  }), 'utf8');
  await writeFile(path.join(pilotDir, 'approved-claims.json'), JSON.stringify({ claims: [] }), 'utf8');
  await writeFile(path.join(pilotDir, 'ideas.jsonl'), recordsToJsonl(ideas), 'utf8');
  await writeFile(path.join(pilotDir, 'scripts.jsonl'), recordsToJsonl(scripts), 'utf8');
  await writeFile(path.join(pilotDir, 'knowledge-cards.jsonl'), recordsToJsonl(knowledgeCards), 'utf8');
  await writeFile(path.join(pilotDir, 'render-queue.jsonl'), recordsToJsonl(renderQueue), 'utf8');
  await writeFile(path.join(pilotDir, 'publish-log.jsonl'), recordsToJsonl(publishLog), 'utf8');

  for (const file of ['qa-decisions.jsonl', 'blog-backlog.jsonl']) {
    await writeFile(path.join(pilotDir, file), '', 'utf8');
  }
}

function recordsToJsonl(records) {
  return records.map(record => JSON.stringify(record)).join('\n') + (records.length === 0 ? '' : '\n');
}

function validPublishLogRecord(overrides = {}) {
  return {
    renderId: 'render-servicios-locales-001',
    platform: 'tiktok',
    publishedAt: '2026-05-30T18:00:00.000Z',
    url: 'https://example.com/video',
    views: 0,
    threeSecondRetention: 0,
    averageWatchTimeSeconds: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    profileVisits: 0,
    linkClicks: 0,
    whatsappConversations: 0,
    notes: '',
    ...overrides,
  };
}
