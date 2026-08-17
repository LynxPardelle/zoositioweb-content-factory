import assert from 'node:assert/strict';
import test from 'node:test';

import {
  groupBy,
  parseJsonl,
  validateAssetPickRecord,
  validateIdeaRecord,
  validateKnowledgeCardRecord,
  validatePublishLogRecord,
  validateQaDecisionRecord,
  validateRenderQueueRecord,
  validateScriptRecord,
  findUnsafeClaimHits,
} from '../campaigns/zoositioweb/schema.mjs';

test('parseJsonl ignores blank lines and reports source line numbers', () => {
  const records = parseJsonl('{"id":"one"}\n\n{"id":"two"}\n', 'sample.jsonl');

  assert.deepEqual(records, [
    { value: { id: 'one' }, line: 1, file: 'sample.jsonl' },
    { value: { id: 'two' }, line: 3, file: 'sample.jsonl' },
  ]);
});

test('validateIdeaRecord accepts a valid idea', () => {
  const errors = validateIdeaRecord({
    id: 'idea-servicios-locales-001',
    sector: 'servicios-locales',
    hookType: 'mistake',
    audience: 'duenos de servicios locales',
    problem: 'El visitante no sabe si el negocio atiende su zona.',
    usefulAngle: 'Mostrar zonas, horarios y tipo de servicio antes del WhatsApp.',
    ctaProduct: 'zoositioweb.com.mx',
    sourceDraftPaths: ['sector-servicios-locales/i18n/es.json'],
    status: 'draft',
  });

  assert.deepEqual(errors, []);
});

test('validateScriptRecord rejects unsupported ROI language', () => {
  const errors = validateScriptRecord({
    id: 'script-servicios-locales-001',
    ideaId: 'idea-servicios-locales-001',
    sector: 'servicios-locales',
    durationSecondsEstimate: 35,
    title: 'Ventas garantizadas',
    hook: 'Con este sitio duplicas ventas garantizado.',
    bodyLines: ['Tenemos retorno de inversion garantizado.'],
    cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
    approvedClaimIds: ['claim-one'],
    status: 'draft',
  });

  assert.equal(errors.some(error => error.includes('unsafe claim')), true);
});

test('record validators require cross-reference fields', () => {
  assert.equal(validateKnowledgeCardRecord({ id: 'knowledge-servicios-locales-001' }).length > 0, true);
  assert.equal(validateQaDecisionRecord({ scriptId: 'script-servicios-locales-001' }).length > 0, true);
  assert.equal(validateRenderQueueRecord({ id: 'render-servicios-locales-001' }).length > 0, true);
  assert.equal(validateAssetPickRecord({ id: 'asset-servicios-locales-001' }).length > 0, true);
  assert.equal(validatePublishLogRecord({ renderId: 'render-servicios-locales-001' }).length > 0, true);
});

test('validateRenderQueueRecord accepts human-gated render metadata', () => {
  assert.deepEqual(validateRenderQueueRecord(validRenderQueueRecord()), []);
});

test('validateRenderQueueRecord accepts an audited terminal approval tied to one asset', () => {
  assert.deepEqual(validateRenderQueueRecord(validRenderQueueRecord({
    status: 'approved',
    humanApprovalStatus: 'approved',
    humanApprovalBy: 'Campaign approver',
    humanApprovalAt: '2026-08-17T18:00:00.000Z',
    assetLicenseStatus: 'verified',
    assetLicenseVerifiedBy: 'License reviewer',
    assetLicenseVerifiedAt: '2026-08-17T18:05:00.000Z',
    approvedAssetId: 'asset-render-servicios-locales-001',
  })), []);
});

