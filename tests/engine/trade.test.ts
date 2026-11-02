import { describe, expect, it } from 'vitest';
import { PORTS, PORT_IDS } from '../../src/config/map';
import { applyAction, validate } from '../../src/engine/reducer';
import { bestSale, recoverMarkets, saleRevenue, validateTrade } from '../../src/engine/trade';
import { GOODS } from '../../src/engine/types';
import { me, newGame, noPirates } from '../helpers';

describe('Handel', () => {
  it('Preise 1/3/5 je Nachfragestufe, jeder Verkauf senkt die Stufe', () => {
    expect(saleRevenue(3, 1)).toEqual({ revenue: 5, level: 2 });
    expect(saleRevenue(3, 3)).toEqual({ revenue: 9, level: 1 });
    expect(saleRevenue(2, 2)).toEqual({ revenue: 4, level: 1 });
    expect(saleRevenue(1, 2)).toEqual({ revenue: 2, level: 1 });
  });

  it('jeder Hafen hat Nachfrage in Stufen 1–3 für alle 4 Waren', () => {
    const s = newGame();
    for (const id of PORT_IDS) for (const g of GOODS) expect([1, 2, 3]).toContain(s.markets[id][g]);
  });

  it('Verkauf über die Aktion senkt die Stufe und bringt Gold in die Kasse', () => {
    const s = newGame();
    noPirates(s);
    const p = me(s);
    p.location = 'havanna';
    s.markets.havanna.Rum = 3;
    p.cargo.Rum = 2;
    p.purse = 0;
    const r = applyAction(s, { type: 'TRADE', sell: { Rum: 2 }, buy: {} });
    expect(r.players[p.id].purse).toBe(8);
    expect(r.markets.havanna.Rum).toBe(1);
    expect(r.players[p.id].time).toBe(1);
    expect(r.players[p.id].stats.goodsSold).toBe(2);
  });

  it('Kauf nur der Erzeugerware, begrenzt durch Laderaum und Kasse', () => {
    const s = newGame();
    const p = me(s);
    p.location = 'havanna';
    expect(PORTS.havanna.produces).toBe('Tabak');
    p.purse = 10;
    expect(validateTrade(s, p, 'havanna', { type: 'TRADE', sell: {}, buy: { Rum: 1 } })).not.toBeNull();
    expect(validateTrade(s, p, 'havanna', { type: 'TRADE', sell: {}, buy: { Tabak: 3 } })).toBeNull();
    expect(validateTrade(s, p, 'havanna', { type: 'TRADE', sell: {}, buy: { Tabak: 4 } })).toMatch(/Laderaum/);
    p.purse = 2;
    expect(validateTrade(s, p, 'havanna', { type: 'TRADE', sell: {}, buy: { Tabak: 3 } })).toMatch(/Gold/);
    expect(validateTrade(s, p, 'havanna', { type: 'TRADE', sell: { Zucker: 1 }, buy: {} })).toMatch(/Nicht genug/);
    expect(validateTrade(s, p, 'havanna', { type: 'TRADE', sell: {}, buy: {} })).toMatch(/Nichts/);
  });

  it('Verkaufserlös darf direkt für den Einkauf genutzt werden', () => {
    const s = newGame();
    const p = me(s);
    p.location = 'havanna';
    p.purse = 0;
    p.cargo.Rum = 3;
    s.markets.havanna.Rum = 3;
    expect(validateTrade(s, p, 'havanna', { type: 'TRADE', sell: { Rum: 3 }, buy: { Tabak: 3 } })).toBeNull();
  });

  it('Handel nur im Hafen', () => {
    const s = newGame();
    me(s).location = 's5';
    expect(validate(s, { type: 'TRADE', sell: {}, buy: { Tabak: 1 } })).toMatch(/Hafen/);
  });

  it('Markterholung beim Weltjahreswechsel: +1 Stufe, max 3; Erzeugerware bleibt bei 1', () => {
    const s = newGame();
    s.markets.havanna.Rum = 1;
    s.markets.havanna.Zucker = 3;
    recoverMarkets(s);
    expect(s.markets.havanna.Rum).toBe(2);
    expect(s.markets.havanna.Zucker).toBe(3);
    expect(s.markets.havanna.Tabak).toBe(1);
  });

  it('bestSale verkauft nur mit Gewinn gegenüber dem Einkaufspreis', () => {
    const s = newGame();
    s.markets.havanna.Rum = 2;
    const r = bestSale(s, { Rum: 3, Zucker: 0, Tabak: 0, Kakao: 0 }, 'havanna');
    expect(r.revenue).toBe(3);
    expect(r.sell.Rum).toBe(1);
  });
});
