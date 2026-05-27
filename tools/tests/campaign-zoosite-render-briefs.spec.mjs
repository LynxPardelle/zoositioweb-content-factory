import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildRenderBriefs, renderBriefMarkdown } from '../campaigns/zoositioweb/build-render-briefs.mjs';

test('renderBriefMarkdown includes render, script, asset, and safety details', () => {
  const markdown = renderBriefMarkdown({
    render: {
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
      notes: 'Render requires human approval.',
    },
    script: {
      id: 'script-servicios-locales-001',
      ideaId: 'idea-servicios-locales-001',
      sector: 'servicios-locales',
      durationSecondsEstimate: 29,
      title: 'Zona antes de contacto',
      hook: 'Si tu cliente no sabe si atiendes su zona, el primer mensaje ya empieza con duda.',
      bodyLines: [
        'En un servicio local, la pagina debe decir que haces, donde atiendes y como iniciar la cotizacion.',
        'Cuando servicio, zona y WhatsApp estan juntos, la conversacion empieza con mas contexto.',
      ],
      cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
      approvedClaimIds: ['claim-sector-servicios-locales-i18n-es-json-003'],
      status: 'draft',
    },
    idea: {
      id: 'idea-servicios-locales-001',
      usefulAngle: 'Mostrar zonas, horarios y tipo de servicio antes del WhatsApp.',
    },
    knowledgeCard: {
      id: 'knowledge-servicios-locales-001',
      insight: 'La pagina debe unir servicio, zona y forma de contacto para que WhatsApp llegue con contexto.',
      approvedProductClaim: 'Zoositioweb presenta que haces, donde atiendes y contacto por WhatsApp para servicios locales.',
      sourceDraftPath: 'sector-servicios-locales/i18n/es.json',
    },
  });

  assert.match(markdown, /render-servicios-locales-001/);
  assert.match(markdown, /servicios-locales/);
  assert.match(markdown, /Zona antes de contacto/);
  assert.match(markdown, /Si tu cliente no sabe si atiendes su zona/);
  assert.match(markdown, /En un servicio local, la pagina debe decir que haces/);
  assert.match(markdown, /Cuando servicio, zona y WhatsApp estan juntos/);
  assert.match(markdown, /Revisa zoositioweb\.com\.mx y pide tu sitio por WhatsApp\./);
  assert.match(markdown, /manual-selection/);
  assert.match(markdown, /approved-local-assets-only/);
  assert.match(markdown, /Human approval required: true/);
  assert.match(markdown, /Human approval status: pending/);
  assert.match(markdown, /Asset license status: pending-local-asset-selection/);
  assert.match(markdown, /La pagina debe unir servicio, zona y forma de contacto/);
  assert.match(markdown, /Do not use untrusted uploaded media\./);
});

