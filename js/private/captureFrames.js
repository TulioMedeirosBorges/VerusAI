async function captureFrames(video, intervalSeconds = 2) {
  const frames = [];
  const duration = video.duration;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Gera os timestamps que vai capturar
  const timestamps = [];
  for (let t = 0; t < duration; t += intervalSeconds) {
    timestamps.push(t);
  }

  for (const time of timestamps) {
    await new Promise((resolve) => {
      video.currentTime = time;

      video.addEventListener(
        "seeked",
        () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Reduz qualidade pra não pesar na requisição (0.7 = 70%)
          const base64 = canvas.toDataURL("image/jpeg", 0.7);
          frames.push(base64);
          resolve();
        },
        { once: true },
      );
    });
  }

  return frames;
}
