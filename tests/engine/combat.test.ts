import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { combatFavorNations } from '../../src/engine/util';
import { beats, combatRound, duelRound, makeEnemy, npcChoice, parryFor, startCombat, startRaid } from '../../src/engine/combat';
import { applyAction } from '../../src/engine/reducer';
import type { Enemy, GameState, PlayerState } from '../../src/engine/types';
import { forceDice, me, newGame, noPirates } from '../helpers';

function fight(type: Enemy['type'] = 'merchant', nation: Enemy['nation'] = 'ES'): { s: GameState; p: PlayerState } {
  const s = newGame();
  noPirates(s);
  s.contracts = [];
  const p = me(s);
  p.letters = ['EN'];
  p.favor.EN = 2;
  const e = makeEnemy(s, type, nation);
  e.cargo = { Zucker: 2 };
  e.gold = 7;
  startCombat(s, p, e, { context: 'sea', playerInitiated: true });
  return { s, p };
}

// Händler-Tabelle: 1 Breitseite, 2 Entern, 3–5 Ausweichen, 6 Breitseite
describe('Seegefecht', () => {
  it('Breitseite > Entern > Ausweichen > Breitseite', () => {
    expect(beats('Breitseite', 'Entern')).toBe(true);
    expect(beats('Entern', 'Ausweichen')).toBe(true);
    expect(beats('Ausweichen', 'Breitseite')).toBe(true);
    expect(beats('Entern', 'Breitseite')).toBe(false);
    expect(beats('Breitseite', 'Breitseite')).toBe(false);
  });

  it('NPC wählt per W6', () => {
    expect(npcChoice('merchant', 1)).toBe('Breitseite');
    expect(npcChoice('merchant', 2)).toBe('Entern');
    expect(npcChoice('merchant', 4)).toBe('Ausweichen');
  });

  it('gewonnene Breitseite beschädigt den Gegner um die Kanonenzahl', () => {
    const { s, p } = fight();
    forceDice(s, [2]);
    combatRound(s, p, 'Breitseite');
    expect(s.pending?.kind).toBe('combat');
    if (s.pending?.kind === 'combat') expect(s.pending.combat.enemy.hull).toBe(2);
  });

  it('verlorene Runde: gegnerische Breitseite trifft beim Entern', () => {
    const { s, p } = fight();
    forceDice(s, [1]);
    combatRound(s, p, 'Entern');
    expect(p.hull).toBe(2);
  });

  it('Ausweichen schlägt Breitseite: Gefecht endet', () => {
    const { s, p } = fight();
    forceDice(s, [1]);
    combatRound(s, p, 'Ausweichen');
    expect(s.pending).toBeNull();
    expect(s.lastReport?.outcome).toMatch(/entkommen/);
  });

  it('höchstens 3 Runden', () => {
    const { s, p } = fight('warship');
    p.hull = 20; // übersteht alles
    // Kriegsschiff: 1–3 Breitseite. Gleiche Wahl -> beide treffen
    p.ship = 'Schaluppe';
    const e = s.pending?.kind === 'combat' ? s.pending.combat.enemy : null;
    e!.hull = 99;
    forceDice(s, [1, 1, 1]);
    combatRound(s, p, 'Breitseite');
    combatRound(s, p, 'Breitseite');
    combatRound(s, p, 'Breitseite');
    expect(s.pending).toBeNull();
    expect(s.lastReport?.rounds.length).toBe(3);
  });

  it('Versenken: Gunst bei Briefgeber, keine Beute', () => {
    const { s, p } = fight();
    const e = s.pending?.kind === 'combat' ? s.pending.combat.enemy : null;
    e!.hull = 1;
    p.purse = 0;
    forceDice(s, [2]);
    combatRound(s, p, 'Breitseite');
    expect(s.pending).toBeNull();
    expect(p.favor.EN).toBe(4);
    expect(p.purse).toBe(0);
    expect(p.cargo.Zucker).toBe(0);
    expect(p.stats.sunk).toBe(1);
  });

  it('Entern-Erfolg führt zum Fechtduell', () => {
    const { s, p } = fight();
    forceDice(s, [3]);
    combatRound(s, p, 'Entern');
    expect(s.pending?.kind).toBe('duel');
  });

  it('Kapern: Ladung und Gold, Moral +2, Gunst +1', () => {
    const { s, p } = fight();
    p.morale = 2;
    p.purse = 0;
    p.crew = 3;
    forceDice(s, [3]);
    combatRound(s, p, 'Entern');
    if (s.pending?.kind !== 'duel') throw new Error('kein Duell');
    expect(s.pending.duel.pos).toBe(2);
    // Parade W6: 1–2 Hoch, 3–4 Mitte, 5–6 Tief. Angriff Tief gegen Parade Hoch zweimal -> Sieg
    forceDice(s, [1, 1]);
    duelRound(s, p, 'Tief');
    duelRound(s, p, 'Tief');
    expect(s.pending).toBeNull();
    expect(p.cargo.Zucker).toBe(2);
    expect(p.purse).toBe(7);
    expect(p.morale).toBe(4);
    expect(p.favor.EN).toBe(3);
    expect(p.stats.prizes).toBe(1);
    expect(s.lastReport?.duel.length).toBe(2);
  });
});

