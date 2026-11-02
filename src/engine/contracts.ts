// Offene Aufträge: 3 je Nation, Belohnung für den Ersten.
import { BALANCE } from '../config/balance';
import { nextRandom, pick, randInt } from './rng';
import { enemiesOf } from './politics';
import type { Contract, GameState, Nation, PlayerState } from './types';
import { GOODS, NATIONS } from './types';
import { addFavor, atWar, log, nationName } from './util';

const C = BALANCE.contracts;

export function makeContract(s: GameState, nation: Nation): Contract {
  s.contractCounter++;
  const id = `K${s.contractCounter}`;
  const enemies = enemiesOf(s, nation);
  if (enemies.length > 0 && nextRandom(s) < C.captureChance) {
    return { id, nation, kind: 'capture', target: pick(s, enemies), gold: C.captureGold, favor: C.captureFavor };
  }
  const qty = C.deliverQtyMin + randInt(s, C.deliverQtyMax - C.deliverQtyMin + 1);
  return { id, nation, kind: 'deliver', good: pick(s, GOODS), qty, gold: qty * C.deliverGoldPerUnit, favor: C.deliverFavor };
}

export function refillContracts(s: GameState): void {
  // ANNAHME: Kaperaufträge gegen Nationen, mit denen inzwischen Frieden herrscht, verfallen.
  s.contracts = s.contracts.filter((c) => c.kind !== 'capture' || atWar(s, c.nation, c.target!));
  let added = 0;
  for (const n of NATIONS) {
    while (s.contracts.filter((c) => c.nation === n).length < C.perNation) {
      s.contracts.push(makeContract(s, n));
      added++;
    }
  }
  if (added > 0) log(s, `${added} neue Aufträge werden ausgehängt.`, 'world', null);
}

export function contractText(c: Contract): string {
  if (c.kind === 'deliver') return `${nationName(c.nation)}: Liefere ${c.qty} ${c.good} (${c.gold} Gold, +${c.favor} Gunst)`;
  return `${nationName(c.nation)}: Kapere oder versenke ein Schiff von ${nationName(c.target!)} (${c.gold} Gold, +${c.favor} Gunst)`;
}

export function completeContract(s: GameState, p: PlayerState, c: Contract): void {
  s.contracts = s.contracts.filter((x) => x.id !== c.id);
  p.purse += c.gold;
  p.stats.contracts++;
  log(s, `${p.name} erfüllt den Auftrag „${contractText(c)}“ und erhält ${c.gold} Gold.`, 'action', p.id);
  addFavor(s, p, c.nation, c.favor);
}

/** Nach einem Sieg über ein Schiff der Nation `target`: passende Kaperaufträge (Brief des Auftraggebers nötig). */
export function checkCaptureContracts(s: GameState, p: PlayerState, target: Nation): void {
  const c = s.contracts.find(
    (x) => x.kind === 'capture' && x.target === target && p.letters.includes(x.nation) && atWar(s, x.nation, target),
  );
  if (c) completeContract(s, p, c);
}
