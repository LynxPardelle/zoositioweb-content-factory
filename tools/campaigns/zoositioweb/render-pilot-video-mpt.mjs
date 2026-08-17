import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PILOT_DIR, readPilotDataset } from './validate-pilot.mjs';
import { ffprobeDuration } from './render-pilot-video.mjs';
import { verifyApprovedMptCheckout } from './mpt-provenance.mjs';
import {
  assertRenderReady,
  selectedAssetsDirectoryForPilot,
  verifySelectedAssetFile,
} from './render-safety.mjs';

const DEFAULT_AUDIO_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/audio/polly';
const DEFAULT_OUTPUT_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/renders/mpt';
const DEFAULT_ENHANCED_OUTPUT_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/renders/mpt-enhanced';
const SAFE_RENDER_ID_REGEX = /^render-[a-z0-9-]+-\d{3}$/;
const TRANSITIONS = new Set(['None', 'Shuffle', 'FadeIn', 'FadeOut', 'SlideIn', 'SlideOut']);
const CONCAT_MODES = new Set(['sequential', 'random']);

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
    } else if (arg.startsWith('--preset=')) {
      options.preset = arg.slice('--preset='.length);
    } else if (arg.startsWith('--transition=')) {
      options.transition = arg.slice('--transition='.length);
    } else if (arg.startsWith('--concat-mode=')) {
      options.concatMode = arg.slice('--concat-mode='.length);
    } else if (arg.startsWith('--clip-duration=')) {
      options.clipDuration = Number(arg.slice('--clip-duration='.length));
    } else if (arg.startsWith('--bgm-type=')) {
      options.bgmType = arg.slice('--bgm-type='.length);
    } else if (arg.startsWith('--bgm-file=')) {
      options.bgmFile = arg.slice('--bgm-file='.length);
    } else if (arg.startsWith('--bgm-volume=')) {
      options.bgmVolume = Number(arg.slice('--bgm-volume='.length));
    } else if (arg.startsWith('--subtitle-position=')) {
      options.subtitlePosition = arg.slice('--subtitle-position='.length);
    } else if (arg.startsWith('--custom-position=')) {
      options.customPosition = Number(arg.slice('--custom-position='.length));
    } else if (arg.startsWith('--font-size=')) {
      options.fontSize = Number(arg.slice('--font-size='.length));
    } else if (arg.startsWith('--stroke-width=')) {
      options.strokeWidth = Number(arg.slice('--stroke-width='.length));
    } else if (arg.startsWith('--cta=')) {
      options.cta = parseBoolean(arg.slice('--cta='.length));
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

export async function renderPilotVideoWithMpt({
  pilotDir = DEFAULT_PILOT_DIR,
  audioDir = DEFAULT_AUDIO_DIR,
  outputDir,
  renderId,
  mptRoot = process.env.MPT_ROOT,
  pythonPath,
  preset = 'standard',
  transition,
  concatMode,
  clipDuration,
  bgmType,
  bgmFile,
  bgmVolume,
  subtitlePosition,
  customPosition,
  fontSize,
  strokeWidth,
  cta,
} = {}) {
  if (!renderId) {
    throw new Error('Missing required --render-id value');
  }

  if (!mptRoot) {
    throw new Error('Missing required --mpt-root value or MPT_ROOT environment variable');
  }

  assertSafeRenderId(renderId);
  assertPreset(preset);

  const effectiveOutputDir = outputDir || (preset === 'enhanced'
    ? DEFAULT_ENHANCED_OUTPUT_DIR
    : DEFAULT_OUTPUT_DIR);
  const renderOptions = buildRenderOptions({
    preset,
    transition,
    concatMode,
    clipDuration,
    bgmType,
    bgmFile,
    bgmVolume,
    subtitlePosition,
    customPosition,
    fontSize,
    strokeWidth,
    cta,
  });

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

  assertRenderReady({ render, asset });
  const sourceAssets = selectSourceVideos({ dataset, primaryAsset: asset, preset });
  const verifiedAssets = [];

  for (const sourceAsset of sourceAssets) {
    verifiedAssets.push(await verifySelectedAssetFile({
      asset: sourceAsset,
      selectedAssetsDir: selectedAssetsDirectoryForPilot(pilotDir),
    }));
  }

  const mptProvenance = await verifyApprovedMptCheckout({ mptRoot: resolvedMptRoot });

  if (!existsSync(resolvedMptRoot)) {
    throw new Error(`MoneyPrinterTurbo root not found: ${resolvedMptRoot}`);
  }

  if (!existsSync(resolvedPythonPath)) {
    throw new Error(`MoneyPrinterTurbo Python not found: ${resolvedPythonPath}`);
  }

  const sourceVideos = verifiedAssets.map(item => item.path);
  const sourceAudio = path.resolve(audioDir, `${renderId}.mp3`);
  const durationSeconds = await ffprobeDuration(sourceAudio);
  const renderDir = path.resolve(effectiveOutputDir, renderId);
  const subtitleFile = path.join(renderDir, 'subtitle.srt');
  const combinedFile = path.join(renderDir, 'combined.mp4');
  const rawOutputFile = path.join(renderDir, `${renderId}.raw.mp4`);
  const trimmedOutputFile = path.join(renderDir, `${renderId}.trimmed.mp4`);
  const outputFile = path.join(renderDir, `${renderId}.mp4`);

  await mkdir(renderDir, { recursive: true });
  await writeFile(subtitleFile, renderSrtSubtitles({
    events: buildMptCaptionEvents({ script, totalDurationSeconds: durationSeconds }),
  }), 'utf8');

  await runMptBridge({
    mptRoot: resolvedMptRoot,
    pythonPath: resolvedPythonPath,
    sourceVideos,
    sourceAudio,
    subtitleFile,
    combinedFile,
    outputFile: rawOutputFile,
    options: renderOptions,
  });
  await trimVideoToDuration({
    inputFile: rawOutputFile,
    outputFile: renderOptions.cta ? trimmedOutputFile : outputFile,
    durationSeconds,
  });
  if (renderOptions.cta) {
    await appendCtaCard({
      inputFile: trimmedOutputFile,
      outputFile,
      renderDir,
      fontFile: path.join(resolvedMptRoot, 'resource', 'fonts', 'MicrosoftYaHeiBold.ttc'),
      title: 'zoositioweb.com.mx',
      subtitle: 'Pide tu sitio por WhatsApp',
      footnote: 'Presencia clara para vender mejor',
    });
  }

  return {
    renderId,
    scriptId: script.id,
    assetId: asset.id,
    mptRoot: resolvedMptRoot,
    mptProvenance,
    sourceVideos,
    sourceAudio,
    subtitleFile,
    combinedFile,
    outputFile,
    durationSeconds: Number(durationSeconds.toFixed(3)),
    preset,
    ...renderOptions,
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

export function selectSourceVideos({ dataset, primaryAsset, preset = 'standard' }) {
  if (preset !== 'enhanced') {
    return [primaryAsset];
  }

  const rendersById = new Map((dataset.renderQueue || []).map(render => [render.id, render]));
  const selectedAssets = dataset.assetPicks
    .filter(item => item.status === 'selected' && item.mediaType === 'video')
    .filter(item => {
      try {
        assertRenderReady({ render: rendersById.get(item.renderId), asset: item });
        return true;
      } catch {
        return false;
      }
    });
  const sameSector = selectedAssets
    .filter(item => item.sector === primaryAsset.sector && item.id !== primaryAsset.id);
  const fallback = selectedAssets
    .filter(item => item.sector !== primaryAsset.sector && item.id !== primaryAsset.id);

  return [primaryAsset, ...sameSector, ...fallback].slice(0, 5);
}

function buildRenderOptions({
  preset,
  transition,
  concatMode,
  clipDuration,
  bgmType,
  bgmFile,
  bgmVolume,
  subtitlePosition,
  customPosition,
  fontSize,
  strokeWidth,
  cta,
}) {
  const options = preset === 'enhanced'
    ? {
        transition: 'Shuffle',
        concatMode: 'random',
        clipDuration: 3,
        bgmType: 'random',
        bgmFile: '',
        bgmVolume: 0.07,
        subtitlePosition: 'bottom',
        customPosition: 70,
        fontSize: 54,
        strokeWidth: 3,
        cta: true,
      }
    : {
        transition: 'None',
        concatMode: 'sequential',
        clipDuration: 5,
        bgmType: '',
        bgmFile: '',
        bgmVolume: 0,
        subtitlePosition: 'bottom',
        customPosition: 70,
        fontSize: 60,
        strokeWidth: 3,
        cta: false,
      };

  const merged = {
    ...options,
    transition: transition ?? options.transition,
    concatMode: concatMode ?? options.concatMode,
    clipDuration: clipDuration ?? options.clipDuration,
    bgmType: bgmType ?? options.bgmType,
    bgmFile: bgmFile ?? options.bgmFile,
    bgmVolume: bgmVolume ?? options.bgmVolume,
    subtitlePosition: subtitlePosition ?? options.subtitlePosition,
    customPosition: customPosition ?? options.customPosition,
    fontSize: fontSize ?? options.fontSize,
    strokeWidth: strokeWidth ?? options.strokeWidth,
    cta: cta ?? options.cta,
  };

  validateRenderOptions(merged);
  return merged;
}

function validateRenderOptions(options) {
  if (!TRANSITIONS.has(options.transition)) {
    throw new Error(`Unsupported transition: ${options.transition}`);
  }
  if (!CONCAT_MODES.has(options.concatMode)) {
    throw new Error(`Unsupported concat mode: ${options.concatMode}`);
  }
  if (!Number.isInteger(options.clipDuration) || options.clipDuration < 1 || options.clipDuration > 10) {
    throw new Error(`Invalid clip duration: ${options.clipDuration}`);
  }
  if (!Number.isFinite(options.bgmVolume) || options.bgmVolume < 0 || options.bgmVolume > 0.3) {
    throw new Error(`Invalid BGM volume: ${options.bgmVolume}`);
  }
  if (!['top', 'bottom', 'center', 'custom'].includes(options.subtitlePosition)) {
    throw new Error(`Unsupported subtitle position: ${options.subtitlePosition}`);
  }
  if (!Number.isFinite(options.customPosition) || options.customPosition < 0 || options.customPosition > 100) {
    throw new Error(`Invalid custom position: ${options.customPosition}`);
  }
  if (!Number.isInteger(options.fontSize) || options.fontSize < 30 || options.fontSize > 100) {
    throw new Error(`Invalid font size: ${options.fontSize}`);
  }
  if (!Number.isInteger(options.strokeWidth) || options.strokeWidth < 0 || options.strokeWidth > 10) {
    throw new Error(`Invalid stroke width: ${options.strokeWidth}`);
  }
}

function assertPreset(preset) {
  if (!['standard', 'enhanced'].includes(preset)) {
    throw new Error(`Unsupported preset: ${preset}`);
  }
}

function defaultMptPython(mptRoot) {
  return process.platform === 'win32'
    ? path.join(mptRoot, '.venv', 'Scripts', 'python.exe')
    : path.join(mptRoot, '.venv', 'bin', 'python');
}

function runMptBridge({
  mptRoot,
  pythonPath,
  sourceVideos,
  sourceAudio,
  subtitleFile,
  combinedFile,
  outputFile,
  options,
}) {
  const bridgePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    'mpt-render-bridge.py',
  );

  return runCommand(pythonPath, [
    bridgePath,
    `--mpt-root=${mptRoot}`,
    ...sourceVideos.flatMap(sourceVideo => [`--source-video=${sourceVideo}`]),
    `--source-audio=${sourceAudio}`,
    `--subtitle-file=${subtitleFile}`,
    `--combined-file=${combinedFile}`,
    `--output-file=${outputFile}`,
    `--concat-mode=${options.concatMode}`,
    `--transition=${options.transition}`,
    `--clip-duration=${options.clipDuration}`,
    `--bgm-type=${options.bgmType}`,
    `--bgm-file=${options.bgmFile}`,
    `--bgm-volume=${options.bgmVolume}`,
    `--subtitle-position=${options.subtitlePosition}`,
    `--custom-position=${options.customPosition}`,
    `--font-size=${options.fontSize}`,
    `--stroke-width=${options.strokeWidth}`,
  ], {
    cwd: mptRoot,
    timeoutMs: 10 * 60 * 1000,
  });
}

export async function appendCtaCard({
  inputFile,
  outputFile,
  renderDir,
  fontFile,
  title,
  subtitle,
  footnote,
}) {
  const ctaFile = path.join(renderDir, 'cta-card.mp4');
  const concatFile = path.join(renderDir, 'concat-list.txt');
  const drawTextFont = escapeDrawtextPath(fontFile);
  const filter = [
    `drawtext=fontfile='${drawTextFont}':text='${escapeDrawtextText(title)}':fontcolor=white:fontsize=86:x=(w-text_w)/2:y=(h*0.40)`,
    `drawtext=fontfile='${drawTextFont}':text='${escapeDrawtextText(subtitle)}':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=(h*0.49)`,
    `drawtext=fontfile='${drawTextFont}':text='${escapeDrawtextText(footnote)}':fontcolor=0x7FE3B2:fontsize=42:x=(w-text_w)/2:y=(h*0.57)`,
  ].join(',');

  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x0B1215:s=1080x1920:d=2:r=30',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-vf',
    filter,
    '-t',
    '2',
    '-shortest',
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
    ctaFile,
  ]);
  await writeFile(concatFile, [
    `file '${toConcatPath(inputFile)}'`,
    `file '${toConcatPath(ctaFile)}'`,
    '',
  ].join('\n'), 'utf8');
  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatFile,
    '-c',
    'copy',
    outputFile,
  ]);
}

function toConcatPath(filePath) {
  return path.resolve(filePath).replaceAll('\\', '/').replaceAll("'", "'\\''");
}

function escapeDrawtextPath(filePath) {
  return path.resolve(filePath).replaceAll('\\', '/').replace(':', '\\:');
}

function escapeDrawtextText(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll(':', '\\:')
    .replaceAll("'", "\\'");
}

function parseBoolean(value) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`Invalid boolean value: ${value}`);
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
