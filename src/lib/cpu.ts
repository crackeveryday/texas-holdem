import type { Card } from "./cards";
import { evaluateBestHand, HandRank } from "./handEvaluator";
import { BET_OPTIONS, type GameAction, type GameState, getLegalActions } from "./game";

export function decideCpuAction(state: GameState, playerIndex: number): GameAction {
  const legal = getLegalActions(state, playerIndex);
  const player = state.players[playerIndex];
  const toCall = Math.max(0, state.currentBet - player.roundBet);
  const strength = state.communityCards.length === 0 ? preflopStrength(player.holeCards) : postflopStrength(player.holeCards, state.communityCards);
  const pressure = player.chips === 0 ? 1 : toCall / Math.max(1, player.chips + toCall);

  if (toCall > 0) {
    if (strength < 0.35 && pressure > 0.18 && hasAction(legal, "fold")) return { type: "fold" };
    if (strength > 0.82 && hasAction(legal, "raise")) return { type: "raise", amount: pickBetSize(player.chips, toCall, strength) };
    if (strength > 0.94 && hasAction(legal, "all-in")) return { type: "all-in" };
    return { type: "call" };
  }

  if (strength > 0.72 && hasAction(legal, "bet")) return { type: "bet", amount: pickBetSize(player.chips, 0, strength) };
  if (strength > 0.92 && hasAction(legal, "all-in")) return { type: "all-in" };
  return hasAction(legal, "check") ? { type: "check" } : { type: "fold" };
}

export function preflopStrength(cards: Card[]): number {
  const [a, b] = cards;
  if (!a || !b) return 0;
  let score = (a.rank + b.rank) / 28;
  if (a.rank === b.rank) score += 0.35 + a.rank / 40;
  if (a.rank === 14 || b.rank === 14) score += 0.12;
  if (a.suit === b.suit) score += 0.08;
  const gap = Math.abs(a.rank - b.rank);
  if (gap === 1) score += 0.09;
  else if (gap === 2) score += 0.04;
  if (Math.max(a.rank, b.rank) < 9 && gap > 3 && a.suit !== b.suit) score -= 0.2;
  return clamp(score);
}

export function postflopStrength(holeCards: Card[], communityCards: Card[]): number {
  const evaluation = evaluateBestHand([...holeCards, ...communityCards]);
  let score = evaluation.rank / HandRank.RoyalFlush;
  if (evaluation.rank >= HandRank.TwoPair) score += 0.12;
  if (hasFlushDraw([...holeCards, ...communityCards])) score += 0.08;
  if (hasStraightDraw([...holeCards, ...communityCards])) score += 0.06;
  return clamp(score);
}

function hasFlushDraw(cards: Card[]): boolean {
  return Object.values(
    cards.reduce<Record<string, number>>((counts, card) => {
      counts[card.suit] = (counts[card.suit] ?? 0) + 1;
      return counts;
    }, {}),
  ).some((count) => count === 4);
}

function hasStraightDraw(cards: Card[]): boolean {
  const ranks = [...new Set(cards.flatMap((card) => (card.rank === 14 ? [14, 1] : [card.rank])))].sort((a, b) => a - b);
  for (let start = 1; start <= 10; start += 1) {
    const needed = [start, start + 1, start + 2, start + 3, start + 4];
    const hits = needed.filter((rank) => ranks.includes(rank)).length;
    if (hits === 4) return true;
  }
  return false;
}

function pickBetSize(chips: number, toCall: number, strength: number): number {
  const affordable = BET_OPTIONS.filter((amount) => chips > toCall + amount);
  if (affordable.length === 0) return BET_OPTIONS[0];
  if (strength > 0.9) return affordable[affordable.length - 1];
  if (strength > 0.78) return affordable[Math.min(1, affordable.length - 1)];
  return affordable[0];
}

function hasAction(actions: GameAction[], type: GameAction["type"]): boolean {
  return actions.some((action) => action.type === type);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
