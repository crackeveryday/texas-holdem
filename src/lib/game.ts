import { createDeck, drawCards, shuffleDeck, type Card } from "./cards";
import { evaluateBestHand, type HandEvaluation } from "./handEvaluator";
import { determineWinners } from "./winner";

export type PlayerStatus = "Active" | "Folded" | "All-in" | "Eliminated";
export type Stage = "preflop" | "flop" | "turn" | "river" | "showdown" | "handOver" | "gameOver";
export type ActionType = "check" | "call" | "bet" | "raise" | "fold" | "all-in";

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  chips: number;
  holeCards: Card[];
  status: PlayerStatus;
  committed: number;
  roundBet: number;
  acted: boolean;
  raisedThisRound: boolean;
}

export interface GameState {
  players: Player[];
  deck: Card[];
  communityCards: Card[];
  stage: Stage;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerIndex: number | null;
  currentBet: number;
  pot: number;
  handNumber: number;
  logs: string[];
  lastEvaluations: Record<string, HandEvaluation>;
  showdown: boolean;
  roundRaiseCount: number;
}

export interface GameAction {
  type: ActionType;
  amount?: number;
}

export const INITIAL_CHIPS = 1000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const BET_OPTIONS = [10, 25, 50];
export const MAX_RAISES_PER_ROUND = 2;

export function createInitialGame(): GameState {
  const players = Array.from({ length: 5 }, (_, index): Player => ({
    id: `p${index}`,
    name: index === 0 ? "You" : `CPU ${index}`,
    isHuman: index === 0,
    chips: INITIAL_CHIPS,
    holeCards: [] as Card[],
    status: "Active",
    committed: 0,
    roundBet: 0,
    acted: false,
    raisedThisRound: false,
  }));
  return startHand({
    players,
    deck: [],
    communityCards: [],
    stage: "handOver",
    dealerIndex: 0,
    smallBlindIndex: 1,
    bigBlindIndex: 2,
    currentPlayerIndex: null,
    currentBet: 0,
    pot: 0,
    handNumber: 0,
    logs: [],
    lastEvaluations: {},
    showdown: false,
    roundRaiseCount: 0,
  });
}

export function restartGame(): GameState {
  return createInitialGame();
}

export function startHand(previous: GameState): GameState {
  const activePlayers = previous.players.filter((player) => player.chips > 0);
  if (activePlayers.length < 2 || previous.players[0].chips <= 0) {
    return { ...previous, stage: "gameOver", currentPlayerIndex: null, logs: ["Game over. Restart to play again.", ...previous.logs] };
  }

  const players = previous.players.map((player) => ({
    ...player,
    holeCards: [] as Card[],
    committed: 0,
    roundBet: 0,
    acted: false,
    raisedThisRound: false,
    status: player.chips > 0 ? ("Active" as const) : ("Eliminated" as const),
  }));
  let deck = shuffleDeck(createDeck());
  const dealerIndex = nextEligibleIndex(players, previous.handNumber === 0 ? previous.dealerIndex - 1 : previous.dealerIndex);
  const smallBlindIndex = nextEligibleIndex(players, dealerIndex);
  const bigBlindIndex = nextEligibleIndex(players, smallBlindIndex);

  for (let round = 0; round < 2; round += 1) {
    for (const index of eligibleIndexes(players, dealerIndex + 1)) {
      const draw = drawCards(deck, 1);
      players[index].holeCards.push(draw.drawn[0]);
      deck = draw.deck;
    }
  }

  postBlind(players[smallBlindIndex], SMALL_BLIND);
  postBlind(players[bigBlindIndex], BIG_BLIND);
  const currentPlayerIndex = nextActionableIndex(players, bigBlindIndex);
  const pot = calculatePot(players);

  return {
    ...previous,
    players,
    deck,
    communityCards: [],
    stage: "preflop",
    dealerIndex,
    smallBlindIndex,
    bigBlindIndex,
    currentPlayerIndex,
    currentBet: Math.max(players[bigBlindIndex].roundBet, players[smallBlindIndex].roundBet),
    pot,
    handNumber: previous.handNumber + 1,
    lastEvaluations: {},
    showdown: false,
    roundRaiseCount: 0,
    logs: [
      `Hand ${previous.handNumber + 1} started. ${players[smallBlindIndex].name} posts SB ${SMALL_BLIND}, ${players[bigBlindIndex].name} posts BB ${BIG_BLIND}.`,
      ...previous.logs,
    ],
  };
}

