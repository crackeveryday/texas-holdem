import { useEffect, useMemo, useState } from "react";
import { cardLabel, type Card } from "./lib/cards";
import { decideCpuAction } from "./lib/cpu";
import {
  applyPlayerAction,
  createInitialGame,
  getLegalActions,
  playerBestHand,
  restartGame,
  startHand,
  type GameAction,
  type GameState,
  type Player,
} from "./lib/game";

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
          <p>5人テーブル / No Limit風 選択式ベット</p>
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
            legalActions.map((action, index) => (
              <button key={`${action.type}-${action.amount ?? index}`} onClick={() => dispatch(action)}>
                {actionLabel(action)}
              </button>
            ))
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

function actionLabel(action: GameAction): string {
  const suffix = action.amount ? ` ${action.amount}` : "";
  if (action.type === "all-in") return "All-in";
  return `${action.type[0].toUpperCase()}${action.type.slice(1)}${suffix}`;
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