describe('Fechtduell', () => {
  function duel(): { s: GameState; p: PlayerState } {
    const r = fight();
    r.p.crew = 3;
    forceDice(r.s, [3]);
    combatRound(r.s, r.p, 'Entern');
    return r;
  }

  it('Parade wird gewürfelt (Hoch/Mitte/Tief)', () => {
    expect(parryFor(1)).toBe('Hoch');
    expect(parryFor(4)).toBe('Mitte');
    expect(parryFor(6)).toBe('Tief');
  });

  it('pariert: Spieler hält mit W6 <= Fechten stand', () => {
    const { s, p } = duel();
    p.talents.fechten = 2;
    forceDice(s, [1, 2]);
    duelRound(s, p, 'Hoch');
    if (s.pending?.kind !== 'duel') throw new Error();
    expect(s.pending.duel.pos).toBe(2);
    forceDice(s, [1, 3]);
    duelRound(s, p, 'Hoch');
    expect(s.pending.duel.pos).toBe(1);
  });

  it('am Plankenende verloren: Enterangriff abgeschlagen', () => {
    const { s, p } = duel();
    p.talents.fechten = 1;
    forceDice(s, [1, 6, 1, 6]);
    duelRound(s, p, 'Hoch');
    duelRound(s, p, 'Hoch');
    expect(s.pending).toBeNull();
    expect(s.lastReport?.outcome).toMatch(/abgeschlagen/);
    expect(p.crew).toBe(2);
  });

  it('Mannschaftsvorsprung verschiebt den Start (ANNAHME)', () => {
    const r = fight();
    r.p.crew = 6;
    forceDice(r.s, [3]);
    combatRound(r.s, r.p, 'Entern');
    if (r.s.pending?.kind !== 'duel') throw new Error();
    expect(r.s.pending.duel.pos).toBe(3);
  });
});

describe('Hafen überfallen', () => {
  it('kostet 2 Zeit und startet ein Gefecht gegen die Festung', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'havanna';
    const r = applyAction(s, { type: 'RAID' });
    expect(r.players[p.id].time).toBe(2);
    expect(r.pending?.kind).toBe('combat');
  });

  it('erfolgreicher Überfall mit Kaperbrief ändert die Flagge', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'havanna';
    p.letters = ['EN'];
    p.favor.EN = 3;
    startRaid(s, p, 'havanna');
    if (s.pending?.kind !== 'combat') throw new Error();
    s.pending.combat.enemy.hull = 1;
    const gold = s.pending.combat.enemy.gold;
    p.purse = 0;
    // Festung: 5–6 Entern -> Breitseite gewinnt
    forceDice(s, [5]);
    combatRound(s, p, 'Breitseite');
    expect(s.portOwner.havanna).toBe('EN');
    expect(p.purse).toBe(gold);
    expect(p.favor.EN).toBe(5);
    expect(p.stats.raids).toBe(1);
  });
});

describe('Gunst für Siege', () => {
  it('geht an alle passenden Kaperbrief-Geber oder, per Schalter, nur an den mit der höchsten Gunst', () => {
    const s = newGame();
    const p = me(s);
    p.letters = ['EN', 'FR'];
    p.favor.EN = 2;
    p.favor.FR = 4;
    expect(combatFavorNations(s, p, 'ES').sort()).toEqual(['EN', 'FR']);
    BALANCE.favor.combatFavorAllLetters = false;
    try {
      expect(combatFavorNations(s, p, 'ES')).toEqual(['FR']);
    } finally {
      BALANCE.favor.combatFavorAllLetters = true;
    }
  });
});
