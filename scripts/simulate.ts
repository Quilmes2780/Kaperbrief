// Simuliert KI-gegen-KI-Partien und gibt eine Balancing-Auswertung aus.
// Aufruf: npm run simulate [-- <Anzahl> <Startseed>] [--ohne-fruehruhestand] [--nachlauf=<Jahreszeiten>] [--ruhestand-ab=<Alter>]
import { writeFileSync } from 'node:fs';
import { BALANCE } from '../src/config/balance';
import { PERSONALITY_NAMES } from '../src/config/cards';
import { playOut } from '../src/engine/ai';
import { shuffle } from '../src/engine/rng';
import { createGame } from '../src/engine/setup';
import type { GameState, Personality, ScoreBreakdown, SeatConfig } from '../src/engine/types';
import { PERSONALITIES } from '../src/engine/types';
import { ageOf } from '../src/engine/util';

const NO_EARLY = process.argv.includes('--ohne-fruehruhestand');
const flag = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const GRACE = flag('nachlauf');
const MIN_AGE = flag('ruhestand-ab');
// --set=pfad.zum.wert=zahl|true|false setzt beliebige Werte aus balance.ts (zum Ausprobieren).
const SETS = process.argv.filter((a) => a.startsWith('--set=')).map((a) => a.slice(6));
for (const kv of SETS) {
  const [path, raw] = kv.split('=');
  const keys = path.split('.');
  let obj = BALANCE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) obj = obj[k] as Record<string, unknown>;
  obj[keys[keys.length - 1]] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
}
if (GRACE !== undefined) BALANCE.time.finishLineGrace = Number(GRACE);
if (MIN_AGE !== undefined) BALANCE.time.retireMinAge = Number(MIN_AGE);
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] ?? 200);
const SEED0 = Number(args[1] ?? 1);
if (NO_EARLY) for (const p of PERSONALITIES) BALANCE.ai.personalities[p].retireLead = 999;
const SOURCES = ['gold', 'titles', 'treasures', 'pirates', 'lifeGoal', 'ships'] as const;
const SOURCE_NAMES: Record<(typeof SOURCES)[number], string> = {
  gold: 'Gold',
  titles: 'Titel',
  treasures: 'Schätze',
  pirates: 'Piraten',
  lifeGoal: 'Lebensziel',
  ships: 'Schiff',
};

interface Agg {
  seats: number;
  wins: number;
  total: number;
  src: Record<string, number>;
  stats: Record<string, number>;
  goalMet: number;
}

const agg: Record<Personality, Agg> = Object.fromEntries(
  PERSONALITIES.map((p) => [p, { seats: 0, wins: 0, total: 0, src: {}, stats: {}, goalMet: 0 }]),
) as Record<Personality, Agg>;

const games: { players: number; turns: number; turnsAfterFinish: number; endAge: number; firstRetireAge: number; margin: number; winnerScore: number }[] = [];
const allScores: number[] = [];
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const seed = SEED0 + i;
  const rng = { rng: seed * 7919 };
  const four = i % 2 === 1;
  const pers: Personality[] = [...PERSONALITIES];
  if (four) pers.push(PERSONALITIES[i % 3]);
  const order = shuffle(rng, pers);
  const seats: SeatConfig[] = order.map((p, k) => ({ name: `${PERSONALITY_NAMES[p]} ${k + 1}`, kind: 'ai', personality: p }));
  const end: GameState = playOut(createGame(seats, seed));
  const finishTurn = end.log.find((e) => e.text.includes('legt die Ziellinie fest'))?.turn ?? end.turn;
  const scores = end.scores as ScoreBreakdown[];
  const top = scores[0].total;
  const winners = scores.filter((x) => x.total === top);
  for (const sc of scores) {
    const p = end.players.find((x) => x.id === sc.player)!;
    const a = agg[p.personality!];
    a.seats++;
    a.total += sc.total;
    allScores.push(sc.total);
    if (sc.total === top) a.wins += 1 / winners.length;
    if (sc.lifeGoal > 0) a.goalMet++;
    for (const k of SOURCES) a.src[k] = (a.src[k] ?? 0) + sc[k];
    for (const [k, v] of Object.entries(p.stats)) a.stats[k] = (a.stats[k] ?? 0) + v;
    a.stats.titlesHeld = (a.stats.titlesHeld ?? 0) + Object.values(p.titles).filter(Boolean).length;
    a.stats.letters = (a.stats.letters ?? 0) + p.letters.length;
    a.stats.bigShip = (a.stats.bigShip ?? 0) + (sc.ships > 0 ? 1 : 0);
  }
  const retiredAt = end.players.map((p) => p.retiredAt ?? 80);
  games.push({
    players: end.players.length,
    turns: end.players.reduce((s, p) => s + p.stats.actions, 0),
    turnsAfterFinish: end.turn - finishTurn,
    endAge: ageOf(Math.max(...retiredAt)),
    firstRetireAge: ageOf(end.finishLine ?? 80),
    margin: top - (scores[1]?.total ?? 0),
    winnerScore: top,
  });
}

const ms = Date.now() - t0;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const f1 = (x: number) => x.toFixed(1);
const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

const lines: string[] = [];
const out = (s = '') => lines.push(s);

