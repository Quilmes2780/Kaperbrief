import { BALANCE } from '../config/balance';
import { PORTS, NATION_NAMES } from '../config/map';
import type { Cargo, GameState, LogEntry, Nation, PlayerState } from './types';
import { GOODS, NATIONS } from './types';

const T = BALANCE.time;

export const SEASONS_PER_YEAR = T.seasonsPerYear;
export const MAX_TIME = (T.endAge - T.startAge) * T.seasonsPerYear;
/** Frühestes Feld für den Ruhestand. Als Funktion, damit Varianten den Wert zur Laufzeit ändern können. */
export function retireTime(): number {
  return (T.retireMinAge - T.startAge) * T.seasonsPerYear;
}
export const LOG_LIMIT = 400;

export class IllegalAction extends Error {}

export function ageOf(time: number): number {
  return T.startAge + Math.floor(time / T.seasonsPerYear);
}

export function seasonOf(time: number): number {
  return time % T.seasonsPerYear;
}

export function timeLabel(time: number): string {
  return `${T.seasonNames[seasonOf(time)]}, ${ageOf(time)} J.`;
}

export function getPlayer(s: GameState, id: number): PlayerState {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`Spieler ${id} unbekannt`);
  return p;
}

export function activePlayer(s: GameState): PlayerState {
  return getPlayer(s, s.active);
}

export function log(s: GameState, text: string, kind: LogEntry['kind'] = 'action', player: number | null = s.active): void {
  s.logCounter++;
  s.log.push({ n: s.logCounter, turn: s.turn, player, text, kind });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

export function warKey(a: Nation, b: Nation): string {
  return [a, b].sort().join('-');
}

export function atWar(s: GameState, a: Nation, b: Nation): boolean {
  if (a === b) return false;
  return !!s.war[warKey(a, b)];
}

export function nationPairs(): [Nation, Nation][] {
  const pairs: [Nation, Nation][] = [];
  for (let i = 0; i < NATIONS.length; i++)
    for (let j = i + 1; j < NATIONS.length; j++) pairs.push([NATIONS[i], NATIONS[j]]);
  return pairs;
}

export function nationName(n: Nation): string {
  return NATION_NAMES[n];
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function addFavor(s: GameState, p: PlayerState, n: Nation, delta: number): void {
  if (delta === 0) return;
  const before = p.favor[n];
  p.favor[n] = clamp(before + delta, BALANCE.favor.min, BALANCE.favor.max);
  const diff = p.favor[n] - before;
  if (diff !== 0) log(s, `${p.name}: Gunst bei ${nationName(n)} ${diff > 0 ? '+' : ''}${diff} (jetzt ${p.favor[n]}).`, 'info', p.id);
}

export function isPort(loc: string): boolean {
  return loc in PORTS;
}

export function seaOf(loc: string): string {
  return isPort(loc) ? PORTS[loc].sea : loc;
}

export function emptyCargo(): Cargo {
  return { Zucker: 0, Tabak: 0, Rum: 0, Kakao: 0 };
}

export function cargoCount(c: Partial<Cargo>): number {
  return GOODS.reduce((a, g) => a + (c[g] ?? 0), 0);
}

export function shipStats(p: PlayerState) {
  return BALANCE.ships[p.ship];
}

export function holdFree(p: PlayerState): number {
  return shipStats(p).hold - cargoCount(p.cargo);
}

export function speedOf(p: PlayerState): number {
  const nav = BALANCE.navigation;
  return shipStats(p).speed + (p.talents.navigation >= nav.speedBonusAt ? nav.speedBonus : 0);
}

/** Nationen, deren Kaperbrief einen Angriff auf `target` deckt. */
export function validLetterNations(s: GameState, p: PlayerState, target: Nation): Nation[] {
  return p.letters.filter((l) => atWar(s, l, target));
}

/** Nationen, die für einen Sieg gegen target Gunst geben.
 * ANNAHME (Balancing): Ist favor.combatFavorAllLetters aus, gibt nur der Kaperbrief-Geber mit der höchsten Gunst Gunst. */
export function combatFavorNations(s: GameState, p: PlayerState, target: Nation): Nation[] {
  const valid = validLetterNations(s, p, target);
  if (BALANCE.favor.combatFavorAllLetters || valid.length <= 1) return valid;
  return [valid.reduce((a, b) => (p.favor[b] > p.favor[a] ? b : a))];
}

/**
 * ANNAHME: Ein Hafen ist feindlich (nur Überfall möglich), wenn die Gunst bei der Hafennation 0 ist
 * und der Spieler einen gültigen Kaperbrief gegen diese Nation besitzt.
 */
export function isHostilePort(s: GameState, p: PlayerState, port: string): boolean {
  const owner = s.portOwner[port];
  return p.favor[owner] === 0 && validLetterNations(s, p, owner).length > 0;
}

export function halfCost(c: number): number {
  return Math.ceil(c / 2);
}
