import { describe, expect, it } from "vitest";
import { applyPlayerAction, createInitialGame, getLegalActions, MAX_RAISES_PER_ROUND, type GameState } from "../lib/game";

function forceHumanTurn(state: GameState): GameState {
  return {
    ...state,
    currentPlayerIndex: 0,
    currentBet: 20,
    players: state.players.map((player, index) => ({
      ...player,
      acted: index === 0 ? false : true,
      roundBet: index === 0 ? 0 : 20,
      committed: index === 0 ? 0 : 20,
    })),
    pot: 80,
  };
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

  it("hides raise actions after the round raise cap", () => {
    const state = { ...forceHumanTurn(createInitialGame()), roundRaiseCount: MAX_RAISES_PER_ROUND };
    const actions = getLegalActions(state, 0).map((action) => action.type);
    expect(actions).not.toContain("raise");
    expect(actions).not.toContain("all-in");
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
    const forced = { ...state, players: folded, currentPlayerIndex: 0, pot: 90, currentBet: 20 };
    const next = applyPlayerAction(forced, 0, { type: "check" });
    expect(next.players[0].chips).toBeGreaterThan(winner.chips);
    expect(next.currentPlayerIndex).toBeNull();
  });
});
