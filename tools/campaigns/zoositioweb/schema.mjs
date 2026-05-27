export const SECTOR_IDS = new Set(['servicios-locales', 'consultorios', 'despachos']);
export const STATUS_VALUES = new Set(['draft', 'needs-review', 'approved', 'rejected', 'rendered', 'published']);
export const PRODUCT = 'zoositioweb.com.mx';

const UNSAFE_CLAIM_RULES = [
  { id: 'guaranteed-roi', regex: /\b(?:(?:roi|retorno(?:\s+de\s+inversion)?|ventas?)\b.{0,40}\b(?:garantizad[oa]s?|garantizamos|asegurad[oa]s?|aseguramos|duplic(?:a|as|ar|amos)|triplic(?:a|as|ar|amos))|(?:garantizad[oa]s?|garantizamos|asegurad[oa]s?|aseguramos|duplic(?:a|as|ar|amos)|triplic(?:a|as|ar|amos))\b.{0,40}\b(?:roi|retorno(?:\s+de\s+inversion)?|ventas?))\b/i },
  { id: 'fake-testimonial', regex: /\b(?:(?:testimonios?)\b.{0,40}\b(?:inventad[oa]s?|fals[oa]s?|simulad[oa]s?|cliente\s+real|caso\s+real|historia\s+real)|(?:inventad[oa]s?|fals[oa]s?|simulad[oa]s?|cliente\s+real|caso\s+real|historia\s+real)\b.{0,40}\b(?:testimonios?))\b/i },
  { id: 'unsupported-free', regex: /\b(?:gratis|sin\s+costo|costo\s+cero)\b/i },
  { id: 'unsupported-numbered-claim', regex: /\b\d{2,3}%\b/i },
];

const STRICT_UTC_ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const BLOG_POTENTIAL_VALUES = new Set(['low', 'medium', 'high']);
const QA_DECISION_VALUES = new Set(['approved', 'rejected', 'needs-review']);
const PUBLISH_METRIC_FIELDS = [
  'views',
  'threeSecondRetention',
  'averageWatchTimeSeconds',
  'likes',
  'comments',
  'saves',
  'shares',
  'profileVisits',
  'linkClicks',
  'whatsappConversations',
];

export function parseJsonl(text, file) {
  return text.split(/\r?\n/).flatMap((lineText, index) => {
    if (lineText.trim() === '') {
      return [];
    }

    const line = index + 1;

    try {
      return [{ value: JSON.parse(lineText), line, file }];
    } catch (error) {
      throw new Error(`Invalid JSON in ${file}:${line}: ${error.message}`);
    }
  });
}

export function findUnsafeClaimHits(value) {
  const hits = [];

  function visit(current) {
    if (typeof current === 'string') {
      for (const rule of UNSAFE_CLAIM_RULES) {
        if (rule.regex.test(current)) {
          hits.push({ rule: rule.id, text: current });
        }
      }

      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }

      return;
    }

    if (isPlainObject(current)) {
      for (const item of Object.values(current)) {
        visit(item);
      }
    }
  }

  visit(value);
  return hits;
}

export function validateIdeaRecord(record) {
  const errors = baseRecordErrors(record);

  requireString(record, 'id', errors);
  requireEnum(record, 'sector', SECTOR_IDS, errors);
  requireString(record, 'hookType', errors);
  requireString(record, 'audience', errors);
  requireString(record, 'problem', errors);
  requireString(record, 'usefulAngle', errors);
  requireProduct(record, errors);
  requireStringArray(record, 'sourceDraftPaths', errors);
  requireEnum(record, 'status', STATUS_VALUES, errors);

  return errors;
}

export function validateScriptRecord(record) {
  const errors = baseRecordErrors(record);

  requireString(record, 'id', errors);
  requireString(record, 'ideaId', errors);
  requireEnum(record, 'sector', SECTOR_IDS, errors);
  requireDurationEstimate(record, errors);
  requireString(record, 'title', errors);
  requireString(record, 'hook', errors);
  requireStringArray(record, 'bodyLines', errors);
  requireString(record, 'cta', errors);
  requireStringArray(record, 'approvedClaimIds', errors);
  requireEnum(record, 'status', STATUS_VALUES, errors);
  rejectUnsafeClaims(record, errors);

  return errors;
}

export function validateKnowledgeCardRecord(record) {
  const errors = baseRecordErrors(record);

  requireString(record, 'id', errors);
  requireString(record, 'scriptId', errors);
  requireEnum(record, 'sector', SECTOR_IDS, errors);
  requireString(record, 'audience', errors);
  requireString(record, 'problem', errors);
  requireString(record, 'insight', errors);
  requireString(record, 'approvedProductClaim', errors);
  requireString(record, 'sourceDraftPath', errors);
  requireProduct(record, errors);
  requireEnum(record, 'blogPotential', BLOG_POTENTIAL_VALUES, errors);
  requireString(record, 'blogTitleCandidate', errors);
  requireString(record, 'faqCandidate', errors);
  requireStringArray(record, 'evidenceNeeded', errors, { allowEmpty: true });
  requireEnum(record, 'status', STATUS_VALUES, errors);
  rejectUnsafeClaims(record, errors);

  return errors;
}

