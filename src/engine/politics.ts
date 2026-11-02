// Politik: 6 Nationenpaare, je Krieg oder Frieden; Politikkarte beim Weltjahreswechsel.
import { BALANCE } from '../config/balance';
import { pick } from './rng';
import type { GameState, Nation } from './types';
import { NATIONS } from './types';
import { atWar, log, nationName, nationPairs, warKey } from './util';

export type PoliticsCard = { kind: 'calm' } | { kind: 'war' | 'peace'; a: Nation; b: Nation };

export function initialWar(): Record<string, boolean> {
  const war: Record<string, boolean> = {};
  for (const [a, b] of nationPairs()) war[warKey(a, b)] = a === 'ES' || b === 'ES';
  return war;
}

export function politicsDeck(): PoliticsCard[] {
  const P = BALANCE.politics;
  const deck: PoliticsCard[] = [];
  for (const [a, b] of nationPairs()) {
    for (let i = 0; i < P.warCardsPerPair; i++) deck.push({ kind: 'war', a, b });
    for (let i = 0; i < P.peaceCardsPerPair; i++) deck.push({ kind: 'peace', a, b });
  }
  for (let i = 0; i < P.calmCards; i++) deck.push({ kind: 'calm' });
  return deck;
}

// ANNAHME: Jedes Jahr wird aus dem vollständigen Stapel gezogen (mit Zurücklegen).
export function drawPolitics(s: GameState): PoliticsCard {
  const card = pick(s, politicsDeck());
  applyPolitics(s, card);
  return card;
}

export function applyPolitics(s: GameState, card: PoliticsCard): void {
  if (card.kind === 'calm') {
    log(s, 'Politik: Die Lage bleibt ruhig.', 'world', null);
    return;
  }
  const key = warKey(card.a, card.b);
  const wantWar = card.kind === 'war';
  const names = `${nationName(card.a)} und ${nationName(card.b)}`;
  if (s.war[key] === wantWar) {
    log(s, `Politik: Zwischen ${names} bleibt es bei ${wantWar ? 'Krieg' : 'Frieden'}.`, 'world', null);
  } else {
    s.war[key] = wantWar;
    log(s, `Politik: ${wantWar ? 'Krieg' : 'Frieden'} zwischen ${names}!`, 'world', null);
  }
  resolveLetterConflicts(s);
}

/**
 * ANNAHME: Geraten zwei Geber eines Spielers in Krieg, behält er den Kaperbrief der Nation
 * mit der höheren Gunst (bei Gleichstand den älteren) und gibt den anderen zurück.
 */
export function resolveLetterConflicts(s: GameState): void {
  for (const p of s.players) {
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < p.letters.length; i++) {
        for (let j = i + 1; j < p.letters.length; j++) {
          const a = p.letters[i];
          const b = p.letters[j];
          if (atWar(s, a, b)) {
            const drop = p.favor[b] > p.favor[a] ? a : b;
            p.letters = p.letters.filter((l) => l !== drop);
            log(s, `${p.name} verliert den Kaperbrief von ${nationName(drop)} (Krieg zwischen den Gebern).`, 'world', p.id);
            changed = true;
            break outer;
          }
        }
      }
    }
  }
}

export function enemiesOf(s: GameState, n: Nation): Nation[] {
  return NATIONS.filter((m) => atWar(s, n, m));
}
