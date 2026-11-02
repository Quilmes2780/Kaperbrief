// Hafenaktionen: Prüfung, Zeitkosten und Ausführung.
import { BALANCE } from '../config/balance';
import { startRaid } from './combat';
import { doTavern, shareLoot, validateTavern } from './crew';
import { doGovernor, validateGovernor } from './governor';
import { doShipyard, validateShipyard } from './shipyard';
import { advanceTime } from './time';
import { doTrade, validateTrade } from './trade';
import type { GameState, PlayerState, PortAction, PortActionType } from './types';
import { halfCost, isHostilePort, isPort } from './util';

export function portActionCost(type: PortActionType, half: boolean): number {
  const c = BALANCE.actionCost[type];
  return half ? halfCost(c) : c;
}

export function validatePortAction(s: GameState, p: PlayerState, a: PortAction): string | null {
  const port = p.location;
  if (!isPort(port)) return 'Nur im Hafen möglich';
  if (a.type !== 'RAID' && isHostilePort(s, p, port)) return 'Feindlicher Hafen – nur ein Überfall ist möglich';
  switch (a.type) {
    case 'TRADE':
      return validateTrade(s, p, port, a);
    case 'GOVERNOR':
      return validateGovernor(s, p, port, a);
    case 'TAVERN':
      return validateTavern(s, p, a);
    case 'SHIPYARD':
      return validateShipyard(s, p, a);
    case 'RAID':
      return null;
    case 'SHARE_LOOT':
      return null;
  }
}

export function performPortAction(s: GameState, p: PlayerState, a: PortAction, half: boolean): void {
  const port = p.location;
  advanceTime(s, p, portActionCost(a.type, half));
  switch (a.type) {
    case 'TRADE':
      return doTrade(s, p, port, a);
    case 'GOVERNOR':
      return doGovernor(s, p, port, a);
    case 'TAVERN':
      return doTavern(s, p, a);
    case 'SHIPYARD':
      return doShipyard(s, p, a);
    case 'RAID':
      return startRaid(s, p, port);
    case 'SHARE_LOOT':
      return shareLoot(s, p);
  }
}
