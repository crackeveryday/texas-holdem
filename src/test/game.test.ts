import { describe, expect, it } from "vitest";
import { parseCard } from "../lib/cards";
import { applyPlayerAction, BIG_BLIND, createInitialGame, getLegalActions, type GameState } from "../lib/game";
import { calculatePots } from "../lib/pots";

const c = (cards: string) => cards.split(" ").map(parseCard);

function forceHumanTurn(state: GameState): GameState {
  const players = state.players.map((player, index) => ({
    ...player,
    acted: index === 0 ? false : true,
    roundBet: index === 0 ? 0 : 20,
    committed: index === 0 ? 0 : 20,
  }));
  const pots = calculatePots(players);
  return {
    ...state,
    currentPlayerIndex: 0,
    currentBet: 20,
    players,
    pot: 80,
    pots,
  };
}

function totalChips(state: GameState): number {
  return state.players.reduce((total, player) => total + player.chips + player.committed, 0);
}

describe("game betting", () => {
  it("lists call, raise, all-in, and fold when facing a bet", () => {
    const state = forceHumanTurn(createInitialGame());
    const actions = getLegalActions(state, 0).map((action) => action.type);
    expect(actions).toContain("call");
    expect(actions).toContain("raise");
    expect(actions).toContain("all-in");
    expect(actions).toContain("fold");
  });

  it("commits chips on call", () => {
    const state = forceHumanTurn(createInitialGame());
    const next = applyPlayerAction(state, 0, { type: "call" });
    expect(next.players[0].chips).toBe(980);
    expect(next.players[0].committed).toBe(20);
    expect(next.pot).toBe(100);
  });

  it("lists raise to as an action type when a full raise is possible", () => {
    const state = { ...forceHumanTurn(createInitialGame()), roundRaiseCount: 99, lastFullRaiseAmount: BIG_BLIND };
    const actions = getLegalActions(state, 0).map((action) => action.type);
    expect(actions).toContain("raise");
    expect(actions).toContain("all-in");
    expect(actions).toContain("call");
  });

  it("awards the pot when everyone else folds", () => {
    const state = createInitialGame();
    const winner = state.players[0];
    const folded = state.players.map((player, index) => ({
      ...player,
      status: index === 0 ? ("Active" as const) : ("Folded" as const),
      committed: index === 0 ? 10 : 20,
    }));
    const forced = { ...state, players: folded, currentPlayerIndex: 0, pot: 90, pots: calculatePots(folded), currentBet: 20 };
    const next = applyPlayerAction(forced, 0, { type: "check" });
    expect(next.players[0].chips).toBeGreaterThan(winner.chips);
    expect(next.currentPlayerIndex).toBeNull();
  });

  it("lets a short stack call all-in without asking that player to act again", () => {
    const state = createInitialGame();
    const players = state.players.map((player, index) => ({
      ...player,
      chips: index === 0 ? 50 : 900,
      status: index === 0 || index === 1 || index === 2 ? ("Active" as const) : ("Folded" as const),
      acted: index !== 0,
      roundBet: index === 0 ? 20 : index <= 2 ? 100 : 0,
      committed: index === 0 ? 20 : index <= 2 ? 100 : 0,
    }));
    const forced = { ...state, players, currentPlayerIndex: 0, currentBet: 100, pot: 220, pots: calculatePots(players) };

    const next = applyPlayerAction(forced, 0, { type: "call" });

    expect(next.players[0]).toMatchObject({ chips: 0, status: "All-in", committed: 70 });
    expect(next.currentPlayerIndex).not.toBe(0);
    expect(next.pots).toMatchObject([
      { amount: 210, eligiblePlayerIds: ["p0", "p1", "p2"] },
      { amount: 60, eligiblePlayerIds: ["p1", "p2"] },
    ]);
  });

  it("reveals the remaining board and resolves the hand when all live players are all-in", () => {
    const state = createInitialGame();
    const players = state.players.map((player, index) => ({
      ...player,
      holeCards: [c("AS AD"), c("KS KD"), c("2C 7D"), c("3C 4D"), c("5C 6D")][index],
      chips: index === 0 ? 80 : 0,
      status: index <= 2 ? (index === 0 ? ("Active" as const) : ("All-in" as const)) : ("Folded" as const),
      acted: index !== 0,
      roundBet: index <= 2 ? 100 : 0,
      committed: index <= 2 ? 100 : 0,
    }));
    players[0].roundBet = 20;
    players[0].committed = 20;
    const forced = {
      ...state,
      players,
      deck: c("AC 9D 4S 8C QH"),
      communityCards: [],
      currentPlayerIndex: 0,
      currentBet: 100,
      pot: 220,
      pots: calculatePots(players),
    };

    const next = applyPlayerAction(forced, 0, { type: "call" });

    expect(next.currentPlayerIndex).toBeNull();
    expect(next.communityCards).toHaveLength(5);
    expect(next.showdown).toBe(true);
    expect(next.players.reduce((total, player) => total + player.chips, 0)).toBe(totalChips(forced));
  });

  it("reopens action after a full raise", () => {
    const state = createInitialGame();
    const players = state.players.map((player, index) => ({
      ...player,
      chips: index <= 2 ? 900 : player.chips,
      status: index <= 2 ? ("Active" as const) : ("Folded" as const),
      acted: index === 0 ? false : true,
      roundBet: index <= 2 ? 100 : 0,
      committed: index <= 2 ? 100 : 0,
    }));
    const forced = {
      ...state,
      players,
      currentPlayerIndex: 0,
      currentBet: 100,
      lastFullRaiseAmount: 50,
      pot: 300,
      pots: calculatePots(players),
    };

    const next = applyPlayerAction(forced, 0, { type: "raise", amount: 160 });

    expect(next.currentBet).toBe(160);
    expect(next.lastFullRaiseAmount).toBe(60);
    expect(next.players[1].acted).toBe(false);
    expect(next.players[2].acted).toBe(false);
  });

  it("does not update lastFullRaiseAmount for an under raise all-in", () => {
    const state = createInitialGame();
    const players = state.players.map((player, index) => ({
      ...player,
      chips: index === 0 ? 30 : 900,
      status: index <= 2 ? ("Active" as const) : ("Folded" as const),
      acted: index === 0 ? false : true,
      roundBet: index <= 2 ? 100 : 0,
      committed: index <= 2 ? 100 : 0,
    }));
    const forced = {
      ...state,
      players,
      currentPlayerIndex: 0,
      currentBet: 100,
      lastFullRaiseAmount: 50,
      pot: 300,
      pots: calculatePots(players),
    };

    const next = applyPlayerAction(forced, 0, { type: "all-in" });

    expect(next.players[0]).toMatchObject({ status: "All-in", roundBet: 130 });
    expect(next.currentBet).toBe(130);
    expect(next.lastFullRaiseAmount).toBe(50);
  });

  it("does not ask an all-in player to act again", () => {
    const state = createInitialGame();
    const players = state.players.map((player, index) => ({
      ...player,
      chips: index === 0 ? 30 : 900,
      status: index <= 2 ? ("Active" as const) : ("Folded" as const),
      acted: index === 0 ? false : true,
      roundBet: index <= 2 ? 100 : 0,
      committed: index <= 2 ? 100 : 0,
    }));
    const forced = {
      ...state,
      players,
      currentPlayerIndex: 0,
      currentBet: 100,
      lastFullRaiseAmount: 50,
      pot: 300,
      pots: calculatePots(players),
    };

    const next = applyPlayerAction(forced, 0, { type: "all-in" });

    expect(next.players[0].status).toBe("All-in");
    expect(next.currentPlayerIndex).not.toBe(0);
  });
});
