/**
 * A duration as `M:SS`, from an hour on as `H:MM:SS` (100 questions give 100 minutes).
 * The single format for the timer of `/test` and the elapsed time of `/result`; only whole seconds count,
 * like on a stopwatch, and a negative value shows as `0:00`.
 */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
