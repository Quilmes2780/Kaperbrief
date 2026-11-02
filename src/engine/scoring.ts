// Wertung: 1 Punkt je 5 Gold Vermögen (Kasse halb), Titel, Schätze, Piraten, Lebensziel, große Schiffe.
import { BALANCE } from '../config/balance';
import type { GameState, PlayerState, ScoreBreakdown } from './types';
import { NATIONS } from './types';
import { titleRank } from './governor';

const SC = BALANCE.scoring;

export function goldPoints(p: PlayerState): number {
  // ANNAHME: Vermögen und halbe Kasse werden addiert und dann abgerundet durch 5 geteilt.
  return Math.floor((p.wealth + p.purse * SC.purseFactor) / SC.goldPerPoint);
}

/** Je Nation zählt der höchste Titel. */
export function titlePoints(p: PlayerState): number {
  let sum = 0;
  for (const n of NATIONS) {
    const t = p.titles[n];
    if (t) sum += BALANCE.titles[t].points;
  }
  return sum;
}

export function lifeGoalMet(p: PlayerState): boolean {
  const L = BALANCE.lifeGoals;
  const titlesAtLeast = (rank: number) => NATIONS.filter((n) => titleRank(p.titles[n]) >= rank).length;
  switch (p.lifeGoal) {
    case 'reichtum':
      return p.wealth >= L.wealth;
    case 'adel':
      return titlesAtLeast(2) >= 1;
    case 'zwei_kronen':
      return titlesAtLeast(1) >= 2;
    case 'schatzjaeger':
      return p.treasures.length >= 2;
    case 'piratenjaeger':
      return p.pirates.length >= 2;
    case 'kaperkapitaen':
      return p.stats.prizes + p.stats.sunk >= L.prizes;
    case 'handelsherr':
      return p.stats.goodsSold >= L.goodsSold;
    default:
      return false;
  }
}

export function scorePlayer(p: PlayerState): ScoreBreakdown {
  const b = {
    player: p.id,
    gold: goldPoints(p),
    titles: titlePoints(p),
    treasures: p.treasures.length * SC.treasure,
    pirates: p.pirates.length * SC.pirate,
    lifeGoal: lifeGoalMet(p) ? SC.lifeGoal : 0,
    ships: SC.bigShips.includes(p.ship) ? SC.bigShip : 0,
    total: 0,
  };
  b.total = b.gold + b.titles + b.treasures + b.pirates + b.lifeGoal + b.ships;
  return b;
}

export function finalScores(s: GameState): ScoreBreakdown[] {
  return s.players.map(scorePlayer).sort((a, b) => b.total - a.total);
}

export function winners(s: GameState): number[] {
  const scores = s.scores ?? finalScores(s);
  const top = Math.max(...scores.map((x) => x.total));
  return scores.filter((x) => x.total === top).map((x) => x.player);
}
