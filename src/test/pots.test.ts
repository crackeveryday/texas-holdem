import { describe, expect, it } from "vitest";
import { parseCard } from "../lib/cards";
import { calculatePots, resolvePots, splitPot } from "../lib/pots";
import type { PlayerStatus } from "../lib/game";

const c = (cards: string) => cards.split(" ").map(parseCard);

function player(id: string, committed: number, status: PlayerStatus, holeCards = "2C 3D") {
  return { id, committed, status, holeCards: c(holeCards) };
}

describe("calculatePots", () => {
  it("creates one pot when everyone commits the same amount", () => {
    const pots = calculatePots([player("a", 100, "Active"), player("b", 100, "Active"), player("c", 100, "Active")]);

    expect(pots).toMatchObject([{ amount: 300, eligiblePlayerIds: ["a", "b", "c"] }]);
  });

  it("creates a side pot for one short all-in", () => {
    const pots = calculatePots([player("a", 100, "All-in"), player("b", 300, "Active"), player("c", 300, "Active")]);

    expect(pots).toMatchObject([
      { amount: 300, eligiblePlayerIds: ["a", "b", "c"] },
      { amount: 400, eligiblePlayerIds: ["b", "c"] },
    ]);
  });

  it("creates multiple side pots for different all-in amounts", () => {
    const pots = calculatePots([player("a", 100, "All-in"), player("b", 300, "All-in"), player("c", 500, "Active")]);

    expect(pots).toMatchObject([
      { amount: 300, eligiblePlayerIds: ["a", "b", "c"] },
      { amount: 400, eligiblePlayerIds: ["b", "c"] },
      { amount: 200, eligiblePlayerIds: ["c"] },
    ]);
  });

  it("keeps folded chips in the pot and removes folded players from eligibility", () => {
    const pots = calculatePots([player("a", 100, "All-in"), player("b", 300, "Folded"), player("c", 300, "Active")]);

    expect(pots).toMatchObject([
      { amount: 300, eligiblePlayerIds: ["a", "c"] },
      { amount: 400, eligiblePlayerIds: ["c"] },
    ]);
  });

  it("assigns folded-only excess chips to the highest live committed players", () => {
    const pots = calculatePots([player("a", 100, "All-in"), player("b", 500, "Folded"), player("c", 300, "Active")]);

    expect(pots).toMatchObject([
      { amount: 300, eligiblePlayerIds: ["a", "c"] },
      { amount: 400, eligiblePlayerIds: ["c"] },
      { amount: 200, eligiblePlayerIds: ["c"] },
    ]);
  });
});

describe("resolvePots", () => {
  it("can award main and side pots to different players", () => {
    const players = [
      player("a", 100, "All-in", "AS AD"),
      player("b", 300, "All-in", "KS KD"),
      player("c", 500, "Active", "2C 7D"),
    ];
    const pots = calculatePots(players);
    const resolved = resolvePots(pots, players, c("AC 9D 4S 8C QH"));

    expect(resolved.payouts).toEqual({ a: 300, b: 400, c: 200 });
    expect(resolved.awards.map((award) => award.winnerIds)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("splits a tied pot", () => {
    const players = [
      player("a", 100, "All-in", "AS KD"),
      player("b", 100, "Active", "AH KC"),
      player("c", 100, "Active", "2C 7D"),
    ];
    const pots = calculatePots(players);
    const resolved = resolvePots(pots, players, c("QS JD TC 2H 3S"));

    expect(resolved.payouts).toEqual({ a: 150, b: 150, c: 0 });
    expect(resolved.awards[0].winnerIds).toEqual(["a", "b"]);
  });

  it("splits odd chips by seat order", () => {
    expect(splitPot(301, ["b", "a"], ["a", "b", "c"])).toEqual({ a: 151, b: 150 });
  });
});
