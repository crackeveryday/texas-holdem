import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Card } from "./lib/cards";
import { cardDisplayKey, getRankLabel, getSuitColorClass, getSuitSymbol } from "./lib/cardDisplay";
import { decideCpuAction } from "./lib/cpu";
import { getCpuActionDelay, sleep } from "./lib/cpuTiming";
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

interface BoardReveal {
  handNumber: number;
  from: number;
  to: number;
  label: string;
}

export default function App() {
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const [thinkingPlayerId, setThinkingPlayerId] = useState<string | null>(null);
  const [boardReveal, setBoardReveal] = useState<BoardReveal | null>(null);
  const mountedRef = useRef(false);
  const pendingCpuActionRef = useRef<string | null>(null);
  const previousBoardRef = useRef({ handNumber: game.handNumber, count: game.communityCards.length });
  const currentPlayer = game.currentPlayerIndex === null ? null : game.players[game.currentPlayerIndex];
  const legalActions = useMemo(() => getLegalActions(game, humanIndex), [game]);
  const humanBest = playerBestHand(game.players[humanIndex], game.communityCards);
  const isCpuThinking = thinkingPlayerId !== null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const previous = previousBoardRef.current;
    const count = game.communityCards.length;

    if (previous.handNumber !== game.handNumber) {
      previousBoardRef.current = { handNumber: game.handNumber, count };
      setBoardReveal(null);
      return;
    }

    if (count > previous.count) {
      setBoardReveal({
        handNumber: game.handNumber,
        from: previous.count,
        to: count,
        label: boardRevealLabel(previous.count, count),
      });
    }

    previousBoardRef.current = { handNumber: game.handNumber, count };
  }, [game.handNumber, game.communityCards.length]);

  useEffect(() => {
    const playerIndex = game.currentPlayerIndex;
    if (playerIndex === null) {
      pendingCpuActionRef.current = null;
      if (mountedRef.current) setThinkingPlayerId(null);
      return;
    }

    const player = game.players[playerIndex];
    if (player.isHuman || game.stage === "gameOver") {
      pendingCpuActionRef.current = null;
      if (mountedRef.current) setThinkingPlayerId(null);
      return;
    }

    const pendingKey = `${game.handNumber}:${game.stage}:${player.id}:${playerIndex}`;
    let cancelled = false;
    pendingCpuActionRef.current = pendingKey;
    if (mountedRef.current) setThinkingPlayerId(player.id);

    async function actAfterThinking() {
      await sleep(getCpuActionDelay());
      if (cancelled || pendingCpuActionRef.current !== pendingKey) return;

      setGame((current) => {
        const currentPlayerIndex = current.currentPlayerIndex;
        if (currentPlayerIndex === null) return current;
        const currentPlayer = current.players[currentPlayerIndex];
        if (
          current.handNumber !== game.handNumber ||
          current.stage === "gameOver" ||
          currentPlayerIndex !== playerIndex ||
          currentPlayer.id !== player.id ||
          currentPlayer.isHuman ||
          pendingCpuActionRef.current !== pendingKey
        ) {
          return current;
        }

        const cpuAction = decideCpuAction(current, currentPlayerIndex);
        return applyPlayerAction(current, currentPlayerIndex, cpuAction);
      });
    }

    void actAfterThinking();

    return () => {
      cancelled = true;
      if (pendingCpuActionRef.current === pendingKey) {
        pendingCpuActionRef.current = null;
        if (mountedRef.current) setThinkingPlayerId(null);
      }
    };
  }, [game]);

  function dispatch(action: GameAction) {
    if (isCpuThinking) return;
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

      <div className="playLayout">
        <PokerTable game={game} thinkingPlayerId={thinkingPlayerId} boardReveal={boardReveal} />

        <section className="controls">
          <div className="actionSummary">
            <h2>Action</h2>
            <p>{actionStatusLabel(currentPlayer, game, thinkingPlayerId)}</p>
            {humanBest && <p>Your best hand: {humanBest.name}</p>}
            <RoundResultPanel result={game.roundResult} />
          </div>
          <div className="buttons">
            {game.stage === "gameOver" ? (
              <button onClick={() => setGame(restartGame())}>Restart</button>
            ) : game.currentPlayerIndex === null ? (
              <button onClick={nextHand}>Next Hand</button>
            ) : currentPlayer?.isHuman ? (
              <ActionPanel game={game} player={currentPlayer} legalActions={legalActions} disabled={isCpuThinking} onAction={dispatch} />
            ) : (
              <span className="waiting">{currentPlayer?.name ?? "CPU"} thinking...</span>
            )}
          </div>
        </section>
      </div>

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

function RoundResultPanel({ result }: { result: GameState["roundResult"] }) {
  if (!result) return null;

  const deltaClass = result.humanChipDelta > 0 ? "positive" : result.humanChipDelta < 0 ? "negative" : "neutral";
  const showAwardDetails = result.awards.length > 1 || result.awards.some((award) => award.winnerIds.length > 1);

  return (
    <section className="roundResult" aria-label="Round result">
      <div className="roundResultMain">
        <div>
          <span className="resultEyebrow">{result.kind === "showdown" ? "Showdown result" : "Fold result"}</span>
          <h3>{result.title}</h3>
          <p>{result.reason}</p>
        </div>
        <div className={`chipDelta ${deltaClass}`}>
          <span>Your result</span>
          <strong>{formatChipDelta(result.humanChipDelta)}</strong>
        </div>
      </div>

      {showAwardDetails && (
        <div className="resultAwards">
          {result.awards.map((award) => (
            <div key={`${award.potName}-${award.amount}-${award.winnerIds.join("-")}`}>
              <strong>{award.potName}</strong>
              <span>
                {award.winnerNames.join(", ")}
                {award.handName ? ` with ${award.handName}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatChipDelta(delta: number): string {
  if (delta > 0) return `+${delta} chips`;
  if (delta < 0) return `${delta} chips`;
  return "±0 chips";
}

function CpuPlayerList({ game, thinkingPlayerId }: { game: GameState; thinkingPlayerId: string | null }) {
  return (
    <section className="mobileCpuPlayers" aria-label="CPU players">
      {game.players.map((player, index) => (
        player.isHuman ? null : (
          <CpuSummarySeat
            key={`mobile-${player.id}`}
            player={player}
            index={index}
            game={game}
            isCurrent={game.currentPlayerIndex === index}
            isThinking={thinkingPlayerId === player.id}
            reveal={game.showdown || game.stage === "gameOver"}
          />
        )
      ))}
    </section>
  );
}

function ActionPanel({
  game,
  player,
  legalActions,
  disabled,
  onAction,
}: {
  game: GameState;
  player: Player;
  legalActions: GameAction[];
  disabled: boolean;
  onAction: (action: GameAction) => void;
}) {
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
    if (disabled || !validation.valid) return;
    if (mode === "bet") onAction({ type: "bet", amount });
    if (mode === "raise") onAction({ type: "raise", amount });
  }

  return (
    <div className="actionPanel">
      <div className="quickActions">
        {actionTypes.includes("check") && <button className="actionButton" disabled={disabled} onClick={() => onAction({ type: "check" })}>Check</button>}
        {actionTypes.includes("call") && <button className="actionButton" disabled={disabled} onClick={() => onAction({ type: "call" })}>Call {Math.min(callAmount, player.chips)}</button>}
        {actionTypes.includes("all-in") && <button className="actionButton allInAction" disabled={disabled} onClick={() => onAction({ type: "all-in" })}>All-in</button>}
        {actionTypes.includes("fold") && <button className="actionButton dangerAction" disabled={disabled} onClick={() => onAction({ type: "fold" })}>Fold</button>}
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
            <button disabled={disabled} onClick={() => changeBy(-largeStep)}>--</button>
            <button disabled={disabled} onClick={() => changeBy(-smallStep)}>-</button>
            <button disabled={disabled} onClick={() => changeBy(smallStep)}>+</button>
            <button disabled={disabled} onClick={() => changeBy(largeStep)}>++</button>
          </div>

          <div className="presetButtons">
            <button disabled={disabled} onClick={() => setPreset("min")}>Min</button>
            <button disabled={disabled} onClick={() => setPreset("half-pot")}>1/2 Pot</button>
            <button disabled={disabled} onClick={() => setPreset("pot")}>Pot</button>
            <button disabled={disabled} onClick={() => setPreset("all-in")}>All-in</button>
          </div>

          {!validation.valid && validation.reason && <p className="errorText">{validation.reason}</p>}
          <button className="primaryAction" disabled={disabled || !validation.valid} onClick={submitWager}>
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

function actionStatusLabel(currentPlayer: Player | null, game: GameState, thinkingPlayerId: string | null): string {
  if (currentPlayer) {
    return currentPlayer.id === thinkingPlayerId ? `${currentPlayer.name} thinking...` : `${currentPlayer.name}'s turn`;
  }
  if (game.stage === "gameOver") return "Game over";
  return "Hand complete";
}

function PokerTable({ game, thinkingPlayerId, boardReveal }: { game: GameState; thinkingPlayerId: string | null; boardReveal: BoardReveal | null }) {
  return (
    <section className="table" aria-label="Poker table">
      <div className="tableFelt">
        <CpuPlayerList game={game} thinkingPlayerId={thinkingPlayerId} />

        {game.players.map((player, index) => (
          <PlayerSeat
            key={player.id}
            player={player}
            index={index}
            game={game}
            isCurrent={game.currentPlayerIndex === index}
            isThinking={thinkingPlayerId === player.id}
            reveal={player.isHuman || game.showdown || game.stage === "gameOver"}
          />
        ))}

        <div className="tableCenter">
          <CommunityCards cards={game.communityCards} reveal={boardReveal} />
          <PotDisplay game={game} />
        </div>
      </div>
    </section>
  );
}

function CpuSummarySeat({
  player,
  index,
  game,
  isCurrent,
  isThinking,
  reveal,
}: {
  player: Player;
  index: number;
  game: GameState;
  isCurrent: boolean;
  isThinking: boolean;
  reveal: boolean;
}) {
  const badges = [
    game.dealerIndex === index ? "D" : null,
    game.smallBlindIndex === index ? "SB" : null,
    game.bigBlindIndex === index ? "BB" : null,
  ].filter(Boolean);
  const className = [
    "cpuSummarySeat",
    isCurrent ? "current" : "",
    isThinking ? "thinking" : "",
    `status-${player.status.toLowerCase().replace("-", "")}`,
  ].filter(Boolean).join(" ");
  const showCards = reveal && player.status !== "Eliminated";

  return (
    <article className={className}>
      <div className="cpuSummaryMain">
        <span className="cpuSeatOrder">#{index + 1}</span>
        <strong>{player.name}</strong>
        <StatusBadge status={player.status} isThinking={isThinking} />
      </div>
      <div className="cpuSummaryBadges">
        {badges.map((badge) => (
          <span className="positionBadge" key={badge}>{badge}</span>
        ))}
      </div>
      <div className="cpuSummaryStats">
        <span>Chips <strong>{player.chips}</strong></span>
        <span>Bet <strong>{player.roundBet}</strong></span>
      </div>
      {showCards && (
        <div className="cards cpuSummaryCards">
          {player.holeCards.map((card, cardIndex) => (
            <CardView key={`${cardDisplayKey(card)}-${cardIndex}`} card={card} muted={player.status === "Folded"} />
          ))}
        </div>
      )}
    </article>
  );
}

function CommunityCards({ cards, reveal }: { cards: Card[]; reveal: BoardReveal | null }) {
  const label = reveal?.label;

  return (
    <div className="board">
      <div className="boardHeader">
        <h2>Community Cards</h2>
        {label && <span key={`${reveal.handNumber}-${reveal.from}-${reveal.to}`} className="revealNotice">{label}</span>}
      </div>
      <div className="cards boardCards">
        {Array.from({ length: 5 }, (_, index) => {
          const card = cards[index];
          const isRevealed = Boolean(reveal && index >= reveal.from && index < reveal.to);
          return (
            <CardView
              key={card ? cardDisplayKey(card) : `empty-${index}`}
              card={card}
              faceDown={!card}
              revealed={isRevealed}
              revealDelayMs={isRevealed ? (index - (reveal?.from ?? index)) * 80 : 0}
            />
          );
        })}
      </div>
    </div>
  );
}

function PotDisplay({ game }: { game: GameState }) {
  const pots = game.pots.length > 0 ? game.pots : [{ amount: game.pot, eligiblePlayerIds: game.players.filter((player) => player.status !== "Folded").map((player) => player.id) }];

  return (
    <div className="potDisplay">
      {pots.map((pot, index) => (
        <div key={`${index}-${pot.amount}`}>
          <strong>{index === 0 ? "Main Pot" : `Side Pot ${index}`}: {pot.amount}</strong>
          <span>eligible: {pot.eligiblePlayerIds.map((id) => game.players.find((player) => player.id === id)?.name ?? id).join(", ") || "none"}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerSeat({
  player,
  index,
  game,
  isCurrent,
  isThinking,
  reveal,
}: {
  player: Player;
  index: number;
  game: GameState;
  isCurrent: boolean;
  isThinking: boolean;
  reveal: boolean;
}) {
  const badges = [
    game.dealerIndex === index ? "D" : null,
    game.smallBlindIndex === index ? "SB" : null,
    game.bigBlindIndex === index ? "BB" : null,
  ].filter(Boolean);
  const evaluation = game.lastEvaluations[player.id];
  const seatClass = [
    "player",
    `seat-${index}`,
    player.isHuman ? "human" : "",
    reveal ? "cards-revealed" : "",
    isCurrent ? "current" : "",
    isThinking ? "thinking" : "",
    `status-${player.status.toLowerCase().replace("-", "")}`,
  ].filter(Boolean).join(" ");
  const showCards = player.status !== "Eliminated";

  return (
    <article className={seatClass}>
      <div className="playerHead">
        <div>
          <h3>{player.name}</h3>
        </div>
        <div className="badges">
          {badges.map((badge) => (
            <span className="positionBadge" key={badge}>{badge}</span>
          ))}
        </div>
      </div>
      <div className="playerStatusRow">
        <StatusBadge status={player.status} isThinking={isThinking} />
      </div>
      <div className="cards holeCards">
        {showCards
          ? player.holeCards.map((card, cardIndex) => (
              <CardView key={`${cardDisplayKey(card)}-${cardIndex}`} card={card} faceDown={!reveal} muted={player.status === "Folded"} />
            ))
          : <span className="noCards">No cards</span>}
      </div>
      <dl className="playerStats">
        <div className="playerStat playerStatChips">
          <dt>Chips</dt>
          <dd>{player.chips}</dd>
        </div>
        <div className="playerStat playerStatCommitted">
          <dt>Committed</dt>
          <dd>{player.committed}</dd>
        </div>
        <div className="playerStat playerStatBet">
          <dt>Round Bet</dt>
          <dd>{player.roundBet}</dd>
        </div>
        <div className="playerStat playerStatStatus">
          <dt>Status</dt>
          <dd>{player.status}</dd>
        </div>
      </dl>
      {evaluation && <p className="handName">{evaluation.name}</p>}
    </article>
  );
}

function StatusBadge({ status, isThinking }: { status: Player["status"]; isThinking: boolean }) {
  if (isThinking) return <span className="statusBadge statusThinking">THINKING...</span>;

  const className = `statusBadge status${status.replace("-", "")}`;
  const label = status === "All-in" ? "ALL-IN" : status.toUpperCase();
  return <span className={className}>{label}</span>;
}

function CardView({
  card,
  faceDown = false,
  revealed = false,
  revealDelayMs = 0,
  muted = false,
}: {
  card?: Card;
  faceDown?: boolean;
  revealed?: boolean;
  revealDelayMs?: number;
  muted?: boolean;
}) {
  const style = revealed ? ({ "--reveal-delay": `${revealDelayMs}ms` } as CSSProperties) : undefined;
  const classes = ["card", revealed ? "card-revealed" : "", muted ? "muted" : ""].filter(Boolean).join(" ");

  if (!card) {
    return <span className={`${classes} empty`} style={style} aria-label="Empty card slot" />;
  }

  if (faceDown) {
    return (
      <span className={`${classes} back`} style={style} aria-label="Face down card">
        <span className="cardBackMark">◆</span>
      </span>
    );
  }

  const suitColorClass = getSuitColorClass(card.suit);
  const rank = getRankLabel(card);
  const suit = getSuitSymbol(card.suit);

  return (
    <span className={`${classes} face ${suitColorClass}`} style={style} aria-label={`${rank} of ${card.suit}`}>
      <span className="card-corner top-left">
        <strong>{rank}</strong>
        <span>{suit}</span>
      </span>
      <span className="card-center-suit">{suit}</span>
      <span className="card-corner bottom-right">
        <strong>{rank}</strong>
        <span>{suit}</span>
      </span>
    </span>
  );
}

function boardRevealLabel(from: number, to: number): string {
  if (from === 0 && to === 3) return "Flop 公開";
  if (from === 3 && to === 4) return "Turn 公開";
  if (from === 4 && to === 5) return "River 公開";
  return "Board 公開";
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
