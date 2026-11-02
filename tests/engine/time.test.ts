import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/engine/reducer';
import { advanceTime, agingCheck, nextActive } from '../../src/engine/time';
import { MAX_TIME, retireTime, ageOf, seasonOf, timeLabel } from '../../src/engine/util';
import { calmSeas, forceDice, me, newGame, noPirates } from '../helpers';

describe('Lebensleiste', () => {
  it('läuft von 25 bis 45 in Jahreszeiten', () => {
    expect(ageOf(0)).toBe(25);
    expect(ageOf(3)).toBe(25);
    expect(ageOf(4)).toBe(26);
    expect(MAX_TIME).toBe(80);
    expect(retireTime()).toBe(52);
    expect(seasonOf(2)).toBe(2);
    expect(timeLabel(6)).toBe('Herbst, 26 J.');
  });

  it('der hinterste Spieler ist am Zug', () => {
    const s = newGame(3);
    s.players[0].time = 5;
    s.players[1].time = 2;
    s.players[2].time = 4;
    expect(nextActive(s)).toBe(1);
  });

  it('bei Gleichstand ist der zuletzt Angekommene (oben im Stapel) am Zug', () => {
    const s = newGame(3);
    for (const p of s.players) p.time = 3;
    s.players[0].arrival = 10;
    s.players[1].arrival = 12;
    s.players[2].arrival = 11;
    s.arrivalCounter = 12;
    expect(nextActive(s)).toBe(1);
    advanceTime(s, s.players[2], 0);
    expect(nextActive(s)).toBe(1);
    s.players[2].time = 2;
    advanceTime(s, s.players[2], 1);
    expect(s.players[2].arrival).toBeGreaterThan(12);
    expect(nextActive(s)).toBe(2);
  });

  it('nach einer Aktion wechselt der Zug zum hintersten Spieler', () => {
    const s = newGame(2);
    noPirates(s);
    const first = me(s).id;
    const port = me(s).location;
    const next = calmSeas(() => applyAction(s, { type: 'SHARE_LOOT' }));
    expect(next.players[first].time).toBe(2);
    expect(next.players[first].location).toBe(port);
    expect(next.active).not.toBe(first);
  });

  it('Weltjahreswechsel erst, wenn der hinterste Marker den Frühling überschreitet', () => {
    const s = newGame(2);
    noPirates(s);
    s.players[0].time = 3;
    s.players[1].time = 6;
    s.active = 0;
    const r = applyAction(s, { type: 'SHARE_LOOT' });
    expect(r.worldYear).toBe(1);
    expect(r.log.some((l) => l.text.includes('Weltjahreswechsel'))).toBe(true);

    const t = newGame(2);
    t.players[0].time = 1;
    t.players[1].time = 6;
    t.active = 0;
    expect(applyAction(t, { type: 'SHARE_LOOT' }).worldYear).toBe(0);
  });
});

describe('Alterung', () => {
  it('keine Probe vor 35', () => {
    const s = newGame();
    const p = s.players[0];
    p.time = 39;
    forceDice(s, [1]);
    advanceTime(s, p, 1); // -> 35
    // Probe mit 35 findet statt
    expect(p.talents.fechten + p.talents.navigation + p.talents.fuehrung).toBe(4);
    const q = s.players[1];
    q.time = 35;
    forceDice(s, [1]);
    advanceTime(s, q, 1); // 34
    expect(q.talents.fechten + q.talents.navigation + q.talents.fuehrung).toBe(5);
  });

  it('ab 35 scheitert die Probe bei W6 = 1, ab 40 bei 1–2', () => {
    const s = newGame();
    const p = s.players[0];
    p.time = 40;
    forceDice(s, [2]);
    agingCheck(s, p);
    expect(p.talents.fechten + p.talents.navigation + p.talents.fuehrung).toBe(5);
    p.time = 60;
    forceDice(s, [2]);
    agingCheck(s, p);
    expect(p.talents.fechten + p.talents.navigation + p.talents.fuehrung).toBe(4);
  });

  it('Talente fallen nicht unter 1', () => {
    const s = newGame();
    const p = s.players[0];
    p.talents = { fechten: 1, navigation: 1, fuehrung: 1 };
    p.time = 64;
    forceDice(s, [1]);
    agingCheck(s, p);
    expect(p.talents).toEqual({ fechten: 1, navigation: 1, fuehrung: 1 });
  });
});
