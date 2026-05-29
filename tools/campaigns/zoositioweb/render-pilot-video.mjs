import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PILOT_DIR, readPilotDataset } from './validate-pilot.mjs';

const DEFAULT_AUDIO_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/audio/polly';
const DEFAULT_OUTPUT_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/renders';
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
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
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

export async function renderPilotVideo({
  pilotDir = DEFAULT_PILOT_DIR,
  audioDir = DEFAULT_AUDIO_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  renderId,
} = {}) {
  if (!renderId) {
    throw new Error('Missing required --render-id value');
  }

  assertSafeRenderId(renderId);

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

  const resolvedOutputDir = path.resolve(outputDir);
  const captionsDir = path.join(resolvedOutputDir, 'captions');
  const outputFile = path.join(resolvedOutputDir, `${renderId}.mp4`);
  const captionsFile = path.join(captionsDir, `${renderId}.ass`);
  const sourceVideo = path.resolve(asset.localFilePath);
  const sourceAudio = path.resolve(audioDir, `${renderId}.mp3`);
  const audioDuration = await ffprobeDuration(sourceAudio);
  const captionEvents = buildCaptionEvents({
    script,
    totalDurationSeconds: audioDuration,
  });

  await mkdir(captionsDir, { recursive: true });
  await writeFile(captionsFile, renderAssSubtitles({
    title: script.title,
    events: captionEvents,
  }), 'utf8');
  await runFfmpeg({
    sourceVideo,
    sourceAudio,
    captionsFile,
    outputFile,
    durationSeconds: audioDuration,
  });

  return {
    renderId,
    scriptId: script.id,
    assetId: asset.id,
    sourceVideo,
    sourceAudio,
    captionsFile,
    outputFile,
    durationSeconds: Number(audioDuration.toFixed(3)),
  };
}

export function buildCaptionEvents({ script, totalDurationSeconds }) {
  const segments = [
    { kind: 'hook', text: script.hook },
    ...script.bodyLines.map(text => ({ kind: 'body', text })),
    { kind: 'cta', text: script.cta },
  ];
  const readableDuration = Math.max(totalDurationSeconds - 0.4, 1);
  const totalWeight = segments.reduce((total, segment) => total + captionWeight(segment.text), 0);
  let current = 0.2;

  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    const weightedDuration = isLast
      ? (totalDurationSeconds - 0.2) - current
      : readableDuration * (captionWeight(segment.text) / totalWeight);
    const start = current;
    const end = Math.min(totalDurationSeconds - 0.1, current + Math.max(weightedDuration, 2.4));
    current = end;

    return {
      ...segment,
      start,
      end,
      text: wrapCaption(segment.text),
    };
  });
}

export function renderAssSubtitles({ title, events }) {
  return [
    '[Script Info]',
    `Title: ${escapeAssText(title)}`,
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Arial,78,&H00FFFFFF,&H00FFFFFF,&H0013171C,&H99000000,-1,0,0,0,100,100,0,0,1,6,1,2,96,96,210,1',
    'Style: CTA,Arial,72,&H00FFFFFF,&H00FFFFFF,&H002C5E35,&HAA000000,-1,0,0,0,100,100,0,0,1,7,1,2,90,90,230,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events.map(event => `Dialogue: ${[
      0,
      formatAssTime(event.start),
      formatAssTime(event.end),
      event.kind === 'cta' ? 'CTA' : 'Default',
      '',
      0,
      0,
      0,
      '',
      escapeAssText(event.text),
    ].join(',')}`),
    '',
  ].join('\n');
}

function captionWeight(text) {
  return Math.max(text.length, 42);
}

function wrapCaption(text, maxLineLength = 28) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLineLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.join('\\N');
}

function formatAssTime(value) {
  const centiseconds = Math.max(0, Math.round(value * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const centis = centiseconds % 100;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

function escapeAssText(value) {
  const lineBreakToken = '[[ASS_LINE_BREAK]]';

  return String(value)
    .replaceAll('\\N', lineBreakToken)
    .replaceAll('\\', '\\\\')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}')
    .replaceAll(lineBreakToken, '\\N');
}

function assertSafeRenderId(renderId) {
  if (!SAFE_RENDER_ID_REGEX.test(renderId)) {
    throw new Error(`Unsafe render ID for output filename: ${renderId}`);
  }
}

export async function ffprobeDuration(filePath) {
  const output = await runCommand('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number(output.trim());

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not determine media duration: ${filePath}`);
  }

  return duration;
}

async function runFfmpeg({ sourceVideo, sourceAudio, captionsFile, outputFile, durationSeconds }) {
  const captionsPath = captionsFile.replaceAll('\\', '/').replaceAll(':', '\\:');
  const filter = [
    `scale=${DEFAULT_WIDTH}:${DEFAULT_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${DEFAULT_WIDTH}:${DEFAULT_HEIGHT}`,
    `subtitles='${captionsPath}'`,
  ].join(',');

  await runCommand('ffmpeg', [
    '-y',
    '-stream_loop',
    '-1',
    '-i',
    sourceVideo,
    '-i',
    sourceAudio,
    '-t',
    durationSeconds.toFixed(3),
    '-vf',
    filter,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
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
    outputFile,
  ]);
}

function runCommand(command, args) {
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

      reject(new Error(`${command} failed with exit code ${code}: ${stderr || stdout}`));
    });
  });
}

function isCliMode() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliMode()) {
  try {
    const result = await renderPilotVideo(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