out(`# Kaperbrief – Simulation von ${N} KI-Partien`);
out();
out(NO_EARLY ? 'Variante: KI geht nicht wegen Punktevorsprungs früh in den Ruhestand.' : 'Standard-KI (Ruhestand bei ausreichendem Vorsprung).');
out();
out(`Regeln: Ruhestand ab ${BALANCE.time.retireMinAge} Jahren, Nachlauf nach der Ziellinie ${BALANCE.time.finishLineGrace} Jahreszeiten.`);
out();
out(`Seeds ${SEED0}–${SEED0 + N - 1}; abwechselnd 3 Spieler (je eine Persönlichkeit) und 4 Spieler (plus eine doppelte). Laufzeit ${(ms / 1000).toFixed(1)} s.`);
out();
out('## Partieverlauf');
out();
for (const n of [3, 4]) {
  const g = games.filter((x) => x.players === n);
  out(
    `- **${n} Spieler** (${g.length} Partien): Ø ${f1(avg(g.map((x) => x.turns)))} Züge je Partie (${f1(avg(g.map((x) => x.turns / n)))} je Spieler), ` +
      `Ziellinie Ø mit ${f1(avg(g.map((x) => x.firstRetireAge)))} Jahren gesetzt, Ø Siegpunkte ${f1(avg(g.map((x) => x.winnerScore)))}, Ø Vorsprung ${f1(avg(g.map((x) => x.margin)))}, Ø Züge nach der Ziellinie ${f1(avg(g.map((x) => x.turnsAfterFinish)))}`,
  );
}
const ages = new Map<number, number>();
for (const g of games) ages.set(g.firstRetireAge, (ages.get(g.firstRetireAge) ?? 0) + 1);
out(`- Alter beim ersten Ruhestand: ${[...ages.entries()].sort((a, b) => a[0] - b[0]).map(([a, c]) => `${a} J.: ${c}`).join(', ')}`);
out(`- Punkte aller Spieler: Ø ${f1(avg(allScores))}, Min ${Math.min(...allScores)}, Max ${Math.max(...allScores)}`);
out();
out('## Siegquote je Persönlichkeit');
out();
out('| Persönlichkeit | Plätze | Siege | Siegquote | Ø Punkte | Lebensziel erfüllt |');
out('|---|---:|---:|---:|---:|---:|');
for (const p of PERSONALITIES) {
  const a = agg[p];
  out(`| ${PERSONALITY_NAMES[p]} | ${a.seats} | ${f1(a.wins)} | ${pct(a.wins / a.seats)} | ${f1(a.total / a.seats)} | ${pct(a.goalMet / a.seats)} |`);
}
out();
out('Erwartung bei Gleichgewicht: ca. 29 % (Mischung aus 3er- und 4er-Partien).');
out();
out('## Punkteverteilung nach Quelle (Ø je Spieler)');
out();
out(`| Persönlichkeit | ${SOURCES.map((k) => SOURCE_NAMES[k]).join(' | ')} | Summe |`);
out(`|---|${SOURCES.map(() => '---:').join('|')}|---:|`);
const totalSrc: Record<string, number> = {};
let totalSeats = 0;
for (const p of PERSONALITIES) {
  const a = agg[p];
  totalSeats += a.seats;
  for (const k of SOURCES) totalSrc[k] = (totalSrc[k] ?? 0) + a.src[k];
  out(`| ${PERSONALITY_NAMES[p]} | ${SOURCES.map((k) => f1(a.src[k] / a.seats)).join(' | ')} | ${f1(a.total / a.seats)} |`);
}
const grand = SOURCES.reduce((s, k) => s + totalSrc[k], 0);
out(`| **Alle** | ${SOURCES.map((k) => f1(totalSrc[k] / totalSeats)).join(' | ')} | ${f1(grand / totalSeats)} |`);
out(`| Anteil | ${SOURCES.map((k) => pct(totalSrc[k] / grand)).join(' | ')} | 100 % |`);
out();
out('## Verhalten (Ø je Spieler)');
out();
const STAT_NAMES: Record<string, string> = {
  actions: 'Züge',
  goodsSold: 'Waren verkauft',
  prizes: 'Schiffe gekapert',
  sunk: 'Schiffe versenkt',
  raids: 'Häfen überfallen',
  contracts: 'Aufträge erfüllt',
  mutinies: 'Meutereien',
  shipwrecks: 'Schiffbrüche',
  titlesHeld: 'Titel (Nationen)',
  letters: 'Kaperbriefe am Ende',
  bigShip: 'Fregatte/Galeone am Ende',
};
out(`| Kennzahl | ${PERSONALITIES.map((p) => PERSONALITY_NAMES[p]).join(' | ')} |`);
out(`|---|${PERSONALITIES.map(() => '---:').join('|')}|`);
for (const [k, name] of Object.entries(STAT_NAMES)) {
  out(`| ${name} | ${PERSONALITIES.map((p) => f1((agg[p].stats[k] ?? 0) / agg[p].seats)).join(' | ')} |`);
}

const text = lines.join('\n');
console.log(text);
const suffix = [SETS.length > 0 && "test", NO_EARLY && 'ohne-fruehruhestand', GRACE !== undefined && `nachlauf-${GRACE}`, MIN_AGE !== undefined && `ab-${MIN_AGE}`].filter(Boolean).join('-');
writeFileSync(suffix ? `simulation-report-${suffix}.md` : 'simulation-report.md', text + '\n', 'utf8');
