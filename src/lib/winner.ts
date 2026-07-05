import type { Card } from "./cards";
import { compareEvaluations, evaluateBestHand, type HandEvaluation } from "./handEvaluator";

export interface ShowdownPlayer {
  id: string;
  holeCards: Card[];
  folded: boolean;
}

export interface WinnerResult {
  winners: string[];
  evaluations: Record<string, HandEvaluation>;
}

export function determineWinners(players: ShowdownPlayer[], communityCards: Card[]): WinnerResult {
  const contenders = players.filter((player) => !player.folded);
  if (contenders.length === 0) {
    throw new Error("Cannot determine winners without contenders");
  }
  const evaluations = Object.fromEntries(
    contenders.map((player) => [player.id, evaluateBestHand([...player.holeCards, ...communityCards])]),
  );
  const sorted = Object.values(evaluations).sort(compareEvaluations);
  const best = sorted[sorted.length - 1];
  return {
    winners: contenders
      .filter((player) => compareEvaluations(evaluations[player.id], best) === 0)
      .map((player) => player.id),
    evaluations,
  };
}