test('validateRenderQueueRecord rejects terminal approval without audit evidence', () => {
  const errors = validateRenderQueueRecord(validRenderQueueRecord({
    status: 'approved',
    humanApprovalStatus: 'approved',
    assetLicenseStatus: 'verified',
  }));

  assert.equal(errors.some(error => error.includes('humanApprovalBy')), true);
  assert.equal(errors.some(error => error.includes('humanApprovalAt')), true);
  assert.equal(errors.some(error => error.includes('assetLicenseVerifiedBy')), true);
  assert.equal(errors.some(error => error.includes('assetLicenseVerifiedAt')), true);
  assert.equal(errors.some(error => error.includes('approvedAssetId')), true);
});

test('validateRenderQueueRecord rejects unsafe draft render metadata', () => {
  const errors = validateRenderQueueRecord({
    id: 'render-servicios-locales-001',
    scriptId: 'script-servicios-locales-001',
    sector: 'servicios-locales',
    format: 'vertical-short',
    voice: 'manual-selection',
    assetSource: 'approved-claims',
    captionStyle: 'direct',
    status: 'draft',
  });

  assert.equal(errors.some(error => error.includes('format must be vertical-9x16')), true);
  assert.equal(errors.some(error => error.includes('assetSource must be approved-local-assets-only')), true);
  assert.equal(errors.some(error => error.includes('captionStyle must be large-readable-spanish')), true);
  assert.equal(errors.some(error => error.includes('status must be one of: needs-review, approved, rejected')), true);
  assert.equal(errors.some(error => error.includes('humanApprovalRequired must be true')), true);
  assert.equal(errors.some(error => error.includes('humanApprovalStatus must be one of: pending, approved, rejected')), true);
  assert.equal(errors.some(error => error.includes('assetLicenseStatus must be one of: pending-local-asset-selection, verified, rejected')), true);
  assert.equal(errors.some(error => error.includes('notes must be a string')), true);
});

test('findUnsafeClaimHits scans nested string arrays', () => {
  const hits = findUnsafeClaimHits({
    bodyLines: ['Sin testimonio inventado.', 'Nada de ROI garantizado.'],
  });

  assert.deepEqual(hits.map(hit => hit.rule), ['fake-testimonial', 'guaranteed-roi']);
});

test('groupBy returns a Map keyed by callback', () => {
  const grouped = groupBy(
    [
      { sector: 'servicios-locales', id: 'one' },
      { sector: 'consultorios', id: 'two' },
      { sector: 'servicios-locales', id: 'three' },
    ],
    record => record.sector,
  );

  assert.equal(grouped instanceof Map, true);
  assert.deepEqual(grouped.get('servicios-locales').map(record => record.id), ['one', 'three']);
  assert.deepEqual(grouped.get('consultorios').map(record => record.id), ['two']);
});

test('date validation accepts strict UTC ISO timestamp strings', () => {
  const errors = validateQaDecisionRecord(validQaDecisionRecord({
    reviewedAt: '2026-05-27T19:40:00.000Z',
  }));

  assert.deepEqual(errors, []);
});

test('date validation rejects ambiguous local formats', () => {
  const errors = validateQaDecisionRecord(validQaDecisionRecord({
    reviewedAt: '05/27/2026',
  }));

  assert.equal(errors.some(error => error.includes('reviewedAt')), true);
});

test('date validation rejects invalid calendar dates', () => {
  const errors = validateQaDecisionRecord(validQaDecisionRecord({
    reviewedAt: '2026-02-30T00:00:00.000Z',
  }));

  assert.equal(errors.some(error => error.includes('reviewedAt')), true);
});

test('findUnsafeClaimHits catches ROI promises before the sales term', () => {
  const hits = findUnsafeClaimHits([
    'Duplica tus ventas con tu sitio web.',
    'Garantizamos mas ventas.',
  ]);

  assert.deepEqual(hits.map(hit => hit.rule), ['guaranteed-roi', 'guaranteed-roi']);
});

test('findUnsafeClaimHits targets fake testimonials without blocking ordinary mentions', () => {
  assert.deepEqual(findUnsafeClaimHits('Testimonio inventado de cliente real.').map(hit => hit.rule), [
    'fake-testimonial',
  ]);
  assert.deepEqual(findUnsafeClaimHits('sin depender de testimonios'), []);
});