export function getLegalActions(state: GameState, playerIndex: number): GameAction[] {
  const player = state.players[playerIndex];
  if (!isActionable(player) || state.currentPlayerIndex !== playerIndex) return [];

  const toCall = Math.max(0, state.currentBet - player.roundBet);
  const actions: GameAction[] = [];
  if (toCall === 0) {
    actions.push({ type: "check" });
    for (const amount of BET_OPTIONS) {
      if (player.chips > 0) actions.push({ type: "bet", amount: Math.min(amount, player.chips) });
    }
  } else {
    actions.push({ type: "call" });
    if (state.roundRaiseCount < MAX_RAISES_PER_ROUND) {
      for (const amount of BET_OPTIONS) {
        if (player.chips > toCall) actions.push({ type: "raise", amount });
      }
    }
  }
  const allInWouldRaise = toCall > 0 && player.chips > toCall;
  if (!(allInWouldRaise && state.roundRaiseCount >= MAX_RAISES_PER_ROUND)) {
    actions.push({ type: "all-in" });
  }
  actions.push({ type: "fold" });
  return dedupeActions(actions, player.chips, toCall);
}

export function applyPlayerAction(state: GameState, playerIndex: number, action: GameAction): GameState {
  if (state.currentPlayerIndex !== playerIndex) return state;
  const players = state.players.map((player) => ({ ...player, holeCards: [...player.holeCards] }));
  const player = players[playerIndex];
  const logs = [...state.logs];
  let currentBet = state.currentBet;
  let roundRaiseCount = state.roundRaiseCount;

  if (!isActionable(player)) return state;

  const toCall = Math.max(0, currentBet - player.roundBet);
  if (action.type === "fold") {
    player.status = "Folded";
    player.acted = true;
    logs.unshift(`${player.name} folds.`);
  } else if (action.type === "check" && toCall === 0) {
    player.acted = true;
    logs.unshift(`${player.name} checks.`);
  } else if (action.type === "call") {
    const paid = commitChips(player, toCall);
    player.acted = true;
    logs.unshift(`${player.name} ${player.status === "All-in" ? "calls all-in" : "calls"} ${paid}.`);
  } else if (action.type === "bet" && toCall === 0) {
    const paid = commitChips(player, action.amount ?? 0);
    if (player.roundBet > currentBet) {
      currentBet = player.roundBet;
      resetOtherActors(players, playerIndex);
    }
    player.acted = true;
    logs.unshift(`${player.name} ${player.status === "All-in" ? "bets all-in" : "bets"} ${paid}.`);
  } else if (action.type === "raise" && toCall > 0) {
    if (roundRaiseCount >= MAX_RAISES_PER_ROUND) {
      return state;
    }
    const target = currentBet + (action.amount ?? 0);
    const paid = commitChips(player, target - player.roundBet);
    if (player.roundBet > currentBet) {
      currentBet = player.roundBet;
      roundRaiseCount += 1;
      player.raisedThisRound = true;
      resetOtherActors(players, playerIndex);
    }
    player.acted = true;
    logs.unshift(`${player.name} ${player.status === "All-in" ? "raises all-in" : "raises"} ${paid}.`);
  } else if (action.type === "all-in") {
    const before = player.roundBet;
    const paid = commitChips(player, player.chips);
    if (player.roundBet > currentBet) {
      if (toCall > 0 && roundRaiseCount >= MAX_RAISES_PER_ROUND) {
        return state;
      }
      currentBet = player.roundBet;
      if (toCall > 0) {
        roundRaiseCount += 1;
        player.raisedThisRound = true;
      }
      resetOtherActors(players, playerIndex);
    }
    player.acted = true;
    logs.unshift(`${player.name} goes all-in for ${paid}${before < state.currentBet ? " total call/raise" : ""}.`);
  }

  return continueGame({
    ...state,
    players,
    currentBet,
    roundRaiseCount,
    pot: calculatePot(players),
    logs,
  });
}

