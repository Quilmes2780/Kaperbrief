import { BALANCE } from '../src/config/balance';
import { d6 } from '../src/engine/rng';
import { createGame } from '../src/engine/setup';
import type { GameState, Nation, PlayerState, SeatConfig } from '../src/engine/types';
import { activePlayer } from '../src/engine/util';

export function newGame(n = 2, seed = 42, extra: Partial<SeatConfig>[] = []): GameState {
  const seats: SeatConfig[] = Array.from({ length: n }, (_, i) => ({
    name: `S${i + 1}`,
    kind: 'human',
    home: 'EN' as Nation,
    talentBonus: { fechten: 1, navigation: 1 },
    ...(extra[i] ?? {}),
  }));
  return createGame(seats, seed);
}

export function me(s: GameState): PlayerState {
  return activePlayer(s);
}

/** Sucht einen RNG-Zustand, bei dem die nächsten W6-Würfe genau `dice` ergeben. */
export function seedFor(dice: number[]): number {
  for (let r = 1; r < 5_000_000; r++) {
    const st = { rng: r };
    if (dice.every((v) => d6(st) === v)) return r;
  }
  throw new Error('Kein passender Seed');
}

export function forceDice(s: GameState, dice: number[]): void {
  s.rng = seedFor(dice);
}

/** Setzt Begegnungen auf "ruhige See" und Stürme auf "glimpflich" für die Dauer von fn. */
export function calmSeas<T>(fn: () => T): T {
  const ew = { ...BALANCE.encounters.weights };
  const sw = { ...BALANCE.storms.weights };
  Object.assign(BALANCE.encounters.weights, { calm: 1, merchant: 0, warship: 0, pirate: 0, wreck: 0, doldrums: 0, bottle: 0 });
  Object.assign(BALANCE.storms.weights, { mild: 1, light: 0, heavy: 0, drift: 0 });
  try {
    return fn();
  } finally {
    Object.assign(BALANCE.encounters.weights, ew);
    Object.assign(BALANCE.storms.weights, sw);
  }
}

/** Entfernt alle Piraten von der Karte. */
export function noPirates(s: GameState): void {
  s.pirates = [];
  s.piratePool = [];
}
