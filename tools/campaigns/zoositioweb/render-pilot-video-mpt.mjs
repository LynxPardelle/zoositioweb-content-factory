import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PILOT_DIR, readPilotDataset } from './validate-pilot.mjs';
import { ffprobeDuration } from './render-pilot-video.mjs';

const DEFAULT_AUDIO_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/audio/polly';
const DEFAULT_OUTPUT_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/renders/mpt';
const SAFE_RENDER_ID_REGEX = /^render-[a-z0-9-]+-\d{3}$/;

export function parseArgs(rawArgs) {
  const options = {};

  for (const arg of rawArgs) {
    if (arg.startsWith('--pilot-dir=')) {
      options.pilotDir = arg.slice('--pilot-dir='.length);
    } else if (arg.startsWith('--audio-dir=')) {
      options.audioDir = arg.slice('--audio-dir='.length);
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.slice('--output-dir='.length);
    } else if (arg.startsWith('--render-id=')) {
      options.renderId = arg.slice('--render-id='.length);
    } else if (arg.startsWith('--mpt-root=')) {
      options.mptRoot = arg.slice('--mpt-root='.length);
    } else if (arg.startsWith('--python=')) {
      options.pythonPath = arg.slice('--python='.length);
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

export async function renderPilotVideoWithMpt({
  pilotDir = DEFAULT_PILOT_DIR,
  audioDir = DEFAULT_AUDIO_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  renderId,
  mptRoot = process.env.MPT_ROOT,
  pythonPath,
} = {}) {
  if (!renderId) {
    throw new Error('Missing required --render-id value');
  }

  if (!mptRoot) {
    throw new Error('Missing required --mpt-root value or MPT_ROOT environment variable');
  }

  assertSafeRenderId(renderId);

  const resolvedMptRoot = path.resolve(mptRoot);
  const resolvedPythonPath = path.resolve(pythonPath || defaultMptPython(resolvedMptRoot));
  const dataset = await readPilotDataset(pilotDir);
  const render = dataset.renderQueue.find(item => item.id === renderId);

  if (!render) {
    throw new Error(`Render ID not found in render queue: ${renderId}`);
  }

  const script = dataset.scripts.find(item => item.id === render.scriptId);
  const asset = dataset.assetPicks.find(item => item.renderId === renderId && item.status === 'selected');

  if (!script) {
    throw new Error(`Missing script for render ${render.id}: ${render.scriptId}`);
  }

  if (!asset) {
    throw new Error(`Missing selected asset pick for render ${render.id}`);
  }

  if (!existsSync(resolvedMptRoot)) {
    throw new Error(`MoneyPrinterTurbo root not found: ${resolvedMptRoot}`);
  }

  if (!existsSync(resolvedPythonPath)) {
    throw new Error(`MoneyPrinterTurbo Python not found: ${resolvedPythonPath}`);
  }

  const sourceVideo = path.resolve(asset.localFilePath);
  const sourceAudio = path.resolve(audioDir, `${renderId}.mp3`);
  const durationSeconds = await ffprobeDuration(sourceAudio);
  const renderDir = path.resolve(outputDir, renderId);
  const subtitleFile = path.join(renderDir, 'subtitle.srt');
  const combinedFile = path.join(renderDir, 'combined.mp4');
  const rawOutputFile = path.join(renderDir, `${renderId}.raw.mp4`);
  const outputFile = path.join(renderDir, `${renderId}.mp4`);

  await mkdir(renderDir, { recursive: true });
  await writeFile(subtitleFile, renderSrtSubtitles({
    events: buildMptCaptionEvents({ script, totalDurationSeconds: durationSeconds }),
  }), 'utf8');

  await runMptBridge({
    mptRoot: resolvedMptRoot,
    pythonPath: resolvedPythonPath,
    sourceVideo,
    sourceAudio,
    subtitleFile,
    combinedFile,
    outputFile: rawOutputFile,
  });
  await trimVideoToDuration({
    inputFile: rawOutputFile,
    outputFile,
    durationSeconds,
  });

  return {
    renderId,
    scriptId: script.id,
    assetId: asset.id,
    mptRoot: resolvedMptRoot,
    sourceVideo,
    sourceAudio,
    subtitleFile,
    combinedFile,
    outputFile,
    durationSeconds: Number(durationSeconds.toFixed(3)),
  };
}

export function renderSrtSubtitles({ events }) {
  return events.map((event, index) => [
    index + 1,
    `${formatSrtTime(event.start)} --> ${formatSrtTime(event.end)}`,
    event.text,
    '',
  ].join('\n')).join('\n');
}

export function buildMptCaptionEvents({ script, totalDurationSeconds }) {
  const segments = [
    script.hook,
    ...script.bodyLines,
    script.cta,
  ].flatMap(text => splitCaptionText(text));
  const readableDuration = Math.max(totalDurationSeconds - 0.4, 1);
  const totalWeight = segments.reduce((total, text) => total + captionWeight(text), 0);
  const endLimit = totalDurationSeconds - 0.1;
  let current = 0.2;

  return segments.map((text, index) => {
    const isLast = index === segments.length - 1;
    const remainingSegments = segments.length - index;
    const remainingDuration = Math.max(endLimit - current, 0.8);
    const minReserved = Math.max(0, remainingSegments - 1) * 1.2;
    const weightedDuration = readableDuration * (captionWeight(text) / totalWeight);
    const duration = isLast
      ? remainingDuration
      : Math.min(Math.max(weightedDuration, 1.4), Math.max(1.4, remainingDuration - minReserved));
    const start = current;
    const end = Math.min(endLimit, current + duration);

    current = end;

    return {
      start,
      end,
      text,
    };
  });
}

function splitCaptionText(text, maxLineLength = 42) {
  const words = String(text).trim().split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLineLength && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function captionWeight(text) {
  return Math.max(text.length, 24);
}

function defaultMptPython(mptRoot) {
  return process.platform === 'win32'
    ? path.join(mptRoot, '.venv', 'Scripts', 'python.exe')
    : path.join(mptRoot, '.venv', 'bin', 'python');
}

function runMptBridge({
  mptRoot,
  pythonPath,
  sourceVideo,
  sourceAudio,
  subtitleFile,
  combinedFile,
  outputFile,
}) {
  const bridgePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    'mpt-render-bridge.py',
  );

  return runCommand(pythonPath, [
    bridgePath,
    `--mpt-root=${mptRoot}`,
    `--source-video=${sourceVideo}`,
    `--source-audio=${sourceAudio}`,
    `--subtitle-file=${subtitleFile}`,
    `--combined-file=${combinedFile}`,
    `--output-file=${outputFile}`,
  ], {
    cwd: mptRoot,
    timeoutMs: 10 * 60 * 1000,
  });
}

async function trimVideoToDuration({ inputFile, outputFile, durationSeconds }) {
  const tempOutputFile = `${outputFile}.tmp.mp4`;

  await runCommand('ffmpeg', [
    '-y',
    '-i',
    inputFile,
    '-t',
    durationSeconds.toFixed(3),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    tempOutputFile,
  ]);
  await rename(tempOutputFile, outputFile);
}

function formatSrtTime(value) {
  const milliseconds = Math.max(0, Math.round(value * 1000));
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + `,${String(millis).padStart(3, '0')}`;
}

function assertSafeRenderId(renderId) {
  if (!SAFE_RENDER_ID_REGEX.test(renderId)) {
    throw new Error(`Unsafe render ID for output filename: ${renderId}`);
  }
}

function runCommand(command, args, { cwd, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);

      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`${command} failed with exit code ${code}: ${stderr || stdout}`));
    });
  });
}

function isCliMode() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliMode()) {
  try {
    const result = await renderPilotVideoWithMpt(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
