import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PILOT_DIR, readPilotDataset } from './validate-pilot.mjs';
import { assertRenderReady } from './render-safety.mjs';

const DEFAULT_OUTPUT_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/audio/polly';
const DEFAULT_ENGINE = 'neural';
const DEFAULT_VOICE_ID = 'Mia';
const DEFAULT_LANGUAGE_CODE = 'es-MX';
const DEFAULT_OUTPUT_FORMAT = 'mp3';
const ENGINE_COST_PER_MILLION_CHARS_USD = {
  standard: 4,
  neural: 16,
  generative: 30,
  'long-form': 100,
};

export function parseArgs(rawArgs) {
  const options = {};

  for (const arg of rawArgs) {
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg.startsWith('--pilot-dir=')) {
      options.pilotDir = arg.slice('--pilot-dir='.length);
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.slice('--output-dir='.length);
    } else if (arg.startsWith('--render-id=')) {
      options.renderId = arg.slice('--render-id='.length);
    } else if (arg.startsWith('--voice-id=')) {
      options.voiceId = arg.slice('--voice-id='.length);
    } else if (arg.startsWith('--engine=')) {
      options.engine = arg.slice('--engine='.length);
    } else if (arg.startsWith('--language-code=')) {
      options.languageCode = arg.slice('--language-code='.length);
    } else if (arg.startsWith('--region=')) {
      options.region = arg.slice('--region='.length);
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

export async function buildPollyAudioPlan({
  pilotDir = DEFAULT_PILOT_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  renderId,
  voiceId = DEFAULT_VOICE_ID,
  engine = DEFAULT_ENGINE,
  languageCode = DEFAULT_LANGUAGE_CODE,
} = {}) {
  const dataset = await readPilotDataset(pilotDir);
  const scriptsById = new Map(dataset.scripts.map(script => [script.id, script]));
  const renders = renderId
    ? dataset.renderQueue.filter(render => render.id === renderId)
    : dataset.renderQueue;

  if (renderId && renders.length === 0) {
    throw new Error(`Render ID not found in render queue: ${renderId}`);
  }

  const resolvedOutputDir = path.resolve(outputDir);
  const plans = renders.map(render => {
    const script = scriptsById.get(render.scriptId);

    if (!script) {
      throw new Error(`Missing script for render ${render.id}: ${render.scriptId}`);
    }

    const text = scriptVoiceoverText(script);
    const textFile = path.join(resolvedOutputDir, 'text', `${render.id}.txt`);
    const audioFile = path.join(resolvedOutputDir, `${render.id}.${DEFAULT_OUTPUT_FORMAT}`);

    return {
      renderId: render.id,
      scriptId: script.id,
      sector: render.sector,
      voiceId,
      engine,
      languageCode,
      outputFormat: DEFAULT_OUTPUT_FORMAT,
      characters: text.length,
      estimatedCostUsd: estimateCostUsd({ characters: text.length, engine }),
      text,
      textFile,
      audioFile,
    };
  });

  return {
    outputDir: resolvedOutputDir,
    count: plans.length,
    characters: plans.reduce((total, plan) => total + plan.characters, 0),
    estimatedCostUsd: plans.reduce((total, plan) => total + plan.estimatedCostUsd, 0),
    plans,
  };
}

export function scriptVoiceoverText(script) {
  return [
    script.hook,
    ...script.bodyLines,
    script.cta,
  ].join('\n\n');
}

export function estimateCostUsd({ characters, engine }) {
  const costPerMillion = ENGINE_COST_PER_MILLION_CHARS_USD[engine];

  if (!Number.isFinite(costPerMillion)) {
    throw new Error(`Unsupported Polly engine for cost estimate: ${engine}`);
  }

  return (characters / 1_000_000) * costPerMillion;
}

export async function synthesizePollyAudio({
  execute = false,
  pilotDir = DEFAULT_PILOT_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  renderId,
  voiceId = DEFAULT_VOICE_ID,
  engine = DEFAULT_ENGINE,
  languageCode = DEFAULT_LANGUAGE_CODE,
  region,
} = {}) {
  const plan = await buildPollyAudioPlan({
    pilotDir,
    outputDir,
    renderId,
    voiceId,
    engine,
    languageCode,
  });

  if (!execute) {
    return {
      ...plan,
      dryRun: true,
    };
  }

  const dataset = await readPilotDataset(pilotDir);
  const rendersById = new Map(dataset.renderQueue.map(render => [render.id, render]));
  const selectedAssetsByRenderId = new Map(
    dataset.assetPicks
      .filter(asset => asset.status === 'selected')
      .map(asset => [asset.renderId, asset]),
  );

  for (const item of plan.plans) {
    assertRenderReady({
      render: rendersById.get(item.renderId),
      asset: selectedAssetsByRenderId.get(item.renderId),
    });
  }

  await mkdir(path.join(plan.outputDir, 'text'), { recursive: true });

  for (const item of plan.plans) {
    await writeFile(item.textFile, item.text, 'utf8');
    await runAwsPolly({
      item,
      region,
    });
  }

  return {
    ...plan,
    dryRun: false,
  };
}

function runAwsPolly({ item, region }) {
  const command = 'aws';
  const args = [
    'polly',
    'synthesize-speech',
    '--engine',
    item.engine,
    '--language-code',
    item.languageCode,
    '--voice-id',
    item.voiceId,
    '--output-format',
    item.outputFormat,
    '--text',
    `file://${item.textFile}`,
  ];

  if (region) {
    args.push('--region', region);
  }

  args.push(item.audioFile);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`AWS Polly failed for ${item.renderId} with exit code ${code}: ${stderr || stdout}`));
    });
  });
}

function isCliMode() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

function printableSummary(result) {
  return {
    dryRun: result.dryRun,
    count: result.count,
    characters: result.characters,
    estimatedCostUsd: Number(result.estimatedCostUsd.toFixed(6)),
    outputDir: result.outputDir,
    plans: result.plans.map(plan => ({
      renderId: plan.renderId,
      scriptId: plan.scriptId,
      sector: plan.sector,
      voiceId: plan.voiceId,
      engine: plan.engine,
      languageCode: plan.languageCode,
      characters: plan.characters,
      estimatedCostUsd: Number(plan.estimatedCostUsd.toFixed(6)),
      audioFile: plan.audioFile,
    })),
  };
}

if (isCliMode()) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await synthesizePollyAudio(options);
    console.log(JSON.stringify(printableSummary(result), null, 2));

    if (result.dryRun) {
      console.log('Dry run only. Add --execute to call AWS Polly and generate MP3 files.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
