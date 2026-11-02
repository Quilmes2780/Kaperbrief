// KI: bewertet legale Aktionen nach erwartetem Punktgewinn pro Jahreszeit.
// Persönlichkeiten (Händler, Freibeuter, Höfling) unterscheiden sich nur über Gewichte in balance.ts.
import { BALANCE, type AiWeights } from '../../config/balance';
import { PERSONALITY_NAMES, TREASURES } from '../../config/cards';
import { PORTS, PORT_IDS, SEAS } from '../../config/map';
import { isAttackLegal, npcChoice, strength } from '../combat';
import { letterProblem, eligibleTitle } from '../governor';
import { actionCost, validate } from '../reducer';
import { neighbors, planLegs } from '../sailing';
import { scorePlayer } from '../scoring';
import { repairCost, shipNetPrice } from '../shipyard';
import { digChance, fragmentsLeft } from '../treasure';
import { bestSale, buyableGoods } from '../trade';
import type { Action, Choice, Combat, Enemy, GameState, Good, Nation, PlayerState, PortAction, ShipType } from '../types';
import { CHOICES, GOODS, HEIGHTS, NATIONS, SHIP_TYPES } from '../types';
import { MAX_TIME, retireTime, activePlayer, ageOf, cargoCount, combatFavorNations, isHostilePort, isPort, nationName, shipStats, validLetterNations } from '../util';

const AI = BALANCE.ai;

export interface Candidate {
  action: Action;
  value: number;
  cost: number;
  rate: number;
  label: string;
}

/** Gewichte inkl. Anpassung an das Lebensziel. */
export function weightsFor(p: PlayerState): AiWeights {
  const w = { ...AI.personalities[p.personality ?? 'Haendler'] };
  switch (p.lifeGoal) {
    case 'adel':
    case 'zwei_kronen':
      w.favor += 0.4;
      break;
    case 'schatzjaeger':
      w.treasure += 0.6;
      break;
    case 'piratenjaeger':
      w.pirates += 0.7;
      break;
    case 'kaperkapitaen':
      w.combat += 0.4;
      break;
    case 'handelsherr':
      w.trade += 0.3;
      break;
  }
  return w;
}

// ---------- Wertfunktionen ----------

const TITLE_CURVE: [number, number][] = [
  [0, 0],
  [3, BALANCE.titles.Kapitaen.points],
  [6, BALANCE.titles.Oberst.points],
  [8, BALANCE.titles.Baron.points],
  [10, BALANCE.titles.Gouverneur.points],
];

/** Glatte Titelkurve: Punkte, die eine Gunststufe "wert" ist. */
export function favorCurve(f: number): number {
  for (let i = 1; i < TITLE_CURVE.length; i++) {
    const [f1, v1] = TITLE_CURVE[i];
    const [f0, v0] = TITLE_CURVE[i - 1];
    if (f <= f1) return v0 + ((v1 - v0) * (f - f0)) / (f1 - f0);
  }
  return TITLE_CURVE[TITLE_CURVE.length - 1][1];
}

export function favorValue(p: PlayerState, n: Nation, delta: number): number {
  const f = p.favor[n];
  const to = Math.max(0, Math.min(10, f + delta));
  return favorCurve(to) - favorCurve(f);
}

/** Erwarteter Verkaufspreis einer Ware (Durchschnitt der 4 besten Häfen, abgezinst). */
export function expectedPrice(s: GameState, g: Good): number {
  const prices = PORT_IDS.filter((id) => PORTS[id].produces !== g)
    .map((id) => BALANCE.trade.priceByLevel[s.markets[id][g]])
    .sort((a, b) => b - a)
    .slice(0, 4);
  return (prices.reduce((a, b) => a + b, 0) / prices.length) * 0.7;
}

function gold(w: AiWeights, n: number): number {
  return n * AI.goldValue * w.gold;
}

const TREASURE_VALUE = BALANCE.scoring.treasure + BALANCE.treasure.gold * AI.goldValue;

function completion(k: number, poolLeft: number): number {
  if (k >= 4) return 1;
  if (k === 3) return 0.85;
  if (k + poolLeft < 3) return 0;
  return k === 2 ? 0.35 : k === 1 ? 0.15 : 0.05;
}

export function fragmentValue(s: GameState, p: PlayerState): number {
  const total = fragmentsLeft(s);
  if (total === 0) return 0;
  let v = 0;
  for (const t of TREASURES) {
    const pool = s.fragmentPool[t.id];
    if (pool === 0 || s.treasuresTaken[t.id] !== null) continue;
    const k = p.fragments[t.id] ?? 0;
    v += (pool / total) * TREASURE_VALUE * (completion(k + 1, pool - 1) - completion(k, pool));
  }
  return v;
}

