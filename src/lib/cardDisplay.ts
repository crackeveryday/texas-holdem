import type { Card, Suit } from "./cards";

export function getRankLabel(card: Card): string {
  if (card.rank === 14) return "A";
  if (card.rank === 13) return "K";
  if (card.rank === 12) return "Q";
  if (card.rank === 11) return "J";
  return String(card.rank);
}

export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
  };
  return symbols[suit];
}

export function getSuitColorClass(suit: Suit): "suit-red" | "suit-dark" {
  return suit === "hearts" || suit === "diamonds" ? "suit-red" : "suit-dark";
}

export function cardDisplayKey(card: Card): string {
  return `${getRankLabel(card)}-${card.suit}`;
}
