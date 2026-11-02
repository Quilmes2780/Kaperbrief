import { useCallback, useEffect, useState } from 'react';
import { aiStep } from '../engine/ai';
import { applyAction } from '../engine/reducer';
import { createGame } from '../engine/setup';
import type { Action, GameState, SeatConfig } from '../engine/types';
import { activePlayer, timeLabel } from '../engine/util';
import { ActionPanel } from './ActionPanel';
import { CombatDialog, DuelDialog, EncounterDialog, ReportDialog } from './Dialogs';
import { LifeTrack } from './LifeTrack';
import { MapView } from './MapView';
import { ContractsPanel, EventLog, LocationInfo, PoliticsPanel, RulesPanel, ScoreTable } from './Panels';
import { PlayerBoard } from './PlayerBoard';
import { SetupScreen } from './SetupScreen';
import { clearSave, hasSave, loadGame, saveGame } from './storage';

const SPEEDS = { langsam: 1100, normal: 500, schnell: 120 } as const;
type Speed = keyof typeof SPEEDS;

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [ackReport, setAckReport] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [hideScores, setHideScores] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback((next: GameState) => {
    setGame(next);
    saveGame(next);
  }, []);

  const act = (a: Action) => {
    if (!game) return;
    try {
      const next = applyAction(game, a);
      if (a.type === 'SAIL') setTarget(null);
      setError(null);
      commit(next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // KI-Züge animiert ausführen
  useEffect(() => {
    if (!game || game.gameOver || paused) return;
    const p = activePlayer(game);
    if (p.kind !== 'ai') return;
    const r = game.lastReport;
    if (r && r.id > ackReport && game.players.find((x) => x.id === r.player)?.kind === 'human') return;
    const delay = game.pending ? SPEEDS[speed] * 0.6 : SPEEDS[speed];
    const id = window.setTimeout(() => {
      try {
        commit(aiStep(game));
      } catch (e) {
        setError(`KI-Fehler: ${(e as Error).message}`);
        setPaused(true);
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [game, speed, paused, commit, ackReport]);

  if (!game) {
    return (
      <SetupScreen
        canLoad={hasSave()}
        onLoad={() => {
          const g = loadGame();
          if (g) {
            setGame(g);
            setAckReport(g.lastReport?.id ?? 0);
          } else setNotice('Kein Spielstand gefunden.');
        }}
        onStart={(seats: SeatConfig[], seed: number) => {
          const g = createGame(seats, seed);
          setAckReport(0);
          setHideScores(false);
          commit(g);
        }}
      />
    );
  }

  const p = activePlayer(game);
  const human = p.kind === 'human' && !game.gameOver;
  const report = game.lastReport;
  const reportPlayer = report ? game.players.find((x) => x.id === report.player) : null;
  const showReport = report && report.id > ackReport && reportPlayer?.kind === 'human';
  const pend = game.pending;

  const newGame = () => {
    clearSave();
    setGame(null);
    setTarget(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Kaperbrief</h1>
        <span className="pill" title="Mit diesem Seed lässt sich die Partie wiederholen">
          Seed {game.seed}
        </span>
        <span className="pill">Weltjahr {game.worldYear + 1}</span>
        <span className="pill">
          Am Zug: <span className="dot" style={{ background: p.color }} /> {p.name} ({timeLabel(p.time)})
        </span>
        <PoliticsPanel s={game} />
        <span className="spacer" />
        <label className="speed">
          KI-Tempo{' '}
          <select value={speed} onChange={(e) => setSpeed(e.target.value as Speed)}>
            {Object.keys(SPEEDS).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <button onClick={() => setPaused(!paused)}>{paused ? 'Weiter' : 'Pause'}</button>
        <button onClick={() => setShowRules(true)}>Regeln</button>
        <button
          onClick={() => {
            setNotice(saveGame(game) ? 'Spielstand gespeichert.' : 'Speichern nicht möglich.');
          }}
        >
          Speichern
        </button>
        <button
          onClick={() => {
            const g = loadGame();
            if (g) {
              setGame(g);
              setAckReport(g.lastReport?.id ?? 0);
              setNotice('Spielstand geladen.');
            } else setNotice('Kein Spielstand gefunden.');
          }}
        >
          Laden
        </button>
        <button onClick={newGame}>Neue Partie</button>
      </header>
      {(notice || error) && (
        <div className={error ? 'banner err' : 'banner'} onClick={() => (setNotice(null), setError(null))}>
          {error ?? notice} <small>(antippen zum Schließen)</small>
        </div>
      )}
      <main className="layout">
        <section className="map-col">
          <MapView s={game} selected={target} onSelect={(loc) => setTarget(loc === target ? null : loc)} />
          <LocationInfo s={game} loc={target} />
          {human && !pend && <ActionPanel s={game} target={target} setTarget={setTarget} onAction={act} />}
          {!human && !game.gameOver && (
            <div className="actions ai-turn">
              <span className="dot" style={{ background: p.color }} /> {p.name} (KI) überlegt …
            </div>
          )}
        </section>
        <section className="side-col">
          <LifeTrack s={game} />
          <div className="boards">
            {game.players.map((pl) => (
              <PlayerBoard key={pl.id} s={game} p={pl} />
            ))}
          </div>
          <ContractsPanel s={game} />
          <h3>Ereignisprotokoll</h3>
          <EventLog s={game} />
        </section>
      </main>

      {human && pend?.kind === 'encounter' && <EncounterDialog s={game} p={p} enemy={pend.enemy} onAction={act} />}
      {human && pend?.kind === 'combat' && <CombatDialog p={p} combat={pend.combat} onAction={act} />}
      {human && pend?.kind === 'duel' && <DuelDialog p={p} duel={pend.duel} onAction={act} />}
      {showReport && !pend && <ReportDialog report={report!} onClose={() => setAckReport(report!.id)} />}
      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
      {game.gameOver && !hideScores && <ScoreTable s={game} onNew={newGame} onClose={() => setHideScores(true)} />}
    </div>
  );
}
