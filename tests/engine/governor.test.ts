import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { startCombat, makeEnemy } from '../../src/engine/combat';
import { claimTitles, eligibleTitle, letterProblem } from '../../src/engine/governor';
import { applyPolitics, initialWar, resolveLetterConflicts } from '../../src/engine/politics';
import { applyAction, validate } from '../../src/engine/reducer';
import { atWar, isHostilePort, nationPairs } from '../../src/engine/util';
import { me, newGame, noPirates } from '../helpers';

describe('Politik', () => {
  it('6 Nationenpaare; zu Beginn ist Spanien mit allen im Krieg', () => {
    expect(nationPairs().length).toBe(6);
    const w = initialWar();
    expect(Object.values(w).filter(Boolean).length).toBe(3);
    const s = newGame();
    expect(atWar(s, 'ES', 'EN')).toBe(true);
    expect(atWar(s, 'ES', 'NL')).toBe(true);
    expect(atWar(s, 'EN', 'FR')).toBe(false);
  });

  it('Politikkarten erklären Krieg oder Frieden', () => {
    const s = newGame();
    applyPolitics(s, { kind: 'war', a: 'EN', b: 'FR' });
    expect(atWar(s, 'FR', 'EN')).toBe(true);
    applyPolitics(s, { kind: 'peace', a: 'ES', b: 'EN' });
    expect(atWar(s, 'ES', 'EN')).toBe(false);
  });

  it('Weltjahreswechsel zieht eine Politikkarte', () => {
    const s = newGame();
    noPirates(s);
    s.players[0].time = 3;
    s.players[1].time = 5;
    s.active = 0;
    const r = applyAction(s, { type: 'SHARE_LOOT' });
    expect(r.log.some((l) => l.text.startsWith('Politik:'))).toBe(true);
  });
});

describe('Kaperbriefe', () => {
  it('ab 1 Gunst beim Gouverneur', () => {
    const s = newGame();
    const p = me(s);
    p.favor.FR = 0;
    expect(letterProblem(s, p, 'FR')).toMatch(/Gunst/);
    p.favor.FR = 1;
    expect(letterProblem(s, p, 'FR')).toBeNull();
  });

  it('mehrere erlaubt, solange die Geber nicht im Krieg miteinander sind', () => {
    const s = newGame();
    const p = me(s);
    p.favor = { ES: 2, EN: 2, FR: 2, NL: 2 };
    p.letters = ['EN'];
    expect(letterProblem(s, p, 'FR')).toBeNull();
    expect(letterProblem(s, p, 'ES')).toMatch(/Krieg/);
    expect(letterProblem(s, p, 'EN')).toMatch(/bereits/);
  });

  it('Gouverneursaktion stellt den Kaperbrief aus', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'port_royal';
    p.favor.EN = 1;
    const r = applyAction(s, { type: 'GOVERNOR', letter: true });
    expect(r.players[p.id].letters).toEqual(['EN']);
    expect(r.players[p.id].time).toBe(1);
  });

  it('bricht Krieg zwischen zwei Gebern aus, geht der Brief mit weniger Gunst verloren', () => {
    const s = newGame();
    const p = s.players[0];
    p.letters = ['EN', 'FR'];
    p.favor.EN = 4;
    p.favor.FR = 2;
    s.war['EN-FR'] = true;
    resolveLetterConflicts(s);
    expect(p.letters).toEqual(['EN']);
  });

  it('Angriff ohne gültigen Kaperbrief: -2 Gunst bei der angegriffenen Nation', () => {
    const s = newGame();
    const p = me(s);
    p.favor.FR = 5;
    startCombat(s, p, makeEnemy(s, 'merchant', 'FR'), { context: 'sea', playerInitiated: true });
    expect(p.favor.FR).toBe(3);
    if (s.pending?.kind === 'combat') expect(s.pending.combat.legal).toBe(false);

    const t = newGame();
    const q = me(t);
    q.letters = ['EN'];
    q.favor.ES = 5;
    startCombat(t, q, makeEnemy(t, 'merchant', 'ES'), { context: 'sea', playerInitiated: true });
    expect(q.favor.ES).toBe(5);
  });

  it('feindlicher Hafen: Gunst 0 und gültiger Kaperbrief gegen die Hafennation', () => {
    const s = newGame();
    const p = me(s);
    p.favor.ES = 0;
    expect(isHostilePort(s, p, 'havanna')).toBe(false);
    p.letters = ['EN'];
    expect(isHostilePort(s, p, 'havanna')).toBe(true);
    p.location = 'havanna';
    expect(validate(s, { type: 'SHARE_LOOT' })).toMatch(/Feindlich/);
    expect(validate(s, { type: 'RAID' })).toBeNull();
  });
});

