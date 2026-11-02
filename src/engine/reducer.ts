// Zentraler Einstieg: applyAction(state, action) -> neuer State. Der Eingabezustand wird nie verändert.
import { BALANCE } from '../config/balance';
import { TREASURES } from '../config/cards';
import { PORTS, SEAS } from '../config/map';
import { combatRound, duelRound, startCombat } from './combat';
import { performPortAction, portActionCost, validatePortAction } from './portActions';
import { continueVoyage, planLegs, startVoyage } from './sailing';
import { advanceTime, endTurn, retire } from './time';
import { doDig, validateDig } from './treasure';
import type { Action, GameState, PlayerState } from './types';
import { CHOICES, HEIGHTS } from './types';
import { IllegalAction, retireTime, activePlayer, isPort, log } from './util';

export function validate(s: GameState, a: Action): string | null {
  if (s.gameOver) return 'Das Spiel ist vorbei';
  const p = activePlayer(s);
  if (s.pending) {
    const k = s.pending.kind;
    if (k === 'encounter') return a.type === 'ENCOUNTER' ? null : 'Erst die Begegnung entscheiden';
    if (k === 'combat') return a.type === 'COMBAT' && CHOICES.includes(a.choice) ? null : 'Gefechtsmanöver wählen';
    if (k === 'duel') return a.type === 'DUEL' && HEIGHTS.includes(a.height) ? null : 'Hieb wählen';
  }
  switch (a.type) {
    case 'ENCOUNTER':
    case 'COMBAT':
    case 'DUEL':
      return 'Keine Entscheidung offen';
    case 'SAIL': {
      if (!(a.to in PORTS) && !(a.to in SEAS)) return 'Unbekanntes Ziel';
      const legs = planLegs(p, a.to);
      if (!legs) return 'Ungültiges Ziel';
      if (a.then) {
        if (!isPort(a.to)) return 'Hafenaktion nur mit einem Hafen als Ziel';
        const there: PlayerState = { ...p, location: a.to };
        return validatePortAction(s, there, a.then);
      }
      return null;
    }
    case 'DIG':
      return validateDig(s, p, a.treasure);
    case 'RETIRE':
      return p.time >= retireTime() ? null : `Ruhestand erst ab ${BALANCE.time.retireMinAge}`;
    default:
      return validatePortAction(s, p, a);
  }
}

export function isLegal(s: GameState, a: Action): boolean {
  return validate(s, a) === null;
}

/** Zeitkosten einer (Haupt-)Aktion in Jahreszeiten, ohne Zufallsereignisse. */
export function actionCost(s: GameState, a: Action): number {
  const p = activePlayer(s);
  const C = BALANCE.actionCost;
  switch (a.type) {
    case 'SAIL': {
      const legs = planLegs(p, a.to)?.length ?? 0;
      return legs * C.SAIL_LEG + (a.then ? portActionCost(a.then.type, true) : 0);
    }
    case 'DIG':
      return C.DIG;
    case 'RETIRE':
      return C.RETIRE;
    case 'ENCOUNTER':
    case 'COMBAT':
    case 'DUEL':
      return 0;
    default:
      return portActionCost(a.type, false);
  }
}

/** `note` wird vor der Aktion ins Protokoll geschrieben (z. B. Begründung eines KI-Zugs). */
export function applyAction(s: GameState, a: Action, note?: string): GameState {
  const err = validate(s, a);
  if (err) throw new IllegalAction(err);
  const d: GameState = structuredClone(s);
  const p = activePlayer(d);
  if (note) log(d, note, 'info');
  switch (a.type) {
    case 'ENCOUNTER': {
      const pend = d.pending as Extract<GameState['pending'], { kind: 'encounter' }>;
      d.pending = null;
      if (a.attack) startCombat(d, p, pend.enemy, { context: 'sea', playerInitiated: true });
      else log(d, `${p.name} lässt ${pend.enemy.name} ziehen.`);
      break;
    }
    case 'COMBAT':
      combatRound(d, p, a.choice);
      break;
    case 'DUEL':
      duelRound(d, p, a.height);
      break;
    case 'SAIL':
      p.stats.actions++;
      startVoyage(d, p, a.to, a.then ?? null);
      break;
    case 'DIG': {
      p.stats.actions++;
      const t = TREASURES.find((x) => x.id === a.treasure)!;
      log(d, `${p.name} sucht nach dem ${t.name}.`);
      advanceTime(d, p, BALANCE.actionCost.DIG);
      doDig(d, p, a.treasure);
      break;
    }
    case 'RETIRE':
      p.stats.actions++;
      retire(d, p, true);
      break;
    default:
      p.stats.actions++;
      performPortAction(d, p, a, false);
  }
  settle(d, p);
  return d;
}

function settle(d: GameState, p: PlayerState): void {
  if (d.pending) return;
  if (d.voyage) {
    continueVoyage(d, p);
    if (d.pending || d.voyage) return;
  }
  endTurn(d);
}
