// Grundtypen der Spiel-Engine. Keine UI-Abhängigkeiten.

export const NATIONS = ['ES', 'EN', 'FR', 'NL'] as const;
export type Nation = (typeof NATIONS)[number];

export const GOODS = ['Zucker', 'Tabak', 'Rum', 'Kakao'] as const;
export type Good = (typeof GOODS)[number];

export const SHIP_TYPES = ['Schaluppe', 'Brigantine', 'Fregatte', 'Galeone'] as const;
export type ShipType = (typeof SHIP_TYPES)[number];

export const TALENTS = ['fechten', 'navigation', 'fuehrung'] as const;
export type Talent = (typeof TALENTS)[number];

export const PERSONALITIES = ['Haendler', 'Freibeuter', 'Hoefling'] as const;
export type Personality = (typeof PERSONALITIES)[number];

export const TITLES = ['Kapitaen', 'Oberst', 'Baron', 'Gouverneur'] as const;
export type Title = (typeof TITLES)[number];

export const CHOICES = ['Breitseite', 'Entern', 'Ausweichen'] as const;
export type Choice = (typeof CHOICES)[number];

export const HEIGHTS = ['Hoch', 'Mitte', 'Tief'] as const;
export type Height = (typeof HEIGHTS)[number];

/** Hafen-ID oder Seegebiets-ID (Seegebiete beginnen mit "s"). */
export type LocId = string;

export type Cargo = Record<Good, number>;

export interface PlayerStats {
  prizes: number; // gekaperte Schiffe
  sunk: number; // versenkte Schiffe
  goodsSold: number;
  raids: number;
  contracts: number;
  mutinies: number;
  shipwrecks: number;
  actions: number;
}

export interface PlayerState {
  id: number;
  name: string;
  kind: 'human' | 'ai';
  personality: Personality | null;
  color: string;
  home: Nation;
  /** Position auf der Lebensleiste: 0 = Frühling mit 25, 80 = Frühling mit 45. */
  time: number;
  /** Ankunftszähler; höher = später angekommen (oben im Stapel). */
  arrival: number;
  location: LocId;
  ship: ShipType;
  hull: number;
  crew: number;
  morale: number;
  cargo: Cargo;
  purse: number;
  wealth: number;
  talents: Record<Talent, number>;
  favor: Record<Nation, number>;
  titles: Record<Nation, Title | null>;
  letters: Nation[];
  fragments: Record<string, number>;
  treasures: string[];
  pirates: string[];
  lifeGoal: string;
  retired: boolean;
  retiredAt: number | null;
  stats: PlayerStats;
}

export type EnemyType = 'merchant' | 'warship' | 'pirate' | 'notorious' | 'fort';

export interface Enemy {
  name: string;
  type: EnemyType;
  nation: Nation | null;
  hull: number;
  hullMax: number;
  cannons: number;
  crew: number;
  gold: number;
  cargo: Partial<Cargo>;
  pirateId?: string;
  portId?: string;
}

export interface CombatRound {
  round: number;
  player: Choice;
  die: number;
  npc: Choice;
  text: string;
}

export interface DuelRound {
  round: number;
  attack: Height;
  die: number;
  parry: Height;
  parried: boolean;
  holdDie: number | null;
  held: boolean | null;
  pos: number;
}

export interface Combat {
  enemy: Enemy;
  round: number;
  context: 'sea' | 'raid';
  /** Gültiger Kaperbrief bzw. Piratenjagd/Verteidigung. */
  legal: boolean;
  playerInitiated: boolean;
  rounds: CombatRound[];
}

export interface Duel {
  pos: number;
  round: number;
  /** true = Gegner hat geentert, Spieler verteidigt. */
  defending: boolean;
  rounds: DuelRound[];
}

export type Pending =
  | { kind: 'encounter'; enemy: Enemy; text: string }
  | { kind: 'combat'; combat: Combat }
  | { kind: 'duel'; combat: Combat; duel: Duel };

export type PortActionType = 'TRADE' | 'GOVERNOR' | 'TAVERN' | 'SHIPYARD' | 'RAID' | 'SHARE_LOOT';

export type PortAction =
  | { type: 'TRADE'; sell: Partial<Cargo>; buy: Partial<Cargo> }
  | { type: 'GOVERNOR'; letter?: boolean; deliver?: string[]; gift?: boolean }
  | { type: 'TAVERN'; hire?: number; fragment?: boolean }
  | { type: 'SHIPYARD'; repair?: boolean; buyShip?: ShipType }
  | { type: 'RAID' }
  | { type: 'SHARE_LOOT' };

export type Action =
  | { type: 'SAIL'; to: LocId; then?: PortAction }
  | PortAction
  | { type: 'DIG'; treasure: string }
  | { type: 'RETIRE' }
  | { type: 'ENCOUNTER'; attack: boolean }
  | { type: 'COMBAT'; choice: Choice }
  | { type: 'DUEL'; height: Height };

export interface Voyage {
  legs: LocId[][];
  destination: LocId;
  then: PortAction | null;
}

export interface Contract {
  id: string;
  nation: Nation;
  kind: 'deliver' | 'capture';
  good?: Good;
  qty?: number;
  target?: Nation;
  gold: number;
  favor: number;
}

export interface PirateState {
  id: string;
  name: string;
  sea: LocId;
  hull: number;
  hullMax: number;
  cannons: number;
  crew: number;
  gold: number;
  bounty: number;
}

export interface LogEntry {
  n: number;
  turn: number;
  player: number | null;
  text: string;
  kind: 'action' | 'world' | 'combat' | 'info';
}

export interface Report {
  id: number;
  player: number;
  title: string;
  lines: string[];
  rounds: CombatRound[];
  duel: DuelRound[];
  outcome: string;
}

export interface ScoreBreakdown {
  player: number;
  gold: number;
  titles: number;
  treasures: number;
  pirates: number;
  lifeGoal: number;
  ships: number;
  total: number;
}

export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  players: PlayerState[];
  active: number;
  arrivalCounter: number;
  worldYear: number;
  markets: Record<string, Record<Good, number>>;
  portOwner: Record<string, Nation>;
  war: Record<string, boolean>;
  contracts: Contract[];
  contractCounter: number;
  pirates: PirateState[];
  piratePool: string[];
  fragmentPool: Record<string, number>;
  treasuresTaken: Record<string, number | null>;
  pending: Pending | null;
  voyage: Voyage | null;
  finishLine: number | null;
  gameOver: boolean;
  scores: ScoreBreakdown[] | null;
  turn: number;
  log: LogEntry[];
  logCounter: number;
  lastReport: Report | null;
  reportCounter: number;
}

export interface SeatConfig {
  name: string;
  kind: 'human' | 'ai';
  personality?: Personality;
  home?: Nation;
  /** Verteilung der 2 freien Talentpunkte. */
  talentBonus?: Partial<Record<Talent, number>>;
}
