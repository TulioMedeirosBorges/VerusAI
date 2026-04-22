const MAX_DIMENSION = 480;
const MAX_FRAMES = 20;
const MAX_TOTAL_KB = 3000; // 3MB total de frames

async function captureFrames(video) {
  const frames = [];
  const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 30;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth || 480, video.videoHeight || 270));
  const width = Math.round((video.videoWidth || 480) * scale);
  const height = Math.round((video.videoHeight || 270) * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // 1 frame por segundo, máximo MAX_FRAMES
  const totalFrames = Math.min(Math.floor(duration), MAX_FRAMES);
  const step = duration / (totalFrames + 1);
  const timestamps = Array.from({ length: totalFrames }, (_, i) => step * (i + 1));

  let totalKB = 0;

  for (const time of timestamps) {
    await new Promise((resolve) => {
      video.currentTime = time;
      video.addEventListener("seeked", () => {
        ctx.drawImage(video, 0, 0, width, height);
        const base64 = canvas.toDataURL("image/jpeg", 0.55);
        const sizeKB = Math.round((base64.length * 3) / 4 / 1024);

        if (totalKB + sizeKB <= MAX_TOTAL_KB) {
          frames.push(base64);
          totalKB += sizeKB;
        }
        resolve();
      }, { once: true });
    });

    if (totalKB >= MAX_TOTAL_KB) break;
  }

  console.log(`[captureFrames] ${frames.length} frames | ${totalKB}KB total | duração: ${Math.round(duration)}s`);
  return frames;
}
