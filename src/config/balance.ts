// Alle justierbaren Zahlenwerte des Spiels. Änderungen hier wirken ohne Codeänderung.
import type { Choice, EnemyType, Nation, Personality, ShipType, Title } from '../engine/types';

export interface ShipStats {
  speed: number;
  hold: number;
  cannons: number;
  hull: number;
  crewMax: number;
  price: number;
}

export interface EnemyStats {
  hull: number;
  cannons: number;
  crew: number;
  /** Gold = goldBase + W6 * goldPerPip */
  goldBase: number;
  goldPerPip: number;
  cargoUnits: number;
}

export interface AiWeights {
  /** Punktwert je Gold Gewinn (vor Gewichtung). */
  gold: number;
  trade: number;
  favor: number;
  combat: number;
  treasure: number;
  pirates: number;
  /** Mindest-Stärkeverhältnis, ab dem angegriffen wird. */
  aggression: number;
  /** Ab diesem Alter in den Ruhestand, falls nichts Besseres. */
  retireAge: number;
  /** Ruhestand ab 35, wenn Führung in Punkten mindestens so groß ist. */
  retireLead: number;
  talentBonus: { fechten: number; navigation: number; fuehrung: number };
}

export const BALANCE = {
  time: {
    startAge: 25,
    endAge: 45,
    // ANNAHME (Balancing, vom Nutzer gewählt): Ruhestand ab 38 statt 35, Ziellinie mit 1 Jahr Nachlauf.
    retireMinAge: 38,
    /** Nachlauf: Die Ziellinie liegt so viele Jahreszeiten hinter dem Feld des ersten Ruhestands.
     * 0 = Regel 14 wörtlich (die Partie endet dann sofort, weil der Ziehende immer der Hinterste ist). */
    finishLineGrace: 4,
    seasonsPerYear: 4,
    seasonNames: ['Frühling', 'Sommer', 'Herbst', 'Winter'],
    agingFromAge: 35,
    agingHardAge: 40,
    /** Alterungsprobe: W6 <= Wert -> Talent -1 */
    agingFailEasy: 1,
    agingFailHard: 2,
  },

  actionCost: {
    SAIL_LEG: 1,
    TRADE: 1,
    GOVERNOR: 1,
    TAVERN: 1,
    SHIPYARD: 2,
    RAID: 2,
    DIG: 1,
    SHARE_LOOT: 2,
    RETIRE: 0,
  },

  ships: {
    // ANNAHME: Die Schaluppe ist das Startschiff; nachgekauft kostet sie 8 Gold.
    Schaluppe: { speed: 3, hold: 3, cannons: 1, hull: 3, crewMax: 4, price: 8 },
    Brigantine: { speed: 2, hold: 5, cannons: 2, hull: 4, crewMax: 6, price: 15 },
    Fregatte: { speed: 2, hold: 6, cannons: 4, hull: 6, crewMax: 8, price: 30 },
    Galeone: { speed: 1, hold: 10, cannons: 3, hull: 7, crewMax: 8, price: 25 },
  } satisfies Record<ShipType, ShipStats>,

  start: {
    ship: 'Schaluppe' as ShipType,
    purse: 10,
    morale: 5,
    // ANNAHME: Jeder Spieler wählt eine Heimatnation und beginnt dort mit 1 Gunst (sonst 0), 10 Gold Kasse.
    homeFavor: 1,
    talentBase: 1,
    talentFreePoints: 2,
    talentMax: 3,
    talentMin: 1,
  },

  navigation: {
    /** ANNAHME: Navigation 3 gibt +1 Geschwindigkeit. */
    speedBonusAt: 3,
    speedBonus: 1,
  },

  morale: {
    max: 5,
    perLeg: 1,
    afterShare: 5,
    captureBonus: 2,
    raidBonus: 2,
    /** Meutereiprobe: W6 + Führung >= Ziel */
    mutinyTarget: 5,
    afterPassedCheck: 1,
    afterMutiny: 3,
  },

  trade: {
    /** Index = Nachfragestufe (1..3) */
    priceByLevel: [0, 1, 3, 5],
    buyPrice: 1,
    maxLevel: 3,
    minLevel: 1,
    recoveryPerYear: 1,
    /** Maximale Einkaufsmenge je Handelsaktion. */
    maxBuyPerVisit: 10,
  },

  crew: { hireCost: 1 },

  shipyard: { repairCostPerPoint: 1, tradeInFactor: 0.5 },

  favor: {
    min: 0,
    max: 10,
    illegalAttackPenalty: 2,
    sinkGain: 2,
    captureGain: 1,
    warshipBonus: 1,
    /** Sieg bringt Gunst bei allen passenden Kaperbrief-Gebern (true) oder nur beim Geber mit der höchsten Gunst (false). */
    combatFavorAllLetters: true,
    // ANNAHME: Beim Gouverneur kann man für 5 Gold ein Geschenk machen (+1 Gunst).
    giftCost: 5,
    giftGain: 1,
    raidGain: 2,
    /** Gunst bei allen Nationen je besiegtem berüchtigtem Piraten. Balancing: 0 (mit 1 stellten Titel 42 % aller Punkte). */
    notoriousGain: 0,
  },

  titles: {
    Kapitaen: { favor: 3, points: 1, limit: null as number | null },
    Oberst: { favor: 6, points: 3, limit: null as number | null },
    Baron: { favor: 8, points: 6, limit: 2 as number | null },
    Gouverneur: { favor: 10, points: 10, limit: 1 as number | null },
  } satisfies Record<Title, { favor: number; points: number; limit: number | null }>,

  combat: {
    maxRounds: 3,
    duel: {
      planks: 5,
      start: 2,
      maxRounds: 10,
      /** ANNAHME: Mannschaftsvorsprung von mind. 2 verschiebt den Start um 1 Feld. */
      crewAdvantage: 2,
    },
    /** NPC-Wahl per W6: Eintrag i gilt für Augenzahl i+1. */
    npcTables: {
      merchant: ['Breitseite', 'Entern', 'Ausweichen', 'Ausweichen', 'Ausweichen', 'Breitseite'],
      warship: ['Breitseite', 'Breitseite', 'Breitseite', 'Entern', 'Entern', 'Ausweichen'],
      pirate: ['Breitseite', 'Entern', 'Entern', 'Entern', 'Ausweichen', 'Breitseite'],
      notorious: ['Breitseite', 'Breitseite', 'Entern', 'Entern', 'Ausweichen', 'Entern'],
      fort: ['Breitseite', 'Breitseite', 'Breitseite', 'Breitseite', 'Entern', 'Entern'],
    } satisfies Record<EnemyType, Choice[]>,
    enemies: {
      merchant: { hull: 3, cannons: 1, crew: 3, goldBase: 2, goldPerPip: 1, cargoUnits: 3 },
      warship: { hull: 6, cannons: 3, crew: 7, goldBase: 2, goldPerPip: 1, cargoUnits: 0 },
      pirate: { hull: 4, cannons: 2, crew: 5, goldBase: 3, goldPerPip: 1, cargoUnits: 1 },
      notorious: { hull: 5, cannons: 2, crew: 6, goldBase: 4, goldPerPip: 1, cargoUnits: 0 },
      fort: { hull: 6, cannons: 3, crew: 6, goldBase: 8, goldPerPip: 2, cargoUnits: 0 },
    } satisfies Record<EnemyType, EnemyStats>,
    /** Gegner plündert nach verlorenem Abwehrkampf diesen Anteil der Kasse. */
    plunderPurseFactor: 0.5,
  },

  shipwreck: {
    purseFactor: 0.5,
    extraTime: 1,
  },

  encounters: {
    /** Gewichte der Begegnungskarten. */
    weights: { calm: 3, merchant: 5, warship: 1, pirate: 1, wreck: 1, doldrums: 1, bottle: 0.5 },
    merchantNation: { ES: 4, EN: 2, FR: 2, NL: 2 } satisfies Record<Nation, number>,
    warshipNation: { ES: 3, EN: 1, FR: 1, NL: 1 } satisfies Record<Nation, number>,
    wreckGoldPerPip: 1,
    doldrumsTime: 1,
  },

  storms: {
    weights: { mild: 2, light: 3, heavy: 2, drift: 1 },
    lightDamage: 1,
    heavyDamage: 2,
    driftTime: 1,
  },

  politics: {
    warCardsPerPair: 1,
    peaceCardsPerPair: 1,
    calmCards: 3,
  },

  treasure: {
    fragmentsEach: 4,
    fragmentPrice: 6,
    riskyNeed: 3,
    riskyTarget: 4,
    // ANNAHME: Ein gehobener Schatz bringt zusätzlich 15 Gold in die Kasse.
    gold: 15,
  },

  pirates: {
    active: 3,
    /** Kopfgeld = Basis + W6 * je Auge */
    bountyBase: 8,
    bountyPerPip: 2,
    moveSteps: 1,
  },

  contracts: {
    perNation: 3,
    deliverQtyMin: 2,
    deliverQtyMax: 4,
    deliverGoldPerUnit: 3,
    // Balancing: 2 statt 1, damit der friedliche Weg zu Titeln mit dem Kapern mithält.
    deliverFavor: 2,
    captureGold: 8,
    captureFavor: 2,
    /** Wahrscheinlichkeit (0..1) für Kaperauftrag statt Lieferauftrag, falls Krieg herrscht. */
    captureChance: 0.4,
  },

  raid: { goldBase: 8, goldPerPip: 2 },

  scoring: {
    goldPerPoint: 5,
    purseFactor: 0.5,
    treasure: 6,
    pirate: 3,
    lifeGoal: 8,
    bigShip: 2,
    bigShips: ['Fregatte', 'Galeone'] as ShipType[],
  },

  lifeGoals: {
    wealth: 50,
    prizes: 5,
    goodsSold: 30,
  },

  ai: {
    /** Grundwert eines Golds in Kasse in Punkten. */
    goldValue: 0.12,
    /** Erwarteter Wert einer Ware an Bord (Gold). */
    cargoValue: 2.5,
    letterValue: 1.5,
    fragmentValue: 1.4,
    lowMoralePenalty: 1.5,
    hullPenalty: 1.2,
    /** Punkte, die jeder Mitspieler je Jahreszeit Nachlauf voraussichtlich noch holt (erhöht den nötigen Vorsprung). */
    gracePointsPerSeason: 0.7,
    /** Gewichte per Simulation abgestimmt (je 400 Partien, Seeds 1 und 1001): Siegquoten je ca. 27–31 %. */
    personalities: {
      Haendler: {
        gold: 1, trade: 1.2, favor: 0.8, combat: 0.6, treasure: 0.7, pirates: 0.3,
        aggression: 1.6, retireAge: 41, retireLead: 6,
        talentBonus: { fechten: 0, navigation: 2, fuehrung: 0 },
      },
      Freibeuter: {
        gold: 1, trade: 0.7, favor: 0.9, combat: 1.05, treasure: 1.0, pirates: 1.1,
        aggression: 0.8, retireAge: 42, retireLead: 6,
        talentBonus: { fechten: 2, navigation: 0, fuehrung: 0 },
      },
      Hoefling: {
        gold: 0.9, trade: 0.9, favor: 1.2, combat: 1.1, treasure: 0.6, pirates: 0.6,
        aggression: 1.0, retireAge: 41, retireLead: 5,
        talentBonus: { fechten: 1, navigation: 1, fuehrung: 0 },
      },
    } satisfies Record<Personality, AiWeights>,
  },
};

export type Balance = typeof BALANCE;
