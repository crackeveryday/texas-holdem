import { describe, expect, it } from "vitest";
import { parseCard } from "../lib/cards";
import { decideCpuAction, evaluatePostflopHand, evaluatePreflopHand } from "../lib/cpu";
import { BIG_BLIND, createInitialGame, MAX_RAISES_PER_ROUND, type GameState } from "../lib/game";

const c = (cards: string) => cards.split(" ").map(parseCard);

function cpuTurn(overrides: Partial<GameState> = {}, playerOverrides: Record<number, Partial<GameState["players"][number]>> = {}): GameState {
  const state = createInitialGame();
  return {
    ...state,
    currentPlayerIndex: 1,
    currentBet: 20,
    roundRaiseCount: 0,
    ...overrides,
    players: state.players.map((player, index) => ({
      ...player,
      acted: index === 1 ? false : true,
      roundBet: index === 1 ? 0 : 20,
      committed: index === 1 ? 0 : 20,
      raisedThisRound: false,
      ...(playerOverrides[index] ?? {}),
    })),
  };
}

describe("CPU hand evaluation", () => {
  it("classifies premium preflop hands as very strong", () => {
    expect(evaluatePreflopHand(c("AS AH")).category).toBe("veryStrong");
    expect(evaluatePreflopHand(c("AS KS")).category).toBe("veryStrong");
  });

  it("classifies disconnected low offsuit preflop hands as weak", () => {
    expect(evaluatePreflopHand(c("7C 2D")).category).toBe("weak");
  });

  it("classifies strong postflop made hands as very strong", () => {
    expect(evaluatePostflopHand(c("AS KS"), c("QS JS TS 2D 3C")).category).toBe("veryStrong");
  });
});

describe("CPU action selection", () => {
  it("does not raise after the round raise cap is reached", () => {
    const state = cpuTurn(
      { roundRaiseCount: MAX_RAISES_PER_ROUND },
      {
        1: { holeCards: c("AS AH") },
      },
    );
    const action = decideCpuAction(state, 1, () => 0.01);
    expect(action.type).not.toBe("raise");
  });

  it("avoids reraising with the same CPU in the same betting round", () => {
    const state = cpuTurn(
      {},
      {
        1: { holeCards: c("AS TS"), raisedThisRound: true },
      },
    );
    const action = decideCpuAction(state, 1, () => 0.01);
    expect(action.type).toBe("call");
  });

  it("folds weak preflop hands against expensive calls", () => {
    const state = cpuTurn(
      { currentBet: 300, pot: 500 },
      {
        1: { chips: 700, holeCards: c("7C 2D"), roundBet: 0 },
      },
    );
    const action = decideCpuAction(state, 1, () => 0.6);
    expect(action.type).toBe("fold");
  });

  it("calls or raises premium preflop hands instead of always raising", () => {
    const callState = cpuTurn({}, { 1: { holeCards: c("AS AH") } });
    const raiseState = cpuTurn({}, { 1: { holeCards: c("AS AH") } });
    expect(decideCpuAction(callState, 1, () => 0.5).type).toBe("call");
    expect(decideCpuAction(raiseState, 1, () => 0.1).type).toBe("raise");
  });

  it("checks weak hands when checking is available", () => {
    const state = cpuTurn(
      { currentBet: 0 },
      {
        1: { holeCards: c("7C 2D"), roundBet: 0, committed: 0 },
      },
    );
    const action = decideCpuAction(state, 1, () => 0.2);
    expect(action.type).toBe("check");
    expect(action.type).not.toBe("fold");
  });

  it("does not fold weak hands when already matched to the current bet", () => {
    const state = cpuTurn(
      { currentBet: BIG_BLIND },
      {
        1: { holeCards: c("7C 2D"), roundBet: BIG_BLIND, committed: BIG_BLIND },
      },
    );
    const action = decideCpuAction(state, 1, () => 0.2);
    expect(action.type).toBe("check");
  });

  it("can bet or raise with a strong postflop hand", () => {
    const state = cpuTurn(
      { stage: "flop", communityCards: c("QS JS TS"), currentBet: 20 },
      {
        1: { holeCards: c("AS KS"), roundBet: 0 },
      },
    );
    const action = decideCpuAction(state, 1, () => 0.2);
    expect(action.type).toBe("raise");
    expect(action.amount).toBeGreaterThanOrEqual(40);
  });

  it("does not use all-in for ordinary strong hands by default", () => {
    const state = cpuTurn({}, { 1: { holeCards: c("AS AH") } });
    const action = decideCpuAction(state, 1, () => 0.5);
    expect(action.type).not.toBe("all-in");
  });
});
