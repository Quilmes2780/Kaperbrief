import { describe, expect, it } from 'vitest';
import { PORTS, PORT_IDS, SEAS, SEA_LINKS } from '../../src/config/map';
import { mutinyCheck, loseMorale } from '../../src/engine/crew';
import { drawEncounter, drawStorm } from '../../src/engine/encounters';
import { actionCost, applyAction, validate } from '../../src/engine/reducer';
import { areasFor, planLegs, seaPath, shipwreck } from '../../src/engine/sailing';
import { NATIONS } from '../../src/engine/types';
import { calmSeas, forceDice, me, newGame, noPirates } from '../helpers';

describe('Karte', () => {
  it('hat 16 Häfen (je 4 pro Nation) und 12 Seegebiete', () => {
    expect(PORT_IDS.length).toBe(16);
    expect(Object.keys(SEAS).length).toBe(12);
    for (const n of NATIONS) expect(PORT_IDS.filter((id) => PORTS[id].nation === n).length).toBe(4);
    for (const id of PORT_IDS) expect(SEAS[PORTS[id].sea]).toBeDefined();
  });

  it('der Graph ist zusammenhängend', () => {
    for (const a of Object.keys(SEAS)) for (const b of Object.keys(SEAS)) if (a !== b) expect(seaPath(a, b).length).toBeGreaterThan(0);
    for (const [a, b] of SEA_LINKS) expect(seaPath(a, b)).toEqual([b]);
  });

  it('Etappen: Hafen zählt sein Seegebiet als erstes Feld', () => {
    expect(areasFor('port_royal', 's6')).toEqual(['s6']);
    expect(areasFor('port_royal', 'willemstad')).toEqual(['s6', 's11']);
    expect(areasFor('s6', 'port_royal')).toEqual(['s6']);
    expect(areasFor('s6', 's6')).toBeNull();
    expect(areasFor('havanna', 'havanna')).toBeNull();
  });
});

describe('Segeln', () => {
  it('eine Etappe umfasst Schiffsgeschwindigkeit viele Seegebiete', () => {
    const s = newGame();
    const p = me(s);
    p.location = 'veracruz';
    p.talents.navigation = 1;
    // Veracruz (s1) -> Cayenne (s12): s1,s5,s10,s11,s12 = 5 Gebiete
    expect(planLegs(p, 'cayenne')!.length).toBe(2); // Schaluppe 3
    p.ship = 'Galeone';
    expect(planLegs(p, 'cayenne')!.length).toBe(5);
    p.ship = 'Brigantine';
    expect(planLegs(p, 'cayenne')!.length).toBe(3);
    p.talents.navigation = 3; // ANNAHME: +1 Geschwindigkeit
    expect(planLegs(p, 'cayenne')!.length).toBe(2);
  });

  it('kostet 1 Zeit und 1 Moral je Etappe und zieht je Etappe eine Begegnung', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'veracruz';
    p.talents.navigation = 1;
    expect(actionCost(s, { type: 'SAIL', to: 'cayenne' })).toBe(2);
    const r = calmSeas(() => applyAction(s, { type: 'SAIL', to: 'cayenne' }));
    const q = r.players[p.id];
    expect(q.location).toBe('cayenne');
    expect(q.time).toBe(2);
    expect(q.morale).toBe(3);
    expect(r.log.filter((l) => l.text.startsWith('Ruhige See')).length).toBe(2);
  });

  it('Segeln + Hafenaktion am Ziel: Hafenaktion kostet die halbe Zeit (aufgerundet)', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'port_royal';
    p.hull = 1;
    p.purse = 10;
    const a = { type: 'SAIL', to: 'tortuga', then: { type: 'SHIPYARD', repair: true } } as const;
    expect(validate(s, a)).toBeNull();
    expect(actionCost(s, a)).toBe(1 + 1);
    const r = calmSeas(() => applyAction(s, a));
    expect(r.players[p.id].time).toBe(2);
    expect(r.players[p.id].hull).toBe(3);
    expect(actionCost(s, { type: 'SAIL', to: 'tortuga', then: { type: 'TRADE', sell: {}, buy: { Tabak: 1 } } })).toBe(2);
  });

  it('Hafenaktion nur mit Hafen als Ziel', () => {
    const s = newGame();
    expect(validate(s, { type: 'SAIL', to: 's5', then: { type: 'SHARE_LOOT' } })).not.toBeNull();
  });

  it('im Herbst zusätzlich eine Sturmkarte', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.time = 2; // Herbst
    p.location = 'port_royal';
    const r = calmSeas(() => applyAction(s, { type: 'SAIL', to: 's6' }));
    expect(r.log.some((l) => l.text.includes('Herbststurm'))).toBe(true);
    const t = newGame();
    noPirates(t);
    me(t).time = 1;
    me(t).location = 'port_royal';
    const r2 = calmSeas(() => applyAction(t, { type: 'SAIL', to: 's6' }));
    expect(r2.log.some((l) => l.text.includes('Herbststurm'))).toBe(false);
  });

  it('Sturm: Navigationsprobe verhindert Schaden', () => {
    const s = newGame();
    const p = me(s);
    p.talents.navigation = 2;
    forceDice(s, [2]);
    drawStorm(s, p, 'heavy');
    expect(p.hull).toBe(3);
    forceDice(s, [5]);
    drawStorm(s, p, 'heavy');
    expect(p.hull).toBe(1);
  });

  it('Rumpf 0 führt zum Schiffbruch', () => {
    const s = newGame();
    const p = me(s);
    p.ship = 'Fregatte';
    p.location = 's5';
    p.cargo.Rum = 3;
    p.purse = 10;
    shipwreck(s, p);
    expect(p.ship).toBe('Schaluppe');
    expect(p.cargo.Rum).toBe(0);
    expect(p.purse).toBe(5);
    expect(p.location in PORTS).toBe(true);
  });

  it('Handelsschiff-Begegnung verlangt eine Entscheidung', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    drawEncounter(s, p, 'merchant');
    expect(s.pending?.kind).toBe('encounter');
    const r = applyAction(s, { type: 'ENCOUNTER', attack: false });
    expect(r.pending).toBeNull();
  });

  it('ein berüchtigter Pirat im Zielgebiet greift an', () => {
    const s = newGame();
    const p = me(s);
    p.location = 'port_royal';
    s.pirates = [{ id: 'x', name: 'Testpirat', sea: 's6', hull: 5, hullMax: 5, cannons: 2, crew: 6, gold: 5, bounty: 10 }];
    const r = calmSeas(() => applyAction(s, { type: 'SAIL', to: 's6' }));
    expect(r.pending?.kind).toBe('combat');
    expect(r.active).toBe(p.id);
  });
});

describe('Moral und Meuterei', () => {
  it('Moral 0 löst die Meutereiprobe W6 + Führung >= 5 aus', () => {
    const s = newGame();
    const p = me(s);
    p.talents.fuehrung = 1;
    p.morale = 1;
    p.purse = 9;
    forceDice(s, [4]);
    loseMorale(s, p, 1);
    expect(p.morale).toBe(1); // bestanden
    expect(p.purse).toBe(9);
    p.morale = 1;
    forceDice(s, [3]);
    loseMorale(s, p, 1);
    expect(p.purse).toBe(0);
    expect(p.crew).toBe(2);
    expect(p.stats.mutinies).toBe(1);
  });

  it('Führung hilft bei der Probe', () => {
    const s = newGame();
    const p = me(s);
    p.talents.fuehrung = 3;
    forceDice(s, [2]);
    expect(mutinyCheck(s, p)).toBe(true);
  });
});
