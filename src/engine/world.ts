// Weltjahreswechsel: Politikkarte, Markterholung, Piraten ziehen, Aufträge auffüllen.
import { refillContracts } from './contracts';
import { movePirates } from './pirates';
import { drawPolitics } from './politics';
import { recoverMarkets } from './trade';
import type { GameState } from './types';
import { log } from './util';

export function worldYearChange(s: GameState): void {
  log(s, `— Weltjahreswechsel (Jahr ${s.worldYear + 1}) —`, 'world', null);
  drawPolitics(s);
  recoverMarkets(s);
  movePirates(s);
  refillContracts(s);
}
