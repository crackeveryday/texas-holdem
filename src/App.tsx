import { useEffect, useMemo, useState } from "react";
import { cardLabel, type Card } from "./lib/cards";
import { decideCpuAction } from "./lib/cpu";
import {
  applyPlayerAction,
  BIG_BLIND,
  createInitialGame,
  getLegalActions,
  playerBestHand,
  restartGame,
  startHand,
  type GameAction,
  type GameState,
  type Player,
} from "./lib/game";
import {
  adjustWagerAmount,
  calculatePresetBetAmount,
  calculatePresetRaiseToAmount,
  classifyAllInAction,
  getCallAmount,
  getMaxBetAmount,
  getMaxRaiseTo,
  getMinBet,
  getMinRaiseTo,
  validateBetAmount,
  validateRaiseToAmount,
  type AllInActionKind,
  type WagerPreset,
} from "./lib/wager";

const humanIndex = 0;

export default function App() {
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const currentPlayer = game.currentPlayerIndex === null ? null : game.players[game.currentPlayerIndex];
  const legalActions = useMemo(() => getLegalActions(game, humanIndex), [game]);
  const humanBest = playerBestHand(game.players[humanIndex], game.communityCards);

  useEffect(() => {
    if (game.currentPlayerIndex === null) return;
    const player = game.players[game.currentPlayerIndex];
    if (player.isHuman || game.stage === "gameOver") return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (current.currentPlayerIndex === null) return current;
        const cpuAction = decideCpuAction(current, current.currentPlayerIndex);
        return applyPlayerAction(current, current.currentPlayerIndex, cpuAction);
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [game]);

  function dispatch(action: GameAction) {
    setGame((current) => applyPlayerAction(current, humanIndex, action));
  }

  function nextHand() {
    setGame((current) => startHand(current));
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Texas Hold'em</h1>
          <p>5人テーブル / No Limit Raise to</p>
        </div>
        <div className="summary">
          <span>Hand {game.handNumber}</span>
          <span>Stage {stageLabel(game.stage)}</span>
          <span>Pot {game.pot}</span>
          <span>Current Bet {game.currentBet}</span>
        </div>
      </header>

      <section className="table">
        <div className="board">
          <h2>Community Cards</h2>
          <div className="cards">
            {Array.from({ length: 5 }, (_, index) => (
              <CardView key={index} card={game.communityCards[index]} hidden={!game.communityCards[index]} />
            ))}
          </div>
        </div>

        <PotBreakdown game={game} />

        <div className="players">
          {game.players.map((player, index) => (
            <PlayerPanel
              key={player.id}
              player={player}
              index={index}
              game={game}
              isCurrent={game.currentPlayerIndex === index}
              reveal={player.isHuman || game.showdown || game.stage === "gameOver"}
            />
          ))}
        </div>
      </section>

      <section className="controls">
        <div>
          <h2>Action</h2>
          <p>{currentPlayer ? `${currentPlayer.name}'s turn` : game.stage === "gameOver" ? "Game over" : "Hand complete"}</p>
          {humanBest && <p>Your best hand: {humanBest.name}</p>}
        </div>
        <div className="buttons">
          {game.stage === "gameOver" ? (
            <button onClick={() => setGame(restartGame())}>Restart</button>
          ) : game.currentPlayerIndex === null ? (
            <button onClick={nextHand}>Next Hand</button>
          ) : currentPlayer?.isHuman ? (
            <HumanActionControls game={game} player={currentPlayer} legalActions={legalActions} onAction={dispatch} />
          ) : (
            <span className="waiting">CPU thinking...</span>
          )}
        </div>
      </section>

      <section className="log">
        <h2>Game Log</h2>
        <ol>
          {game.logs.slice(0, 80).map((log, index) => (
            <li key={`${index}-${log}`}>{log}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function HumanActionControls({ game, player, legalActions, onAction }: { game: GameState; player: Player; legalActions: GameAction[]; onAction: (action: GameAction) => void }) {
  const actionTypes = legalActions.map((action) => action.type);
  const canBet = actionTypes.includes("bet");
  const canRaise = actionTypes.includes("raise");
  const mode = canBet ? "bet" : canRaise ? "raise" : "none";
  const callAmount = getCallAmount(game.currentBet, player);
  const minBet = getMinBet(BIG_BLIND);
  const maxBet = getMaxBetAmount(player);
  const minRaiseTo = getMinRaiseTo(game.currentBet, game.lastFullRaiseAmount);
  const maxRaiseTo = getMaxRaiseTo(player);
  const initialAmount = mode === "bet" ? (maxBet < minBet ? maxBet : minBet) : mode === "raise" ? (maxRaiseTo < minRaiseTo ? maxRaiseTo : minRaiseTo) : 0;
  const [amount, setAmount] = useState(initialAmount);
  const smallStep = BIG_BLIND;
  const largeStep = BIG_BLIND * 5;

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount, mode, game.currentBet, game.lastFullRaiseAmount, player.chips, player.roundBet]);

  const validation =
    mode === "bet"
      ? validateBetAmount(amount, minBet, player)
      : mode === "raise"
        ? validateRaiseToAmount(amount, game.currentBet, minRaiseTo, player)
        : { valid: false, reason: undefined as string | undefined };
  const allInKind = mode === "raise" ? classifyAllInAction(amount, game.currentBet, minRaiseTo, maxRaiseTo) : validation.allInKind ?? "none";
  const minAmount = mode === "bet" ? (maxBet < minBet ? maxBet : minBet) : maxRaiseTo < minRaiseTo ? maxRaiseTo : minRaiseTo;
  const maxAmount = mode === "bet" ? maxBet : maxRaiseTo;

  function setPreset(preset: WagerPreset) {
    if (mode === "bet") {
      setAmount(calculatePresetBetAmount(preset, game.pot, minBet, maxBet, BIG_BLIND));
    } else if (mode === "raise") {
      setAmount(calculatePresetRaiseToAmount(preset, game.pot, game.currentBet, callAmount, minRaiseTo, maxRaiseTo, BIG_BLIND));
    }
  }

  function changeBy(delta: number) {
    setAmount((current) => adjustWagerAmount(current, delta, minAmount, maxAmount));
  }

  function submitWager() {
    if (!validation.valid) return;
    if (mode === "bet") onAction({ type: "bet", amount });
    if (mode === "raise") onAction({ type: "raise", amount });
  }

  return (
    <div className="actionPanel">
      <div className="quickActions">
        {actionTypes.includes("check") && <button onClick={() => onAction({ type: "check" })}>Check</button>}
        {actionTypes.includes("call") && <button onClick={() => onAction({ type: "call" })}>Call {Math.min(callAmount, player.chips)}</button>}
        {actionTypes.includes("all-in") && <button onClick={() => onAction({ type: "all-in" })}>All-in</button>}
        {actionTypes.includes("fold") && <button onClick={() => onAction({ type: "fold" })}>Fold</button>}
      </div>

      {mode !== "none" && (
        <div className="wagerControl">
          <div className="wagerStats">
            <Stat label="Pot" value={game.pot} />
            <Stat label="Current Bet" value={game.currentBet} />
            {mode === "raise" && <Stat label="To Call" value={callAmount} />}
            <Stat label={mode === "bet" ? "Min Bet" : "Min Raise To"} value={mode === "bet" ? minBet : minRaiseTo} />
            <Stat label={mode === "bet" ? "Max Bet" : "Max Raise To"} value={mode === "bet" ? maxBet : maxRaiseTo} />
            <Stat label="Your Chips" value={player.chips} />
          </div>

          <div className="amountDisplay">
            <span>{mode === "bet" ? "Selected Bet" : "Selected Raise To"}</span>
            <strong>{amount}</strong>
            {mode === "raise" && <em>Additional {Math.max(0, amount - player.roundBet)}</em>}
            {allInKind !== "none" && <em className="allInNote">{allInLabel(allInKind)}</em>}
          </div>

          <div className="stepButtons">
            <button onClick={() => changeBy(-largeStep)}>--</button>
            <button onClick={() => changeBy(-smallStep)}>-</button>
            <button onClick={() => changeBy(smallStep)}>+</button>
            <button onClick={() => changeBy(largeStep)}>++</button>
          </div>

          <div className="presetButtons">
            <button onClick={() => setPreset("min")}>Min</button>
            <button onClick={() => setPreset("half-pot")}>1/2 Pot</button>
            <button onClick={() => setPreset("pot")}>Pot</button>
            <button onClick={() => setPreset("all-in")}>All-in</button>
          </div>

          {!validation.valid && validation.reason && <p className="errorText">{validation.reason}</p>}
          <button className="primaryAction" disabled={!validation.valid} onClick={submitWager}>
            {mode === "bet" ? "Bet" : "Raise"}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function allInLabel(kind: AllInActionKind): string {
  if (kind === "all-in-call") return "All-in Call";
  if (kind === "all-in-under-raise") return "Under Raise All-in";
  if (kind === "all-in-full-raise") return "Full Raise All-in";
  return "";
}

function PotBreakdown({ game }: { game: GameState }) {
  const pots = game.pots.length > 0 ? game.pots : [{ amount: game.pot, eligiblePlayerIds: game.players.filter((player) => player.status !== "Folded").map((player) => player.id) }];

  return (
    <div className="potBreakdown">
      {pots.map((pot, index) => (
        <div key={`${index}-${pot.amount}`}>
          <strong>{index === 0 ? "Main Pot" : `Side Pot ${index}`}: {pot.amount}</strong>
          <span>eligible: {pot.eligiblePlayerIds.map((id) => game.players.find((player) => player.id === id)?.name ?? id).join(", ") || "none"}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerPanel({ player, index, game, isCurrent, reveal }: { player: Player; index: number; game: GameState; isCurrent: boolean; reveal: boolean }) {
  const badges = [
    game.dealerIndex === index ? "D" : null,
    game.smallBlindIndex === index ? "SB" : null,
    game.bigBlindIndex === index ? "BB" : null,
  ].filter(Boolean);
  const evaluation = game.lastEvaluations[player.id];

  return (
    <article className={`player ${player.isHuman ? "human" : ""} ${isCurrent ? "current" : ""}`}>
      <div className="playerHead">
        <h3>{player.name}</h3>
        <div className="badges">
          {badges.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      </div>
      <div className="cards">
        {player.holeCards.map((card, cardIndex) => (
          <CardView key={cardIndex} card={card} hidden={!reveal} />
        ))}
      </div>
      <dl>
        <div>
          <dt>Chips</dt>
          <dd>{player.chips}</dd>
        </div>
        <div>
          <dt>Committed</dt>
          <dd>{player.committed}</dd>
        </div>
        <div>
          <dt>Round Bet</dt>
          <dd>{player.roundBet}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{player.status}</dd>
        </div>
      </dl>
      {evaluation && <p className="handName">{evaluation.name}</p>}
    </article>
  );
}

function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (!card || hidden) {
    return <span className="card back">{card ? "??" : ""}</span>;
  }
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return <span className={`card ${red ? "red" : "black"}`}>{cardLabel(card)}</span>;
}

function stageLabel(stage: GameState["stage"]): string {
  const labels: Record<GameState["stage"], string> = {
    preflop: "Preflop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown",
    handOver: "Hand Over",
    gameOver: "Game Over",
  };
  return labels[stage];
}
