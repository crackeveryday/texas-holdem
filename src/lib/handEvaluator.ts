import type { Card, Rank } from "./cards";

export enum HandRank {
  HighCard = 1,
  OnePair,
  TwoPair,
  ThreeOfAKind,
  Straight,
  Flush,
  FullHouse,
  FourOfAKind,
  StraightFlush,
  RoyalFlush,
}

export interface HandEvaluation {
  rank: HandRank;
  name: string;
  tiebreakers: number[];
  cards: Card[];
}

const handNames: Record<HandRank, string> = {
  [HandRank.HighCard]: "High Card",
  [HandRank.OnePair]: "One Pair",
  [HandRank.TwoPair]: "Two Pair",
  [HandRank.ThreeOfAKind]: "Three of a Kind",
  [HandRank.Straight]: "Straight",
  [HandRank.Flush]: "Flush",
  [HandRank.FullHouse]: "Full House",
  [HandRank.FourOfAKind]: "Four of a Kind",
  [HandRank.StraightFlush]: "Straight Flush",
  [HandRank.RoyalFlush]: "Royal Flush",
};

export function evaluateBestHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error("Hold'em hand evaluation requires 5 to 7 cards");
  }
  return combinations(cards, 5)
    .map(evaluateFiveCards)
    .sort(compareEvaluations)
    .slice(-1)[0];
}

export function compareEvaluations(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }
  const length = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function evaluateFiveCards(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) {
    throw new Error("Exactly 5 cards are required");
  }

  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const flush = sorted.every((card) => card.suit === sorted[0].suit);
  const straightHigh = getStraightHigh(sorted.map((card) => card.rank));
  const groups = groupRanks(sorted);
  const counts = [...groups.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (flush && straightHigh === 14) {
    return build(HandRank.RoyalFlush, [14], sorted);
  }
  if (flush && straightHigh) {
    return build(HandRank.StraightFlush, [straightHigh], sorted);
  }
  if (counts[0].count === 4) {
    const kicker = counts.find((group) => group.count === 1)!.rank;
    return build(HandRank.FourOfAKind, [counts[0].rank, kicker], sorted);
  }
  if (counts[0].count === 3 && counts[1].count === 2) {
    return build(HandRank.FullHouse, [counts[0].rank, counts[1].rank], sorted);
  }
  if (flush) {
    return build(HandRank.Flush, sorted.map((card) => card.rank), sorted);
  }
  if (straightHigh) {
    return build(HandRank.Straight, [straightHigh], sorted);
  }
  if (counts[0].count === 3) {
    const kickers = counts.filter((group) => group.count === 1).map((group) => group.rank);
    return build(HandRank.ThreeOfAKind, [counts[0].rank, ...kickers], sorted);
  }
  if (counts[0].count === 2 && counts[1].count === 2) {
    const pairs = counts.filter((group) => group.count === 2).map((group) => group.rank);
    const kicker = counts.find((group) => group.count === 1)!.rank;
    return build(HandRank.TwoPair, [...pairs, kicker], sorted);
  }
  if (counts[0].count === 2) {
    const kickers = counts.filter((group) => group.count === 1).map((group) => group.rank);
    return build(HandRank.OnePair, [counts[0].rank, ...kickers], sorted);
  }
  return build(HandRank.HighCard, sorted.map((card) => card.rank), sorted);
}

function build(rank: HandRank, tiebreakers: number[], cards: Card[]): HandEvaluation {
  return { rank, name: handNames[rank], tiebreakers, cards };
}

function groupRanks(cards: Card[]): Map<Rank, number> {
  return cards.reduce((map, card) => map.set(card.rank, (map.get(card.rank) ?? 0) + 1), new Map<Rank, number>());
}

function getStraightHigh(values: Rank[]): number | null {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1 as Rank);
  for (let i = 0; i <= unique.length - 5; i += 1) {
    const slice = unique.slice(i, i + 5);
    if (slice.every((value, index) => index === 0 || value === slice[index - 1] - 1)) {
      return Number(slice[0]) === 1 ? 5 : slice[0];
    }
  }
  return null;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, size - 1).map((combo) => [first, ...combo]), ...combinations(rest, size)];
}
