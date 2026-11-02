// Seegefecht (bis 3 Runden, Schere-Stein-Papier) und Fechtduell auf der Planke.
import { BALANCE } from '../config/balance';
import { PORTS } from '../config/map';
import { checkCaptureContracts } from './contracts';
import { loseMorale, raiseMorale } from './crew';
import { d6 } from './rng';
import { shipwreck } from './sailing';
import type { Choice, Combat, Duel, DuelRound, Enemy, EnemyType, GameState, Height, Nation, PlayerState } from './types';
import { GOODS, HEIGHTS, NATIONS } from './types';
import { addFavor, combatFavorNations, holdFree, log, nationName, shipStats, validLetterNations } from './util';

const CB = BALANCE.combat;

/** Breitseite > Entern > Ausweichen > Breitseite */
export function beats(a: Choice, b: Choice): boolean {
  return (
    (a === 'Breitseite' && b === 'Entern') || (a === 'Entern' && b === 'Ausweichen') || (a === 'Ausweichen' && b === 'Breitseite')
  );
}

export function npcChoice(type: EnemyType, die: number): Choice {
  return CB.npcTables[type][die - 1];
}

const TYPE_NAMES: Record<EnemyType, string> = {
  merchant: 'Handelsschiff',
  warship: 'Kriegsschiff',
  pirate: 'Piratenschiff',
  notorious: 'Pirat',
  fort: 'Festung',
};

export function makeEnemy(s: GameState, type: EnemyType, nation: Nation | null): Enemy {
  const st = CB.enemies[type];
  const cargo: Enemy['cargo'] = {};
  for (let i = 0; i < st.cargoUnits; i++) {
    const g = GOODS[d6(s) % GOODS.length];
    cargo[g] = (cargo[g] ?? 0) + 1;
  }
  return {
    name: nation ? `${TYPE_NAMES[type]} (${nationName(nation)})` : TYPE_NAMES[type],
    type,
    nation,
    hull: st.hull,
    hullMax: st.hull,
    cannons: st.cannons,
    crew: st.crew,
    gold: st.goldBase + d6(s) * st.goldPerPip,
    cargo,
  };
}

export function isAttackLegal(s: GameState, p: PlayerState, enemy: Enemy): boolean {
  if (enemy.type === 'pirate' || enemy.type === 'notorious') return true;
  if (!enemy.nation) return true;
  return validLetterNations(s, p, enemy.nation).length > 0;
}

export function startCombat(
  s: GameState,
  p: PlayerState,
  enemy: Enemy,
  opts: { context: Combat['context']; playerInitiated: boolean },
): void {
  const legal = !opts.playerInitiated || isAttackLegal(s, p, enemy);
  if (opts.playerInitiated) {
    log(s, `${p.name} greift an: ${enemy.name}.`, 'combat');
    if (!legal && enemy.nation) {
      log(s, `Kein gültiger Kaperbrief gegen ${nationName(enemy.nation)}!`, 'combat');
      addFavor(s, p, enemy.nation, -BALANCE.favor.illegalAttackPenalty);
    }
  } else {
    log(s, `${enemy.name} greift ${p.name} an!`, 'combat');
  }
  s.pending = {
    kind: 'combat',
    combat: { enemy, round: 1, context: opts.context, legal, playerInitiated: opts.playerInitiated, rounds: [] },
  };
}

function startDuel(s: GameState, p: PlayerState, combat: Combat, defending: boolean): void {
  const D = CB.duel;
  let pos = D.start;
  if (p.crew >= combat.enemy.crew + D.crewAdvantage) pos++;
  if (combat.enemy.crew >= p.crew + D.crewAdvantage) pos--;
  const duel: Duel = { pos, round: 1, defending, rounds: [] };
  log(s, `${defending ? 'Der Gegner entert!' : 'Entern gelungen!'} Fechtduell auf der Planke (Feld ${pos + 1} von ${D.planks}).`, 'combat');
  s.pending = { kind: 'duel', combat, duel };
}

