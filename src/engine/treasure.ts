// Schatzfragmente: 3 Schätze à 4 Teile. Heben mit 4 sicher, mit 3 bei W6 >= 4.
import { BALANCE } from '../config/balance';
import { TREASURES } from '../config/cards';
import { d6, weighted } from './rng';
import type { GameState, PlayerState } from './types';
import { log } from './util';

const TB = BALANCE.treasure;

export function fragmentsLeft(s: GameState): number {
  return Object.values(s.fragmentPool).reduce((a, b) => a + b, 0);
}

/** Zieht ein zufälliges Fragment aus dem Vorrat; null, wenn leer. */
export function drawFragment(s: GameState, p: PlayerState): string | null {
  if (fragmentsLeft(s) === 0) return null;
  const id = weighted(s, s.fragmentPool);
  s.fragmentPool[id]--;
  p.fragments[id] = (p.fragments[id] ?? 0) + 1;
  const t = TREASURES.find((x) => x.id === id)!;
  log(s, `${p.name} erhält ein Fragment: ${t.name} (${p.fragments[id]}/${TB.fragmentsEach}).`, 'action', p.id);
  return id;
}

export function validateDig(s: GameState, p: PlayerState, id: string): string | null {
  const t = TREASURES.find((x) => x.id === id);
  if (!t) return 'Unbekannter Schatz';
  if (s.treasuresTaken[id] !== null) return 'Dieser Schatz wurde bereits gehoben';
  if (p.location !== t.sea) return `Der Schatz liegt in einem anderen Seegebiet`;
  if ((p.fragments[id] ?? 0) < TB.riskyNeed) return `Mindestens ${TB.riskyNeed} Fragmente nötig`;
  return null;
}

export function digChance(p: PlayerState, id: string): number {
  const n = p.fragments[id] ?? 0;
  if (n >= TB.fragmentsEach) return 1;
  if (n >= TB.riskyNeed) return (7 - TB.riskyTarget) / 6;
  return 0;
}

export function doDig(s: GameState, p: PlayerState, id: string): boolean {
  const t = TREASURES.find((x) => x.id === id)!;
  const n = p.fragments[id] ?? 0;
  let ok = n >= TB.fragmentsEach;
  let text = `${p.name} gräbt mit allen ${n} Fragmenten nach dem ${t.name}`;
  if (!ok) {
    const die = d6(s);
    ok = die >= TB.riskyTarget;
    text = `${p.name} gräbt mit ${n} Fragmenten nach dem ${t.name}: W6 = ${die} (nötig ${TB.riskyTarget})`;
  }
  if (!ok) {
    // ANNAHME: Bei Misserfolg bleiben die Fragmente erhalten; erneuter Versuch möglich.
    log(s, `${text} – nichts gefunden.`);
    return false;
  }
  s.treasuresTaken[id] = p.id;
  p.treasures.push(id);
  p.purse += TB.gold;
  for (const o of s.players) o.fragments[id] = 0;
  s.fragmentPool[id] = 0;
  log(s, `${text} – Schatz gehoben! +${TB.gold} Gold.`);
  return true;
}