/** Wahrscheinlichkeit, das Fechtduell zu gewinnen (Ruin-Modell auf der Planke). */
export function duelWinChance(fechten: number, start: number): number {
  const N = BALANCE.combat.duel.planks - 1;
  const fwd = 2 / 3;
  const back = (1 / 3) * (1 - Math.min(6, fechten) / 6);
  if (start <= 0) return 0;
  if (start >= N) return 1;
  if (back === 0) return 1;
  const r = back / fwd;
  return (1 - r ** start) / (1 - r ** N);
}

function duelStart(p: PlayerState, e: { crew: number }): number {
  const D = BALANCE.combat.duel;
  let pos = D.start;
  if (p.crew >= e.crew + D.crewAdvantage) pos++;
  if (e.crew >= p.crew + D.crewAdvantage) pos--;
  return pos;
}

export function myStrength(p: PlayerState): number {
  const st = shipStats(p);
  return strength(p.hull, st.cannons, p.crew, p.talents.fechten);
}

export function enemyStrength(e: { hull: number; cannons: number; crew: number }): number {
  return strength(e.hull, e.cannons, e.crew, 1);
}

function winChance(p: PlayerState, e: { hull: number; cannons: number; crew: number }): number {
  const r = myStrength(p) / enemyStrength(e);
  return Math.max(0.05, Math.min(0.95, 0.5 + (r - 1) * 0.6));
}

/** Erwarteter Wert eines Kampfes gegen e (gewichtet). */
function prizeValue(s: GameState, p: PlayerState, w: AiWeights, e: Enemy): number {
  let v = gold(w, e.gold) + cargoCount(e.cargo) * 0.25;
  if (e.nation && isAttackLegal(s, p, e)) {
    for (const l of combatFavorNations(s, p, e.nation)) v += favorValue(p, l, BALANCE.favor.captureGain) * w.favor;
  }
  if (e.type === 'notorious') v += BALANCE.scoring.pirate * w.pirates + 1;
  return v;
}

// ---------- Kandidaten im Hafen ----------

function tradeAction(s: GameState, q: PlayerState, port: string): { a: PortAction; value: number } | null {
  const w = weightsFor(q);
  const sale = bestSale(s, q.cargo, port);
  let soldUnits = 0;
  let lost = 0;
  for (const g of GOODS) {
    const n = sale.sell[g] ?? 0;
    soldUnits += n;
    lost += n * expectedPrice(s, g);
  }
  const free = shipStats(q).hold - cargoCount(q.cargo) + soldUnits;
  const g = buyableGoods(port)[0];
  const money = q.purse + sale.revenue;
  const reserve = 2;
  const buy = Math.max(0, Math.min(free, Math.floor((money - reserve) / BALANCE.trade.buyPrice), BALANCE.trade.maxBuyPerVisit));
  const buyGain = expectedPrice(s, g) > BALANCE.trade.buyPrice * 1.5 ? buy * (expectedPrice(s, g) - BALANCE.trade.buyPrice) : 0;
  const buyN = buyGain > 0 ? buy : 0;
  if (soldUnits === 0 && buyN === 0) return null;
  const value = w.trade * (gold(w, sale.revenue - lost) + gold(w, buyGain) + (q.lifeGoal === 'handelsherr' ? soldUnits * 0.25 : 0));
  return { a: { type: 'TRADE', sell: sale.sell, buy: buyN > 0 ? { [g]: buyN } : {} }, value };
}