export function combatRound(s: GameState, p: PlayerState, choice: Choice): void {
  if (s.pending?.kind !== 'combat') throw new Error('Kein Gefecht');
  const c = s.pending.combat;
  const e = c.enemy;
  const die = d6(s);
  const npc = npcChoice(e.type, die);
  const myCannons = shipStats(p).cannons;
  let text: string;
  let next: 'continue' | 'duelAttack' | 'duelDefend' | 'escaped' | 'enemyEscaped' | 'separated' = 'continue';

  if (choice === npc) {
    if (choice === 'Breitseite') {
      e.hull -= myCannons;
      p.hull -= e.cannons;
      text = `Beide feuern Breitseiten: Gegner -${myCannons} Rumpf, eigenes Schiff -${e.cannons} Rumpf.`;
    } else if (choice === 'Entern') {
      // ANNAHME: Beide entern – die größere Mannschaft setzt sich durch; bei Gleichstand nichts.
      if (p.crew > e.crew) {
        next = 'duelAttack';
        text = 'Beide entern – eure größere Mannschaft gewinnt das Handgemenge.';
      } else if (e.crew > p.crew) {
        next = 'duelDefend';
        text = 'Beide entern – die größere gegnerische Mannschaft drängt herüber.';
      } else text = 'Beide entern – das Handgemenge bleibt unentschieden.';
    } else {
      next = 'separated';
      text = 'Beide drehen ab – die Schiffe trennen sich.';
    }
  } else if (beats(choice, npc)) {
    if (choice === 'Breitseite') {
      e.hull -= myCannons;
      text = `Eure Breitseite trifft den enternden Gegner: -${myCannons} Rumpf.`;
    } else if (choice === 'Entern') {
      next = 'duelAttack';
      text = 'Ihr holt den ausweichenden Gegner ein und entert!';
    } else {
      next = 'escaped';
      text = 'Ihr weicht der Breitseite aus und entkommt.';
    }
  } else {
    if (npc === 'Breitseite') {
      p.hull -= e.cannons;
      text = `Die gegnerische Breitseite trifft euch beim Entern: -${e.cannons} Rumpf.`;
    } else if (npc === 'Entern') {
      next = 'duelDefend';
      text = 'Der Gegner holt euch beim Ausweichen ein und entert!';
    } else {
      next = 'enemyEscaped';
      text = 'Der Gegner weicht eurer Breitseite aus und entkommt.';
    }
  }
  c.rounds.push({ round: c.round, player: choice, die, npc, text });
  log(s, `Runde ${c.round}: ${choice} gegen ${npc} (W6 ${die}). ${text}`, 'combat');

  if (p.hull <= 0) return endCombat(s, p, c, 'shipwreck');
  if (e.hull <= 0) return endCombat(s, p, c, 'sunk');
  if (next === 'duelAttack') return startDuel(s, p, c, false);
  if (next === 'duelDefend') return startDuel(s, p, c, true);
  if (next === 'escaped') return endCombat(s, p, c, 'escaped');
  if (next === 'enemyEscaped') return endCombat(s, p, c, 'enemyEscaped');
  if (next === 'separated') return endCombat(s, p, c, 'separated');
  c.round++;
  if (c.round > CB.maxRounds) endCombat(s, p, c, 'draw');
}

export function parryFor(die: number): Height {
  return HEIGHTS[Math.floor((die - 1) / 2)];
}

