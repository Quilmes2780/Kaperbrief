// Werft: Reparieren und Schiffe kaufen.
import { BALANCE } from '../config/balance';
import { PORTS } from '../config/map';
import type { GameState, PlayerState, PortAction, ShipType } from './types';
import { cargoCount, log, shipStats } from './util';

type ShipyardAction = Extract<PortAction, { type: 'SHIPYARD' }>;

export function repairCost(p: PlayerState): number {
  return (shipStats(p).hull - p.hull) * BALANCE.shipyard.repairCostPerPoint;
}

// ANNAHME: Das alte Schiff wird zum halben Listenpreis angerechnet; das neue ist voll repariert.
export function shipNetPrice(p: PlayerState, type: ShipType): number {
  const tradeIn = Math.floor(BALANCE.ships[p.ship].price * BALANCE.shipyard.tradeInFactor);
  return BALANCE.ships[type].price - tradeIn;
}

export function validateShipyard(_s: GameState, p: PlayerState, a: ShipyardAction): string | null {
  if (!a.repair && !a.buyShip) return 'Nichts zu tun in der Werft';
  if (a.buyShip) {
    if (!(a.buyShip in BALANCE.ships)) return 'Unbekannter Schiffstyp';
    if (a.buyShip === p.ship) return 'Dieses Schiff besitzt du bereits';
    const st = BALANCE.ships[a.buyShip];
    if (cargoCount(p.cargo) > st.hold) return 'Ladung passt nicht in das neue Schiff';
    if (shipNetPrice(p, a.buyShip) > p.purse) return 'Nicht genug Gold';
    return null;
  }
  if (repairCost(p) === 0) return 'Das Schiff ist unbeschädigt';
  if (repairCost(p) > p.purse) return 'Nicht genug Gold für die Reparatur';
  return null;
}

export function doShipyard(s: GameState, p: PlayerState, a: ShipyardAction): void {
  const where = PORTS[p.location].name;
  if (a.buyShip) {
    const price = shipNetPrice(p, a.buyShip);
    const old = p.ship;
    p.purse -= price;
    p.ship = a.buyShip;
    const st = BALANCE.ships[a.buyShip];
    p.hull = st.hull;
    p.crew = Math.min(p.crew, st.crewMax);
    log(s, `${p.name} tauscht in ${where} die ${old} gegen eine ${a.buyShip} (${price} Gold).`);
    return;
  }
  const cost = repairCost(p);
  p.purse -= cost;
  p.hull = shipStats(p).hull;
  log(s, `${p.name} lässt das Schiff in ${where} für ${cost} Gold reparieren.`);
}
