// Handel: 4 Waren, Nachfrage je Hafen und Ware in 3 Stufen.
import { BALANCE } from '../config/balance';
import { PORTS, PORT_IDS } from '../config/map';
import { randInt } from './rng';
import type { Cargo, GameState, Good, PlayerState, PortAction } from './types';
import { GOODS } from './types';
import { cargoCount, log, shipStats } from './util';

const TR = BALANCE.trade;

export function initialMarkets(s: { rng: number }): Record<string, Record<Good, number>> {
  const m: Record<string, Record<Good, number>> = {};
  for (const id of PORT_IDS) {
    const row = {} as Record<Good, number>;
    for (const g of GOODS) row[g] = g === PORTS[id].produces ? TR.minLevel : TR.minLevel + randInt(s, TR.maxLevel);
    m[id] = row;
  }
  return m;
}

/** Erlös beim Verkauf von n Einheiten; jede Einheit senkt die Stufe um 1. */
export function saleRevenue(level: number, n: number): { revenue: number; level: number } {
  let revenue = 0;
  let l = level;
  for (let i = 0; i < n; i++) {
    revenue += TR.priceByLevel[l];
    l = Math.max(TR.minLevel, l - 1);
  }
  return { revenue, level: l };
}

// ANNAHME: Jeder Hafen erzeugt genau eine Ware; nur diese ist dort zum festen Preis käuflich.
export function buyableGoods(port: string): Good[] {
  return [PORTS[port].produces];
}

type TradeAction = Extract<PortAction, { type: 'TRADE' }>;

export function validateTrade(s: GameState, p: PlayerState, port: string, a: TradeAction): string | null {
  let units = 0;
  let revenue = 0;
  for (const g of GOODS) {
    const n = a.sell[g] ?? 0;
    if (!Number.isInteger(n) || n < 0) return 'Ungültige Verkaufsmenge';
    if (n > p.cargo[g]) return `Nicht genug ${g} an Bord`;
    units += n;
    revenue += saleRevenue(s.markets[port][g], n).revenue;
  }
  let cost = 0;
  let bought = 0;
  for (const g of GOODS) {
    const n = a.buy[g] ?? 0;
    if (!Number.isInteger(n) || n < 0) return 'Ungültige Kaufmenge';
    if (n > 0 && !buyableGoods(port).includes(g)) return `${g} wird hier nicht angeboten`;
    bought += n;
    cost += n * TR.buyPrice;
  }
  if (bought > TR.maxBuyPerVisit) return 'Zu viel auf einmal gekauft';
  units += bought;
  if (units === 0) return 'Nichts gehandelt';
  if (cost > p.purse + revenue) return 'Nicht genug Gold in der Schiffskasse';
  const after = cargoCount(p.cargo) - cargoCount(a.sell) + bought;
  if (after > shipStats(p).hold) return 'Nicht genug Laderaum';
  return null;
}

export function doTrade(s: GameState, p: PlayerState, port: string, a: TradeAction): void {
  const parts: string[] = [];
  let revenue = 0;
  for (const g of GOODS) {
    const n = a.sell[g] ?? 0;
    if (n <= 0) continue;
    const r = saleRevenue(s.markets[port][g], n);
    s.markets[port][g] = r.level;
    p.cargo[g] -= n;
    p.stats.goodsSold += n;
    revenue += r.revenue;
    parts.push(`verkauft ${n} ${g} für ${r.revenue} Gold`);
  }
  p.purse += revenue;
  for (const g of GOODS) {
    const n = a.buy[g] ?? 0;
    if (n <= 0) continue;
    p.cargo[g] += n;
    p.purse -= n * TR.buyPrice;
    parts.push(`kauft ${n} ${g} für ${n * TR.buyPrice} Gold`);
  }
  log(s, `${p.name} handelt in ${PORTS[port].name}: ${parts.join(', ')}.`);
}

/** Beim Weltjahreswechsel steigt jede Nachfrage um eine Stufe (Erzeugerware bleibt auf Stufe 1). */
export function recoverMarkets(s: GameState): void {
  for (const id of PORT_IDS) {
    for (const g of GOODS) {
      if (g === PORTS[id].produces) continue;
      s.markets[id][g] = Math.min(TR.maxLevel, s.markets[id][g] + TR.recoveryPerYear);
    }
  }
  log(s, 'Die Märkte erholen sich.', 'world', null);
}

/** Bester möglicher Verkaufserlös der aktuellen Ladung in einem Hafen. */
export function bestSale(s: GameState, cargo: Cargo, port: string): { revenue: number; sell: Partial<Cargo> } {
  const sell: Partial<Cargo> = {};
  let revenue = 0;
  for (const g of GOODS) {
    let l = s.markets[port][g];
    let n = 0;
    while (n < cargo[g] && TR.priceByLevel[l] > TR.buyPrice) {
      revenue += TR.priceByLevel[l];
      l = Math.max(TR.minLevel, l - 1);
      n++;
    }
    if (n > 0) sell[g] = n;
  }
  return { revenue, sell };
}