/** Eine Duellrunde: Angriff gegen gewürfelte Parade; pariert -> Spieler hält mit W6 <= Fechten stand. */
export function duelRound(s: GameState, p: PlayerState, height: Height): void {
  if (s.pending?.kind !== 'duel') throw new Error('Kein Duell');
  const { combat, duel } = s.pending;
  const D = CB.duel;
  const die = d6(s);
  const parry = parryFor(die);
  const parried = parry === height;
  let holdDie: number | null = null;
  let held: boolean | null = null;
  if (!parried) duel.pos++;
  else {
    holdDie = d6(s);
    held = holdDie <= p.talents.fechten;
    if (!held) duel.pos--;
  }
  const r: DuelRound = { round: duel.round, attack: height, die, parry, parried, holdDie, held, pos: duel.pos };
  duel.rounds.push(r);
  const msg = !parried
    ? `Hieb ${height} trifft (Parade ${parry}) – vorwärts auf Feld ${duel.pos + 1}.`
    : held
      ? `Hieb ${height} pariert, Gegenangriff abgewehrt (W6 ${holdDie} ≤ Fechten ${p.talents.fechten}).`
      : `Hieb ${height} pariert, zurückgedrängt (W6 ${holdDie} > Fechten ${p.talents.fechten}) – Feld ${duel.pos + 1}.`;
  log(s, `Duell ${duel.round}: ${msg}`, 'combat');

  if (duel.pos >= D.planks - 1) return endCombat(s, p, combat, 'captured', duel);
  if (duel.pos <= 0) return endCombat(s, p, combat, duel.defending ? 'plundered' : 'repelled', duel);
  duel.round++;
  // ANNAHME: Nach 10 Duellrunden ohne Entscheidung lösen sich die Schiffe voneinander.
  if (duel.round > D.maxRounds) endCombat(s, p, combat, 'separated', duel);
}

export type CombatOutcome =
  | 'sunk'
  | 'captured'
  | 'escaped'
  | 'enemyEscaped'
  | 'separated'
  | 'draw'
  | 'repelled'
  | 'plundered'
  | 'shipwreck';

const OUTCOME_TEXT: Record<CombatOutcome, string> = {
  sunk: 'Gegner versenkt',
  captured: 'Gegner gekapert',
  escaped: 'Ihr seid entkommen',
  enemyEscaped: 'Der Gegner ist entkommen',
  separated: 'Die Schiffe trennen sich',
  draw: 'Nach drei Runden unentschieden',
  repelled: 'Enterangriff abgeschlagen',
  plundered: 'Ihr wurdet geplündert',
  shipwreck: 'Euer Schiff ist gesunken',
};

function endCombat(s: GameState, p: PlayerState, c: Combat, outcome: CombatOutcome, duel?: Duel): void {
  s.pending = null;
  const e = c.enemy;
  const lines: string[] = [];
  const victory = outcome === 'sunk' || outcome === 'captured';
  log(s, `Gefecht gegen ${e.name}: ${OUTCOME_TEXT[outcome]}.`, 'combat');

  if (victory && e.type === 'fort') {
    raidSuccess(s, p, c, lines);
  } else if (victory) {
    if (e.nation && c.legal) {
      for (const l of combatFavorNations(s, p, e.nation)) {
        const gain =
          (outcome === 'sunk' ? BALANCE.favor.sinkGain : BALANCE.favor.captureGain) + (e.type === 'warship' ? BALANCE.favor.warshipBonus : 0);
        addFavor(s, p, l, gain);
        lines.push(`Gunst bei ${nationName(l)} +${gain}`);
      }
    }
    if (outcome === 'captured') {
      let free = holdFree(p);
      const taken: string[] = [];
      for (const g of GOODS) {
        const n = Math.min(free, e.cargo[g] ?? 0);
        if (n > 0) {
          p.cargo[g] += n;
          free -= n;
          taken.push(`${n} ${g}`);
        }
      }
      p.purse += e.gold;
      raiseMorale(p, BALANCE.morale.captureBonus);
      p.stats.prizes++;
      lines.push(`Beute: ${e.gold} Gold${taken.length ? ', ' + taken.join(', ') : ''}; Moral +${BALANCE.morale.captureBonus}`);
      log(s, `${p.name} erbeutet ${e.gold} Gold${taken.length ? ' und ' + taken.join(', ') : ''}.`, 'combat');
    } else {
      p.stats.sunk++;
      lines.push('Versenkt – keine Beute');
    }
    if (e.type === 'notorious' && e.pirateId) {
      const pr = s.pirates.find((x) => x.id === e.pirateId);
      if (pr) {
        s.pirates = s.pirates.filter((x) => x.id !== pr.id);
        p.pirates.push(pr.id);
        p.purse += pr.bounty;
        lines.push(`Kopfgeld: ${pr.bounty} Gold`);
        log(s, `${p.name} hat ${pr.name} besiegt und kassiert ${pr.bounty} Gold Kopfgeld!`, 'combat');
        // ANNAHME: Ein besiegter berüchtigter Pirat bringt Gunst bei allen Nationen (favor.notoriousGain, derzeit 0).
        if (BALANCE.favor.notoriousGain > 0) for (const n of NATIONS) addFavor(s, p, n, BALANCE.favor.notoriousGain);
      }
    }
    if (e.nation) checkCaptureContracts(s, p, e.nation);
  } else if (outcome === 'plundered') {
    // ANNAHME: Verlorener Abwehrkampf -> Ladung weg, halbe Kasse weg, Moral -1.
    const lost = Math.ceil(p.purse * CB.plunderPurseFactor);
    p.purse -= lost;
    for (const g of GOODS) p.cargo[g] = 0;
    lines.push(`Verlust: gesamte Ladung und ${lost} Gold`);
    loseMorale(s, p, 1);
  } else if (outcome === 'repelled') {
    // ANNAHME: Abgeschlagenes Entern kostet einen Mann und 1 Moral.
    p.crew = Math.max(1, p.crew - 1);
    lines.push('Ein Mann verloren, Moral -1');
    loseMorale(s, p, 1);
  } else if (outcome === 'shipwreck') {
    shipwreck(s, p);
    lines.push('Schiffbruch!');
  }

  s.reportCounter++;
  s.lastReport = {
    id: s.reportCounter,
    player: p.id,
    title: c.context === 'raid' ? `Überfall auf ${e.portId ? PORTS[e.portId].name : 'Hafen'}` : `Gefecht: ${e.name}`,
    lines,
    rounds: c.rounds,
    duel: duel?.rounds ?? [],
    outcome: OUTCOME_TEXT[outcome],
  };
}

