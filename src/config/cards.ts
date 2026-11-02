// Kartentexte, Schätze, Piraten und Lebensziele. Zahlenwerte stehen in balance.ts.

export interface TreasureDef {
  id: string;
  name: string;
  sea: string;
}

// ANNAHME: Die Fundorte der drei Schätze sind von Beginn an bekannt.
export const TREASURES: TreasureDef[] = [
  { id: 'A', name: 'Silber der verlorenen Flotte', sea: 's5' },
  { id: 'B', name: 'Kirchenschatz der Bahamabänke', sea: 's3' },
  { id: 'C', name: 'Perlen der Antillensee', sea: 's11' },
];

export interface PirateDef {
  id: string;
  name: string;
  /** Startgebiet */
  sea: string;
  /** Stärkezuschlag auf Rumpf/Kanonen/Mannschaft */
  tier: number;
}

// Erfundene Piraten (keine Figuren aus anderen Spielen).
export const PIRATES: PirateDef[] = [
  { id: 'hagedorn', name: 'Schwarzer Jan Hagedorn', sea: 's5', tier: 0 },
  { id: 'mareike', name: 'Rote Mareike', sea: 's9', tier: 1 },
  { id: 'knochenhand', name: 'Kapitän Knochenhand', sea: 's3', tier: 0 },
  { id: 'esteban', name: 'Der lange Esteban', sea: 's10', tier: 1 },
  { id: 'morvan', name: 'Witwe Morvan', sea: 's12', tier: 2 },
  { id: 'pulverfass', name: 'Bastian Pulverfass', sea: 's1', tier: 2 },
];

export interface LifeGoalDef {
  id: string;
  name: string;
  text: string;
}

// ANNAHME: Lebensziele sind offen ausliegende Karten, jeder Spieler erhält eines zufällig.
export const LIFE_GOALS: LifeGoalDef[] = [
  { id: 'reichtum', name: 'Reich und angesehen', text: 'Mindestens 50 Gold Vermögen bei Spielende.' },
  { id: 'adel', name: 'Blaues Blut', text: 'Den Titel Baron oder Gouverneur bei einer Nation.' },
  { id: 'zwei_kronen', name: 'Diener zweier Kronen', text: 'Oberst oder höher bei zwei Nationen.' },
  { id: 'schatzjaeger', name: 'Schatzjäger', text: 'Zwei Schätze gehoben.' },
  { id: 'piratenjaeger', name: 'Geißel der Piraten', text: 'Zwei berüchtigte Piraten besiegt.' },
  { id: 'kaperkapitaen', name: 'Kaperkapitän', text: 'Fünf Schiffe gekapert oder versenkt.' },
  { id: 'handelsherr', name: 'Handelsherr', text: 'Dreißig Waren verkauft.' },
];

export const ENCOUNTER_TEXT: Record<string, string> = {
  calm: 'Ruhige See – nichts geschieht.',
  merchant: 'Ein Handelsschiff kommt in Sicht.',
  warship: 'Ein Kriegsschiff kreuzt euren Kurs.',
  pirate: 'Ein Piratenschiff hält auf euch zu!',
  wreck: 'Treibgut eines Wracks – ihr birgt etwas Gold.',
  doldrums: 'Flaute! Ihr verliert eine Jahreszeit.',
  bottle: 'Eine Flaschenpost mit einem Schatzfragment!',
};

export const STORM_TEXT: Record<string, string> = {
  mild: 'Herbststurm zieht vorbei.',
  light: 'Herbststurm!',
  heavy: 'Schwerer Herbststurm!',
  drift: 'Der Sturm treibt euch ab – eine Jahreszeit verloren.',
};

export const PERSONALITY_NAMES: Record<string, string> = {
  Haendler: 'Händler',
  Freibeuter: 'Freibeuter',
  Hoefling: 'Höfling',
};

export const TITLE_NAMES: Record<string, string> = {
  Kapitaen: 'Kapitän',
  Oberst: 'Oberst',
  Baron: 'Baron',
  Gouverneur: 'Gouverneur',
};

export const TALENT_NAMES: Record<string, string> = {
  fechten: 'Fechten',
  navigation: 'Navigation',
  fuehrung: 'Führung',
};
