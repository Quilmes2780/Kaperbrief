import { BALANCE } from '../config/balance';
import { isAttackLegal } from '../engine/combat';
import type { Action, Combat, Enemy, GameState, PlayerState, Report } from '../engine/types';
import { CHOICES, GOODS, HEIGHTS } from '../engine/types';
import { shipStats } from '../engine/util';
import { nationName } from './format';

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="hbar">
      <span style={{ width: `${Math.max(0, (value / max) * 100)}%`, background: color }} />
      <em>
        {Math.max(0, value)}/{max}
      </em>
    </span>
  );
}

function Sides({ p, e }: { p: PlayerState; e: Enemy }) {
  const st = shipStats(p);
  return (
    <div className="sides">
      <div>
        <h4>{p.name}</h4>
        <div>{p.ship}</div>
        <div>
          Rumpf <Bar value={p.hull} max={st.hull} color="#2f9e44" />
        </div>
        <div>
          Kanonen {st.cannons} · Crew {p.crew} · Fechten {p.talents.fechten}
        </div>
      </div>
      <div className="vs">gegen</div>
      <div>
        <h4>{e.name}</h4>
        <div>{e.nation ? nationName(e.nation) : 'ohne Flagge'}</div>
        <div>
          Rumpf <Bar value={e.hull} max={e.hullMax} color="#c92a2a" />
        </div>
        <div>
          Kanonen {e.cannons} · Crew {e.crew}
        </div>
      </div>
    </div>
  );
}

export function EncounterDialog({ s, p, enemy, onAction }: { s: GameState; p: PlayerState; enemy: Enemy; onAction: (a: Action) => void }) {
  const legal = isAttackLegal(s, p, enemy);
  const cargo = GOODS.filter((g) => (enemy.cargo[g] ?? 0) > 0)
    .map((g) => `${enemy.cargo[g]} ${g}`)
    .join(', ');
  return (
    <Modal title="Begegnung auf See">
      <p>{s.pending?.kind === 'encounter' ? s.pending.text : ''}</p>
      <Sides p={p} e={enemy} />
      <p className="muted">Mögliche Beute: {cargo || 'keine Ladung'}, Gold unbekannt.</p>
      {legal ? (
        <p>Dein Kaperbrief deckt den Angriff.</p>
      ) : (
        <p className="err">
          Kein gültiger Kaperbrief gegen {enemy.nation ? nationName(enemy.nation) : '–'}: ein Angriff kostet {BALANCE.favor.illegalAttackPenalty} Gunst.
        </p>
      )}
      <div className="btn-row">
        <button className="primary" onClick={() => onAction({ type: 'ENCOUNTER', attack: true })}>
          Angreifen
        </button>
        <button onClick={() => onAction({ type: 'ENCOUNTER', attack: false })}>Vorbeiziehen</button>
      </div>
    </Modal>
  );
}

const TYPE_HINT: Record<string, string> = {
  Breitseite: 'schlägt Entern',
  Entern: 'schlägt Ausweichen',
  Ausweichen: 'schlägt Breitseite',
};

function tendency(c: Combat): string {
  const t = BALANCE.combat.npcTables[c.enemy.type];
  return CHOICES.map((ch) => `${ch} ${t.filter((x) => x === ch).length}/6`).join(' · ');
}

export function CombatDialog({ p, combat, onAction }: { p: PlayerState; combat: Combat; onAction: (a: Action) => void }) {
  return (
    <Modal title={`Seegefecht – Runde ${combat.round} von ${BALANCE.combat.maxRounds}`}>
      <Sides p={p} e={combat.enemy} />
      <p className="muted">Erfahrungsgemäß wählt dieser Gegner: {tendency(combat)}</p>
      <RoundList combat={combat} />
      <div className="btn-row">
        {CHOICES.map((ch) => (
          <button key={ch} className="primary" onClick={() => onAction({ type: 'COMBAT', choice: ch })}>
            {ch}
            <small>{TYPE_HINT[ch]}</small>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function RoundList({ combat }: { combat: { rounds: Combat['rounds'] } }) {
  if (combat.rounds.length === 0) return null;
  return (
    <ol className="rounds">
      {combat.rounds.map((r) => (
        <li key={r.round}>
          <strong>{r.player}</strong> gegen <strong>{r.npc}</strong> <span className="die">W6 {r.die}</span> – {r.text}
        </li>
      ))}
    </ol>
  );
}

export function DuelDialog({ p, duel, onAction }: { p: PlayerState; duel: Extract<GameState['pending'], { kind: 'duel' }>['duel']; onAction: (a: Action) => void }) {
  const N = BALANCE.combat.duel.planks;
  return (
    <Modal title={duel.defending ? 'Abwehr an Deck – Fechtduell' : 'Entern! – Fechtduell'}>
      <p>
        Triffst du die Höhe, die der Gegner nicht pariert, rückst du vor. Wird pariert, hältst du mit W6 ≤ Fechten ({p.talents.fechten}) stand, sonst
        wirst du zurückgedrängt. Erreichst du das rechte Ende, ist das Schiff gekapert.
      </p>
      <div className="plank">
        {Array.from({ length: N }, (_, i) => (
          <div key={i} className={`plank-cell ${i === 0 ? 'lose' : ''} ${i === N - 1 ? 'win' : ''}`}>
            {i === duel.pos && (
              <span className="duelist" style={{ background: p.color }}>
                ⚔
              </span>
            )}
          </div>
        ))}
      </div>
      {duel.rounds.length > 0 && (
        <ol className="rounds">
          {duel.rounds.map((r) => (
            <li key={r.round}>
              Hieb <strong>{r.attack}</strong>, Parade {r.parry} <span className="die">W6 {r.die}</span>
              {r.parried ? (
                <>
                  {' '}
                  – pariert, Standprobe <span className="die">W6 {r.holdDie}</span> {r.held ? 'gehalten' : 'zurückgedrängt'}
                </>
              ) : (
                ' – Treffer!'
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="btn-row">
        {HEIGHTS.map((h) => (
          <button key={h} className="primary" onClick={() => onAction({ type: 'DUEL', height: h })}>
            {h}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ReportDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  return (
    <Modal title={report.title}>
      <p className="outcome">{report.outcome}</p>
      <RoundList combat={report} />
      {report.duel.length > 0 && (
        <>
          <h4>Fechtduell</h4>
          <ol className="rounds">
            {report.duel.map((r) => (
              <li key={r.round}>
                {r.attack} gegen Parade {r.parry} (W6 {r.die}){r.parried ? ` – pariert, W6 ${r.holdDie}: ${r.held ? 'gehalten' : 'zurück'}` : ' – Treffer'}
              </li>
            ))}
          </ol>
        </>
      )}
      <ul className="plain">
        {report.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <div className="btn-row">
        <button className="primary" onClick={onClose}>
          Weiter
        </button>
      </div>
    </Modal>
  );
}
