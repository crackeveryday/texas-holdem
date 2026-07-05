export type AllInActionKind = "none" | "all-in-call" | "all-in-under-raise" | "all-in-full-raise";

export interface WagerPlayer {
  chips: number;
  roundBet: number;
}

export interface WagerValidation {
  valid: boolean;
  reason?: string;
  allInKind?: AllInActionKind;
}

export type WagerPreset = "min" | "half-pot" | "pot" | "all-in";

export function getMinBet(bigBlind: number): number {
  return bigBlind;
}

export function getMinRaiseTo(currentBet: number, lastFullRaiseAmount: number): number {
  return currentBet + lastFullRaiseAmount;
}

export function getMaxBetAmount(player: WagerPlayer): number {
  return player.chips;
}

export function getMaxRaiseTo(player: WagerPlayer): number {
  return player.roundBet + player.chips;
}

export function getCallAmount(currentBet: number, player: WagerPlayer): number {
  return Math.max(0, currentBet - player.roundBet);
}

export function roundToStep(amount: number, step: number): number {
  if (step <= 0) return Math.round(amount);
  return Math.round(amount / step) * step;
}

export function clampBetAmount(amount: number, minBet: number, maxBet: number): number {
  if (maxBet <= 0) return 0;
  if (maxBet < minBet) return maxBet;
  return Math.max(minBet, Math.min(maxBet, amount));
}

export function clampRaiseToAmount(amount: number, currentBet: number, minRaiseTo: number, maxRaiseTo: number): number {
  if (maxRaiseTo <= currentBet) return maxRaiseTo;
  if (maxRaiseTo < minRaiseTo) return maxRaiseTo;
  return Math.max(minRaiseTo, Math.min(maxRaiseTo, amount));
}

export function adjustWagerAmount(currentAmount: number, delta: number, minAmount: number, maxAmount: number): number {
  return Math.max(minAmount, Math.min(maxAmount, currentAmount + delta));
}

export function classifyAllInAction(raiseToAmount: number, currentBet: number, minRaiseTo: number, maxRaiseTo: number): AllInActionKind {
  if (raiseToAmount !== maxRaiseTo) return "none";
  if (raiseToAmount <= currentBet) return "all-in-call";
  if (raiseToAmount < minRaiseTo) return "all-in-under-raise";
  return "all-in-full-raise";
}

export function validateBetAmount(amount: number, minBet: number, player: WagerPlayer): WagerValidation {
  const maxBet = getMaxBetAmount(player);
  const isAllIn = amount === maxBet;
  if (amount <= 0) return { valid: false, reason: "Bet must be greater than 0." };
  if (amount > maxBet) return { valid: false, reason: "Bet exceeds your chips." };
  if (amount < minBet && !isAllIn) return { valid: false, reason: `Minimum bet is ${minBet}.` };
  if (amount < minBet && isAllIn) return { valid: true, allInKind: "all-in-under-raise" };
  return { valid: true, allInKind: isAllIn ? "all-in-full-raise" : "none" };
}

export function validateRaiseToAmount(raiseToAmount: number, currentBet: number, minRaiseTo: number, player: WagerPlayer): WagerValidation {
  const maxRaiseTo = getMaxRaiseTo(player);
  const allInKind = classifyAllInAction(raiseToAmount, currentBet, minRaiseTo, maxRaiseTo);
  if (raiseToAmount <= currentBet) return { valid: false, reason: `Raise to must exceed ${currentBet}.`, allInKind };
  if (raiseToAmount > maxRaiseTo) return { valid: false, reason: "Raise exceeds your chips.", allInKind };
  if (raiseToAmount < minRaiseTo && allInKind !== "all-in-under-raise") {
    return { valid: false, reason: `Minimum raise to is ${minRaiseTo}.`, allInKind };
  }
  return { valid: true, allInKind };
}

export function calculatePresetBetAmount(preset: WagerPreset, pot: number, minBet: number, maxBet: number, bigBlind: number): number {
  const raw = preset === "min" ? minBet : preset === "half-pot" ? pot / 2 : preset === "pot" ? pot : maxBet;
  if (preset === "all-in") return maxBet;
  return clampBetAmount(roundToStep(raw, bigBlind), minBet, maxBet);
}

export function calculatePresetRaiseToAmount(
  preset: WagerPreset,
  pot: number,
  currentBet: number,
  callAmount: number,
  minRaiseTo: number,
  maxRaiseTo: number,
  bigBlind: number,
): number {
  const raw =
    preset === "min"
      ? minRaiseTo
      : preset === "half-pot"
        ? currentBet + callAmount + pot / 2
        : preset === "pot"
          ? currentBet + callAmount + pot
          : maxRaiseTo;
  if (preset === "all-in") return maxRaiseTo;
  return clampRaiseToAmount(roundToStep(raw, bigBlind), currentBet, minRaiseTo, maxRaiseTo);
}
