export const CPU_ACTION_DELAY_MIN_MS = 500;
export const CPU_ACTION_DELAY_MAX_MS = 900;
export const AUTO_REVEAL_DELAY_MS = 500;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getCpuActionDelay(random = Math.random): number {
  return Math.floor(CPU_ACTION_DELAY_MIN_MS + random() * (CPU_ACTION_DELAY_MAX_MS - CPU_ACTION_DELAY_MIN_MS + 1));
}