function governorAction(s: GameState, q: PlayerState, port: string): { a: PortAction; value: number } | null {
  const w = weightsFor(q);
  const n = s.portOwner[port];
  const cargo = { ...q.cargo };
  const deliver: string[] = [];
  let value = 0;
  let favor = 0;
  let goldGain = 0;
  for (const c of s.contracts) {
    if (c.nation !== n || c.kind !== 'deliver') continue;
    if (cargo[c.good!] >= c.qty!) {
      cargo[c.good!] -= c.qty!;
      deliver.push(c.id);
      favor += c.favor;
      goldGain += c.gold;
      value += gold(w, c.gold) - c.qty! * expectedPrice(s, c.good!) * AI.goldValue;
    }
  }
  const purse = q.purse + goldGain;
  const giftGain = favorValue(q, n, favor + BALANCE.favor.giftGain) - favorValue(q, n, favor);
  const gift = purse >= BALANCE.favor.giftCost + 3 && giftGain * w.favor > gold(w, BALANCE.favor.giftCost);
  if (gift) {
    favor += BALANCE.favor.giftGain;
    value += giftGain * w.favor - gold(w, BALANCE.favor.giftCost);
  }
  value += favorValue(q, n, favor) * w.favor * (gift ? 0 : 1);
  if (gift) value += favorValue(q, n, favor - BALANCE.favor.giftGain) * w.favor;
  const after = { ...q, favor: { ...q.favor, [n]: Math.min(10, q.favor[n] + favor) } };
  const newTitle = eligibleTitle(s, after, n);
  if (newTitle !== q.titles[n]) {
    const before = q.titles[n] ? BALANCE.titles[q.titles[n]!].points : 0;
    value += BALANCE.titles[newTitle!].points - before - (favorCurve(after.favor[n]) - favorCurve(q.favor[n])) * 0.5;
    value += 0.5;
  }
  let letter = false;
  if (letterProblem(s, after, n) === null) {
    const targets = NATIONS.filter((m) => m !== n && s.war[[n, m].sort().join('-')]).length;
    if (targets > 0 && (q.letters.length === 0 || w.combat >= 1)) {
      letter = true;
      value += AI.letterValue * w.combat * (q.letters.length === 0 ? 1 : 0.5);
    }
  }
  if (deliver.length === 0 && !gift && !letter && newTitle === q.titles[n]) return null;
  return { a: { type: 'GOVERNOR', deliver, gift, letter }, value };
}

function tavernAction(s: GameState, q: PlayerState): { a: PortAction; value: number } | null {
  const w = weightsFor(q);
  const max = shipStats(q).crewMax;
  let purse = q.purse;
  let value = 0;
  let fragment = false;
  const fv = fragmentValue(s, q) * w.treasure;
  if (fv > gold(w, BALANCE.treasure.fragmentPrice) && purse >= BALANCE.treasure.fragmentPrice) {
    fragment = true;
    purse -= BALANCE.treasure.fragmentPrice;
    value += fv - gold(w, BALANCE.treasure.fragmentPrice);
  }
  const want = Math.min(max - q.crew, Math.max(0, purse - 2));
  const hire = want > 0 && (q.crew < 3 || w.combat >= 1) ? want : 0;
  value += hire * (q.crew < 3 ? 0.35 : 0.15) * w.combat - gold(w, hire * BALANCE.crew.hireCost);
  if (!fragment && hire === 0) return null;
  return { a: { type: 'TAVERN', hire, fragment }, value };
}

function shipyardActions(_s: GameState, q: PlayerState): { a: PortAction; value: number }[] {
  const w = weightsFor(q);
  const out: { a: PortAction; value: number }[] = [];
  const cost = repairCost(q);
  if (cost > 0 && cost <= q.purse) {
    const missing = shipStats(q).hull - q.hull;
    out.push({ a: { type: 'SHIPYARD', repair: true }, value: missing * AI.hullPenalty * (q.hull <= 1 ? 1 : 0.5) - gold(w, cost) });
  }
  const cur = shipStats(q);
  for (const t of SHIP_TYPES as readonly ShipType[]) {
    if (t === q.ship) continue;
    const price = shipNetPrice(q, t);
    if (price > q.purse - 2 || price <= 0) continue;
    const st = BALANCE.ships[t];
    if (cargoCount(q.cargo) > st.hold) continue;
    const big = BALANCE.scoring.bigShips.includes(t) && !BALANCE.scoring.bigShips.includes(q.ship) ? BALANCE.scoring.bigShip : 0;
    const v =
      big +
      (st.hold - cur.hold) * 0.35 * w.trade +
      (st.cannons - cur.cannons) * 0.45 * w.combat +
      (st.hull - cur.hull) * 0.2 +
      (st.speed - cur.speed) * 1.2 -
      gold(w, price);
    out.push({ a: { type: 'SHIPYARD', buyShip: t }, value: v });
  }
  return out;
}

