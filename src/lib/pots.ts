import type { Card } from "./cards";
import { compareEvaluations, evaluateBestHand, type HandEvaluation } from "./handEvaluator";
import type { Player, PlayerStatus } from "./game";

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
  contributorPlayerIds?: string[];
  threshold?: number;
}

export interface PotAward {
  potIndex: number;
  pot: Pot;
  winnerIds: string[];
  shares: Record<string, number>;
  handName?: string;
}

export interface ResolvedPots {
  awards: PotAward[];
  payouts: Record<string, number>;
  evaluations: Record<string, HandEvaluation>;
}

type PotPlayer = Pick<Player, "id" | "committed" | "status" | "holeCards">;

export function calculatePots(players: Pick<Player, "id" | "committed" | "status">[]): Pot[] {
  const contributors = players.filter((player) => player.committed > 0);
  const thresholds = [...new Set(contributors.map((player) => player.committed))].sort((a, b) => a - b);
  let previousThreshold = 0;

  return thresholds
    .map((threshold) => {
      const potContributors = contributors.filter((player) => player.committed >= threshold);
      const amount = (threshold - previousThreshold) * potContributors.length;
      previousThreshold = threshold;
      return {
        amount,
        eligiblePlayerIds: getEligiblePlayersForPot(players, threshold),
        contributorPlayerIds: potContributors.map((player) => player.id),
        threshold,
      };
    })
    .filter((pot) => pot.amount > 0);
}

export function getEligiblePlayersForPot(players: Pick<Player, "id" | "committed" | "status">[], threshold: number): string[] {
  const liveContributors = players.filter((player) => player.committed >= threshold && isLiveStatus(player.status));
  if (liveContributors.length > 0) return liveContributors.map((player) => player.id);

  const livePlayersWithCommit = players.filter((player) => player.committed > 0 && isLiveStatus(player.status));
  const maxLiveCommit = Math.max(0, ...livePlayersWithCommit.map((player) => player.committed));
  return livePlayersWithCommit.filter((player) => player.committed === maxLiveCommit).map((player) => player.id);
}

export function resolvePots(pots: Pot[], players: PotPlayer[], communityCards: Card[], seatOrder = players.map((player) => player.id)): ResolvedPots {
  const payouts: Record<string, number> = Object.fromEntries(players.map((player) => [player.id, 0]));
  const evaluations = evaluatePlayers(players, communityCards);
  const awards = pots.map((pot, potIndex) => {
    if (pot.eligiblePlayerIds.length === 0) {
      throw new Error(`Pot ${potIndex} has no eligible players`);
    }

    const winnerIds = determinePotWinners(pot.eligiblePlayerIds, evaluations);
    const shares = splitPot(pot.amount, winnerIds, seatOrder);
    for (const [playerId, amount] of Object.entries(shares)) {
      payouts[playerId] = (payouts[playerId] ?? 0) + amount;
    }

    return {
      potIndex,
      pot,
      winnerIds,
      shares,
      handName: evaluations[winnerIds[0]]?.name,
    };
  });

  return { awards, payouts, evaluations };
}

export function splitPot(amount: number, winnerIds: string[], seatOrder: string[]): Record<string, number> {
  if (winnerIds.length === 0) {
    throw new Error("Cannot split a pot without winners");
  }

  const orderedWinners = [...winnerIds].sort((a, b) => seatOrder.indexOf(a) - seatOrder.indexOf(b));
  const share = Math.floor(amount / orderedWinners.length);
  let remainder = amount % orderedWinners.length;

  return Object.fromEntries(
    orderedWinners.map((winnerId) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      return [winnerId, share + extra];
    }),
  );
}

function determinePotWinners(eligiblePlayerIds: string[], evaluations: Record<string, HandEvaluation>): string[] {
  const eligibleEvaluations = eligiblePlayerIds.map((playerId) => evaluations[playerId]).filter(Boolean);
  if (eligibleEvaluations.length === 0) {
    throw new Error("Cannot resolve a pot without evaluated eligible players");
  }

  const best = eligibleEvaluations.sort(compareEvaluations).slice(-1)[0];
  return eligiblePlayerIds.filter((playerId) => compareEvaluations(evaluations[playerId], best) === 0);
}

function evaluatePlayers(players: PotPlayer[], communityCards: Card[]): Record<string, HandEvaluation> {
  return Object.fromEntries(
    players
      .filter((player) => isLiveStatus(player.status))
      .map((player) => [player.id, evaluateBestHand([...player.holeCards, ...communityCards])]),
  );
}

function isLiveStatus(status: PlayerStatus): boolean {
  return status !== "Folded" && status !== "Eliminated";
}
