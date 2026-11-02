import { BALANCE } from '../config/balance';
import { TREASURES } from '../config/cards';
import { PORTS, SEAS } from '../config/map';
import { contractText } from '../engine/contracts';
import { pirateAt } from '../engine/pirates';
import type { GameState } from '../engine/types';
import { GOODS, NATIONS } from '../engine/types';
import { atWar, nationPairs } from '../engine/util';
import { nationName } from './format';
import { Flag, GoodIcon } from './icons';

export function EventLog({ s }: { s: GameState }) {
  const entries = [...s.log].reverse().slice(0, 150);
  return (
    <div className="log" aria-label="Ereignisprotokoll">
      {entries.map((e) => {
        const p = e.player !== null ? s.players.find((x) => x.id === e.player) : null;
        return (
          <div key={e.n} className={`log-entry log-${e.kind}`}>
            {p && <span className="dot" style={{ background: p.color }} />}
            {e.text}
          </div>
        );
      })}
    </div>
  );
}

export function PoliticsPanel({ s }: { s: GameState }) {
  return (
    <div className="politics">
      {nationPairs().map(([a, b]) => (
        <span key={a + b} className={atWar(s, a, b) ? 'war' : 'peace'} title={atWar(s, a, b) ? 'Krieg' : 'Frieden'}>
          <Flag nation={a} size={11} />
          {atWar(s, a, b) ? '⚔' : '☮'}
          <Flag nation={b} size={11} />
        </span>
      ))}
    </div>
  );
}

export function LocationInfo({ s, loc }: { s: GameState; loc: string | null }) {
  if (!loc) return null;
  if (PORTS[loc]) {
    const port = PORTS[loc];
    const owner = s.portOwner[loc];
    return (
      <div className="locinfo">
        <h4>
          <Flag nation={owner} size={13} /> {port.name} <span className="muted">({nationName(owner)})</span>
        </h4>
        <div>
          Erzeugt: <GoodIcon good={port.produces} /> {port.produces} (Kauf {BALANCE.trade.buyPrice} Gold)
        </div>
        <div className="prices">
          Nachfrage:{' '}
          {GOODS.map((g) => (
            <span key={g}>
              <GoodIcon good={g} /> {BALANCE.trade.priceByLevel[s.markets[loc][g]]}
            </span>
          ))}
        </div>
        <ul className="plain small">
          {s.contracts
            .filter((c) => c.nation === owner)
            .map((c) => (
              <li key={c.id}>{contractText(c)}</li>
            ))}
        </ul>
      </div>
    );
  }
  const sea = SEAS[loc];
  const pr = pirateAt(s, loc);
  const t = TREASURES.find((x) => x.sea === loc && s.treasuresTaken[x.id] === null);
  return (
    <div className="locinfo">
      <h4>{sea.name}</h4>
      {pr && (
        <div>
          Berüchtigter Pirat: <strong>{pr.name}</strong> (Rumpf {pr.hull}, Kanonen {pr.cannons}, Crew {pr.crew}) – Kopfgeld {pr.bounty} Gold
        </div>
      )}
      {t && <div>Fundort: {t.name}</div>}
      {!pr && !t && <div className="muted">Offene See.</div>}
    </div>
  );
}

