import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertApprovedMptSource,
  assertMptCheckoutMatchesApproval,
} from '../campaigns/zoositioweb/mpt-provenance.mjs';

const approvedSource = {
  schemaVersion: 1,
  sourceRepository: 'https://example.test/approved/MoneyPrinterTurbo.git',
  approvedCommit: 'a'.repeat(40),
  reviewedBy: 'Independent source reviewer',
  reviewedAt: '2026-08-17T18:00:00.000Z',
};

test('MPT provenance rejects an unapproved source record', () => {
  assert.throws(() => assertApprovedMptSource({
    schemaVersion: 1,
    sourceRepository: null,
    approvedCommit: null,
    reviewedBy: null,
    reviewedAt: null,
  }), /no immutable MoneyPrinterTurbo source is approved/i);
});

test('MPT provenance accepts a complete immutable source review', () => {
  assert.doesNotThrow(() => assertApprovedMptSource(approvedSource));
});

test('MPT checkout must exactly match the approved clean source revision', () => {
  assert.doesNotThrow(() => assertMptCheckoutMatchesApproval({
    approval: approvedSource,
    headCommit: approvedSource.approvedCommit,
    sourceRepository: approvedSource.sourceRepository,
    statusPorcelain: '',
  }));
  assert.throws(() => assertMptCheckoutMatchesApproval({
    approval: approvedSource,
    headCommit: 'b'.repeat(40),
    sourceRepository: approvedSource.sourceRepository,
    statusPorcelain: '',
  }), /commit does not match/i);
  assert.throws(() => assertMptCheckoutMatchesApproval({
    approval: approvedSource,
    headCommit: approvedSource.approvedCommit,
    sourceRepository: 'https://example.test/attacker/fork.git',
    statusPorcelain: '',
  }), /repository does not match/i);
  assert.throws(() => assertMptCheckoutMatchesApproval({
    approval: approvedSource,
    headCommit: approvedSource.approvedCommit,
    sourceRepository: approvedSource.sourceRepository,
    statusPorcelain: ' M app/services/video.py',
  }), /uncommitted changes/i);
});