export function validateQaDecisionRecord(record) {
  const errors = baseRecordErrors(record);

  requireString(record, 'scriptId', errors);
  requireEnum(record, 'decision', QA_DECISION_VALUES, errors);
  requireIsoDateString(record, 'reviewedAt', errors);
  requireString(record, 'reviewer', errors);
  requireChecksObject(record, errors);
  requireString(record, 'notes', errors, { allowEmpty: true });

  return errors;
}

export function validateRenderQueueRecord(record) {
  const errors = baseRecordErrors(record);

  requireString(record, 'id', errors);
  requireString(record, 'scriptId', errors);
  requireEnum(record, 'sector', SECTOR_IDS, errors);
  requireExactValue(record, 'format', 'vertical-9x16', errors);
  requireString(record, 'voice', errors);
  requireExactValue(record, 'assetSource', 'approved-local-assets-only', errors);
  requireExactValue(record, 'captionStyle', 'large-readable-spanish', errors);
  requireExactValue(record, 'status', 'needs-review', errors);
  requireExactValue(record, 'humanApprovalRequired', true, errors);
  requireExactValue(record, 'humanApprovalStatus', 'pending', errors);
  requireExactValue(record, 'assetLicenseStatus', 'pending-local-asset-selection', errors);
  requireString(record, 'notes', errors);

  return errors;
}

export function validatePublishLogRecord(record) {
  const errors = baseRecordErrors(record);

  requireString(record, 'renderId', errors);
  requireString(record, 'platform', errors);
  requireIsoDateString(record, 'publishedAt', errors);
  requireString(record, 'url', errors, { allowEmpty: true });
  requireString(record, 'notes', errors, { allowEmpty: true });

  for (const field of PUBLISH_METRIC_FIELDS) {
    requireMetric(record, field, errors);
  }

  return errors;
}

export function groupBy(values, keyFn) {
  const grouped = new Map();

  for (const value of values) {
    const key = keyFn(value);
    const group = grouped.get(key);

    if (group) {
      group.push(value);
    } else {
      grouped.set(key, [value]);
    }
  }

  return grouped;
}

function baseRecordErrors(record) {
  if (!isPlainObject(record)) {
    return ['record must be an object'];
  }

  return [];
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record, field, errors, { allowEmpty = false } = {}) {
  if (typeof record?.[field] !== 'string') {
    errors.push(`${field} must be a string`);
    return;
  }

  if (!allowEmpty && record[field].trim() === '') {
    errors.push(`${field} must not be empty`);
  }
}

function requireStringArray(record, field, errors, { allowEmpty = false } = {}) {
  if (!Array.isArray(record?.[field])) {
    errors.push(`${field} must be an array of strings`);
    return;
  }

  if (!allowEmpty && record[field].length === 0) {
    errors.push(`${field} must not be empty`);
  }

  for (const [index, value] of record[field].entries()) {
    if (typeof value !== 'string') {
      errors.push(`${field}[${index}] must be a string`);
      continue;
    }

    if (!allowEmpty && value.trim() === '') {
      errors.push(`${field}[${index}] must not be empty`);
    }
  }
}

function requireEnum(record, field, values, errors) {
  if (!values.has(record?.[field])) {
    errors.push(`${field} must be one of: ${Array.from(values).join(', ')}`);
  }
}

function requireExactValue(record, field, expected, errors) {
  if (record?.[field] !== expected) {
    errors.push(`${field} must be ${expected}`);
  }
}

function requireProduct(record, errors) {
  if (record?.ctaProduct !== PRODUCT) {
    errors.push(`ctaProduct must be ${PRODUCT}`);
  }
}

function requireDurationEstimate(record, errors) {
  const value = record?.durationSecondsEstimate;

  if (!Number.isFinite(value) || value < 1 || value > 45) {
    errors.push('durationSecondsEstimate must be a number between 1 and 45');
  }
}

function requireIsoDateString(record, field, errors) {
  requireString(record, field, errors);

  if (typeof record?.[field] !== 'string') {
    return;
  }

  const value = record[field];
  const parsed = new Date(value);

  if (!STRICT_UTC_ISO_TIMESTAMP_REGEX.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    errors.push(`${field} must be a strict UTC ISO timestamp`);
  }
}

function requireChecksObject(record, errors) {
  if (!isPlainObject(record?.checks)) {
    errors.push('checks must be an object');
    return;
  }

  for (const [field, value] of Object.entries(record.checks)) {
    if (typeof value !== 'boolean') {
      errors.push(`checks.${field} must be a boolean`);
    }
  }
}

function requireMetric(record, field, errors) {
  const value = record?.[field];

  if (value === null) {
    return;
  }

  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${field} must be a non-negative number or null`);
  }
}

function rejectUnsafeClaims(record, errors) {
  for (const hit of findUnsafeClaimHits(record)) {
    errors.push(`unsafe claim (${hit.rule}): ${hit.text}`);
  }
}
