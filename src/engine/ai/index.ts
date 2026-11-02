import { applyAction } from '../reducer';
import type { GameState } from '../types';
import { chooseAction } from './heuristic';

export { chooseAction, candidates } from './heuristic';

/** Führt genau eine KI-Entscheidung (Hauptaktion oder Teilschritt) für den aktiven Spieler aus. */
export function aiStep(s: GameState): GameState {
  const d = chooseAction(s);
  return applyAction(s, d.action, d.note || undefined);
}

/** Spielt eine Partie vollständig mit KI-Spielern aus (für Tests und Simulation). */
export function playOut(s: GameState, maxSteps = 20000): GameState {
  let cur = s;
  for (let i = 0; i < maxSteps && !cur.gameOver; i++) cur = aiStep(cur);
  if (!cur.gameOver) throw new Error('Partie endet nicht');
  return cur;
}
