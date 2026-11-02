// Gouverneur: Gunst, Titel, Kaperbriefe, Lieferaufträge, Geschenke.
import { BALANCE } from '../config/balance';
import { TITLE_NAMES } from '../config/cards';
import { PORTS } from '../config/map';
import { completeContract } from './contracts';
import type { GameState, Nation, PlayerState, PortAction, Title } from './types';
import { GOODS, TITLES } from './types';
import { addFavor, atWar, log, nationName } from './util';

type GovernorAction = Extract<PortAction, { type: 'GOVERNOR' }>;

export function titleRank(t: Title | null): number {
  return t === null ? -1 : TITLES.indexOf(t);
}

function holders(s: GameState, n: Nation, t: Title): number {
  return s.players.filter((p) => p.titles[n] === t).length;
}

/** Höchster Titel, den p bei Nation n mit seiner Gunst erhalten kann (unter Beachtung der Limits). */
export function eligibleTitle(s: GameState, p: PlayerState, n: Nation): Title | null {
  let best: Title | null = p.titles[n];
  for (const t of TITLES) {
    const def = BALANCE.titles[t];
    if (p.favor[n] < def.favor) continue;
    if (titleRank(t) <= titleRank(best)) continue;
    if (def.limit !== null && holders(s, n, t) >= def.limit) continue;
    best = t;
  }
  return best;
}

// ANNAHME: Titel werden beim Gouverneur abgeholt und bleiben erhalten, auch wenn die Gunst später sinkt.
export function claimTitles(s: GameState, p: PlayerState, n: Nation): void {
  const t = eligibleTitle(s, p, n);
  if (t !== null && t !== p.titles[n]) {
    p.titles[n] = t;
    log(s, `${p.name} wird ${TITLE_NAMES[t]} von ${nationName(n)}!`, 'action', p.id);
  }
}

export function letterProblem(s: GameState, p: PlayerState, n: Nation, favor = p.favor[n]): string | null {
  if (p.letters.includes(n)) return 'Kaperbrief dieser Nation bereits vorhanden';
  if (favor < 1) return 'Mindestens 1 Gunst nötig';
  const conflict = p.letters.find((l) => atWar(s, l, n));
  if (conflict) return `Krieg mit ${nationName(conflict)}, deren Kaperbrief du hältst`;
  return null;
}

export function validateGovernor(s: GameState, p: PlayerState, port: string, a: GovernorAction): string | null {
  const n = s.portOwner[port];
  let favor = p.favor[n];
  let gold = p.purse;
  const need: Record<string, number> = {};
  for (const id of a.deliver ?? []) {
    const c = s.contracts.find((x) => x.id === id);
    if (!c) return 'Auftrag nicht mehr verfügbar';
    if (c.nation !== n || c.kind !== 'deliver') return 'Auftrag gehört nicht zu diesem Gouverneur';
    need[c.good!] = (need[c.good!] ?? 0) + c.qty!;
    favor += c.favor;
    gold += c.gold;
  }
  for (const g of GOODS) if ((need[g] ?? 0) > p.cargo[g]) return `Nicht genug ${g} für die Lieferung`;
  if (a.gift) {
    if (gold < BALANCE.favor.giftCost) return 'Nicht genug Gold für ein Geschenk';
    favor += BALANCE.favor.giftGain;
  }
  if (a.letter) {
    const prob = letterProblem(s, p, n, favor);
    if (prob) return prob;
  }
  const hasEffect = (a.deliver?.length ?? 0) > 0 || a.gift || a.letter;
  if (!hasEffect && eligibleTitle(s, p, n) === p.titles[n]) return 'Der Gouverneur hat nichts für dich';
  return null;
}

export function doGovernor(s: GameState, p: PlayerState, port: string, a: GovernorAction): void {
  const n = s.portOwner[port];
  log(s, `${p.name} besucht den Gouverneur von ${PORTS[port].name} (${nationName(n)}).`);
  for (const id of a.deliver ?? []) {
    const c = s.contracts.find((x) => x.id === id)!;
    p.cargo[c.good!] -= c.qty!;
    completeContract(s, p, c);
  }
  if (a.gift) {
    p.purse -= BALANCE.favor.giftCost;
    log(s, `${p.name} überreicht ein Geschenk (${BALANCE.favor.giftCost} Gold).`);
    addFavor(s, p, n, BALANCE.favor.giftGain);
  }
  claimTitles(s, p, n);
  if (a.letter && !letterProblem(s, p, n)) {
    p.letters.push(n);
    log(s, `${p.name} erhält einen Kaperbrief von ${nationName(n)}.`);
  }
}
