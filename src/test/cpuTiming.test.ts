import { describe, expect, it } from "vitest";
import { CPU_ACTION_DELAY_MAX_MS, CPU_ACTION_DELAY_MIN_MS, getCpuActionDelay } from "../lib/cpuTiming";

describe("CPU action timing", () => {
  it("returns the minimum delay when random is zero", () => {
    expect(getCpuActionDelay(() => 0)).toBe(CPU_ACTION_DELAY_MIN_MS);
  });

  it("keeps generated delays inside the configured range", () => {
    const delay = getCpuActionDelay(() => 0.999);

    expect(delay).toBeGreaterThanOrEqual(CPU_ACTION_DELAY_MIN_MS);
    expect(delay).toBeLessThanOrEqual(CPU_ACTION_DELAY_MAX_MS);
  });
});
