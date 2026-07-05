import type { Card, Rank } from "./cards";
import { evaluateBestHand, HandRank } from "./handEvaluator";
import { BET_OPTIONS, MAX_RAISES_PER_ROUND, type GameAction, type GameState, getLegalActions } from "./game";

export type CpuHandCategory = "veryStrong" | "strong" | "medium" | "weak";

export interface CpuHandEvaluation {
  category: CpuHandCategory;
  score: number;
  reason: string;
}

export function decideCpuAction(state: GameState, playerIndex: number, random = Math.random): GameAction {
  const legal = getLegalActions(state, playerIndex);
  const player = state.players[playerIndex];
  const toCall = Math.max(0, state.currentBet - player.roundBet);
  const checkPossible = toCall === 0 && hasAction(legal, "check");
  const evaluation =
    state.communityCards.length === 0 ? evaluatePreflopHand(player.holeCards) : evaluatePostflopHand(player.holeCards, state.communityCards);
  const pressure = getCallPressure(toCall, player.chips);
  const canRaise = canCpuRaise(state, playerIndex, legal, evaluation.category);
  const roll = random();

  if (shouldAllIn(state, playerIndex, evaluation, toCall, pressure, legal, roll)) {
    return ensureLegal({ type: "all-in" }, legal);
  }

  if (checkPossible) {
    if (evaluation.category === "veryStrong" && canAggress(legal) && roll < 0.4) {
      return ensureLegal({ type: "bet", amount: pickBetSize(player.chips, 0, evaluation.score) }, legal);
    }
    if (evaluation.category === "strong" && canAggress(legal) && roll < 0.25) {
      return ensureLegal({ type: "bet", amount: pickBetSize(player.chips, 0, evaluation.score) }, legal);
    }
    if (evaluation.category === "medium" && canAggress(legal) && roll < 0.05) {
      return ensureLegal({ type: "bet", amount: BET_OPTIONS[0] }, legal);
    }
    return ensureLegal({ type: "check" }, legal);
  }

  if (shouldFoldToPressure(evaluation.category, pressure, roll) && hasAction(legal, "fold")) {
    return ensureLegal({ type: "fold" }, legal);
  }

  if (canRaise && shouldRaise(evaluation.category, pressure, roll)) {
    return ensureLegal({ type: "raise", amount: pickBetSize(player.chips, toCall, evaluation.score) }, legal);
  }

  if (hasAction(legal, "call")) {
    return ensureLegal({ type: "call" }, legal);
  }
  return ensureLegal({ type: "fold" }, legal);
}

export function evaluatePreflopHand(cards: Card[]): CpuHandEvaluation {
  const [first, second] = cards;
  if (!first || !second) return { category: "weak", score: 0, reason: "missing cards" };
  const [high, low] = [first.rank, second.rank].sort((a, b) => b - a) as [Rank, Rank];
  const pair = high === low;
  const suited = first.suit === second.suit;
  const gap = Math.abs(high - low);

  if ((pair && high >= 10) || isBroadwayCombo(high, low, [14, 13], [14, 12]) || (suited && isBroadwayCombo(high, low, [14, 11], [13, 12]))) {
    return { category: "veryStrong", score: pair ? 0.95 : 0.86, reason: "premium preflop" };
  }
  if ((pair && high >= 6) || isCombo(high, low, 14, 10) || isCombo(high, low, 13, 11) || isCombo(high, low, 12, 11) || (suited && high === 14) || (suited && gap === 1 && high >= 8)) {
    return { category: "strong", score: pair ? 0.74 : 0.68, reason: "playable preflop" };
  }
  if (!pair && high !== 14 && !suited && gap > 3 && (high <= 11 || low <= 4)) {
    return { category: "weak", score: 0.18, reason: "disconnected offsuit" };
  }
  if (pair || suited || gap <= 2 || high >= 13) {
    return { category: "medium", score: 0.46, reason: "speculative preflop" };
  }
  return { category: "weak", score: 0.28, reason: "low preflop" };
}

export function evaluatePostflopHand(holeCards: Card[], communityCards: Card[]): CpuHandEvaluation {
  const allCards = [...holeCards, ...communityCards];
  const best = evaluateBestHand(allCards);
  if (best.rank >= HandRank.Straight || best.rank === HandRank.Flush || best.rank === HandRank.ThreeOfAKind) {
    return { category: "veryStrong", score: 0.9, reason: best.name };
  }
  if (best.rank === HandRank.TwoPair) {
    return { category: "strong", score: 0.76, reason: best.name };
  }
  if (best.rank === HandRank.OnePair) {
    const pairRank = best.tiebreakers[0];
    if (isOverPair(holeCards, communityCards) || isTopPair(pairRank, communityCards)) {
      return { category: "strong", score: 0.68, reason: "top pair or over pair" };
    }
    return { category: "medium", score: 0.48, reason: "pair" };
  }
  if (hasStrongFlushDraw(allCards) || hasStrongStraightDraw(allCards)) {
    return { category: "strong", score: 0.62, reason: "strong draw" };
  }
  if (hasFlushDraw(allCards) || hasStraightDraw(allCards) || holeCards.some((card) => card.rank >= 13)) {
    return { category: "medium", score: 0.42, reason: "draw or high cards" };
  }
  return { category: "weak", score: 0.16, reason: "no made hand" };
}

export function getCallPressure(toCall: number, chips: number): number {
  if (toCall <= 0) return 0;
  return toCall / Math.max(1, chips + toCall);
}

