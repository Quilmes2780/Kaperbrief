import { PERSONALITY_NAMES, TITLE_NAMES } from '../config/cards';
import { NATION_NAMES, PORTS, SEAS } from '../config/map';
import type { Nation, PlayerState } from '../engine/types';

export function locName(loc: string): string {
  return PORTS[loc]?.name ?? SEAS[loc]?.name ?? loc;
}

export function nationName(n: Nation): string {
  return NATION_NAMES[n];
}

export function titleName(t: string | null): string {
  return t ? TITLE_NAMES[t] : '–';
}

export function playerKind(p: PlayerState): string {
  return p.kind === 'ai' ? `KI · ${PERSONALITY_NAMES[p.personality ?? 'Haendler']}` : 'Mensch';
}

export function seasons(n: number): string {
  return `${n} Jahreszeit${n === 1 ? '' : 'en'}`;
}
