import { describe, expect, it } from "vitest";
import { parseCard } from "../lib/cards";
import { createInitialGame, startHand, type GameState } from "../lib/game";
import { getSeatPosition, shouldShowHoleCards } from "../lib/tablePresentation";

const c = (cards: string) => cards.split(" ").map(parseCard);

function roundResult(): NonNullable<GameState["roundResult"]> {
  return {
    kind: "showdown",
    title: "CPU 2 wins!",
    reason: "CPU 2 won with One Pair",
    winnerIds: ["p2"],
    winnerNames: ["CPU 2"],
    humanChipDelta: 0,
    awards: [
      {
        potName: "Main Pot",
        amount: 100,
        winnerIds: ["p2"],
        winnerNames: ["CPU 2"],
        handName: "One Pair",
        shares: { p2: 100 },
      },
    ],
  };
}

describe("table presentation", () => {
  it("maps player order to clockwise table seats", () => {
    const game = createInitialGame();

    expect(game.players.map((player, index) => [player.name, getSeatPosition(index)])).toEqual([
      ["You", "human"],
      ["CPU 1", "left"],
      ["CPU 2", "top-left"],
      ["CPU 3", "top-right"],
      ["CPU 4", "right"],
    ]);
  });

  it("keeps preflop action moving clockwise from the big blind", () => {
    const game = createInitialGame();

    expect(game.dealerIndex).toBe(0);
    expect(game.smallBlindIndex).toBe(1);
    expect(game.bigBlindIndex).toBe(2);
    expect(game.currentPlayerIndex).toBe(3);
    expect(getSeatPosition(game.currentPlayerIndex ?? -1)).toBe("top-right");
  });

  it("keeps eliminated hole cards visible until the result leaves the table", () => {
    const game = createInitialGame();
    const players = game.players.map((player, index) => ({
      ...player,
      chips: index === 1 ? 0 : player.chips,
      holeCards: index === 1 ? c("AS AD") : player.holeCards,
      status: index === 1 ? ("Eliminated" as const) : player.status,
    }));
    const resultState = { ...game, players, roundResult: roundResult() };

    expect(shouldShowHoleCards(resultState.players[1], resultState)).toBe(true);

    const nextHand = startHand(resultState);

    expect(nextHand.players[1]).toMatchObject({ status: "Eliminated", holeCards: [] });
    expect(shouldShowHoleCards(nextHand.players[1], nextHand)).toBe(false);
  });
});
