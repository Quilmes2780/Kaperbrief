import { useEffect, useMemo, useState } from 'react';
import { BALANCE } from '../config/balance';
import { TITLE_NAMES, TREASURES } from '../config/cards';
import { PORTS, PORT_IDS, SEAS } from '../config/map';
import { contractText } from '../engine/contracts';
import { eligibleTitle, letterProblem } from '../engine/governor';
import { actionOptions, type ActionOption } from '../engine/legal';
import { actionCost, validate } from '../engine/reducer';
import { planLegs } from '../engine/sailing';
import { repairCost, shipNetPrice } from '../engine/shipyard';
import { digChance, fragmentsLeft } from '../engine/treasure';
import { buyableGoods, saleRevenue } from '../engine/trade';
import type { Action, GameState, PlayerState, PortAction, PortActionType, ShipType } from '../engine/types';
import { GOODS, SHIP_TYPES } from '../engine/types';
import { activePlayer, isPort, shipStats, validLetterNations } from '../engine/util';
import { locName, nationName, seasons } from './format';
import { GoodIcon } from './icons';

interface Props {
  s: GameState;
  target: string | null;
  setTarget: (loc: string | null) => void;
  onAction: (a: Action) => void;
}

export function ActionPanel({ s, target, setTarget, onAction }: Props) {
  const [mode, setMode] = useState<ActionOption['type'] | null>(null);
  const p = activePlayer(s);
  const options = actionOptions(s);
  useEffect(() => setMode(null), [s.turn, s.active]);

  if (!mode) {
    return (
      <div className="actions">
        <h3>
          <span className="dot" style={{ background: p.color }} /> {p.name} ist am Zug
        </h3>
        <div className="action-grid">
          {options.map((o) => (
            <button key={o.type} disabled={!o.available} title={o.reason ?? ''} onClick={() => setMode(o.type)}>
              <span>{o.label}</span>
              <small>{o.available ? (o.type === 'SAIL' ? '1 je Etappe' : seasons(o.cost)) : o.reason}</small>
            </button>
          ))}
        </div>
        <p className="hint">Tipp: Ein Klick auf einen Hafen oder ein Seegebiet der Karte zeigt Infos und wählt das Segelziel.</p>
      </div>
    );
  }

  return (
    <div className="actions">
      <h3>
        {options.find((o) => o.type === mode)!.label}
        <button className="link-btn" onClick={() => setMode(null)}>
          ← zurück
        </button>
      </h3>
      {mode === 'SAIL' ? (
        <SailForm s={s} p={p} target={target} setTarget={setTarget} onAction={onAction} />
      ) : mode === 'DIG' ? (
        <DigForm s={s} p={p} onAction={onAction} />
      ) : mode === 'RETIRE' ? (
        <Confirm s={s} action={{ type: 'RETIRE' }} onAction={onAction}>
          <p>Du setzt dich zur Ruhe. {s.finishLine === null ? BALANCE.time.finishLineGrace > 0 ? `Damit legst du die Ziellinie fest: Die anderen spielen noch ${BALANCE.time.finishLineGrace} Jahreszeiten weiter.` : 'Damit legst du die Ziellinie fest und beendest die Partie.' : ''}</p>
        </Confirm>
      ) : (
        <PortActionBuilder s={s} p={p} port={p.location} type={mode} half={false} onAction={onAction} />
      )}
    </div>
  );
}

function Confirm({ s, action, onAction, children }: { s: GameState; action: Action | null; onAction: (a: Action) => void; children?: React.ReactNode }) {
  const err = action ? validate(s, action) : 'Bitte Aktion festlegen';
  const cost = action && !err ? actionCost(s, action) : null;
  return (
    <div className="confirm">
      {children}
      {err ? <p className="err">{err}</p> : <p className="cost">Kosten: {seasons(cost!)}</p>}
      <button className="primary" disabled={!!err} onClick={() => action && onAction(action)}>
        Bestätigen
      </button>
    </div>
  );
}

function PortActionBuilder({
  s,
  p,
  port,
  type,
  half,
  onAction,
}: {
  s: GameState;
  p: PlayerState;
  port: string;
  type: ActionOption['type'];
  half: boolean;
  onAction: (a: Action) => void;
}) {
  const [a, setA] = useState<PortAction | null>(null);
  return (
    <>
      <PortActionForm s={s} p={p} port={port} type={type as PortActionType} onChange={setA} />
      {!half && <Confirm s={s} action={a} onAction={onAction} />}
    </>
  );
}

