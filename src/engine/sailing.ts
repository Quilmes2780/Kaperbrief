// Segeln: Wegsuche im Seegebiets-Graphen, Etappen, Moral, Begegnungen, Stürme, Schiffbruch.
import { BALANCE } from '../config/balance';
import { PORTS, PORT_IDS, SEAS, SEA_LINKS } from '../config/map';
import { startCombat } from './combat';
import { loseMorale } from './crew';
import { drawEncounter, drawStorm } from './encounters';
import { pirateAt } from './pirates';
import { performPortAction, validatePortAction } from './portActions';
import { advanceTime } from './time';
import type { Enemy, GameState, LocId, PlayerState, PortAction } from './types';
import { GOODS } from './types';
import { isPort, log, seaOf, seasonOf, speedOf } from './util';

const ADJ: Record<string, string[]> = (() => {
  const a: Record<string, string[]> = {};
  for (const id of Object.keys(SEAS)) a[id] = [];
  for (const [x, y] of SEA_LINKS) {
    a[x].push(y);
    a[y].push(x);
  }
  for (const id of Object.keys(a)) a[id].sort((m, n) => Number(m.slice(1)) - Number(n.slice(1)));
  return a;
})();

export function neighbors(sea: string): string[] {
  return ADJ[sea] ?? [];
}

/** Kürzester Weg zwischen zwei Seegebieten (ohne Start, mit Ziel). */
export function seaPath(from: string, to: string): string[] {
  if (from === to) return [];
  const prev: Record<string, string | null> = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      if (n in prev) continue;
      prev[n] = cur;
      if (n === to) {
        const path = [n];
        let c = cur;
        while (c !== from) {
          path.unshift(c);
          c = prev[c]!;
        }
        return path;
      }
      queue.push(n);
    }
  }
  return [];
}

export function seaDistance(from: string, to: string): number {
  return seaPath(from, to).length;
}

/**
 * Durchfahrene Seegebiete von `from` nach `to`.
 * ANNAHME: Aus einem Hafen zählt das eigene Seegebiet als erstes Feld; das Einlaufen in einen Hafen ist frei,
 * jede Fahrt umfasst aber mindestens ein Seegebiet.
 */
export function areasFor(from: LocId, to: LocId): string[] | null {
  if (from === to) return null;
  if (!isPort(to) && !(to in SEAS)) return null;
  const a = seaOf(from);
  const b = seaOf(to);
  if (isPort(from)) return [a, ...seaPath(a, b)];
  if (a === b) return isPort(to) ? [a] : null;
  return seaPath(a, b);
}

export function planLegs(p: PlayerState, to: LocId): string[][] | null {
  const areas = areasFor(p.location, to);
  if (!areas || areas.length === 0) return null;
  const sp = speedOf(p);
  const legs: string[][] = [];
  for (let i = 0; i < areas.length; i += sp) legs.push(areas.slice(i, i + sp));
  return legs;
}

export function nearestPort(sea: string): string {
  let best = PORT_IDS[0];
  let bestD = Infinity;
  for (const id of PORT_IDS) {
    const d = seaDistance(sea, PORTS[id].sea);
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

// ANNAHME: Schiffbruch – Ladung verloren, halbe Kasse verloren, man wird mit einer Schaluppe im nächsten Hafen abgesetzt.
export function shipwreck(s: GameState, p: PlayerState): void {
  const W = BALANCE.shipwreck;
  const port = nearestPort(seaOf(p.location));
  for (const g of GOODS) p.cargo[g] = 0;
  p.purse = Math.floor(p.purse * W.purseFactor);
  p.ship = 'Schaluppe';
  p.hull = BALANCE.ships.Schaluppe.hull;
  p.crew = Math.min(p.crew, BALANCE.ships.Schaluppe.crewMax);
  p.location = port;
  p.stats.shipwrecks++;
  s.pending = null;
  s.voyage = null;
  log(s, `SCHIFFBRUCH! ${p.name} rettet sich mit einer Schaluppe nach ${PORTS[port].name}.`, 'combat', p.id);
  advanceTime(s, p, W.extraTime);
}

export function startVoyage(s: GameState, p: PlayerState, to: LocId, then: PortAction | null): void {
  const legs = planLegs(p, to)!;
  const name = isPort(to) ? PORTS[to].name : SEAS[to].name;
  log(s, `${p.name} segelt nach ${name} (${legs.length} Etappe${legs.length > 1 ? 'n' : ''}).`);
  s.voyage = { legs, destination: to, then };
}

/** Fährt die Reise Etappe für Etappe ab, bis sie endet oder eine Entscheidung ansteht. */
export function continueVoyage(s: GameState, p: PlayerState): void {
  while (s.voyage && !s.pending) {
    const v = s.voyage;
    const leg = v.legs.shift();
    if (!leg) {
      arrive(s, p);
      return;
    }
    const autumn = seasonOf(p.time) === 2;
    p.location = leg[leg.length - 1];
    advanceTime(s, p, BALANCE.actionCost.SAIL_LEG);
    loseMorale(s, p, BALANCE.morale.perLeg);
    if (autumn) {
      drawStorm(s, p);
      if (!s.voyage) return; // Schiffbruch
    }
    const pr = pirateAt(s, p.location);
    if (pr) {
      // ANNAHME: Ein berüchtigter Pirat im Zielgebiet einer Etappe greift immer an.
      const enemy: Enemy = {
        name: pr.name,
        type: 'notorious',
        nation: null,
        hull: pr.hull,
        hullMax: pr.hullMax,
        cannons: pr.cannons,
        crew: pr.crew,
        gold: pr.gold,
        cargo: {},
        pirateId: pr.id,
      };
      startCombat(s, p, enemy, { context: 'sea', playerInitiated: false });
    } else {
      // ANNAHME: Jede Etappe führt über offene See und zieht daher eine Begegnungskarte.
      drawEncounter(s, p);
    }
  }
}

function arrive(s: GameState, p: PlayerState): void {
  const v = s.voyage!;
  s.voyage = null;
  p.location = v.destination;
  if (isPort(v.destination)) log(s, `${p.name} läuft in ${PORTS[v.destination].name} ein.`);
  if (v.then) {
    const err = validatePortAction(s, p, v.then);
    if (err) log(s, `Geplante Hafenaktion entfällt: ${err}.`);
    else performPortAction(s, p, v.then, true);
  }
}
