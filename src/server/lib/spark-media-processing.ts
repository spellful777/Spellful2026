import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { SparkMediaKind } from '@/lib/spark-media';

const run = promisify(execFile);
export class InvalidMedia extends Error {}
export const sparkMediaFilename = (kind: SparkMediaKind, poster = false) =>
  kind === 'photo' || poster ? 'photo.jpg' : 'video.mp4';

export async function processSparkMedia(input: string, directory: string, kind: SparkMediaKind, signal: AbortSignal, videoSeconds: number) {
  const options = { signal, timeout: 180000, maxBuffer: 1024 * 1024 };
  const sniffProbe = ['-protocol_whitelist', 'file', '-format_whitelist',
    'mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,jpeg_pipe,png_pipe,webp_pipe,image2'];
  const { stdout } = await run('ffprobe', ['-v', 'error', ...sniffProbe,
    '-show_entries', 'format=duration,format_name:stream=codec_type,width,height,duration', '-of', 'json', input], options);
  const probe = JSON.parse(stdout) as {
    format?: { duration?: string; format_name?: string };
    streams?: { codec_type: string; width?: number; height?: number; duration?: string }[];
  };
  const stream = probe.streams?.find(item => item.codec_type === 'video');
  if (!stream?.width || !stream.height || stream.width * stream.height > 48_000_000) {
    throw new InvalidMedia('Choose an image or video with supported dimensions.');
  }
  const format = probe.format?.format_name ?? '';
  const isPhoto = /^(?:jpeg_pipe|png_pipe|webp_pipe|image2)$/.test(format);
  if (isPhoto !== (kind === 'photo')) throw new InvalidMedia('This file does not match the selected attachment type.');
  const base = ['-nostdin', '-v', 'error', '-threads', '2', '-filter_threads', '2', ...sniffProbe, '-i', input, '-map', '0:v:0', '-map_metadata', '-1'];
  const photo = join(directory, sparkMediaFilename(kind, true));
  if (kind === 'photo') {
    await run('ffmpeg', [...base, '-vf', "scale='min(1600,iw)':'min(1600,ih)':force_original_aspect_ratio=decrease",
      '-frames:v', '1', '-q:v', '4', '-update', '1', photo], options);
    return;
  }
  const duration = Math.max(Number(probe.format?.duration) || 0, Number(stream.duration) || 0);
  if (!(duration > 0 && duration <= videoSeconds)) {
    throw new InvalidMedia(`Choose a video up to ${videoSeconds} seconds long.`);
  }
  const video = join(directory, sparkMediaFilename(kind));
  // Bound both dimensions to 720p in either orientation, without upscaling.
  await run('ffmpeg', [...base, '-map', '0:a:0?', '-t', String(videoSeconds),
    '-vf', "scale='min(iw,if(gte(iw,ih),1280,720))':'min(ih,if(gte(iw,ih),720,1280))':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
    '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', video], options);
  await run('ffmpeg', ['-nostdin', '-v', 'error', '-i', video, '-frames:v', '1', '-q:v', '4', '-update', '1', photo], options);
}