test('validateScriptRecord rejects duration estimates outside 1 to 45 seconds', () => {
  assert.equal(validateScriptRecord(validScriptRecord({ durationSecondsEstimate: 0 })).some(error => error.includes('durationSecondsEstimate')), true);
  assert.equal(validateScriptRecord(validScriptRecord({ durationSecondsEstimate: 46 })).some(error => error.includes('durationSecondsEstimate')), true);
});

test('validatePublishLogRecord accepts null metrics and rejects negative metrics', () => {
  assert.deepEqual(validatePublishLogRecord(validPublishLogRecord({
    threeSecondRetention: null,
    averageWatchTimeSeconds: null,
  })), []);

  assert.equal(validatePublishLogRecord(validPublishLogRecord({
    views: -1,
  })).some(error => error.includes('views')), true);
});

test('validateAssetPickRecord accepts Pexels and Pixabay license evidence', () => {
  assert.deepEqual(validateAssetPickRecord(validAssetPickRecord()), []);

  const errors = validateAssetPickRecord(validAssetPickRecord({
    source: 'unsplash',
    commercialUseAllowed: false,
    attributionRequired: true,
    standaloneRedistributionProhibited: false,
  }));

  assert.equal(errors.some(error => error.includes('source must be one of: pexels, pixabay')), true);
  assert.equal(errors.some(error => error.includes('commercialUseAllowed must be true')), true);
  assert.equal(errors.some(error => error.includes('attributionRequired must be false')), true);
  assert.equal(errors.some(error => error.includes('standaloneRedistributionProhibited must be true')), true);
});

test('validateAssetPickRecord requires immutable file metadata for selected assets', () => {
  const errors = validateAssetPickRecord(validAssetPickRecord({
    localFilePath: '',
    sha256: undefined,
    byteLength: undefined,
    contentType: undefined,
  }));

  assert.equal(errors.some(error => error.includes('localFilePath')), true);
  assert.equal(errors.some(error => error.includes('sha256')), true);
  assert.equal(errors.some(error => error.includes('byteLength')), true);
  assert.equal(errors.some(error => error.includes('contentType')), true);
});

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
    approvedClaimIds: ['claim-one'],
    status: 'draft',
    ...overrides,
  };
}

function validQaDecisionRecord(overrides = {}) {
  return {
    scriptId: 'script-servicios-locales-001',
    decision: 'approved',
    reviewedAt: '2026-05-27T19:40:00.000Z',
    reviewer: 'Alec',
    checks: {
      under45Seconds: true,
      sectorClear: true,
      usefulBeforeCta: true,
      rightProductCta: true,
      noUnsupportedRoi: true,
      noFakeTestimonial: true,
      noDraftContradiction: true,
      statisticsSourcedOrRemoved: true,
    },
    notes: 'Approved for pilot render.',
    ...overrides,
  };
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

function validAssetPickRecord(overrides = {}) {
  return {
    id: 'asset-servicios-locales-001',
    renderId: 'render-servicios-locales-001',
    scriptId: 'script-servicios-locales-001',
    sector: 'servicios-locales',
    source: 'pexels',
    mediaType: 'video',
    sourcePageUrl: 'https://www.pexels.com/video/example',
    creator: 'Example Creator',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/legal-pages/license/',
    commercialUseAllowed: true,
    attributionRequired: false,
    standaloneRedistributionProhibited: true,
    trademarkOrRecognizablePeopleCheck: 'No visible trademarks or recognizable people selected.',
    localFilePath: 'devonly/campaigns/zoositioweb/pilot/selected-assets/example.mp4',
    sha256: 'a'.repeat(64),
    byteLength: 1024,
    contentType: 'video/mp4',
    notes: 'Candidate b-roll for pilot.',
    status: 'selected',
    ...overrides,
  };
}
