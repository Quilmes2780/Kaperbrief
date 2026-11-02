// Eigene, schlichte SVG-Grafiken: Flaggen, Schiffe, Piraten, Schatz, Waren.
import type { Good, Nation } from '../engine/types';

export function Flag({ nation, size = 18 }: { nation: Nation; size?: number }) {
  const w = size * 1.5;
  const h = size;
  return (
    <svg width={w} height={h} viewBox="0 0 30 20" className="flag" aria-label={nation}>
      {nation === 'ES' && (
        <>
          <rect width="30" height="20" fill="#f3e3a0" />
          <path d="M4 3 L26 17 M26 3 L4 17" stroke="#b32626" strokeWidth="2.6" />
        </>
      )}
      {nation === 'EN' && (
        <>
          <rect width="30" height="20" fill="#f7f4ec" />
          <rect x="12.5" width="5" height="20" fill="#b8312f" />
          <rect y="7.5" width="30" height="5" fill="#b8312f" />
        </>
      )}
      {nation === 'FR' && (
        <>
          <rect width="30" height="20" fill="#2f5fb8" />
          <circle cx="15" cy="10" r="4" fill="#f2d16b" />
        </>
      )}
      {nation === 'NL' && (
        <>
          <rect width="30" height="7" fill="#e07b1f" />
          <rect y="7" width="30" height="6" fill="#f7f4ec" />
          <rect y="13" width="30" height="7" fill="#2a4f9a" />
        </>
      )}
      <rect width="30" height="20" fill="none" stroke="#3b2f22" strokeWidth="1" />
    </svg>
  );
}

/** Schiffssymbol als SVG-Gruppe für die Karte (Ursprung = Mitte). */
export function ShipGlyph({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path d="M-11 2 L11 2 L7 8 L-7 8 Z" fill={color} stroke="#2b2116" strokeWidth="1.2" />
      <line x1="0" y1="2" x2="0" y2="-13" stroke="#2b2116" strokeWidth="1.4" />
      <path d="M1 -12 L9 -2 L1 -2 Z" fill="#f7f1e1" stroke="#2b2116" strokeWidth="0.9" />
      <path d="M-1 -11 L-8 -1 L-1 -1 Z" fill="#efe6cf" stroke="#2b2116" strokeWidth="0.9" />
    </g>
  );
}

export function PirateGlyph() {
  return (
    <g>
      <line x1="-6" y1="10" x2="-6" y2="-12" stroke="#1b1b1b" strokeWidth="1.6" />
      <path d="M-6 -12 L10 -8 L-6 -2 Z" fill="#1b1b1b" />
      <circle cx="0" cy="-7.2" r="2" fill="#f1ece0" />
      <path d="M-3 -3.5 L3 -3.5" stroke="#f1ece0" strokeWidth="1" />
    </g>
  );
}

export function TreasureGlyph() {
  return (
    <g>
      <path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke="#a3271f" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

const GOOD_COLORS: Record<Good, string> = {
  Zucker: '#f4f1ea',
  Tabak: '#8a5a2b',
  Rum: '#b5651d',
  Kakao: '#5a3a22',
};

export function GoodIcon({ good, size = 14 }: { good: Good; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="good-icon" aria-label={good}>
      {good === 'Zucker' && <rect x="2" y="4" width="12" height="9" rx="1" fill={GOOD_COLORS.Zucker} stroke="#6b5b45" />}
      {good === 'Tabak' && <path d="M3 13 Q8 1 13 13 Z" fill={GOOD_COLORS.Tabak} stroke="#3b2a17" />}
      {good === 'Rum' && (
        <>
          <ellipse cx="8" cy="8.5" rx="5" ry="6" fill={GOOD_COLORS.Rum} stroke="#3b2a17" />
          <line x1="3" y1="6" x2="13" y2="6" stroke="#3b2a17" />
          <line x1="3" y1="11" x2="13" y2="11" stroke="#3b2a17" />
        </>
      )}
      {good === 'Kakao' && <ellipse cx="8" cy="8" rx="4" ry="6.5" fill={GOOD_COLORS.Kakao} stroke="#24170d" />}
    </svg>
  );
}