export function calculatePot(players: Player[]): number {
  return players.reduce((total, player) => total + player.committed, 0);
}

export function isActionable(player: Player): boolean {
  return player.status === "Active" && player.chips > 0;
}

function continueGame(state: GameState): GameState {
  const livePlayers = state.players.filter((player) => player.status !== "Folded" && player.status !== "Eliminated");
  if (livePlayers.length === 1) {
    return awardSingleWinner(state, livePlayers[0].id);
  }
  if (allRemainingAllIn(state.players)) {
    return showdown(revealRemainingBoard(state));
  }
  if (bettingRoundComplete(state)) {
    return advanceStage(state);
  }
  return { ...state, currentPlayerIndex: nextActionableIndex(state.players, state.currentPlayerIndex ?? state.dealerIndex) };
}

function advanceStage(state: GameState): GameState {
  const players = state.players.map((player) => ({ ...player, roundBet: 0, acted: !isActionable(player), raisedThisRound: false }));
  let deck = state.deck;
  let communityCards = state.communityCards;
  let stage: Stage = state.stage;
  const logs = [...state.logs];

  if (state.stage === "preflop") {
    const draw = drawCards(deck, 3);
    deck = draw.deck;
    communityCards = [...communityCards, ...draw.drawn];
    stage = "flop";
    logs.unshift(`Flop: ${draw.drawn.map(formatCard).join(" ")}`);
  } else if (state.stage === "flop") {
    const draw = drawCards(deck, 1);
    deck = draw.deck;
    communityCards = [...communityCards, ...draw.drawn];
    stage = "turn";
    logs.unshift(`Turn: ${formatCard(draw.drawn[0])}`);
  } else if (state.stage === "turn") {
    const draw = drawCards(deck, 1);
    deck = draw.deck;
    communityCards = [...communityCards, ...draw.drawn];
    stage = "river";
    logs.unshift(`River: ${formatCard(draw.drawn[0])}`);
  } else {
    return showdown(state);
  }

  const next = nextActionableIndex(players, state.dealerIndex);
  return continueGame({ ...state, players, deck, communityCards, stage, currentBet: 0, currentPlayerIndex: next, roundRaiseCount: 0, logs });
}

function showdown(state: GameState): GameState {
  const result = determineWinners(
    state.players.map((player) => ({ id: player.id, holeCards: player.holeCards, folded: player.status === "Folded" || player.status === "Eliminated" })),
    state.communityCards,
  );
  const players = payWinners(state.players, result.winners, state.pot);
  const winnerNames = result.winners.map((id) => players.find((player) => player.id === id)?.name).join(", ");
  const bestHand = result.evaluations[result.winners[0]].name;
  return finishHand({
    ...state,
    players,
    stage: "showdown",
    currentPlayerIndex: null,
    lastEvaluations: result.evaluations,
    showdown: true,
    logs: [`Showdown: ${winnerNames} win ${state.pot} with ${bestHand}.`, ...state.logs],
  });
}

function awardSingleWinner(state: GameState, winnerId: string): GameState {
  const players = payWinners(state.players, [winnerId], state.pot);
  const winner = players.find((player) => player.id === winnerId)!;
  return finishHand({
    ...state,
    players,
    stage: "handOver",
    currentPlayerIndex: null,
    showdown: false,
    logs: [`${winner.name} wins ${state.pot}; everyone else folded.`, ...state.logs],
  });
}

