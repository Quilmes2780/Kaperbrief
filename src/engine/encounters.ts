// Begegnungskarten (jede Etappe) und Sturmkarten (Herbst).
import { BALANCE } from '../config/balance';
import { ENCOUNTER_TEXT, STORM_TEXT } from '../config/cards';
import { makeEnemy, startCombat } from './combat';
import { d6, weighted } from './rng';
import { shipwreck } from './sailing';
import { advanceTime } from './time';
import { drawFragment } from './treasure';
import type { GameState, PlayerState } from './types';
import { log, validLetterNations } from './util';

export type EncounterKind = keyof typeof BALANCE.encounters.weights;

export function drawEncounter(s: GameState, p: PlayerState, forced?: EncounterKind): EncounterKind {
  const E = BALANCE.encounters;
  const kind: EncounterKind = forced ?? weighted(s, E.weights);
  switch (kind) {
    case 'calm':
      log(s, ENCOUNTER_TEXT.calm, 'info', p.id);
      break;
    case 'merchant': {
      const enemy = makeEnemy(s, 'merchant', weighted(s, E.merchantNation));
      s.pending = { kind: 'encounter', enemy, text: `${ENCOUNTER_TEXT.merchant} ${enemy.name}.` };
      log(s, `${p.name}: ${enemy.name} in Sicht.`, 'info', p.id);
      break;
    }
    case 'warship': {
      const enemy = makeEnemy(s, 'warship', weighted(s, E.warshipNation));
      // ANNAHME: Kriegsschiffe greifen an, wenn der Spieler einen Kaperbrief gegen ihre Nation hält.
      if (validLetterNations(s, p, enemy.nation!).length > 0) startCombat(s, p, enemy, { context: 'sea', playerInitiated: false });
      else {
        s.pending = { kind: 'encounter', enemy, text: `${ENCOUNTER_TEXT.warship} ${enemy.name}.` };
        log(s, `${p.name}: ${enemy.name} in Sicht.`, 'info', p.id);
      }
      break;
    }
    case 'pirate':
      startCombat(s, p, makeEnemy(s, 'pirate', null), { context: 'sea', playerInitiated: false });
      break;
    case 'wreck': {
      const gold = d6(s) * E.wreckGoldPerPip;
      p.purse += gold;
      log(s, `${ENCOUNTER_TEXT.wreck} (+${gold} Gold)`, 'info', p.id);
      break;
    }
    case 'doldrums':
      log(s, ENCOUNTER_TEXT.doldrums, 'info', p.id);
      advanceTime(s, p, E.doldrumsTime);
      break;
    case 'bottle':
      log(s, ENCOUNTER_TEXT.bottle, 'info', p.id);
      if (!drawFragment(s, p)) log(s, 'Doch die Karte ist unleserlich.', 'info', p.id);
      break;
  }
  return kind;
}

export type StormKind = keyof typeof BALANCE.storms.weights;

/** Sturmkarte: Navigationsprobe W6 <= Navigation verhindert Schaden. */
export function drawStorm(s: GameState, p: PlayerState, forced?: StormKind): StormKind {
  const S = BALANCE.storms;
  const kind: StormKind = forced ?? weighted(s, S.weights);
  if (kind === 'mild') log(s, STORM_TEXT.mild, 'info', p.id);
  else if (kind === 'drift') {
    log(s, STORM_TEXT.drift, 'info', p.id);
    advanceTime(s, p, S.driftTime);
  } else {
    const dmg = kind === 'light' ? S.lightDamage : S.heavyDamage;
    const die = d6(s);
    if (die <= p.talents.navigation) log(s, `${STORM_TEXT[kind]} Navigationsprobe W6 ${die} ≤ ${p.talents.navigation} – geschickt abgewettert.`, 'info', p.id);
    else {
      p.hull -= dmg;
      log(s, `${STORM_TEXT[kind]} Navigationsprobe W6 ${die} > ${p.talents.navigation} – Rumpf -${dmg}.`, 'info', p.id);
      if (p.hull <= 0) shipwreck(s, p);
    }
  }
  return kind;
}
