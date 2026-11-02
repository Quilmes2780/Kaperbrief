import { BALANCE } from '../config/balance';
import type { GameState } from '../engine/types';
import { MAX_TIME, retireTime } from '../engine/util';

const T = BALANCE.time;

export function LifeTrack({ s }: { s: GameState }) {
  const years = Array.from({ length: T.endAge - T.startAge + 1 }, (_, i) => T.startAge + i);
  // Stapel: zuletzt angekommen oben
  const at = (t: number) => s.players.filter((p) => Math.min(p.time, MAX_TIME) === t).sort((a, b) => b.arrival - a.arrival);
  return (
    <div className="lifetrack" aria-label="Lebensleiste">
      <div className="lt-grid" style={{ gridTemplateColumns: `3.2em repeat(${years.length}, 1fr)` }}>
        <div />
        {years.map((y) => (
          <div key={y} className={`lt-year ${y === T.retireMinAge ? 'lt-retire' : ''}`}>
            {y}
          </div>
        ))}
        {T.seasonNames.map((name, si) => (
          <Row key={name} name={name} si={si} years={years} at={at} finish={s.finishLine} />
        ))}
      </div>
      <div className="lt-legend">
        Ruhestand ab Feld {retireTime()} ({BALANCE.time.retireMinAge} J.), Pflicht mit 45. {s.finishLine !== null && <strong>Ziellinie: {s.finishLine}</strong>}
      </div>
    </div>
  );
}

function Row({
  name,
  si,
  years,
  at,
  finish,
}: {
  name: string;
  si: number;
  years: number[];
  at: (t: number) => GameState['players'];
  finish: number | null;
}) {
  return (
    <>
      <div className="lt-season">{name.slice(0, 3)}</div>
      {years.map((y) => {
        const t = (y - T.startAge) * T.seasonsPerYear + si;
        if (t > MAX_TIME) return <div key={y} className="lt-cell lt-void" />;
        const ps = at(t);
        return (
          <div key={y} className={`lt-cell ${finish === t ? 'lt-finish' : ''} ${si === 2 ? 'lt-autumn' : ''}`} title={`Feld ${t}`}>
            {ps.map((p, i) => (
              <span key={p.id} className="lt-marker" style={{ background: p.color, zIndex: 10 - i, opacity: p.retired ? 0.45 : 1 }} title={p.name} />
            ))}
          </div>
        );
      })}
    </>
  );
}
