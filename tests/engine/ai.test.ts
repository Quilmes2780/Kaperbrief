import { describe, expect, it } from 'vitest';
import { aiStep, chooseAction, playOut } from '../../src/engine/ai';
import { chooseManeuver, decideAttack, duelWinChance, favorCurve, weightsFor } from '../../src/engine/ai/heuristic';
import { makeEnemy, startCombat } from '../../src/engine/combat';
import { validate } from '../../src/engine/reducer';
import { createGame } from '../../src/engine/setup';
import type { SeatConfig } from '../../src/engine/types';
import { me, newGame, noPirates } from '../helpers';

const AI3: SeatConfig[] = [
  { name: 'H', kind: 'ai', personality: 'Haendler' },
  { name: 'F', kind: 'ai', personality: 'Freibeuter' },
  { name: 'C', kind: 'ai', personality: 'Hoefling' },
];

describe('KI', () => {
  it('wählt immer legale Aktionen und beendet Partien', () => {
    for (let seed = 1; seed <= 15; seed++) {
      let s = createGame(AI3.slice(0, 2 + (seed % 2)), seed);
      let steps = 0;
      while (!s.gameOver && steps < 5000) {
        const d = chooseAction(s);
        expect(validate(s, d.action)).toBeNull();
        s = aiStep(s);
        steps++;
      }
      expect(s.gameOver).toBe(true);
      expect(s.scores!.length).toBe(s.players.length);
    }
  });

  it('gleicher Seed ergibt die gleiche Partie', () => {
    const a = playOut(createGame(AI3, 77));
    const b = playOut(createGame(AI3, 77));
    expect(a.scores).toEqual(b.scores);
    expect(a.turn).toBe(b.turn);
  });

  it('Persönlichkeiten unterscheiden sich über Gewichte', () => {
    const s = createGame(AI3, 1);
    const [h, f, c] = s.players;
    expect(weightsFor(f).combat).toBeGreaterThan(weightsFor(h).combat);
    expect(weightsFor(c).favor).toBeGreaterThan(weightsFor(f).favor);
    expect(f.talents.fechten).toBe(3);
    expect(h.talents.navigation).toBe(3);
  });

  it('greift ohne gültigen Kaperbrief nicht an', () => {
    const s = createGame(AI3, 3);
    const f = s.players[1];
    f.letters = [];
    expect(decideAttack(s, f, makeEnemy(s, 'merchant', 'ES'))).toBe(false);
    f.letters = ['EN'];
    f.talents.fechten = 3;
    expect(decideAttack(s, f, makeEnemy(s, 'merchant', 'ES'))).toBe(true);
  });

  it('bei tödlicher Gefahr weicht sie aus statt zu feuern', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.personality = 'Haendler';
    p.hull = 1;
    startCombat(s, p, makeEnemy(s, 'warship', 'ES'), { context: 'sea', playerInitiated: false });
    if (s.pending?.kind !== 'combat') throw new Error();
    expect(chooseManeuver(s, p, s.pending.combat)).not.toBe('Breitseite');
  });

  it('Hilfsfunktionen: Titelkurve und Duellchance', () => {
    expect(favorCurve(3)).toBe(1);
    expect(favorCurve(10)).toBe(10);
    expect(favorCurve(7)).toBeCloseTo(4.5);
    expect(duelWinChance(3, 2)).toBeGreaterThan(duelWinChance(1, 2));
    expect(duelWinChance(1, 3)).toBeGreaterThan(duelWinChance(1, 2));
  });
});
