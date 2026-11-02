import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { combatRound, makeEnemy, startCombat } from '../../src/engine/combat';
import { checkCaptureContracts, refillContracts } from '../../src/engine/contracts';
import { movePirates } from '../../src/engine/pirates';
import { applyAction, validate } from '../../src/engine/reducer';
import { doDig, validateDig } from '../../src/engine/treasure';
import { NATIONS } from '../../src/engine/types';
import { forceDice, me, newGame, noPirates } from '../helpers';

describe('Schätze', () => {
  it('3 Schätze à 4 Fragmente im Vorrat', () => {
    const s = newGame();
    expect(s.fragmentPool).toEqual({ A: 4, B: 4, C: 4 });
  });

  it('Fragment in der Taverne kaufen', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'port_royal';
    p.purse = 10;
    const r = applyAction(s, { type: 'TAVERN', fragment: true });
    const q = r.players[p.id];
    expect(q.purse).toBe(10 - BALANCE.treasure.fragmentPrice);
    expect(Object.values(q.fragments).reduce((a, b) => a + b, 0)).toBe(1);
    expect(Object.values(r.fragmentPool).reduce((a, b) => a + b, 0)).toBe(11);
    expect(q.time).toBe(1);
  });

  it('Heben mit 4 Fragmenten sicher', () => {
    const s = newGame();
    const p = me(s);
    p.location = 's5';
    p.fragments.A = 4;
    s.players[1].fragments.A = 0;
    expect(validateDig(s, p, 'A')).toBeNull();
    expect(doDig(s, p, 'A')).toBe(true);
    expect(p.treasures).toEqual(['A']);
    expect(s.treasuresTaken.A).toBe(p.id);
    expect(validateDig(s, p, 'A')).toMatch(/bereits/);
  });

  it('mit 3 Fragmenten nur bei W6 >= 4', () => {
    const s = newGame();
    const p = me(s);
    p.location = 's5';
    p.fragments.A = 3;
    forceDice(s, [3]);
    expect(doDig(s, p, 'A')).toBe(false);
    expect(p.fragments.A).toBe(3);
    forceDice(s, [4]);
    expect(doDig(s, p, 'A')).toBe(true);
  });

  it('mit 2 Fragmenten oder am falschen Ort nicht möglich', () => {
    const s = newGame();
    const p = me(s);
    p.location = 's5';
    p.fragments.A = 2;
    expect(validate(s, { type: 'DIG', treasure: 'A' })).toMatch(/Mindestens/);
    p.fragments.A = 4;
    p.location = 's6';
    expect(validate(s, { type: 'DIG', treasure: 'A' })).toMatch(/anderen/);
  });

  it('nach dem Heben sind die Fragmente der Mitspieler wertlos', () => {
    const s = newGame();
    const p = me(s);
    const other = s.players.find((x) => x.id !== p.id)!;
    p.location = 's5';
    p.fragments.A = 3;
    other.fragments.A = 1;
    forceDice(s, [6]);
    doDig(s, p, 'A');
    expect(other.fragments.A).toBe(0);
  });
});

describe('Piraten', () => {
  it('drei berüchtigte Piraten zu Beginn', () => {
    const s = newGame();
    expect(s.pirates.length).toBe(BALANCE.pirates.active);
  });

  it('Piraten ziehen beim Weltjahreswechsel in ein Nachbargebiet', () => {
    const s = newGame();
    const before = s.pirates.map((x) => x.sea);
    movePirates(s);
    s.pirates.forEach((pr, i) => expect(pr.sea).not.toBe(before[i]));
  });

  it('Sieg über einen Piraten bringt Kopfgeld und zählt für die Wertung', () => {
    const s = newGame();
    const p = me(s);
    const pr = s.pirates[0];
    p.purse = 0;
    startCombat(
      s,
      p,
      { name: pr.name, type: 'notorious', nation: null, hull: 1, hullMax: 5, cannons: 2, crew: 6, gold: 3, cargo: {}, pirateId: pr.id },
      { context: 'sea', playerInitiated: false },
    );
    // berüchtigt: 3–4 Entern -> Breitseite gewinnt
    forceDice(s, [3]);
    combatRound(s, p, 'Breitseite');
    expect(p.pirates).toEqual([pr.id]);
    expect(p.purse).toBe(pr.bounty);
    expect(s.pirates.find((x) => x.id === pr.id)).toBeUndefined();
    movePirates(s);
    expect(s.pirates.length).toBe(BALANCE.pirates.active);
  });
});

describe('Aufträge', () => {
  it('3 offene Aufträge je Nation', () => {
    const s = newGame();
    for (const n of NATIONS) expect(s.contracts.filter((c) => c.nation === n).length).toBe(3);
  });

  it('werden beim Weltjahreswechsel aufgefüllt', () => {
    const s = newGame();
    s.contracts = s.contracts.slice(4);
    refillContracts(s);
    expect(s.contracts.length).toBe(12);
  });

  it('Kaperauftrag: Belohnung für den Ersten', () => {
    const s = newGame();
    const [p, q] = s.players;
    s.contracts = [{ id: 'X', nation: 'EN', kind: 'capture', target: 'ES', gold: 8, favor: 2 }];
    p.letters = ['EN'];
    q.letters = ['EN'];
    p.purse = 0;
    checkCaptureContracts(s, p, 'ES');
    checkCaptureContracts(s, q, 'ES');
    expect(p.purse).toBe(8);
    expect(q.purse).toBe(BALANCE.start.purse);
    expect(s.contracts.length).toBe(0);
  });

  it('Kaperauftrag nur mit Kaperbrief des Auftraggebers', () => {
    const s = newGame();
    const p = s.players[0];
    s.contracts = [{ id: 'X', nation: 'FR', kind: 'capture', target: 'ES', gold: 8, favor: 2 }];
    p.letters = ['EN'];
    checkCaptureContracts(s, p, 'ES');
    expect(s.contracts.length).toBe(1);
    expect(makeEnemy(s, 'merchant', 'ES').nation).toBe('ES');
  });
});