function finishHand(state: GameState): GameState {
  const players = state.players.map((player) => ({
    ...player,
    status: player.chips <= 0 ? ("Eliminated" as const) : player.status,
  }));
  const gameOver = players[0].chips <= 0 || players.filter((player) => player.chips > 0).length < 2;
  return {
    ...state,
    players,
    stage: gameOver ? "gameOver" : state.stage,
    currentPlayerIndex: null,
    logs: gameOver ? ["Game over. Restart to play again.", ...state.logs] : state.logs,
  };
}

function revealRemainingBoard(state: GameState): GameState {
  let deck = state.deck;
  let communityCards = state.communityCards;
  const logs = [...state.logs];
  while (communityCards.length < 5) {
    const count = communityCards.length === 0 ? 3 : 1;
    const draw = drawCards(deck, count);
    deck = draw.deck;
    communityCards = [...communityCards, ...draw.drawn];
    logs.unshift(`Board: ${draw.drawn.map(formatCard).join(" ")}`);
  }
  return { ...state, deck, communityCards, logs };
}

function payWinners(players: Player[], winnerIds: string[], pot: number): Player[] {
  const share = Math.floor(pot / winnerIds.length);
  let remainder = pot % winnerIds.length;
  return players.map((player) => {
    if (!winnerIds.includes(player.id)) return player;
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { ...player, chips: player.chips + share + extra };
  });
}

function postBlind(player: Player, amount: number): void {
  commitChips(player, amount);
  player.acted = false;
}

function commitChips(player: Player, requested: number): number {
  const paid = Math.max(0, Math.min(player.chips, requested));
  player.chips -= paid;
  player.committed += paid;
  player.roundBet += paid;
  if (player.chips === 0) player.status = "All-in";
  return paid;
}

function resetOtherActors(players: Player[], raiserIndex: number): void {
  players.forEach((player, index) => {
    if (index !== raiserIndex && isActionable(player)) player.acted = false;
  });
}

function bettingRoundComplete(state: GameState): boolean {
  return state.players.every((player) => {
    if (!isActionable(player)) return true;
    return player.acted && player.roundBet === state.currentBet;
  });
}

function allRemainingAllIn(players: Player[]): boolean {
  return players.every((player) => player.status === "Folded" || player.status === "Eliminated" || player.status === "All-in");
}

function nextEligibleIndex(players: Player[], fromIndex: number): number {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (fromIndex + offset + players.length) % players.length;
    if (players[index].chips > 0) return index;
  }
  return 0;
}

function nextActionableIndex(players: Player[], fromIndex: number): number | null {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (fromIndex + offset + players.length) % players.length;
    if (isActionable(players[index])) return index;
  }
  return null;
}

function eligibleIndexes(players: Player[], startIndex: number): number[] {
  return players
    .map((_, index) => (startIndex + index) % players.length)
    .filter((index) => players[index].chips > 0);
}

function dedupeActions(actions: GameAction[], chips: number, toCall: number): GameAction[] {
  const seen = new Set<string>();
  return actions
    .filter((action) => action.type !== "bet" || (action.amount ?? 0) > 0)
    .filter((action) => action.type !== "raise" || chips > toCall)
    .filter((action) => {
      const key = `${action.type}:${action.amount ?? 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatCard(card: Card): string {
  const rank = card.rank === 14 ? "A" : card.rank === 13 ? "K" : card.rank === 12 ? "Q" : card.rank === 11 ? "J" : String(card.rank);
  const suit = card.suit === "spades" ? "S" : card.suit === "hearts" ? "H" : card.suit === "diamonds" ? "D" : "C";
  return `${rank}${suit}`;
}

export function playerBestHand(player: Player, communityCards: Card[]): HandEvaluation | null {
  if (player.holeCards.length !== 2 || communityCards.length < 3) return null;
  return evaluateBestHand([...player.holeCards, ...communityCards]);
}
