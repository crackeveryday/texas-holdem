export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
export const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));
}

export function shuffleDeck(deck: Card[], random = Math.random): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawCards(deck: Card[], count: number): { drawn: Card[]; deck: Card[] } {
  if (count < 0 || count > deck.length) {
    throw new Error(`Cannot draw ${count} cards from deck of ${deck.length}`);
  }
  return { drawn: deck.slice(0, count), deck: deck.slice(count) };
}

export function cardLabel(card: Card): string {
  const rank = card.rank === 14 ? "A" : card.rank === 13 ? "K" : card.rank === 12 ? "Q" : card.rank === 11 ? "J" : String(card.rank);
  const suit = card.suit === "spades" ? "S" : card.suit === "hearts" ? "H" : card.suit === "diamonds" ? "D" : "C";
  return `${rank}${suit}`;
}

export function parseCard(value: string): Card {
  const suitMap: Record<string, Suit> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
  const suitChar = value.slice(-1).toUpperCase();
  const rankText = value.slice(0, -1).toUpperCase();
  const rankMap: Record<string, Rank> = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
  const rank = rankMap[rankText] ?? Number(rankText);
  if (!suitMap[suitChar] || !ranks.includes(rank as Rank)) {
    throw new Error(`Invalid card: ${value}`);
  }
  return { rank: rank as Rank, suit: suitMap[suitChar] };
}