describe('Gunst und Titel', () => {
  it('Gunst ist auf 0–10 begrenzt', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'port_royal';
    p.favor.EN = 10;
    p.purse = 10;
    const r = applyAction(s, { type: 'GOVERNOR', gift: true });
    expect(r.players[p.id].favor.EN).toBe(10);
  });

  it('Geschenk: 5 Gold für +1 Gunst', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'port_royal';
    p.favor.EN = 1;
    p.purse = 7;
    const r = applyAction(s, { type: 'GOVERNOR', gift: true });
    expect(r.players[p.id].favor.EN).toBe(2);
    expect(r.players[p.id].purse).toBe(2);
  });

  it('Titel: Kapitän 3, Oberst 6, Baron 8, Gouverneur 10', () => {
    const s = newGame();
    const p = s.players[0];
    const cases: [number, string | null][] = [
      [2, null],
      [3, 'Kapitaen'],
      [6, 'Oberst'],
      [8, 'Baron'],
      [10, 'Gouverneur'],
    ];
    for (const [f, t] of cases) {
      p.titles.EN = null;
      p.favor.EN = f;
      expect(eligibleTitle(s, p, 'EN')).toBe(t);
    }
  });

  it('Baron max. 2 je Nation, Gouverneur 1 je Nation', () => {
    const s = newGame(4);
    for (const p of s.players) p.favor.FR = 8;
    claimTitles(s, s.players[0], 'FR');
    claimTitles(s, s.players[1], 'FR');
    claimTitles(s, s.players[2], 'FR');
    expect(s.players.map((p) => p.titles.FR)).toEqual(['Baron', 'Baron', 'Oberst', null]);
    for (const p of s.players) p.favor.FR = 10;
    claimTitles(s, s.players[3], 'FR');
    claimTitles(s, s.players[2], 'FR');
    expect(s.players[3].titles.FR).toBe('Gouverneur');
    expect(s.players[2].titles.FR).toBe('Oberst'); // beide Baronien und das Gouverneursamt sind vergeben
  });

  it('Lieferauftrag beim Gouverneur erfüllen', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'port_royal';
    s.contracts = [{ id: 'T1', nation: 'EN', kind: 'deliver', good: 'Rum', qty: 2, gold: 6, favor: 1 }];
    p.cargo.Rum = 2;
    p.purse = 0;
    p.favor.EN = 2;
    const r = applyAction(s, { type: 'GOVERNOR', deliver: ['T1'] });
    const q = r.players[p.id];
    expect(q.cargo.Rum).toBe(0);
    expect(q.purse).toBe(6);
    expect(q.favor.EN).toBe(3);
    expect(q.titles.EN).toBe('Kapitaen');
    expect(r.contracts.find((c) => c.id === 'T1')).toBeUndefined();
  });

  it('Gouverneur ohne Anliegen ist keine legale Aktion', () => {
    const s = newGame();
    const p = me(s);
    p.location = 'port_royal';
    p.favor.EN = 1;
    p.letters = ['EN'];
    expect(validate(s, { type: 'GOVERNOR' })).toMatch(/nichts/);
    expect(BALANCE.titles.Kapitaen.favor).toBe(3);
  });
});
