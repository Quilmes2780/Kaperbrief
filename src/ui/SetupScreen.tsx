import { useState } from 'react';
import { BALANCE } from '../config/balance';
import { PERSONALITY_NAMES, TALENT_NAMES } from '../config/cards';
import { talentsFor } from '../engine/setup';
import type { Nation, Personality, SeatConfig, Talent } from '../engine/types';
import { NATIONS, PERSONALITIES, TALENTS } from '../engine/types';
import { nationName } from './format';
import { Flag } from './icons';
import { PLAYER_COLORS } from '../engine/setup';

interface Seat {
  name: string;
  kind: 'human' | 'ai';
  personality: Personality;
  home: Nation | 'random';
  bonus: Record<Talent, number>;
}

const DEFAULT_NAMES = ['Anne', 'Jakob', 'Margot', 'Hendrik'];

function defaultSeat(i: number): Seat {
  return {
    name: DEFAULT_NAMES[i],
    kind: i === 0 ? 'human' : 'ai',
    personality: PERSONALITIES[(i + 2) % 3],
    home: 'random',
    bonus: { fechten: 1, navigation: 1, fuehrung: 0 },
  };
}

export function SetupScreen({ onStart, onLoad, canLoad }: { onStart: (seats: SeatConfig[], seed: number) => void; onLoad: () => void; canLoad: boolean }) {
  const [count, setCount] = useState(3);
  const [seats, setSeats] = useState<Seat[]>([0, 1, 2, 3].map(defaultSeat));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));

  const update = (i: number, patch: Partial<Seat>) => setSeats(seats.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const active = seats.slice(0, count);
  const valid = active.every((s) => s.name.trim() && (s.kind === 'ai' || talentsFor(s.bonus)));

  const start = () => {
    onStart(
      active.map((s) => ({
        name: s.name.trim(),
        kind: s.kind,
        personality: s.kind === 'ai' ? s.personality : undefined,
        home: s.home === 'random' ? undefined : s.home,
        talentBonus: s.kind === 'human' ? s.bonus : undefined,
      })),
      seed,
    );
  };

  return (
    <div className="setup">
      <h1>Kaperbrief</h1>
      <p className="subtitle">Eine Freibeuter-Karriere in der Karibik des 17. Jahrhunderts</p>
      <div className="setup-row">
        <label>
          Spieler:{' '}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[2, 3, 4].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Seed: <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="seed" />
        </label>
        <button onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}>Neu würfeln</button>
      </div>
      <div className="seats">
        {active.map((s, i) => {
          const spent = TALENTS.reduce((a, t) => a + s.bonus[t], 0);
          return (
            <div key={i} className="seat" style={{ borderColor: PLAYER_COLORS[i] }}>
              <input value={s.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Name" />
              <div className="seg">
                <button className={s.kind === 'human' ? 'on' : ''} onClick={() => update(i, { kind: 'human' })}>
                  Mensch
                </button>
                <button className={s.kind === 'ai' ? 'on' : ''} onClick={() => update(i, { kind: 'ai' })}>
                  KI
                </button>
              </div>
              {s.kind === 'ai' && (
                <label>
                  Persönlichkeit:{' '}
                  <select value={s.personality} onChange={(e) => update(i, { personality: e.target.value as Personality })}>
                    {PERSONALITIES.map((p) => (
                      <option key={p} value={p}>
                        {PERSONALITY_NAMES[p]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Heimatnation:{' '}
                <select value={s.home} onChange={(e) => update(i, { home: e.target.value as Nation | 'random' })}>
                  <option value="random">zufällig</option>
                  {NATIONS.map((n) => (
                    <option key={n} value={n}>
                      {nationName(n)}
                    </option>
                  ))}
                </select>
                {s.home !== 'random' && <Flag nation={s.home} size={12} />}
              </label>
              {s.kind === 'human' && (
                <div className="talents">
                  <div className="muted">
                    Talente: Start {BALANCE.start.talentBase}, {BALANCE.start.talentFreePoints} Punkte frei (noch {BALANCE.start.talentFreePoints - spent})
                  </div>
                  {TALENTS.map((t) => (
                    <div key={t} className="talent">
                      {TALENT_NAMES[t]}{' '}
                      <button disabled={s.bonus[t] <= 0} onClick={() => update(i, { bonus: { ...s.bonus, [t]: s.bonus[t] - 1 } })}>
                        −
                      </button>
                      <strong>{BALANCE.start.talentBase + s.bonus[t]}</strong>
                      <button
                        disabled={spent >= BALANCE.start.talentFreePoints || BALANCE.start.talentBase + s.bonus[t] >= BALANCE.start.talentMax}
                        onClick={() => update(i, { bonus: { ...s.bonus, [t]: s.bonus[t] + 1 } })}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="btn-row">
        <button className="primary big" disabled={!valid} onClick={start}>
          In See stechen
        </button>
        {canLoad && <button onClick={onLoad}>Gespeicherte Partie fortsetzen</button>}
      </div>
    </div>
  );
}