function shareLootValue(q: PlayerState, time: number): number {
  const w = weightsFor(q);
  const moraleGain = BALANCE.morale.afterShare - q.morale;
  const pFail = Math.max(0, Math.min(1, (BALANCE.morale.mutinyTarget - q.talents.fuehrung - 1) / 6));
  const risk = q.morale <= 2 ? pFail * (gold(w, q.purse) + 0.5) : 0;
  const safety = gold(w, q.purse) * 0.1;
  const crewLoss = (q.crew - Math.floor(q.crew / 2)) * 0.08 * w.combat;
  const endgame = ageOf(time) >= 44 ? 0 : 1;
  return endgame * (moraleGain * 0.3 + risk * 2 + safety) - crewLoss;
}

function raidValue(s: GameState, q: PlayerState, port: string): number {
  const w = weightsFor(q);
  const owner = s.portOwner[port];
  if (validLetterNations(s, q, owner).length === 0) return -99;
  const fort = BALANCE.combat.enemies.fort;
  const pw = winChance(q, fort) * 0.8;
  const goldV = gold(w, BALANCE.raid.goldBase + 3.5 * BALANCE.raid.goldPerPip);
  const best = validLetterNations(s, q, owner).sort((a, b) => q.favor[b] - q.favor[a])[0];
  const fav = favorValue(q, best, BALANCE.favor.raidGain) * w.favor;
  return w.combat * (pw * (goldV + fav + 0.5) - (1 - pw) * AI.hullPenalty * 1.5);
}

function portCandidates(s: GameState, q: PlayerState, port: string): { a: PortAction; value: number }[] {
  const out: { a: PortAction; value: number }[] = [];
  const hostile = isHostilePort(s, q, port);
  if (!hostile) {
    const t = tradeAction(s, q, port);
    if (t) out.push(t);
    const g = governorAction(s, q, port);
    if (g) out.push(g);
    const tv = tavernAction(s, q);
    if (tv) out.push(tv);
    out.push(...shipyardActions(s, q));
    out.push({ a: { type: 'SHARE_LOOT' }, value: shareLootValue(q, q.time) });
  }
  if (weightsFor(q).combat >= 0.7) out.push({ a: { type: 'RAID' }, value: raidValue(s, q, port) });
  return out;
}

// ---------- Segelrisiken ----------

function encounterEV(s: GameState, p: PlayerState, w: AiWeights): number {
  const E = BALANCE.encounters;
  const totalW = Object.values(E.weights).reduce((a, b) => a + b, 0);
  const totalN = Object.values(E.merchantNation).reduce((a, b) => a + b, 0);
  let legalShare = 0;
  for (const n of NATIONS) if (validLetterNations(s, p, n).length > 0) legalShare += E.merchantNation[n] / totalN;
  const merchant = BALANCE.combat.enemies.merchant;
  const ratio = myStrength(p) / enemyStrength(merchant);
  if (ratio < w.aggression) return 0;
  const pw = winChance(p, merchant);
  const prize = gold(w, merchant.goldBase + 3.5) + 0.6 + 0.5 * w.favor;
  return (E.weights.merchant / totalW) * legalShare * pw * prize * w.combat;
}

function sailRisk(_s: GameState, p: PlayerState, legs: number): number {
  const pFail = Math.max(0, (BALANCE.morale.mutinyTarget - p.talents.fuehrung - 1) / 6);
  const zeroLegs = Math.max(0, legs - (p.morale - 1));
  let risk = zeroLegs * pFail * (gold(weightsFor(p), p.purse) + 1.5);
  if (p.hull <= 1) risk += legs * AI.hullPenalty;
  // Herbststürme
  let autumn = 0;
  for (let i = 0; i < legs; i++) if ((p.time + i) % 4 === 2) autumn++;
  risk += autumn * 0.15 * (p.hull <= 2 ? 3 : 1);
  return risk;
}

// ---------- Hauptentscheidung ----------

