// Spielaufbau.
import { BALANCE } from '../config/balance';
import { LIFE_GOALS, PIRATES, TREASURES } from '../config/cards';
import { PORTS, PORT_IDS } from '../config/map';
import { refillContracts } from './contracts';
import { spawnPirate } from './pirates';
import { initialWar } from './politics';
import { pick, shuffle } from './rng';
import { nextActive } from './time';
import { initialMarkets } from './trade';
import type { GameState, Nation, PlayerState, SeatConfig, Talent } from './types';
import { NATIONS, TALENTS } from './types';
import { emptyCargo, log } from './util';

export const PLAYER_COLORS = ['#d9480f', '#1c7ed6', '#2f9e44', '#9c36b5'];

export function talentsFor(bonus: Partial<Record<Talent, number>> | undefined): Record<Talent, number> | null {
  const S = BALANCE.start;
  const t = {} as Record<Talent, number>;
  let spent = 0;
  for (const k of TALENTS) {
    const b = bonus?.[k] ?? 0;
    if (!Number.isInteger(b) || b < 0) return null;
    t[k] = S.talentBase + b;
    if (t[k] > S.talentMax) return null;
    spent += b;
  }
  if (spent !== S.talentFreePoints) return null;
  return t;
}

export function createGame(seats: SeatConfig[], seed: number): GameState {
  if (seats.length < 2 || seats.length > 4) throw new Error('2 bis 4 Spieler');
  const rng = { rng: seed | 0 };
  const S = BALANCE.start;
  const goals = shuffle(rng, LIFE_GOALS);
  const order = shuffle(
    rng,
    seats.map((_, i) => i),
  );

  const players: PlayerState[] = seats.map((seat, i) => {
    const personality = seat.kind === 'ai' ? (seat.personality ?? 'Haendler') : (seat.personality ?? null);
    const bonus = seat.talentBonus ?? (personality ? BALANCE.ai.personalities[personality].talentBonus : { fechten: 1, navigation: 1 });
    const talents = talentsFor(bonus);
    if (!talents) throw new Error(`Ungültige Talentverteilung für ${seat.name}`);
    const home: Nation = seat.home ?? pick(rng, NATIONS);
    const homePorts = PORT_IDS.filter((id) => PORTS[id].nation === home);
    const favor = { ES: 0, EN: 0, FR: 0, NL: 0 };
    favor[home] = S.homeFavor;
    return {
      id: i,
      name: seat.name,
      kind: seat.kind,
      personality,
      color: PLAYER_COLORS[i],
      home,
      time: 0,
      // ANNAHME: Die Startreihenfolge bei Gleichstand wird ausgelost.
      arrival: order.indexOf(i) + 1,
      location: pick(rng, homePorts),
      ship: S.ship,
      hull: BALANCE.ships[S.ship].hull,
      crew: BALANCE.ships[S.ship].crewMax,
      morale: S.morale,
      cargo: emptyCargo(),
      purse: S.purse,
      wealth: 0,
      talents,
      favor,
      titles: { ES: null, EN: null, FR: null, NL: null },
      letters: [],
      fragments: {},
      treasures: [],
      pirates: [],
      lifeGoal: goals[i % goals.length].id,
      retired: false,
      retiredAt: null,
      stats: { prizes: 0, sunk: 0, goodsSold: 0, raids: 0, contracts: 0, mutinies: 0, shipwrecks: 0, actions: 0 },
    };
  });

  const portOwner: Record<string, Nation> = {};
  for (const id of PORT_IDS) portOwner[id] = PORTS[id].nation;

  const pirateOrder = shuffle(rng, PIRATES);
  const active = pirateOrder.slice(0, BALANCE.pirates.active).map((d) => spawnPirate(rng, d));

  const s: GameState = {
    version: 1,
    seed,
    rng: rng.rng,
    players,
    active: 0,
    arrivalCounter: seats.length,
    worldYear: 0,
    markets: initialMarkets(rng),
    portOwner,
    war: initialWar(),
    contracts: [],
    contractCounter: 0,
    pirates: active,
    piratePool: pirateOrder.slice(BALANCE.pirates.active).map((d) => d.id),
    fragmentPool: Object.fromEntries(TREASURES.map((t) => [t.id, BALANCE.treasure.fragmentsEach])),
    treasuresTaken: Object.fromEntries(TREASURES.map((t) => [t.id, null])),
    pending: null,
    voyage: null,
    finishLine: null,
    gameOver: false,
    scores: null,
    turn: 0,
    log: [],
    logCounter: 0,
    lastReport: null,
    reportCounter: 0,
  };
  s.rng = rng.rng;
  // Märkte wurden mit dem lokalen rng erzeugt – Zustand übernehmen.
  refillContracts(s);
  s.active = nextActive(s);
  log(s, `Neue Partie mit Seed ${seed}. Spanien liegt mit allen Nationen im Krieg.`, 'world', null);
  return s;
}
