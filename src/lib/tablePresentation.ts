import type { GameState, Player } from "./game";

export type SeatPosition = "human" | "left" | "top-left" | "top-right" | "right";

const seatPositions: SeatPosition[] = ["human", "left", "top-left", "top-right", "right"];

export function getSeatPosition(playerIndex: number): SeatPosition {
  return seatPositions[playerIndex] ?? "top-left";
}

export function shouldShowHoleCards(player: Player, game: GameState): boolean {
  if (player.status !== "Eliminated") return true;
  return Boolean(game.roundResult && player.holeCards.length > 0);
}
