import { BALANCE } from '../config/balance';
import { LIFE_GOALS, TALENT_NAMES, TREASURES } from '../config/cards';
import { scorePlayer } from '../engine/scoring';
import type { GameState, PlayerState } from '../engine/types';
import { GOODS, NATIONS, TALENTS } from '../engine/types';
import { timeLabel } from '../engine/util';
import { locName, playerKind, titleName } from './format';
import { Flag, GoodIcon } from './icons';

export function PlayerBoard({ s, p }: { s: GameState; p: PlayerState }) {
  const st = BALANCE.ships[p.ship];
  const score = scorePlayer(p);
  const goal = LIFE_GOALS.find((g) => g.id === p.lifeGoal);
  return (
    <section className={`board ${p.id === s.active && !s.gameOver ? 'board-active' : ''}`} style={{ borderColor: p.color }}>
      <header>
        <span className="dot" style={{ background: p.color }} />
        <strong>{p.name}</strong>
        <span className="muted">{playerKind(p)}</span>
        <span className="score" title="aktueller Punktestand">
          {score.total} P.
        </span>
      </header>
      <div className="board-row">
        <span>{p.retired ? `Ruhestand (Feld ${p.retiredAt})` : timeLabel(p.time)}</span>
        <span>· {locName(p.location)}</span>
      </div>
      <div className="board-row">
        <strong>{p.ship}</strong>
        <span title="Rumpf">Rumpf {p.hull}/{st.hull}</span>
        <span title="Mannschaft">Crew {p.crew}/{st.crewMax}</span>
        <span title="Moral" className={p.morale <= 1 ? 'warn' : ''}>
          Moral {p.morale}
        </span>
      </div>
      <div className="board-row">
        <span title="Schiffskasse">Kasse {p.purse}</span>
        <span title="Vermögen">Vermögen {p.wealth}</span>
        <span className="cargo">
          {GOODS.map((g) =>
            p.cargo[g] > 0 ? (
              <span key={g} title={g}>
                <GoodIcon good={g} />
                {p.cargo[g]}
              </span>
            ) : null,
          )}
          <span className="muted">
            ({GOODS.reduce((a, g) => a + p.cargo[g], 0)}/{st.hold})
          </span>
        </span>
      </div>
      <div className="board-row">
        {TALENTS.map((t) => (
          <span key={t}>
            {TALENT_NAMES[t]} {p.talents[t]}
          </span>
        ))}
      </div>
      <table className="favor">
        <tbody>
          {NATIONS.map((n) => (
            <tr key={n}>
              <td>
                <Flag nation={n} size={12} />
              </td>
              <td className="favor-bar">
                <span style={{ width: `${p.favor[n] * 10}%` }} />
              </td>
              <td className="num">{p.favor[n]}</td>
              <td>{titleName(p.titles[n])}</td>
              <td>{p.letters.includes(n) ? <span className="badge" title="Kaperbrief">Brief</span> : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="board-row small">
        {TREASURES.map((t) =>
          (p.fragments[t.id] ?? 0) > 0 ? (
            <span key={t.id} title={t.name}>
              Fragm. {t.id}: {p.fragments[t.id]}/4
            </span>
          ) : null,
        )}
        {p.treasures.length > 0 && <span>Schätze: {p.treasures.join(', ')}</span>}
        {p.pirates.length > 0 && <span>Piraten: {p.pirates.length}</span>}
      </div>
      {goal && (
        <div className="board-row small goal" title={goal.text}>
          Lebensziel: <strong>{goal.name}</strong> – {goal.text}
        </div>
      )}
    </section>
  );
}
