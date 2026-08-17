import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const COMMIT_REGEX = /^[0-9a-f]{40}$/;
const DEFAULT_APPROVAL_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../campaigns/zoositioweb/mpt-approved-source.json',
);

export function assertApprovedMptSource(approval) {
  if (
    approval?.schemaVersion !== 1
    || typeof approval.sourceRepository !== 'string'
    || approval.sourceRepository.trim() === ''
    || typeof approval.approvedCommit !== 'string'
    || !COMMIT_REGEX.test(approval.approvedCommit)
    || typeof approval.reviewedBy !== 'string'
    || approval.reviewedBy.trim() === ''
    || !isStrictUtcTimestamp(approval.reviewedAt)
  ) {
    throw new Error(
      'No immutable MoneyPrinterTurbo source is approved; complete the tracked source review record first',
    );
  }
}

export function assertMptCheckoutMatchesApproval({
  approval,
  headCommit,
  sourceRepository,
  statusPorcelain,
}) {
  assertApprovedMptSource(approval);

  if (String(headCommit).trim() !== approval.approvedCommit) {
    throw new Error('MoneyPrinterTurbo checkout commit does not match the approved commit');
  }
  if (String(sourceRepository).trim() !== approval.sourceRepository) {
    throw new Error('MoneyPrinterTurbo checkout repository does not match the approved source repository');
  }
  if (String(statusPorcelain).trim() !== '') {
    throw new Error('MoneyPrinterTurbo checkout has uncommitted changes');
  }
}

export async function verifyApprovedMptCheckout({
  mptRoot,
  approvalFile = DEFAULT_APPROVAL_FILE,
}) {
  const approval = JSON.parse(await readFile(approvalFile, 'utf8'));
  assertApprovedMptSource(approval);

  const checkoutRoot = await realpath(path.resolve(mptRoot));
  const [headCommit, sourceRepository, statusPorcelain] = await Promise.all([
    runGit(checkoutRoot, ['rev-parse', '--verify', 'HEAD']),
    runGit(checkoutRoot, ['config', '--get', 'remote.origin.url']),
    runGit(checkoutRoot, ['status', '--porcelain', '--untracked-files=all']),
  ]);

  assertMptCheckoutMatchesApproval({
    approval,
    headCommit,
    sourceRepository,
    statusPorcelain,
  });

  return {
    checkoutRoot,
    sourceRepository: approval.sourceRepository,
    approvedCommit: approval.approvedCommit,
    reviewedBy: approval.reviewedBy,
    reviewedAt: approval.reviewedAt,
  };
}

async function runGit(checkoutRoot, args) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', checkoutRoot, ...args], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: 10000,
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    throw new Error('Unable to verify the approved MoneyPrinterTurbo checkout');
  }
}

function isStrictUtcTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
}