export function canCpuRaise(state: GameState, playerIndex: number, legalActions = getLegalActions(state, playerIndex), category: CpuHandCategory = "weak"): boolean {
  const player = state.players[playerIndex];
  if (!hasAction(legalActions, "raise")) return false;
  if (state.roundRaiseCount >= MAX_RAISES_PER_ROUND) return false;
  if (player.raisedThisRound && category !== "veryStrong") return false;
  return true;
}

function shouldRaise(category: CpuHandCategory, pressure: number, roll: number): boolean {
  if (pressure >= 0.5) return category === "veryStrong" && roll < 0.2;
  if (category === "veryStrong") return roll < 0.4;
  if (category === "strong") return pressure < 0.3 && roll < 0.25;
  if (category === "medium") return pressure < 0.1 && roll < 0.05;
  return false;
}

function shouldFoldToPressure(category: CpuHandCategory, pressure: number, roll: number): boolean {
  if (category === "veryStrong") return pressure >= 0.5 && roll < 0.15;
  if (category === "strong") return pressure >= 0.5 || (pressure >= 0.3 && roll < 0.5) || (pressure >= 0.2 && roll < 0.1);
  if (category === "medium") return pressure >= 0.3 || (pressure >= 0.1 && roll < 0.3);
  return pressure > 0.05 || roll < 0.7;
}

function shouldAllIn(state: GameState, playerIndex: number, evaluation: CpuHandEvaluation, toCall: number, pressure: number, legal: GameAction[], roll: number): boolean {
  if (!hasAction(legal, "all-in")) return false;
  const player = state.players[playerIndex];
  const shortStack = player.chips <= Math.max(80, state.pot * 0.25);
  const callAlmostAllIn = toCall > 0 && pressure >= 0.75;
  const premiumPreflop = state.communityCards.length === 0 && evaluation.category === "veryStrong" && player.holeCards[0]?.rank === player.holeCards[1]?.rank && player.holeCards[0]?.rank >= 13;
  if (callAlmostAllIn && evaluation.category !== "weak") return true;
  if (shortStack && evaluation.category !== "weak" && roll < 0.12) return true;
  if ((evaluation.category === "veryStrong" || premiumPreflop) && pressure < 0.5 && roll >= 0.98) return true;
  return false;
}

function pickBetSize(chips: number, toCall: number, score: number): number {
  const affordable = BET_OPTIONS.filter((amount) => chips > toCall + amount);
  if (affordable.length === 0) return Math.min(BET_OPTIONS[0], Math.max(0, chips - toCall));
  if (score > 0.85) return affordable[Math.min(1, affordable.length - 1)];
  return affordable[0];
}

function ensureLegal(preferred: GameAction, legal: GameAction[]): GameAction {
  const exact = legal.find((action) => action.type === preferred.type && (preferred.amount === undefined || action.amount === preferred.amount));
  if (exact) return preferred;
  const sameType = legal.find((action) => action.type === preferred.type);
  if (sameType) return sameType;
  return legal.find((action) => action.type === "check") ?? legal.find((action) => action.type === "call") ?? legal.find((action) => action.type === "fold") ?? { type: "fold" };
}

function canAggress(actions: GameAction[]): boolean {
  return hasAction(actions, "bet");
}

function hasAction(actions: GameAction[], type: GameAction["type"]): boolean {
  return actions.some((action) => action.type === type);
}

function isBroadwayCombo(high: Rank, low: Rank, ...combos: [Rank, Rank][]): boolean {
  return combos.some(([comboHigh, comboLow]) => isCombo(high, low, comboHigh, comboLow));
}

function isCombo(high: Rank, low: Rank, comboHigh: Rank, comboLow: Rank): boolean {
  return high === comboHigh && low === comboLow;
}

function isOverPair(holeCards: Card[], communityCards: Card[]): boolean {
  return holeCards.length === 2 && holeCards[0].rank === holeCards[1].rank && holeCards[0].rank > Math.max(...communityCards.map((card) => card.rank));
}

function isTopPair(pairRank: number, communityCards: Card[]): boolean {
  return pairRank === Math.max(...communityCards.map((card) => card.rank));
}

function hasFlushDraw(cards: Card[]): boolean {
  return Object.values(countBySuit(cards)).some((count) => count === 4);
}

function hasStrongFlushDraw(cards: Card[]): boolean {
  const counts = cards.reduce<Record<string, Card[]>>((bySuit, card) => {
    bySuit[card.suit] = [...(bySuit[card.suit] ?? []), card];
    return bySuit;
  }, {});
  return Object.values(counts).some((suitedCards) => suitedCards.length === 4 && suitedCards.some((card) => card.rank >= 13));
}

function hasStraightDraw(cards: Card[]): boolean {
  return straightDrawHits(cards).some((hits) => hits >= 4);
}

function hasStrongStraightDraw(cards: Card[]): boolean {
  return straightDrawHits(cards).some((hits) => hits >= 4) && cards.some((card) => card.rank >= 10);
}

function straightDrawHits(cards: Card[]): number[] {
  const ranks = [...new Set(cards.flatMap((card) => (card.rank === 14 ? [14, 1] : [card.rank])))].sort((a, b) => a - b);
  return Array.from({ length: 10 }, (_, index) => index + 1).map((start) => {
    const needed = [start, start + 1, start + 2, start + 3, start + 4];
    return needed.filter((rank) => ranks.includes(rank)).length;
  });
}

function countBySuit(cards: Card[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((counts, card) => {
    counts[card.suit] = (counts[card.suit] ?? 0) + 1;
    return counts;
  }, {});
}