export function PortActionForm({
  s,
  p,
  port,
  type,
  onChange,
}: {
  s: GameState;
  p: PlayerState;
  port: string;
  type: PortActionType;
  onChange: (a: PortAction | null) => void;
}) {
  switch (type) {
    case 'TRADE':
      return <TradeForm s={s} p={p} port={port} onChange={onChange} />;
    case 'GOVERNOR':
      return <GovernorForm s={s} p={p} port={port} onChange={onChange} />;
    case 'TAVERN':
      return <TavernForm s={s} p={p} onChange={onChange} />;
    case 'SHIPYARD':
      return <ShipyardForm p={p} onChange={onChange} />;
    case 'RAID':
      return <RaidInfo s={s} p={p} port={port} onChange={onChange} />;
    case 'SHARE_LOOT':
      return <ShareInfo p={p} onChange={onChange} />;
  }
}

function useReport(a: PortAction | null, onChange: (a: PortAction | null) => void, deps: unknown[]) {
  useEffect(() => onChange(a), deps);
}

function TradeForm({ s, p, port, onChange }: { s: GameState; p: PlayerState; port: string; onChange: (a: PortAction | null) => void }) {
  const [sell, setSell] = useState<Record<string, number>>({});
  const [buy, setBuy] = useState(0);
  const g = buyableGoods(port)[0];
  const market = s.markets[port];
  const revenue = GOODS.reduce((sum, good) => sum + saleRevenue(market[good], sell[good] ?? 0).revenue, 0);
  const a: PortAction = { type: 'TRADE', sell: { ...sell }, buy: buy > 0 ? { [g]: buy } : {} };
  useReport(a, onChange, [JSON.stringify(a)]);
  return (
    <div className="form">
      <table className="trade">
        <thead>
          <tr>
            <th>Ware</th>
            <th>Preis hier</th>
            <th>an Bord</th>
            <th>verkaufen</th>
          </tr>
        </thead>
        <tbody>
          {GOODS.map((good) => (
            <tr key={good}>
              <td>
                <GoodIcon good={good} /> {good}
              </td>
              <td>
                {BALANCE.trade.priceByLevel[market[good]]} Gold <span className="muted">(Stufe {market[good]})</span>
              </td>
              <td>{p.cargo[good]}</td>
              <td>
                <Stepper value={sell[good] ?? 0} max={p.cargo[good]} onChange={(v) => setSell({ ...sell, [good]: v })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Erlös: <strong>{revenue} Gold</strong>
      </p>
      <p>
        Einkauf: <GoodIcon good={g} /> {g} für {BALANCE.trade.buyPrice} Gold je Einheit{' '}
        <Stepper value={buy} max={Math.min(BALANCE.trade.maxBuyPerVisit, shipStats(p).hold)} onChange={setBuy} />
      </p>
    </div>
  );
}

function GovernorForm({ s, p, port, onChange }: { s: GameState; p: PlayerState; port: string; onChange: (a: PortAction | null) => void }) {
  const n = s.portOwner[port];
  const [deliver, setDeliver] = useState<string[]>([]);
  const [gift, setGift] = useState(false);
  const [letter, setLetter] = useState(false);
  const contracts = s.contracts.filter((c) => c.nation === n);
  const lp = letterProblem(s, p, n);
  const title = eligibleTitle(s, p, n);
  const a: PortAction = { type: 'GOVERNOR', deliver, gift, letter };
  useReport(a, onChange, [JSON.stringify(a)]);
  return (
    <div className="form">
      <p>
        Gouverneur von {PORTS[port].name} ({nationName(n)}). Deine Gunst: <strong>{p.favor[n]}</strong>.
        {title && title !== p.titles[n] && <> Du kannst den Titel <strong>{TITLE_NAMES[title]}</strong> erhalten.</>}
      </p>
      <h4>Aufträge von {nationName(n)}</h4>
      <ul className="plain">
        {contracts.map((c) => {
          const ok = c.kind === 'deliver' && p.cargo[c.good!] >= c.qty!;
          return (
            <li key={c.id}>
              <label className={ok ? '' : 'muted'}>
                {c.kind === 'deliver' && (
                  <input
                    type="checkbox"
                    disabled={!ok}
                    checked={deliver.includes(c.id)}
                    onChange={(e) => setDeliver(e.target.checked ? [...deliver, c.id] : deliver.filter((x) => x !== c.id))}
                  />
                )}{' '}
                {contractText(c)}
              </label>
            </li>
          );
        })}
      </ul>
      <label>
        <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} /> Geschenk überreichen ({BALANCE.favor.giftCost} Gold, +
        {BALANCE.favor.giftGain} Gunst)
      </label>
      <label>
        <input type="checkbox" checked={letter} onChange={(e) => setLetter(e.target.checked)} /> Kaperbrief erbitten{' '}
        {lp && <span className="muted">({lp})</span>}
      </label>
    </div>
  );
}

function TavernForm({ s, p, onChange }: { s: GameState; p: PlayerState; onChange: (a: PortAction | null) => void }) {
  const [hire, setHire] = useState(0);
  const [fragment, setFragment] = useState(false);
  const a: PortAction = { type: 'TAVERN', hire, fragment };
  useReport(a, onChange, [hire, fragment]);
  return (
    <div className="form">
      <p>
        Mannschaft anheuern ({BALANCE.crew.hireCost} Gold je Mann, Platz für {shipStats(p).crewMax - p.crew}):{' '}
        <Stepper value={hire} max={shipStats(p).crewMax - p.crew} onChange={setHire} />
      </p>
      <label>
        <input type="checkbox" checked={fragment} disabled={fragmentsLeft(s) === 0} onChange={(e) => setFragment(e.target.checked)} /> Alte Karte kaufen
        – zufälliges Schatzfragment ({BALANCE.treasure.fragmentPrice} Gold, noch {fragmentsLeft(s)} im Umlauf)
      </label>
    </div>
  );
}

function ShipyardForm({ p, onChange }: { p: PlayerState; onChange: (a: PortAction | null) => void }) {
  const [choice, setChoice] = useState<string>('repair');
  const a: PortAction = choice === 'repair' ? { type: 'SHIPYARD', repair: true } : { type: 'SHIPYARD', buyShip: choice as ShipType };
  useReport(a, onChange, [choice]);
  return (
    <div className="form">
      <label>
        <input type="radio" checked={choice === 'repair'} onChange={() => setChoice('repair')} /> Reparieren ({repairCost(p)} Gold)
      </label>
      <table className="ships">
        <thead>
          <tr>
            <th />
            <th>Schiff</th>
            <th>Geschw.</th>
            <th>Laderaum</th>
            <th>Kanonen</th>
            <th>Rumpf</th>
            <th>Crew</th>
            <th>Preis netto</th>
          </tr>
        </thead>
        <tbody>
          {SHIP_TYPES.filter((t) => t !== p.ship).map((t) => {
            const st = BALANCE.ships[t];
            return (
              <tr key={t}>
                <td>
                  <input type="radio" checked={choice === t} onChange={() => setChoice(t)} />
                </td>
                <td>{t}</td>
                <td>{st.speed}</td>
                <td>{st.hold}</td>
                <td>{st.cannons}</td>
                <td>{st.hull}</td>
                <td>{st.crewMax}</td>
                <td>{shipNetPrice(p, t)} Gold</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">Das alte Schiff wird zum halben Preis angerechnet.</p>
    </div>
  );
}

function RaidInfo({ s, p, port, onChange }: { s: GameState; p: PlayerState; port: string; onChange: (a: PortAction | null) => void }) {
  useReport({ type: 'RAID' }, onChange, []);
  const owner = s.portOwner[port];
  const legal = validLetterNations(s, p, owner);
  const f = BALANCE.combat.enemies.fort;
  return (
    <div className="form">
      <p>
        Festung von {PORTS[port].name}: Rumpf {f.hull}, Kanonen {f.cannons}, Besatzung {f.crew}.
      </p>
      {legal.length > 0 ? (
        <p>Gedeckt durch deinen Kaperbrief von {legal.map(nationName).join(', ')}. Bei Erfolg wechselt die Flagge.</p>
      ) : (
        <p className="err">
          Kein gültiger Kaperbrief gegen {nationName(owner)}: −{BALANCE.favor.illegalAttackPenalty} Gunst, und die Flagge bleibt.
        </p>
      )}
    </div>
  );
}

function ShareInfo({ p, onChange }: { p: PlayerState; onChange: (a: PortAction | null) => void }) {
  useReport({ type: 'SHARE_LOOT' }, onChange, []);
  return (
    <div className="form">
      <p>
        {Math.floor(p.purse / 2)} Gold gehen ins Vermögen, {p.purse - Math.floor(p.purse / 2)} an die Mannschaft. Die Mannschaft halbiert sich auf{' '}
        {Math.max(1, Math.floor(p.crew / 2))}, die Moral steigt auf {BALANCE.morale.afterShare}.
      </p>
    </div>
  );
}

function SailForm({
  s,
  p,
  target,
  setTarget,
  onAction,
}: {
  s: GameState;
  p: PlayerState;
  target: string | null;
  setTarget: (loc: string | null) => void;
  onAction: (a: Action) => void;
}) {
  const [then, setThen] = useState<PortActionType | ''>('');
  const [thenAction, setThenAction] = useState<PortAction | null>(null);
  const dest = target && target !== p.location ? target : null;
  const legs = dest ? planLegs(p, dest) : null;
  const q = useMemo<PlayerState | null>(() => (dest && isPort(dest) ? { ...p, location: dest } : null), [dest, p]);
  useEffect(() => {
    setThen('');
    setThenAction(null);
  }, [dest]);
  const action: Action | null = dest ? (then && thenAction ? { type: 'SAIL', to: dest, then: thenAction } : { type: 'SAIL', to: dest }) : null;
  const sorted = [...PORT_IDS].sort((a, b) => PORTS[a].name.localeCompare(PORTS[b].name));
  return (
    <div className="form">
      <label>
        Ziel:{' '}
        <select value={dest ?? ''} onChange={(e) => setTarget(e.target.value || null)}>
          <option value="">– auf der Karte klicken oder wählen –</option>
          <optgroup label="Häfen">
            {sorted
              .filter((id) => id !== p.location)
              .map((id) => (
                <option key={id} value={id}>
                  {PORTS[id].name} ({nationName(s.portOwner[id])})
                </option>
              ))}
          </optgroup>
          <optgroup label="Seegebiete">
            {Object.keys(SEAS)
              .filter((id) => id !== p.location)
              .map((id) => (
                <option key={id} value={id}>
                  {SEAS[id].name}
                </option>
              ))}
          </optgroup>
        </select>
      </label>
      {legs && (
        <p>
          Route: {legs.map((l) => l.map(locName).join(' → ')).join(' | ')} – {legs.length} Etappe{legs.length > 1 ? 'n' : ''}, Moral −{legs.length}, je
          Etappe eine Begegnungskarte{legs.some((_, i) => (p.time + i) % 4 === 2) ? ', im Herbst zusätzlich Sturm' : ''}.
        </p>
      )}
      {q && (
        <>
          <label>
            Hafenaktion am Ziel (halbe Zeit):{' '}
            <select value={then} onChange={(e) => setThen(e.target.value as PortActionType | '')}>
              <option value="">keine</option>
              <option value="TRADE">Handeln</option>
              <option value="GOVERNOR">Gouverneur</option>
              <option value="TAVERN">Taverne</option>
              <option value="SHIPYARD">Werft</option>
              <option value="RAID">Hafen überfallen</option>
              <option value="SHARE_LOOT">Beute teilen</option>
            </select>
          </label>
          {then && <PortActionForm key={then + dest} s={s} p={q} port={dest!} type={then} onChange={setThenAction} />}
        </>
      )}
      <Confirm s={s} action={action} onAction={onAction} />
    </div>
  );
}

function DigForm({ s, p, onAction }: { s: GameState; p: PlayerState; onAction: (a: Action) => void }) {
  const t = TREASURES.find((x) => validate(s, { type: 'DIG', treasure: x.id }) === null);
  if (!t) return <p>Hier ist kein Schatz zu heben.</p>;
  return (
    <Confirm s={s} action={{ type: 'DIG', treasure: t.id }} onAction={onAction}>
      <p>
        {t.name}: {p.fragments[t.id]} Fragmente – Erfolgschance {Math.round(digChance(p, t.id) * 100)} %.
      </p>
    </Confirm>
  );
}

export function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="stepper">
      <button type="button" disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label="weniger">
        −
      </button>
      <span className="num">{value}</span>
      <button type="button" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="mehr">
        +
      </button>
    </span>
  );
}
