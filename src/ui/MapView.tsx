import { TREASURES } from '../config/cards';
import { NATION_COLORS, PORTS, SEAS, SEA_LINKS } from '../config/map';
import { areasFor } from '../engine/sailing';
import type { GameState } from '../engine/types';
import { isPort } from '../engine/util';
import { PirateGlyph, ShipGlyph, TreasureGlyph } from './icons';

const LAND = [
  // Mexiko / Mittelamerika
  'M0 0 L250 0 L262 40 L190 70 L110 120 L70 190 L58 260 L70 330 L120 390 L200 430 L265 470 L300 520 L280 560 L0 560 Z',
  // Südamerika-Küste
  'M280 560 L330 575 L420 615 L520 625 L640 600 L760 612 L860 632 L1000 640 L1000 660 L0 660 L0 560 Z',
  // Florida
  'M300 0 L392 0 L402 55 L388 108 L366 96 L338 46 Z',
  // Kuba
  'M232 172 L320 158 L420 172 L520 192 L566 210 L522 222 L430 206 L330 196 L244 192 Z',
  // Hispaniola
  'M592 196 L662 188 L704 204 L694 238 L622 244 L586 226 Z',
];

const SMALL_ISLANDS: [number, number, number, number][] = [
  [470, 282, 34, 9], // Jamaika
  [770, 214, 30, 8], // Puerto Rico
  [486, 72, 12, 5],
  [520, 100, 14, 5],
  [555, 122, 10, 4],
  [600, 160, 12, 5], // Tortuga
  [838, 150, 6, 4],
  [892, 128, 6, 4],
  [945, 178, 7, 5],
  [855, 300, 9, 6],
  [930, 330, 6, 8],
  [978, 425, 6, 6],
  [620, 545, 16, 6], // Curaçao
];

interface Props {
  s: GameState;
  selected: string | null;
  onSelect?: (loc: string) => void;
}

export function MapView({ s, selected, onSelect }: Props) {
  const active = s.players.find((p) => p.id === s.active)!;
  const route = selected ? areasFor(active.location, selected) : null;
  const routeSet = new Set(route ?? []);

  const shipPos = (loc: string, idx: number, count: number) => {
    const base = isPort(loc) ? PORTS[loc] : SEAS[loc];
    const spread = (idx - (count - 1) / 2) * 18;
    return isPort(loc) ? { x: base.x + spread, y: base.y - 20 } : { x: base.x + spread, y: base.y - 6 };
  };

  const byLoc: Record<string, number[]> = {};
  for (const p of s.players) (byLoc[p.location] ??= []).push(p.id);

  return (
    <svg className="map" viewBox="0 0 1000 660" role="img" aria-label="Karte der Karibik">
      <defs>
        <pattern id="waves" width="40" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 10 Q10 4 20 10 T40 10" fill="none" stroke="var(--sea-line)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1000" height="660" fill="var(--sea)" />
      <rect width="1000" height="660" fill="url(#waves)" opacity="0.5" />
      {LAND.map((d, i) => (
        <path key={i} d={d} fill="var(--land)" stroke="var(--land-edge)" strokeWidth="2" />
      ))}
      {SMALL_ISLANDS.map(([x, y, rx, ry], i) => (
        <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="var(--land)" stroke="var(--land-edge)" strokeWidth="1.5" />
      ))}

      {SEA_LINKS.map(([a, b]) => {
        const on = routeSet.has(a) && routeSet.has(b);
        return (
          <line
            key={a + b}
            x1={SEAS[a].x}
            y1={SEAS[a].y}
            x2={SEAS[b].x}
            y2={SEAS[b].y}
            className={on ? 'link link-on' : 'link'}
          />
        );
      })}

      {Object.entries(SEAS).map(([id, sea]) => (
        <g key={id} className={`sea-node ${routeSet.has(id) ? 'on-route' : ''} ${selected === id ? 'selected' : ''}`} onClick={() => onSelect?.(id)}>
          <circle cx={sea.x} cy={sea.y} r={24} />
          <text x={sea.x} y={sea.y + 38} textAnchor="middle" className="sea-label">
            {sea.name}
          </text>
        </g>
      ))}

      {TREASURES.map((t) =>
        s.treasuresTaken[t.id] === null ? (
          <g key={t.id} transform={`translate(${SEAS[t.sea].x + 22},${SEAS[t.sea].y + 14})`}>
            <title>{t.name}</title>
            <TreasureGlyph />
          </g>
        ) : null,
      )}

      {Object.entries(PORTS).map(([id, port]) => {
        const owner = s.portOwner[id];
        return (
          <g key={id} className={`port ${selected === id ? 'selected' : ''}`} onClick={() => onSelect?.(id)}>
            <line x1={port.x} y1={port.y} x2={SEAS[port.sea].x} y2={SEAS[port.sea].y} className="port-link" />
            <rect x={port.x - 8} y={port.y - 8} width={16} height={16} rx={3} fill={NATION_COLORS[owner]} stroke="#2b2116" strokeWidth="1.5" />
            {owner !== port.nation && <circle cx={port.x + 9} cy={port.y - 9} r={4} fill="#fff" stroke="#2b2116" />}
            <text x={port.x} y={port.y + 22} textAnchor="middle" className="port-label">
              {port.name}
            </text>
          </g>
        );
      })}

      {s.pirates.map((pr) => (
        <g key={pr.id} transform={`translate(${SEAS[pr.sea].x - 26},${SEAS[pr.sea].y + 4})`}>
          <title>
            {pr.name} – Kopfgeld {pr.bounty} Gold
          </title>
          <PirateGlyph />
        </g>
      ))}

      {s.players.map((p) => {
        const list = byLoc[p.location];
        const pos = shipPos(p.location, list.indexOf(p.id), list.length);
        return (
          <g key={p.id} className={`ship ${p.id === s.active ? 'ship-active' : ''} ${p.retired ? 'ship-retired' : ''}`} style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
            <title>{p.name}</title>
            <ShipGlyph color={p.color} scale={1.15} />
          </g>
        );
      })}
    </svg>
  );
}
