import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePilotDataset } from '../campaigns/zoositioweb/validate-pilot.mjs';

test('valid dataset with a full render batch passes', () => {
  assert.deepEqual(validatePilotDataset(validDataset()), { ok: true, errors: [] });
});

test('empty pre-content dataset passes', () => {
  assert.deepEqual(validatePilotDataset(validDataset({
    ideas: [],
    scripts: [],
    knowledgeCards: [],
    qaDecisions: [],
    renderQueue: [],
    assetPicks: [],
    publishLog: [],
  })), { ok: true, errors: [] });
});

test('partial content dataset with one idea, script, and card fails before render selection', () => {
  const result = validatePilotDataset(validDataset({
    ideas: [validIdeaRecord()],
    scripts: [validScriptRecord()],
    knowledgeCards: [validKnowledgeCardRecord()],
    qaDecisions: [validQaDecisionRecord()],
    renderQueue: [],
    publishLog: [],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('exactly 30 ideas, 30 scripts, and 30 knowledge cards')), true);
});

test('script with no matching idea fails', () => {
  const result = validatePilotDataset(validDataset({
    ideas: validIdeaRecords(29),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('missing matching idea')), true);
});

test('render queue record for a script without approved QA fails', () => {
  const result = validatePilotDataset(validDataset({
    qaDecisions: [validQaDecisionRecord({ decision: 'needs-review' })],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('approved QA decision')), true);
});

test('render queue record for an approved QA decision with a false check fails', () => {
  const result = validatePilotDataset(validDataset({
    qaDecisions: [
      validQaDecisionRecord({
        checks: {
          ...validQaChecks(),
          noFakeTestimonial: false,
        },
      }),
      ...validQaDecisionRecords(29).slice(1),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('complete QA checklist')), true);
});

test('render queue record for an approved QA decision with empty checks fails', () => {
  const result = validatePilotDataset(validDataset({
    qaDecisions: [
      validQaDecisionRecord({ checks: {} }),
      ...validQaDecisionRecords(29).slice(1),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('complete QA checklist')), true);
});

test('render queue record for an approved QA decision missing one required check fails', () => {
  const { statisticsSourcedOrRemoved, ...checks } = validQaChecks();
  const result = validatePilotDataset(validDataset({
    qaDecisions: [
      validQaDecisionRecord({ checks }),
      ...validQaDecisionRecords(29).slice(1),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('complete QA checklist')), true);
});

test('render queue record for an approved QA decision with every required check true passes', () => {
  assert.deepEqual(validatePilotDataset(validDataset({
    qaDecisions: validQaDecisionRecords(30),
  })), { ok: true, errors: [] });
});

test('unsafe render queue metadata fails dataset validation', () => {
  const result = validatePilotDataset(validDataset({
    renderQueue: [
      validRenderQueueRecord({
        format: 'vertical-short',
        assetSource: 'approved-claims',
        captionStyle: 'direct',
        status: 'draft',
        humanApprovalRequired: undefined,
        humanApprovalStatus: undefined,
        assetLicenseStatus: undefined,
        notes: undefined,
      }),
      ...validRenderQueueRecords(8).slice(1),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('render-queue.jsonl')), true);
  assert.equal(result.errors.some(error => error.includes('assetSource must be approved-local-assets-only')), true);
  assert.equal(result.errors.some(error => error.includes('humanApprovalRequired must be true')), true);
});

test('knowledge card whose sourceDraftPath is not in approved-claims.json fails', () => {
  const result = validatePilotDataset(validDataset({
    knowledgeCards: [validKnowledgeCardRecord({ sourceDraftPath: 'missing/i18n/es.json' })],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('sourceDraftPath')), true);
});

test('dataset with more than 9 render queue records fails', () => {
  const renderQueue = validRenderQueueRecords(10);

  const result = validatePilotDataset(validDataset({
    renderQueue,
    publishLog: validPublishLogRecords(10),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('render queue')), true);
});

test('dataset with 8 render queue records fails', () => {
  const result = validatePilotDataset(validDataset({
    renderQueue: validRenderQueueRecords(8),
    publishLog: validPublishLogRecords(8),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('render queue')), true);
});

test('asset pick records must reference existing render and script IDs', () => {
  const result = validatePilotDataset(validDataset({
    assetPicks: [
      validAssetPickRecord({
        renderId: 'render-missing-001',
        scriptId: 'script-missing-001',
      }),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.includes('asset-picks.jsonl record')), true);
});

function validDataset(overrides = {}) {
  return {
    sectors: [
      {
        id: 'servicios-locales',
        name: 'Servicios locales',
      },
    ],
    approvedClaims: {
      generatedAt: '2026-05-27T20:40:27.562Z',
      draftRepo: 'draft-zoositioweb-com-mx',
      sourceFiles: ['sector-servicios-locales/i18n/es.json'],
      claims: [validApprovedClaim()],
    },
    ideas: validIdeaRecords(30),
    scripts: validScriptRecords(30),
    knowledgeCards: validKnowledgeCardRecords(30),
    qaDecisions: validQaDecisionRecords(30),
    renderQueue: validRenderQueueRecords(9),
    assetPicks: [],
    publishLog: validPublishLogRecords(9),
    ...overrides,
  };
}

function validApprovedClaim(overrides = {}) {
  return {
    id: 'claim-servicios-locales-i18n-es-json-001',
    sourceDraftPath: 'sector-servicios-locales/i18n/es.json',
    jsonPath: '$.dictionary.hero.title',
    text: 'Un sitio claro para servicios locales.',
    ...overrides,
  };
}

function validIdeaRecord(overrides = {}) {
  return {
    id: 'idea-servicios-locales-001',
    sector: 'servicios-locales',
    hookType: 'mistake',
    audience: 'duenos de servicios locales',
    problem: 'El visitante no sabe si el negocio atiende su zona.',
    usefulAngle: 'Mostrar zonas, horarios y tipo de servicio antes del WhatsApp.',
    ctaProduct: 'zoositioweb.com.mx',
    sourceDraftPaths: ['sector-servicios-locales/i18n/es.json'],
    status: 'draft',
    ...overrides,
  };
}

function validIdeaRecords(count) {
  return Array.from({ length: count }, (_, index) => {
    const suffix = recordSuffix(index);

    return validIdeaRecord({
      id: `idea-servicios-locales-${suffix}`,
    });
  });
}

function validScriptRecord(overrides = {}) {
  return {
    id: 'script-servicios-locales-001',
    ideaId: 'idea-servicios-locales-001',
    sector: 'servicios-locales',
    durationSecondsEstimate: 35,
    title: 'Tu sitio debe decir donde atiendes',
    hook: 'Si vendes un servicio local, decir donde atiendes ayuda a recibir mejores solicitudes.',
    bodyLines: ['La gente quiere saber si llegas a su zona.'],
    cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
    approvedClaimIds: ['claim-servicios-locales-i18n-es-json-001'],
    status: 'draft',
    ...overrides,
  };
}

function validScriptRecords(count) {
  return Array.from({ length: count }, (_, index) => {
    const suffix = recordSuffix(index);

    return validScriptRecord({
      id: `script-servicios-locales-${suffix}`,
      ideaId: `idea-servicios-locales-${suffix}`,
    });
  });
}

function validKnowledgeCardRecord(overrides = {}) {
  return {
    id: 'knowledge-servicios-locales-001',
    scriptId: 'script-servicios-locales-001',
    sector: 'servicios-locales',
    audience: 'duenos de servicios locales',
    problem: 'El visitante no sabe si el negocio atiende su zona.',
    insight: 'La zona de atencion debe verse antes del contacto.',
    approvedProductClaim: 'Un sitio claro para servicios locales.',
    sourceDraftPath: 'sector-servicios-locales/i18n/es.json',
    ctaProduct: 'zoositioweb.com.mx',
    blogPotential: 'medium',
    blogTitleCandidate: 'Como explicar zona de atencion en un sitio web',
    faqCandidate: 'Que zonas atiende mi negocio?',
    evidenceNeeded: [],
    status: 'draft',
    ...overrides,
  };
}

function validKnowledgeCardRecords(count) {
  return Array.from({ length: count }, (_, index) => {
    const suffix = recordSuffix(index);

    return validKnowledgeCardRecord({
      id: `knowledge-servicios-locales-${suffix}`,
      scriptId: `script-servicios-locales-${suffix}`,
    });
  });
}

function validQaDecisionRecord(overrides = {}) {
  return {
    scriptId: 'script-servicios-locales-001',
    decision: 'approved',
    reviewedAt: '2026-05-27T19:40:00.000Z',
    reviewer: 'Alec',
    checks: validQaChecks(),
    notes: 'Approved for pilot render.',
    ...overrides,
  };
}

function validQaChecks() {
  return {
    under45Seconds: true,
    sectorClear: true,
    usefulBeforeCta: true,
    rightProductCta: true,
    noUnsupportedRoi: true,
    noFakeTestimonial: true,
    noDraftContradiction: true,
    statisticsSourcedOrRemoved: true,
  };
}

function validQaDecisionRecords(count) {
  return Array.from({ length: count }, (_, index) => {
    const suffix = recordSuffix(index);

    return validQaDecisionRecord({
      scriptId: `script-servicios-locales-${suffix}`,
    });
  });
}

function validRenderQueueRecord(overrides = {}) {
  return {
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
    notes: 'Human approval and local asset selection required before rendering.',
    ...overrides,
  };
}

function validRenderQueueRecords(count) {
  return Array.from({ length: count }, (_, index) => validRenderQueueRecord({
    id: `render-servicios-locales-${recordSuffix(index)}`,
  }));
}

function validPublishLogRecord(overrides = {}) {
  return {
    renderId: 'render-servicios-locales-001',
    platform: 'tiktok',
    publishedAt: '2026-05-30T18:00:00.000Z',
    url: '',
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

function validPublishLogRecords(count) {
  return Array.from({ length: count }, (_, index) => validPublishLogRecord({
    renderId: `render-servicios-locales-${recordSuffix(index)}`,
  }));
}

function validAssetPickRecord(overrides = {}) {
  return {
    id: 'asset-servicios-locales-001',
    renderId: 'render-servicios-locales-001',
    scriptId: 'script-servicios-locales-001',
    sector: 'servicios-locales',
    source: 'pixabay',
    mediaType: 'video',
    sourcePageUrl: 'https://pixabay.com/videos/example-123',
    creator: 'Example Creator',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    commercialUseAllowed: true,
    attributionRequired: false,
    standaloneRedistributionProhibited: true,
    trademarkOrRecognizablePeopleCheck: 'No visible trademarks or recognizable people selected.',
    localFilePath: '',
    notes: '',
    status: 'selected',
    ...overrides,
  };
}

function recordSuffix(index) {
  return String(index + 1).padStart(3, '0');
}