// ANNAHME: Ein Überfall ist ein Seegefecht gegen die Festung (Rumpf 6, Kanonen 3), die nie ausweicht.
export function startRaid(s: GameState, p: PlayerState, port: string): void {
  const owner = s.portOwner[port];
  const enemy = makeEnemy(s, 'fort', owner);
  enemy.name = `Festung von ${PORTS[port].name}`;
  enemy.portId = port;
  const R = BALANCE.raid;
  enemy.gold = R.goldBase + d6(s) * R.goldPerPip;
  startCombat(s, p, enemy, { context: 'raid', playerInitiated: true });
}

function raidSuccess(s: GameState, p: PlayerState, c: Combat, lines: string[]): void {
  const port = c.enemy.portId!;
  const owner = s.portOwner[port];
  p.purse += c.enemy.gold;
  raiseMorale(p, BALANCE.morale.raidBonus);
  p.stats.raids++;
  lines.push(`Beute: ${c.enemy.gold} Gold`);
  log(s, `${p.name} plündert ${PORTS[port].name} und erbeutet ${c.enemy.gold} Gold!`, 'combat');
  if (c.legal) {
    const options = validLetterNations(s, p, owner).sort((a, b) => p.favor[b] - p.favor[a]);
    const newOwner = options[0];
    if (newOwner) {
      s.portOwner[port] = newOwner;
      lines.push(`${PORTS[port].name} gehört jetzt zu ${nationName(newOwner)}`);
      log(s, `${PORTS[port].name} hisst die Flagge von ${nationName(newOwner)}!`, 'world');
      addFavor(s, p, newOwner, BALANCE.favor.raidGain);
    }
  } else {
    // ANNAHME: Überfall ohne gültigen Kaperbrief bringt nur Beute, die Flagge bleibt.
    lines.push('Ohne gültigen Kaperbrief bleibt die Flagge unverändert');
  }
}

/** Grobe Kampfstärke für Anzeige und KI. */
export function strength(hull: number, cannons: number, crew: number, fechten = 1): number {
  return hull + cannons * 1.5 + crew * 0.5 + fechten;
}
