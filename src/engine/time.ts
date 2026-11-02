// Lebensleiste, Zugreihenfolge, Alterung, Zugende.
import { BALANCE } from '../config/balance';
import { TALENT_NAMES } from '../config/cards';
import { d6, pick } from './rng';
import { finalScores } from './scoring';
import type { GameState, PlayerState } from './types';
import { TALENTS } from './types';
import { MAX_TIME, SEASONS_PER_YEAR, ageOf, log } from './util';
import { worldYearChange } from './world';

/** Zieht den Marker um n Jahreszeiten vor; Geburtstage lösen ggf. die Alterungsprobe aus. */
export function advanceTime(s: GameState, p: PlayerState, n: number): void {
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    p.time++;
    if (p.time % SEASONS_PER_YEAR === 0) agingCheck(s, p);
  }
  s.arrivalCounter++;
  p.arrival = s.arrivalCounter;
}

export function agingCheck(s: GameState, p: PlayerState): void {
  const T = BALANCE.time;
  const age = ageOf(p.time);
  if (age < T.agingFromAge || age >= T.endAge) return;
  const limit = age >= T.agingHardAge ? T.agingFailHard : T.agingFailEasy;
  const die = d6(s);
  const candidates = TALENTS.filter((t) => p.talents[t] > BALANCE.start.talentMin);
  if (die <= limit && candidates.length > 0) {
    const t = pick(s, candidates);
    p.talents[t]--;
    log(s, `${p.name} wird ${age}. Alterungsprobe: W6 = ${die} – ${TALENT_NAMES[t]} sinkt auf ${p.talents[t]}.`, 'info', p.id);
  } else {
    log(s, `${p.name} wird ${age}. Alterungsprobe: W6 = ${die} – bestanden.`, 'info', p.id);
  }
}

/** Am Zug: der am weitesten hinten stehende Spieler; bei Gleichstand der zuletzt angekommene. */
export function nextActive(s: GameState): number {
  const live = s.players.filter((p) => !p.retired);
  if (live.length === 0) return s.active;
  live.sort((a, b) => a.time - b.time || b.arrival - a.arrival);
  return live[0].id;
}

export function retire(s: GameState, p: PlayerState, voluntary: boolean): void {
  if (p.retired) return;
  p.retired = true;
  p.retiredAt = p.time;
  if (s.finishLine === null) {
    // ANNAHME (Variante): Mit Nachlauf liegt die Ziellinie hinter dem Feld des Ruheständlers.
    s.finishLine = Math.min(MAX_TIME, p.time + BALANCE.time.finishLineGrace);
    log(s, `${p.name} setzt sich zur Ruhe und legt die Ziellinie fest (Feld ${s.finishLine}).`, 'world', p.id);
  } else {
    log(s, `${p.name} ${voluntary ? 'setzt sich zur Ruhe' : 'erreicht die Ziellinie und geht in den Ruhestand'}.`, 'world', p.id);
  }
}

/** Schließt einen vollständig abgehandelten Zug ab.
 * ANNAHME: Wer die Ziellinie oder 45 Jahre erreicht, geht am Ende seines Zuges automatisch in den Ruhestand. */
export function endTurn(s: GameState): void {
  for (const p of s.players) {
    if (p.retired) continue;
    if (p.time >= MAX_TIME || (s.finishLine !== null && p.time >= s.finishLine)) retire(s, p, false);
  }
  const live = s.players.filter((p) => !p.retired);
  if (live.length > 0) {
    const minTime = Math.min(...live.map((p) => p.time));
    const year = Math.floor(minTime / SEASONS_PER_YEAR);
    while (s.worldYear < year) {
      s.worldYear++;
      worldYearChange(s);
    }
  }
  s.turn++;
  if (live.length === 0) {
    s.gameOver = true;
    s.scores = finalScores(s);
    log(s, 'Das Spiel ist beendet.', 'world', null);
    return;
  }
  s.active = nextActive(s);
}