export function candidates(s: GameState): Candidate[] {
  const p = activePlayer(s);
  const w = weightsFor(p);
  const out: Candidate[] = [];
  const push = (action: Action, value: number, label: string, extraCost = 0) => {
    if (validate(s, action) !== null) return;
    const cost = actionCost(s, action) + extraCost;
    out.push({ action, value, cost, rate: value / Math.max(1, cost), label });
  };
  const evLeg = encounterEV(s, p, w);

  // Im aktuellen Hafen
  if (isPort(p.location)) {
    for (const c of portCandidates(s, p, p.location)) push(c.a, c.value, `${labelOf(c.a)} in ${PORTS[p.location].name}`);
  }
  // Segeln (+ Hafenaktion) zu jedem Hafen
  for (const port of PORT_IDS) {
    if (port === p.location) continue;
    const legs = planLegs(p, port);
    if (!legs) continue;
    const q: PlayerState = { ...p, location: port, time: p.time + legs.length };
    const base = legs.length * evLeg - sailRisk(s, p, legs.length);
    for (const c of portCandidates(s, q, port)) {
      push({ type: 'SAIL', to: port, then: c.a }, c.value + base, `Segeln nach ${PORTS[port].name} + ${labelOf(c.a)}`);
    }
  }
  // Schatz heben / zum Fundort segeln
  for (const t of TREASURES) {
    const chance = digChance(p, t.id);
    if (chance === 0 || s.treasuresTaken[t.id] !== null) continue;
    const v = chance * TREASURE_VALUE * w.treasure;
    if (p.location === t.sea) push({ type: 'DIG', treasure: t.id }, v, `Schatz heben (${t.name})`);
    else {
      const legs = planLegs(p, t.sea)?.length ?? 0;
      push({ type: 'SAIL', to: t.sea }, v * 0.9 + legs * evLeg - sailRisk(s, p, legs), `Zum Fundort: ${t.name}`, BALANCE.actionCost.DIG);
    }
  }
  // Piratenjagd
  for (const pr of s.pirates) {
    if (pr.sea === p.location) continue;
    const ratio = myStrength(p) / enemyStrength(pr);
    if (ratio < w.aggression * 1.1) continue;
    const pw = winChance(p, pr);
    const v = w.pirates * pw * (BALANCE.scoring.pirate + gold(w, pr.bounty + pr.gold) + 1) - (1 - pw) * AI.hullPenalty * 2;
    const legs = planLegs(p, pr.sea)?.length ?? 0;
    push({ type: 'SAIL', to: pr.sea }, v - sailRisk(s, p, legs), `Jagd auf ${pr.name}`);
  }
  // Kaperfahrt in benachbarte Gebiete
  if (evLeg > 0) {
    for (const sea of neighbors(isPort(p.location) ? PORTS[p.location].sea : p.location)) {
      push({ type: 'SAIL', to: sea }, evLeg - sailRisk(s, p, 1), `Kaperfahrt in die ${SEAS[sea].name}`);
    }
  }
  return out;
}

function labelOf(a: PortAction): string {
  switch (a.type) {
    case 'TRADE':
      return 'Handeln';
    case 'GOVERNOR':
      return 'Gouverneur';
    case 'TAVERN':
      return 'Taverne';
    case 'SHIPYARD':
      return a.buyShip ? `Werft (${a.buyShip})` : 'Werft (Reparatur)';
    case 'RAID':
      return 'Überfall';
    case 'SHARE_LOOT':
      return 'Beute teilen';
  }
}

function shouldRetire(s: GameState, p: PlayerState, best: Candidate | undefined): boolean {
  if (p.time < retireTime()) return false;
  const w = weightsFor(p);
  const mine = scorePlayer(p).total;
  const others = s.players.filter((o) => o.id !== p.id).map((o) => scorePlayer(o).total);
  const lead = mine - Math.max(...others);
  const graceCost = Math.min(BALANCE.time.finishLineGrace, Math.max(0, MAX_TIME - p.time)) * BALANCE.ai.gracePointsPerSeason;
  if (s.finishLine === null && lead >= w.retireLead + graceCost) return true;
  if (ageOf(p.time) >= w.retireAge && (!best || best.rate < 0.3)) return true;
  return false;
}

export interface AiDecision {
  action: Action;
  note: string;
}

export function chooseAction(s: GameState): AiDecision {
  const p = activePlayer(s);
  const who = `${p.name} (KI, ${PERSONALITY_NAMES[p.personality ?? 'Haendler']})`;
  const pend = s.pending;
  if (pend?.kind === 'encounter') {
    const attack = decideAttack(s, p, pend.enemy);
    return { action: { type: 'ENCOUNTER', attack }, note: `${who}: ${attack ? 'Angriff!' : 'Lässt das Schiff ziehen.'}` };
  }
  if (pend?.kind === 'combat') {
    const choice = chooseManeuver(s, p, pend.combat);
    return { action: { type: 'COMBAT', choice }, note: '' };
  }
  if (pend?.kind === 'duel') {
    // Die Parade ist gleichverteilt – jede Höhe ist gleich gut. Deterministisch, ohne den Spiel-RNG zu verbrauchen.
    const height = HEIGHTS[(s.logCounter + pend.duel.round) % 3];
    return { action: { type: 'DUEL', height }, note: '' };
  }
  const list = candidates(s).sort((a, b) => b.rate - a.rate);
  const best = list[0];
  if (shouldRetire(s, p, best)) return { action: { type: 'RETIRE' }, note: `${who}: zieht sich zur Ruhe zurück.` };
  if (best && best.value > 0) {
    return { action: best.action, note: `${who}: ${best.label} – erwartet ${best.rate.toFixed(2)} Punkte je Jahreszeit.` };
  }
  return { action: fallback(s, p), note: `${who}: sucht neue Gelegenheiten.` };
}

