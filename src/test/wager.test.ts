import { describe, expect, it } from "vitest";
import {
  adjustWagerAmount,
  calculatePresetRaiseToAmount,
  classifyAllInAction,
  getMaxRaiseTo,
  getMinBet,
  getMinRaiseTo,
  validateBetAmount,
  validateRaiseToAmount,
} from "../lib/wager";

describe("minimum bet and raise calculations", () => {
  it("calculates the preflop minimum raise", () => {
    expect(getMinRaiseTo(20, 20)).toBe(40);
  });

  it("uses the big blind as the minimum bet when no one has bet postflop", () => {
    expect(getMinBet(20)).toBe(20);
  });

  it("calculates the minimum raise over a bet of 50", () => {
    expect(getMinRaiseTo(50, 50)).toBe(100);
  });

  it("uses the last full raise amount for the next minimum raise", () => {
    const raiseAmount = 120 - 50;
    expect(raiseAmount).toBe(70);
    expect(getMinRaiseTo(120, raiseAmount)).toBe(190);
  });
});

describe("bet and raise validation", () => {
  it("rejects a normal bet below the minimum bet", () => {
    expect(validateBetAmount(10, 20, { chips: 100, roundBet: 0 }).valid).toBe(false);
  });

  it("allows an all-in bet when chips are below the minimum bet", () => {
    const result = validateBetAmount(10, 20, { chips: 10, roundBet: 0 });
    expect(result.valid).toBe(true);
    expect(result.allInKind).toBe("all-in-under-raise");
  });

  it("rejects a normal raise below the minimum raise", () => {
    expect(validateRaiseToAmount(130, 100, 160, { chips: 500, roundBet: 100 }).valid).toBe(false);
  });

  it("allows an all-in under raise below the minimum raise", () => {
    const player = { chips: 30, roundBet: 100 };
    const result = validateRaiseToAmount(130, 100, 160, player);
    expect(result.valid).toBe(true);
    expect(result.allInKind).toBe("all-in-under-raise");
  });

  it("classifies an all-in above the minimum raise as a full raise", () => {
    const player = { chips: 100, roundBet: 100 };
    const raiseTo = getMaxRaiseTo(player);
    const result = validateRaiseToAmount(raiseTo, 100, 160, player);
    expect(result.valid).toBe(true);
    expect(classifyAllInAction(raiseTo, 100, 160, raiseTo)).toBe("all-in-full-raise");
  });
});

describe("wager amount controls", () => {
  it("increments by the small step", () => {
    expect(adjustWagerAmount(20, 20, 20, 1000)).toBe(40);
  });

  it("decrements by the small step", () => {
    expect(adjustWagerAmount(60, -20, 20, 1000)).toBe(40);
  });

  it("does not go below the minimum amount", () => {
    expect(adjustWagerAmount(20, -20, 20, 1000)).toBe(20);
  });

  it("does not go above the maximum amount", () => {
    expect(adjustWagerAmount(980, 20, 20, 990)).toBe(990);
  });

  it("sets all-in raise to the player's max raise to amount", () => {
    const player = { roundBet: 80, chips: 420 };
    expect(calculatePresetRaiseToAmount("all-in", 240, 80, 0, 140, getMaxRaiseTo(player), 20)).toBe(500);
  });
});
