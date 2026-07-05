import { describe, expect, it } from "vitest";
import { parseCard } from "../lib/cards";
import { compareEvaluations, evaluateBestHand, HandRank } from "../lib/handEvaluator";
import { determineWinners } from "../lib/winner";

const c = (cards: string) => cards.split(" ").map(parseCard);

describe("hand evaluator", () => {
  it("detects royal flush", () => {
    const hand = evaluateBestHand(c("AS KS QS JS TS 2D 3C"));
    expect(hand.rank).toBe(HandRank.RoyalFlush);
  });

  it("detects straight flush", () => {
    const hand = evaluateBestHand(c("9S 8S 7S 6S 5S 2D AC"));
    expect(hand.rank).toBe(HandRank.StraightFlush);
    expect(hand.tiebreakers).toEqual([9]);
  });

  it("detects four of a kind", () => {
    const hand = evaluateBestHand(c("AS AH AD AC 9S 2D 3C"));
    expect(hand.rank).toBe(HandRank.FourOfAKind);
    expect(hand.tiebreakers).toEqual([14, 9]);
  });

  it("detects full house", () => {
    const hand = evaluateBestHand(c("KS KH KD 9C 9D 2S 3H"));
    expect(hand.rank).toBe(HandRank.FullHouse);
    expect(hand.tiebreakers).toEqual([13, 9]);
  });

  it("detects flush", () => {
    const hand = evaluateBestHand(c("AS JS 8S 4S 2S KD 3C"));
    expect(hand.rank).toBe(HandRank.Flush);
    expect(hand.tiebreakers).toEqual([14, 11, 8, 4, 2]);
  });

  it("detects wheel straight", () => {
    const hand = evaluateBestHand(c("AS 2D 3C 4H 5S KD QC"));
    expect(hand.rank).toBe(HandRank.Straight);
    expect(hand.tiebreakers).toEqual([5]);
  });

  it("detects broadway straight", () => {
    const hand = evaluateBestHand(c("AS KD QC JH TS 2S 3D"));
    expect(hand.rank).toBe(HandRank.Straight);
    expect(hand.tiebreakers).toEqual([14]);
  });

  it("selects the best five cards from seven", () => {
    const hand = evaluateBestHand(c("AS AD AC KH KD 2S 3D"));
    expect(hand.rank).toBe(HandRank.FullHouse);
    expect(hand.tiebreakers).toEqual([14, 13]);
  });
});

describe("hand comparison", () => {
  it("compares hand ranks", () => {
    const flush = evaluateBestHand(c("AS JS 8S 4S 2S KD 3C"));
    const straight = evaluateBestHand(c("9S 8D 7C 6H 5S 2D AC"));
    expect(compareEvaluations(flush, straight)).toBeGreaterThan(0);
  });

  it("compares two pair kickers", () => {
    const aceKicker = evaluateBestHand(c("AS AD KS KD QC 2H 3S"));
    const jackKicker = evaluateBestHand(c("AH AC KH KC JD 2D 3C"));
    expect(compareEvaluations(aceKicker, jackKicker)).toBeGreaterThan(0);
  });

  it("compares one pair kickers", () => {
    const queenKicker = evaluateBestHand(c("AS AD QC 9D 7S 2H 3S"));
    const jackKicker = evaluateBestHand(c("AH AC JC 9H 7D 2D 3C"));
    expect(compareEvaluations(queenKicker, jackKicker)).toBeGreaterThan(0);
  });

  it("ties identical ranks and kickers", () => {
    const first = evaluateBestHand(c("AS AD QC 9D 7S 2H 3S"));
    const second = evaluateBestHand(c("AH AC QD 9H 7D 4D 5C"));
    expect(compareEvaluations(first, second)).toBe(0);
  });
});

describe("winner determination", () => {
  it("returns one winner", () => {
    const result = determineWinners(
      [
        { id: "a", holeCards: c("AS AD"), folded: false },
        { id: "b", holeCards: c("KS QD"), folded: false },
      ],
      c("AC 9D 4S 2C 7H"),
    );
    expect(result.winners).toEqual(["a"]);
  });

  it("returns split winners", () => {
    const result = determineWinners(
      [
        { id: "a", holeCards: c("AS KD"), folded: false },
        { id: "b", holeCards: c("AH KC"), folded: false },
      ],
      c("QS JD TC 2C 3H"),
    );
    expect(result.winners).toEqual(["a", "b"]);
  });
});
