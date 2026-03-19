import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed with code ${code}`));
    });
  });
}

export async function convertMp4ToHls(inputPath, outputDir) {
  ensureDir(outputDir);

  const masterPath = path.join(outputDir, "master.m3u8");
  const posterPath = path.join(outputDir, "poster.jpg");

  await runFFmpeg([
    "-i", inputPath,
    "-c:v", "libx264",
    "-c:a", "aac",
    "-preset", "veryfast",
    "-crf", "23",
    "-hls_time", "6",
    "-hls_playlist_type", "vod",
    "-hls_list_size", "0",
    "-hls_segment_filename", path.join(outputDir, "segment_%03d.ts"),
    "-f", "hls",
    masterPath
  ]);

  await runFFmpeg([
    "-i", inputPath,
    "-ss", "00:00:02",
    "-frames:v", "1",
    "-q:v", "2",
    posterPath
  ]);

  return { masterPath, posterPath };
}
