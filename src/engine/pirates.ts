// Berüchtigte NPC-Piraten mit Kopfgeld.
import { BALANCE } from '../config/balance';
import { PIRATES, type PirateDef } from '../config/cards';
import { d6, pick } from './rng';
import { neighbors } from './sailing';
import type { GameState, PirateState } from './types';
import { log } from './util';

export function spawnPirate(s: { rng: number }, def: PirateDef): PirateState {
  const base = BALANCE.combat.enemies.notorious;
  const P = BALANCE.pirates;
  const hull = base.hull + def.tier;
  return {
    id: def.id,
    name: def.name,
    sea: def.sea,
    hull,
    hullMax: hull,
    cannons: base.cannons + (def.tier >= 2 ? 1 : 0),
    crew: base.crew + def.tier,
    gold: base.goldBase + d6(s) * base.goldPerPip,
    bounty: P.bountyBase + d6(s) * P.bountyPerPip + def.tier * 2,
  };
}

export function pirateAt(s: GameState, sea: string): PirateState | undefined {
  return s.pirates.find((x) => x.sea === sea);
}

/** Piraten ziehen; besiegte werden aus dem Vorrat ersetzt. */
export function movePirates(s: GameState): void {
  for (const pr of s.pirates) {
    for (let i = 0; i < BALANCE.pirates.moveSteps; i++) {
      const options = neighbors(pr.sea).filter((n) => !s.pirates.some((o) => o !== pr && o.sea === n));
      if (options.length > 0) pr.sea = pick(s, options);
    }
  }
  // ANNAHME: Besiegte Piraten werden beim Weltjahreswechsel aus dem Vorrat ersetzt, bis er leer ist.
  while (s.pirates.length < BALANCE.pirates.active && s.piratePool.length > 0) {
    const id = s.piratePool.shift()!;
    const def = PIRATES.find((x) => x.id === id)!;
    const pr = spawnPirate(s, def);
    s.pirates.push(pr);
    log(s, `Ein neuer Pirat taucht auf: ${pr.name}.`, 'world', null);
  }
  log(s, 'Die Piraten ziehen weiter.', 'world', null);
}