test('buildRenderBriefs writes files using the render ID as the filename', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-render-briefs-'));
  const pilotDir = path.join(tempRoot, 'pilot');
  const outputDir = path.join(tempRoot, 'briefs');

  try {
    await writeFixturePilot(pilotDir);

    const result = await buildRenderBriefs({ pilotDir, outputDir });
    const files = await readdir(outputDir);

    assert.equal(result.count, 1);
    assert.deepEqual(files, ['render-servicios-locales-001.md']);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildRenderBriefs rejects unsafe render IDs without writing outside output dir', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-render-briefs-'));
  const pilotDir = path.join(tempRoot, 'pilot');
  const outputDir = path.join(tempRoot, 'briefs');
  const escapedFile = path.join(tempRoot, 'escaped.md');

  try {
    await writeFixturePilot(pilotDir, {
      render: { id: '../escaped' },
    });

    await assert.rejects(
      buildRenderBriefs({ pilotDir, outputDir }),
      /Unsafe render ID for output filename: \.\.\/escaped/,
    );
    await assert.rejects(stat(escapedFile), error => error.code === 'ENOENT');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildRenderBriefs throws a clear error for a missing script reference', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-render-briefs-'));
  const pilotDir = path.join(tempRoot, 'pilot');

  try {
    await writeFixturePilot(pilotDir, {
      render: { scriptId: 'script-missing-001' },
    });

    await assert.rejects(
      buildRenderBriefs({ pilotDir, outputDir: path.join(tempRoot, 'briefs') }),
      /Missing script for render render-servicios-locales-001: script-missing-001/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildRenderBriefs throws a clear error for a missing idea reference', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-render-briefs-'));
  const pilotDir = path.join(tempRoot, 'pilot');

  try {
    await writeFixturePilot(pilotDir, {
      script: { ideaId: 'idea-missing-001' },
    });

    await assert.rejects(
      buildRenderBriefs({ pilotDir, outputDir: path.join(tempRoot, 'briefs') }),
      /Missing idea for script script-servicios-locales-001: idea-missing-001/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildRenderBriefs throws a clear error for a missing knowledge card reference', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'zoosite-render-briefs-'));
  const pilotDir = path.join(tempRoot, 'pilot');

  try {
    await writeFixturePilot(pilotDir, {
      knowledgeCards: [],
    });

    await assert.rejects(
      buildRenderBriefs({ pilotDir, outputDir: path.join(tempRoot, 'briefs') }),
      /Missing knowledge card for script script-servicios-locales-001/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

async function writeFixturePilot(pilotDir, overrides = {}) {
  await mkdir(pilotDir, { recursive: true });

  const idea = {
    id: 'idea-servicios-locales-001',
    sector: 'servicios-locales',
    hookType: 'mistake',
    audience: 'duenos de servicios locales',
    problem: 'El visitante no sabe si el negocio atiende su zona.',
    usefulAngle: 'Mostrar zonas, horarios y tipo de servicio antes del WhatsApp.',
    ctaProduct: 'zoositioweb.com.mx',
    sourceDraftPaths: ['sector-servicios-locales/i18n/es.json'],
    status: 'draft',
    ...overrides.idea,
  };
  const script = {
    id: 'script-servicios-locales-001',
    ideaId: 'idea-servicios-locales-001',
    sector: 'servicios-locales',
    durationSecondsEstimate: 29,
    title: 'Zona antes de contacto',
    hook: 'Si tu cliente no sabe si atiendes su zona, el primer mensaje ya empieza con duda.',
    bodyLines: ['En un servicio local, la pagina debe decir que haces.'],
    cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
    approvedClaimIds: ['claim-sector-servicios-locales-i18n-es-json-003'],
    status: 'draft',
    ...overrides.script,
  };
  const knowledgeCard = {
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
    ...overrides.knowledgeCard,
  };
  const knowledgeCards = overrides.knowledgeCards ?? [knowledgeCard];
  const render = {
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
    ...overrides.render,
  };

  await writeFile(path.join(pilotDir, 'sectors.json'), JSON.stringify([
    { id: 'servicios-locales', name: 'Servicios locales' },
  ]), 'utf8');
  await writeFile(path.join(pilotDir, 'approved-claims.json'), JSON.stringify({
    claims: [
      {
        id: 'claim-sector-servicios-locales-i18n-es-json-003',
        sourceDraftPath: 'sector-servicios-locales/i18n/es.json',
        jsonPath: '$.dictionary.hero.title',
        text: 'Zoositioweb presenta informacion clara para servicios locales.',
      },
    ],
  }), 'utf8');
  await writeFile(path.join(pilotDir, 'ideas.jsonl'), `${JSON.stringify(idea)}\n`, 'utf8');
  await writeFile(path.join(pilotDir, 'scripts.jsonl'), `${JSON.stringify(script)}\n`, 'utf8');
  await writeFile(path.join(pilotDir, 'knowledge-cards.jsonl'), recordsToJsonl(knowledgeCards), 'utf8');
  await writeFile(path.join(pilotDir, 'render-queue.jsonl'), `${JSON.stringify(render)}\n`, 'utf8');

  for (const file of ['qa-decisions.jsonl', 'publish-log.jsonl', 'blog-backlog.jsonl']) {
    await writeFile(path.join(pilotDir, file), '', 'utf8');
  }
}

function recordsToJsonl(records) {
  return records.map(record => JSON.stringify(record)).join('\n') + (records.length === 0 ? '' : '\n');
}
