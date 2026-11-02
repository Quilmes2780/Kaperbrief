// Übersicht der verfügbaren Aktionen für die Oberfläche.
import { BALANCE } from '../config/balance';
import { TREASURES } from '../config/cards';
import { fragmentsLeft } from './treasure';
import { repairCost } from './shipyard';
import { eligibleTitle, letterProblem } from './governor';
import { validate } from './reducer';
import type { Action, GameState, PortActionType } from './types';
import { retireTime, activePlayer, isHostilePort, isPort } from './util';

export interface ActionOption {
  type: PortActionType | 'SAIL' | 'DIG' | 'RETIRE';
  label: string;
  cost: number;
  available: boolean;
  reason?: string;
}

export const ACTION_LABELS: Record<ActionOption['type'], string> = {
  SAIL: 'Segeln',
  TRADE: 'Handeln',
  GOVERNOR: 'Gouverneur',
  TAVERN: 'Taverne',
  SHIPYARD: 'Werft',
  RAID: 'Hafen überfallen',
  DIG: 'Schatz heben',
  SHARE_LOOT: 'Beute teilen',
  RETIRE: 'Ruhestand',
};

export function actionOptions(s: GameState): ActionOption[] {
  const p = activePlayer(s);
  const C = BALANCE.actionCost;
  const inPort = isPort(p.location);
  const hostile = inPort && isHostilePort(s, p, p.location);
  const opt = (type: ActionOption['type'], cost: number, reason: string | null): ActionOption => ({
    type,
    label: ACTION_LABELS[type],
    cost,
    available: reason === null,
    reason: reason ?? undefined,
  });
  const portReason = !inPort ? 'Nur im Hafen' : hostile ? 'Feindlicher Hafen' : null;
  const n = inPort ? s.portOwner[p.location] : null;
  const govUseful =
    n !== null &&
    (eligibleTitle(s, p, n) !== p.titles[n] ||
      letterProblem(s, p, n) === null ||
      p.purse >= BALANCE.favor.giftCost ||
      s.contracts.some((c) => c.nation === n && c.kind === 'deliver' && p.cargo[c.good!] >= c.qty!));
  const digTarget = TREASURES.find((t) => validate(s, { type: 'DIG', treasure: t.id }) === null);
  return [
    opt('SAIL', C.SAIL_LEG, null),
    opt('TRADE', C.TRADE, portReason),
    opt('GOVERNOR', C.GOVERNOR, portReason ?? (govUseful ? null : 'Nichts zu erledigen')),
    opt(
      'TAVERN',
      C.TAVERN,
      portReason ?? (p.purse < 1 || (p.crew >= BALANCE.ships[p.ship].crewMax && fragmentsLeft(s) === 0) ? 'Nichts zu erledigen' : null),
    ),
    opt('SHIPYARD', C.SHIPYARD, portReason ?? (repairCost(p) === 0 && p.purse < 1 ? 'Nichts zu erledigen' : null)),
    opt('RAID', C.RAID, inPort ? null : 'Nur im Hafen'),
    opt('SHARE_LOOT', C.SHARE_LOOT, portReason),
    opt('DIG', C.DIG, digTarget ? null : 'Kein hebbarer Schatz hier'),
    opt('RETIRE', C.RETIRE, p.time >= retireTime() ? null : `Erst ab ${BALANCE.time.retireMinAge}`),
  ];
}

export function tryValidate(s: GameState, a: Action): string | null {
  try {
    return validate(s, a);
  } catch (e) {
    return (e as Error).message;
  }
}