export function ContractsPanel({ s }: { s: GameState }) {
  return (
    <details className="contracts">
      <summary>Offene Aufträge ({s.contracts.length})</summary>
      {NATIONS.map((n) => (
        <div key={n}>
          <ul className="plain small">
            {s.contracts
              .filter((c) => c.nation === n)
              .map((c) => (
                <li key={c.id}>{contractText(c)}</li>
              ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

export function RulesPanel({ onClose }: { onClose: () => void }) {
  const C = BALANCE.actionCost;
  return (
    <aside className="rules" aria-label="Regelübersicht">
      <button className="link-btn close" onClick={onClose}>
        Schließen ✕
      </button>
      <h2>Regelübersicht</h2>
      <h3>Zeit</h3>
      <p>
        Die Lebensleiste reicht von 25 bis 45 Jahren in Jahreszeiten. Am Zug ist, wer am weitesten hinten steht; bei Gleichstand der zuletzt
        Angekommene.
      </p>
      <h3>Aktionen (Zeitkosten)</h3>
      <ul>
        <li>Segeln: {C.SAIL_LEG} je Etappe (Etappe = Geschwindigkeit in Seegebieten). Moral −1, je Etappe eine Begegnungskarte, im Herbst zusätzlich Sturm.</li>
        <li>
          Handeln {C.TRADE} · Gouverneur {C.GOVERNOR} · Taverne {C.TAVERN} · Werft {C.SHIPYARD} · Hafen überfallen {C.RAID} · Schatz heben {C.DIG} ·
          Beute teilen {C.SHARE_LOOT}
        </li>
        <li>Segeln + Hafenaktion am Ziel: die Hafenaktion kostet die halbe Zeit (aufgerundet).</li>
        <li>Ruhestand ab {BALANCE.time.retireMinAge}, Pflicht mit {BALANCE.time.endAge}.</li>
      </ul>
      <h3>Handel</h3>
      <p>Nachfrage je Hafen und Ware in 3 Stufen (Preis 1/3/5). Jeder Verkauf senkt die Stufe; Erholung beim Weltjahreswechsel. Jeder Hafen verkauft seine Erzeugerware für 1 Gold.</p>
      <h3>Gold und Mannschaft</h3>
      <p>
        Schiffskasse (Betriebsmittel) und Vermögen (zählt voll). Beute teilen: halbe Kasse wird Vermögen, Rest an die Mannschaft, Mannschaft halbiert,
        Moral 5. Moral 0 → Meutereiprobe W6 + Führung ≥ 5.
      </p>
      <h3>Politik und Kaperbriefe</h3>
      <p>
        6 Nationenpaare, je Krieg oder Frieden; zu Beginn ist Spanien mit allen im Krieg. Kaperbriefe beim Gouverneur ab 1 Gunst, mehrere erlaubt, solange
        die Geber nicht im Krieg miteinander sind. Angriff ohne gültigen Kaperbrief: −2 Gunst bei der angegriffenen Nation.
      </p>
      <h3>Gefecht</h3>
      <p>
        Bis 3 Runden: Breitseite schlägt Entern, Entern schlägt Ausweichen, Ausweichen schlägt Breitseite. Erfolgreiches Entern führt zum Fechtduell auf
        der Planke. Versenken bringt Gunst, aber keine Beute; Kapern bringt Ladung, Gold, Moral +2 und Gunst +1.
      </p>
      <h3>Gunst und Titel</h3>
      <p>Gunst 0–10 je Nation. Kapitän 3, Oberst 6, Baron 8 (max. 2 je Nation), Gouverneur 10 (1 je Nation).</p>
      <h3>Konkurrenz</h3>
      <p>
        Kein Kampf zwischen Spielern. Wettlauf um offene Aufträge, Schatzfragmente (3 Schätze à 4 Teile; Heben mit 4 sicher, mit 3 bei W6 ≥ 4),
        berüchtigte Piraten mit Kopfgeld und Hafenflaggen.
      </p>
      <h3>Spielende und Wertung</h3>
      <p>
        Der erste Ruhestand setzt die Ziellinie{BALANCE.time.finishLineGrace > 0 ? ` ${BALANCE.time.finishLineGrace} Jahreszeiten hinter seinem Feld` : ''}; alle anderen spielen, bis sie sie erreichen. Wertung: 1 Punkt je 5 Gold Vermögen (Kasse halb), Titel
        1/3/6/10, Schatz 6, Pirat 3, Lebensziel 8, Fregatte oder Galeone 2.
      </p>
    </aside>
  );
}

export function ScoreTable({ s, onNew, onClose }: { s: GameState; onNew: () => void; onClose: () => void }) {
  const scores = s.scores ?? [];
  const top = Math.max(...scores.map((x) => x.total));
  return (
    <div className="modal-backdrop">
      <div className="modal wide">
        <h2>Endwertung</h2>
        <table className="score-table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Gold</th>
              <th>Titel</th>
              <th>Schätze</th>
              <th>Piraten</th>
              <th>Lebensziel</th>
              <th>Schiff</th>
              <th>Summe</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((b) => {
              const p = s.players.find((x) => x.id === b.player)!;
              return (
                <tr key={b.player} className={b.total === top ? 'winner' : ''}>
                  <td>
                    <span className="dot" style={{ background: p.color }} /> {p.name}
                  </td>
                  <td>{b.gold}</td>
                  <td>{b.titles}</td>
                  <td>{b.treasures}</td>
                  <td>{b.pirates}</td>
                  <td>{b.lifeGoal}</td>
                  <td>{b.ships}</td>
                  <td>
                    <strong>{b.total}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted">
          Seed {s.seed} · {s.turn} Züge
        </p>
        <div className="btn-row">
          <button className="primary" onClick={onNew}>
            Neue Partie
          </button>
          <button onClick={onClose}>Karte ansehen</button>
        </div>
      </div>
    </div>
  );
}
