// Karte: 12 Seegebiete als Graph, 16 Häfen (je 4 pro Nation). Koordinaten für die SVG-Karte (1000 x 640).
import type { Good, Nation } from '../engine/types';

export interface SeaDef {
  name: string;
  x: number;
  y: number;
}

export interface PortDef {
  name: string;
  nation: Nation;
  sea: string;
  produces: Good;
  x: number;
  y: number;
}

export const SEAS: Record<string, SeaDef> = {
  s1: { name: 'Golf von Mexiko', x: 150, y: 210 },
  s2: { name: 'Floridastraße', x: 345, y: 140 },
  s3: { name: 'Bahamabänke', x: 560, y: 95 },
  s4: { name: 'Windward-Passage', x: 575, y: 225 },
  s5: { name: 'Kaimansee', x: 300, y: 320 },
  s6: { name: 'Jamaikasee', x: 490, y: 360 },
  s7: { name: 'Mona-Passage', x: 715, y: 270 },
  s8: { name: 'Leeward-See', x: 880, y: 200 },
  s9: { name: 'Windward-See', x: 905, y: 380 },
  s10: { name: 'Golf von Darién', x: 370, y: 520 },
  s11: { name: 'Antillensee', x: 640, y: 480 },
  s12: { name: 'Guayana-Küste', x: 880, y: 560 },
};

export const SEA_LINKS: [string, string][] = [
  ['s1', 's2'],
  ['s1', 's5'],
  ['s2', 's3'],
  ['s2', 's5'],
  ['s3', 's4'],
  ['s3', 's7'],
  ['s4', 's5'],
  ['s4', 's6'],
  ['s4', 's7'],
  ['s5', 's6'],
  ['s5', 's10'],
  ['s6', 's7'],
  ['s6', 's10'],
  ['s6', 's11'],
  ['s7', 's8'],
  ['s7', 's11'],
  ['s8', 's9'],
  ['s9', 's11'],
  ['s9', 's12'],
  ['s10', 's11'],
  ['s11', 's12'],
];

export const PORTS: Record<string, PortDef> = {
  veracruz: { name: 'Veracruz', nation: 'ES', sea: 's1', produces: 'Kakao', x: 55, y: 290 },
  havanna: { name: 'Havanna', nation: 'ES', sea: 's2', produces: 'Tabak', x: 335, y: 200 },
  santo_domingo: { name: 'Santo Domingo', nation: 'ES', sea: 's7', produces: 'Zucker', x: 680, y: 225 },
  cartagena: { name: 'Cartagena', nation: 'ES', sea: 's10', produces: 'Kakao', x: 440, y: 590 },
  nassau: { name: 'Nassau', nation: 'EN', sea: 's3', produces: 'Tabak', x: 500, y: 55 },
  port_royal: { name: 'Port Royal', nation: 'EN', sea: 's6', produces: 'Rum', x: 485, y: 295 },
  st_johns: { name: "Saint John's", nation: 'EN', sea: 's8', produces: 'Zucker', x: 945, y: 165 },
  bridgetown: { name: 'Bridgetown', nation: 'EN', sea: 's9', produces: 'Rum', x: 975, y: 420 },
  tortuga: { name: 'Tortuga', nation: 'FR', sea: 's4', produces: 'Tabak', x: 615, y: 180 },
  saint_pierre: { name: 'Saint-Pierre', nation: 'FR', sea: 's9', produces: 'Rum', x: 930, y: 320 },
  basse_terre: { name: 'Basse-Terre', nation: 'FR', sea: 's9', produces: 'Zucker', x: 850, y: 300 },
  cayenne: { name: 'Cayenne', nation: 'FR', sea: 's12', produces: 'Kakao', x: 960, y: 605 },
  willemstad: { name: 'Willemstad', nation: 'NL', sea: 's11', produces: 'Tabak', x: 620, y: 555 },
  oranjestad: { name: 'Oranjestad', nation: 'NL', sea: 's8', produces: 'Zucker', x: 835, y: 140 },
  philipsburg: { name: 'Philipsburg', nation: 'NL', sea: 's8', produces: 'Rum', x: 890, y: 115 },
  paramaribo: { name: 'Paramaribo', nation: 'NL', sea: 's12', produces: 'Kakao', x: 810, y: 615 },
};

export const PORT_IDS = Object.keys(PORTS);
export const SEA_IDS = Object.keys(SEAS);

export const NATION_NAMES: Record<Nation, string> = {
  ES: 'Spanien',
  EN: 'England',
  FR: 'Frankreich',
  NL: 'Niederlande',
};

export const NATION_COLORS: Record<Nation, string> = {
  ES: '#c8a023',
  EN: '#b8312f',
  FR: '#2f5fb8',
  NL: '#e07b1f',
};
