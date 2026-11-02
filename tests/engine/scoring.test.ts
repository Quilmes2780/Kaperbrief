import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { applyAction, validate } from '../../src/engine/reducer';
import { goldPoints, lifeGoalMet, scorePlayer, titlePoints } from '../../src/engine/scoring';
import { me, newGame, noPirates } from '../helpers';

describe('Wertung', () => {
  it('1 Punkt je 5 Gold Vermögen, Kasse zählt halb', () => {
    const s = newGame();
    const p = s.players[0];
    p.wealth = 20;
    p.purse = 10;
    expect(goldPoints(p)).toBe(5);
    p.wealth = 4;
    p.purse = 1;
    expect(goldPoints(p)).toBe(0);
  });

  it('Titel 1/3/6/10, je Nation der höchste', () => {
    const s = newGame();
    const p = s.players[0];
    p.titles = { ES: 'Kapitaen', EN: 'Oberst', FR: 'Baron', NL: 'Gouverneur' };
    expect(titlePoints(p)).toBe(20);
  });

  it('Schatz 6, Pirat 3, Lebensziel 8, Fregatte/Galeone 2', () => {
    const s = newGame();
    const p = s.players[0];
    p.purse = 0;
    p.wealth = 0;
    p.treasures = ['A'];
    p.pirates = ['x', 'y'];
    p.ship = 'Galeone';
    p.lifeGoal = 'piratenjaeger';
    const b = scorePlayer(p);
    expect(b).toMatchObject({ treasures: 6, pirates: 6, lifeGoal: 8, ships: 2, gold: 0, titles: 0 });
    expect(b.total).toBe(22);
    p.ship = 'Brigantine';
    expect(scorePlayer(p).ships).toBe(0);
  });

  it('Lebensziele werden geprüft', () => {
    const s = newGame();
    const p = s.players[0];
    p.lifeGoal = 'reichtum';
    p.wealth = 49;
    expect(lifeGoalMet(p)).toBe(false);
    p.wealth = 50;
    expect(lifeGoalMet(p)).toBe(true);
    p.lifeGoal = 'zwei_kronen';
    p.titles.EN = 'Oberst';
    expect(lifeGoalMet(p)).toBe(false);
    p.titles.FR = 'Baron';
    expect(lifeGoalMet(p)).toBe(true);
  });
});

/** Führt fn mit vorübergehend gesetzten Ruhestandsregeln aus. */
function withRules(minAge: number, grace: number, fn: () => void) {
  const T = BALANCE.time;
  const old = [T.retireMinAge, T.finishLineGrace] as const;
  T.retireMinAge = minAge;
  T.finishLineGrace = grace;
  try {
    fn();
  } finally {
    [T.retireMinAge, T.finishLineGrace] = old;
  }
}

describe('Spielende', () => {
  it('Ruhestand erst ab 35 (Regel wörtlich)', () => withRules(35, 0, () => {
    const s = newGame();
    me(s).time = 39;
    expect(validate(s, { type: 'RETIRE' })).not.toBeNull();
    me(s).time = 40;
    expect(validate(s, { type: 'RETIRE' })).toBeNull();
  }));

  it('der erste Ruhestand setzt die Ziellinie; die anderen spielen bis dorthin (Regel wörtlich)', () => withRules(35, 0, () => {
    const s = newGame(2);
    noPirates(s);
    s.players[0].time = 44;
    s.players[1].time = 42;
    s.active = 1;
    let r = applyAction(s, { type: 'RETIRE' });
    expect(r.finishLine).toBe(42);
    expect(r.players[1].retired).toBe(true);
    // Spieler 0 steht schon hinter der Ziellinie -> ebenfalls Ruhestand, Spiel vorbei
    expect(r.gameOver).toBe(true);
    expect(r.scores?.length).toBe(2);

    const t = newGame(2);
    noPirates(t);
    t.players[0].time = 40;
    t.players[1].time = 45;
    t.active = 1;
    t.players[1].location = 'port_royal';
    r = applyAction(t, { type: 'RETIRE' });
    expect(r.gameOver).toBe(false);
    expect(r.active).toBe(0);
    r.players[0].location = 'port_royal';
    r = applyAction(r, { type: 'SHARE_LOOT' }); // 42
    expect(r.gameOver).toBe(false);
    r = applyAction(r, { type: 'SHARE_LOOT' }); // 44
    expect(r.gameOver).toBe(false);
    r = applyAction(r, { type: 'SHARE_LOOT' }); // 46 >= 45
    expect(r.gameOver).toBe(true);
  }));

  it('Standard: Ruhestand ab 38, Ziellinie mit einem Jahr Nachlauf', () => {
    expect(BALANCE.time.retireMinAge).toBe(38);
    expect(BALANCE.time.finishLineGrace).toBe(4);
    const s = newGame(2);
    noPirates(s);
    s.players[0].time = 56;
    s.players[1].time = 56;
    s.players[0].location = 'port_royal';
    s.active = 1;
    let r = applyAction(s, { type: 'RETIRE' });
    expect(r.finishLine).toBe(60);
    expect(r.gameOver).toBe(false);
    expect(r.active).toBe(0);
    r = applyAction(r, { type: 'SHARE_LOOT' }); // 58
    expect(r.gameOver).toBe(false);
    r = applyAction(r, { type: 'SHARE_LOOT' }); // 60
    expect(r.gameOver).toBe(true);

    const t = newGame(2);
    t.players[0].time = 78;
    t.players[1].time = 78;
    t.active = 1;
    expect(applyAction(t, { type: 'RETIRE' }).finishLine).toBe(80);
  });

  it('das Mindestalter für den Ruhestand kommt aus balance.ts', () => {
    const old = BALANCE.time.retireMinAge;
    BALANCE.time.retireMinAge = 38;
    try {
      const s = newGame(2);
      me(s).time = 40;
      expect(validate(s, { type: 'RETIRE' })).toMatch(/38/);
      me(s).time = 52;
      expect(validate(s, { type: 'RETIRE' })).toBeNull();
    } finally {
      BALANCE.time.retireMinAge = old;
    }
  });

  it('mit 45 ist der Ruhestand Pflicht', () => {
    const s = newGame(2);
    noPirates(s);
    s.players[0].time = 79;
    s.players[1].time = 79;
    s.players[0].location = 'port_royal';
    s.players[1].location = 'port_royal';
    s.active = 0;
    let r = applyAction(s, { type: 'TRADE', sell: {}, buy: { Rum: 1 } });
    expect(r.players[0].retired).toBe(true);
    expect(r.finishLine).toBe(80);
    r = applyAction(r, { type: 'TRADE', sell: {}, buy: { Rum: 1 } });
    expect(r.gameOver).toBe(true);
  });

  it('applyAction verändert den Eingabezustand nicht', () => {
    const s = newGame(2);
    const before = JSON.stringify(s);
    me(s).location = 'port_royal';
    const snap = JSON.stringify(s);
    applyAction(s, { type: 'SHARE_LOOT' });
    expect(JSON.stringify(s)).toBe(snap);
    expect(before).not.toBe(snap);
  });
});
