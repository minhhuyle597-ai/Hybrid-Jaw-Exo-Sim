// Frame k is encoded at PTS k/fps; floor selects the frame actually displayed.
export function frameIndex(time, fps, count) {
  if (!Number.isFinite(time) || fps <= 0 || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(time * fps + 1e-5)));
}
export function seekTime(frame, fps, count) {
  return Math.max(0, Math.min(count - 1, frame)) / fps;
}
