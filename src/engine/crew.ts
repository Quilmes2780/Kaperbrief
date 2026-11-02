// Mannschaft: Moral, Meuterei, Beute teilen, Taverne.
import { BALANCE } from '../config/balance';
import { PORTS } from '../config/map';
import { d6 } from './rng';
import { drawFragment, fragmentsLeft } from './treasure';
import type { GameState, PlayerState, PortAction } from './types';
import { log, shipStats } from './util';

const M = BALANCE.morale;

export function raiseMorale(p: PlayerState, n: number): void {
  p.morale = Math.min(M.max, p.morale + n);
}

export function loseMorale(s: GameState, p: PlayerState, n: number): void {
  if (n <= 0) return;
  p.morale = Math.max(0, p.morale - n);
  if (p.morale === 0) mutinyCheck(s, p);
}

/** Moral 0 -> Meutereiprobe W6 + Führung >= 5. */
export function mutinyCheck(s: GameState, p: PlayerState): boolean {
  const die = d6(s);
  const total = die + p.talents.fuehrung;
  if (total >= M.mutinyTarget) {
    // ANNAHME: Bestandene Probe hebt die Moral auf 1.
    p.morale = M.afterPassedCheck;
    log(s, `Murren an Bord! Meutereiprobe ${die} + ${p.talents.fuehrung} = ${total} – ${p.name} behält die Kontrolle.`, 'info', p.id);
    return true;
  }
  // ANNAHME: Meuterei = Schiffskasse geht an die Meuterer, Mannschaft halbiert, Moral 3.
  p.purse = 0;
  p.crew = Math.max(1, Math.floor(p.crew / 2));
  p.morale = M.afterMutiny;
  p.stats.mutinies++;
  log(s, `MEUTEREI! Probe ${die} + ${p.talents.fuehrung} = ${total}. ${p.name} verliert die Schiffskasse und die halbe Mannschaft.`, 'info', p.id);
  return false;
}

/** Beute teilen: halbe Kasse wird Vermögen, Rest an Mannschaft, Mannschaft halbiert, Moral 5. */
export function shareLoot(s: GameState, p: PlayerState): void {
  const toWealth = Math.floor(p.purse / 2);
  const toCrew = p.purse - toWealth;
  p.wealth += toWealth;
  p.purse = 0;
  const before = p.crew;
  p.crew = Math.max(1, Math.floor(p.crew / 2));
  p.morale = M.afterShare;
  log(s, `${p.name} teilt die Beute: ${toWealth} Gold ins Vermögen, ${toCrew} an die Mannschaft; ${before - p.crew} Mann mustern ab. Moral ${p.morale}.`);
}

type TavernAction = Extract<PortAction, { type: 'TAVERN' }>;

export function validateTavern(s: GameState, p: PlayerState, a: TavernAction): string | null {
  const hire = a.hire ?? 0;
  if (!Number.isInteger(hire) || hire < 0) return 'Ungültige Anzahl';
  if (hire === 0 && !a.fragment) return 'Nichts zu tun in der Taverne';
  if (p.crew + hire > shipStats(p).crewMax) return 'So viele Leute passen nicht an Bord';
  let cost = hire * BALANCE.crew.hireCost;
  if (a.fragment) {
    if (fragmentsLeft(s) === 0) return 'Keine Schatzfragmente mehr zu haben';
    cost += BALANCE.treasure.fragmentPrice;
  }
  if (cost > p.purse) return 'Nicht genug Gold';
  return null;
}

// ANNAHME: Die Taverne dient zum Anheuern (1 Gold je Mann) und zum Kauf eines zufälligen Schatzfragments.
export function doTavern(s: GameState, p: PlayerState, a: TavernAction): void {
  const hire = a.hire ?? 0;
  if (hire > 0) {
    p.crew += hire;
    p.purse -= hire * BALANCE.crew.hireCost;
    log(s, `${p.name} heuert in ${PORTS[p.location].name} ${hire} Mann an (Mannschaft ${p.crew}).`);
  }
  if (a.fragment) {
    p.purse -= BALANCE.treasure.fragmentPrice;
    log(s, `${p.name} kauft in der Taverne eine alte Karte für ${BALANCE.treasure.fragmentPrice} Gold.`);
    drawFragment(s, p);
  }
}