function fallback(s: GameState, p: PlayerState): Action {
  if (p.time >= retireTime() && ageOf(p.time) >= 43) return { type: 'RETIRE' };
  // Nächstgelegener befreundeter Hafen mit Handelsmöglichkeit
  const ports = PORT_IDS.filter((id) => id !== p.location && !isHostilePort(s, p, id)).sort(
    (a, b) => (planLegs(p, a)?.length ?? 99) - (planLegs(p, b)?.length ?? 99),
  );
  for (const port of ports) {
    const a: Action = { type: 'SAIL', to: port, then: { type: 'TRADE', sell: {}, buy: { [PORTS[port].produces]: 1 } } };
    if (validate(s, a) === null) return a;
  }
  return { type: 'SAIL', to: ports[0] ?? PORT_IDS.find((id) => id !== p.location)! };
}

export function decideAttack(s: GameState, p: PlayerState, e: Enemy): boolean {
  const w = weightsFor(p);
  if (!isAttackLegal(s, p, e)) return false;
  if (p.hull < 2 || p.crew < 2) return false;
  const ratio = myStrength(p) / enemyStrength(e);
  if (ratio < w.aggression) return false;
  const pw = winChance(p, e);
  return pw * prizeValue(s, p, w, e) * w.combat - (1 - pw) * AI.hullPenalty > 0;
}

/** Wählt das Manöver mit dem besten Erwartungswert gegen die bekannte W6-Tabelle des Gegners. */
export function chooseManeuver(s: GameState, p: PlayerState, c: Combat): Choice {
  const w = weightsFor(p);
  const e = c.enemy;
  const myC = shipStats(p).cannons;
  const pDuel = duelWinChance(p.talents.fechten, duelStart(p, e));
  const capture = prizeValue(s, p, w, e) + 1;
  const sink = c.context === 'raid' ? capture : (e.nation && c.legal ? 1.5 * w.favor : 0.5) + (e.type === 'notorious' ? 3 : 0);
  const loss = p.hull <= e.cannons ? 6 : 1.5;
  const plunder = cargoCount(p.cargo) * 0.25 + gold(w, p.purse) * 0.5 + 0.5;
  const wantFight = c.playerInitiated || myStrength(p) >= enemyStrength(e);
  const hitValue = (dmg: number) => (e.hull <= dmg ? sink : (dmg / e.hull) * sink * 0.8);
  const takeValue = (dmg: number) => (p.hull <= dmg ? loss * 2 : (dmg / p.hull) * loss);
  let best: Choice = 'Ausweichen';
  let bestV = -Infinity;
  for (const mine of CHOICES) {
    let v = 0;
    for (let die = 1; die <= 6; die++) {
      const npc = npcChoice(e.type, die);
      let x = 0;
      if (mine === npc) {
        if (mine === 'Breitseite') x = hitValue(myC) - takeValue(e.cannons);
        else if (mine === 'Entern') x = p.crew > e.crew ? pDuel * capture - (1 - pDuel) * 0.5 : e.crew > p.crew ? pDuel * capture - (1 - pDuel) * plunder : 0;
        else x = wantFight ? -0.2 : 0.2;
      } else if (
        (mine === 'Breitseite' && npc === 'Entern') ||
        (mine === 'Entern' && npc === 'Ausweichen') ||
        (mine === 'Ausweichen' && npc === 'Breitseite')
      ) {
        if (mine === 'Breitseite') x = hitValue(myC);
        else if (mine === 'Entern') x = pDuel * capture - (1 - pDuel) * 0.5;
        else x = wantFight ? -0.1 : 0.5;
      } else {
        if (npc === 'Breitseite') x = -takeValue(e.cannons);
        else if (npc === 'Entern') x = pDuel * capture - (1 - pDuel) * plunder;
        else x = wantFight ? -0.3 : 0.1;
      }
      v += x / 6;
    }
    if (v > bestV) {
      bestV = v;
      best = mine;
    }
  }
  return best;
}

export function describeNation(n: Nation): string {
  return nationName(n);
}
