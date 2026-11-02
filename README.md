# Kaperbrief

Browser-Umsetzung des Brettspiels „Kaperbrief“: Freibeuter-Karriere in der Karibik im 17. Jahrhundert. Hotseat für 2–4 Spieler, jeder Platz Mensch oder KI.

**Online spielen:** https://quilmes2780.github.io/Kaperbrief/ (wird bei jedem Push auf `main` neu gebaut)

## Starten

```
npm install
npm run dev          # Spiel unter http://localhost:5173
npm test             # Regeltests (Vitest)
npm run simulate     # 200 KI-Partien -> simulation-report.md
npm run simulate:spaet   # Variante ohne frühen Ruhestand der KI
npm run simulate -- --nachlauf=4 --ruhestand-ab=38   # Regelvarianten zum Spielende
npm run simulate -- 400 1001 --set=contracts.deliverFavor=1   # beliebige balance.ts-Werte ausprobieren
npm run build        # statischer Build in dist/
```

## Aufbau

- `src/config/balance.ts`: alle Zahlenwerte (Schiffe, Preise, Zeitkosten, Punkte, Wahrscheinlichkeiten, KI-Gewichte)
- `src/config/map.ts`, `cards.ts`: Karte, Schätze, Piraten, Lebensziele, Texte
- `src/engine/`: reine Spiellogik, Einstieg `applyAction(state, action) -> newState` in `reducer.ts`; Zufall über den seedbaren PRNG in `rng.ts`
- `src/engine/ai/`: Heuristik-KI (Händler, Freibeuter, Höfling)
- `src/ui/`: React-Oberfläche, nur Darstellung
- `tests/engine/`: Tests je Regelbereich

## Annahmen (im Code mit `// ANNAHME` markiert)

**Aufbau**
1. Jeder Spieler hat eine Heimatnation (wählbar oder zufällig), startet in einem ihrer Häfen mit 1 Gunst dort (sonst 0) und 10 Gold Kasse.
2. Die Startreihenfolge bei Gleichstand wird ausgelost.
3. Lebensziele sind offen; jeder Spieler erhält eines von 7 zufällig.
4. Die Fundorte der drei Schätze sind von Beginn an bekannt (Kaimansee, Bahamabänke, Antillensee).

**Zeit und Segeln**
5. Aus einem Hafen zählt das eigene Seegebiet als erstes Feld. Das Einlaufen in einen Hafen ist frei, jede Fahrt umfasst aber mindestens ein Seegebiet.
6. Jede Etappe zieht eine Begegnungskarte, weil sie über offene See führt.
7. Navigation 3 gibt +1 Geschwindigkeit. Sturmkarten werden mit einer Navigationsprobe (W6 ≤ Navigation) abgewettert.
8. Ein berüchtigter Pirat im Zielgebiet einer Etappe greift immer an.
9. Kriegsschiffe greifen an, wenn der Spieler einen Kaperbrief gegen ihre Nation hält. Sonst darf er wählen.
10. Schiffbruch (Rumpf 0): Ladung weg, halbe Kasse weg, weiter mit einer Schaluppe im nächstgelegenen Hafen, +1 Jahreszeit.
11. Wer die Ziellinie oder 45 Jahre erreicht, geht am Ende seines Zuges automatisch in den Ruhestand.

**Mannschaft**
12. Eine bestandene Meutereiprobe hebt die Moral auf 1.
13. Meuterei: Die Kasse geht an die Meuterer, die Mannschaft halbiert sich, die Moral steigt auf 3.
14. Taverne: Anheuern kostet 1 Gold je Mann. Eine alte Karte (zufälliges Schatzfragment) kostet 6 Gold.

**Handel und Werft**
15. Jeder Hafen erzeugt genau eine Ware und verkauft sie für 1 Gold. Ihre eigene Nachfrage bleibt auf Stufe 1.
16. Werft: Das alte Schiff wird zum halben Listenpreis angerechnet. Eine nachgekaufte Schaluppe kostet 8 Gold.

**Gouverneur und Politik**
17. Titel werden beim Gouverneur abgeholt und bleiben erhalten, auch wenn die Gunst sinkt. Je Nation zählt nur der höchste Titel.
18. Geschenk beim Gouverneur: 5 Gold für +1 Gunst.
19. Feindlicher Hafen: Ist die Gunst bei der Hafennation 0 und hält man einen gültigen Kaperbrief gegen sie, ist dort nur ein Überfall möglich.
20. Politikkarten werden jedes Jahr aus dem vollständigen Stapel gezogen: je Paar eine Kriegs- und eine Friedenskarte, dazu 3 Karten „Ruhe“.
21. Geraten zwei Kaperbrief-Geber in Krieg, behält man den Brief der Nation mit mehr Gunst.

**Kampf**
22. Beide entern: Die größere Mannschaft setzt sich durch; bei Gleichstand passiert nichts. Beide feuern: Beide nehmen Schaden. Beide weichen aus: Das Gefecht endet.
23. Ein Mannschaftsvorsprung von mindestens 2 verschiebt den Start auf der Planke um ein Feld.
24. Das Fechtduell endet nach 10 Runden ohne Entscheidung.
25. Wer das Duell gewinnt, kapert das Schiff, auch als Verteidiger. Ein verlorener Abwehrkampf kostet die Ladung, die halbe Kasse und 1 Moral. Ein abgeschlagenes Entern kostet 1 Mann und 1 Moral.
26. Gunst für einen Sieg geht an alle Kaperbrief-Geber, die mit der Zielnation im Krieg sind: +2 fürs Versenken, +1 fürs Kapern, +1 extra bei Kriegsschiffen.
27. Ein Überfall ist ein Gefecht gegen die Festung (Rumpf 6, Kanonen 3), die nie ausweicht. Mit gültigem Kaperbrief geht die Flagge an den Geber mit der höchsten Gunst (+2 Gunst). Ohne Kaperbrief gibt es nur Beute.

**Schätze, Piraten, Aufträge**
28. Ein misslungenes Heben kostet keine Fragmente; man darf es erneut versuchen. Ein gehobener Schatz bringt zusätzlich 15 Gold, und die Fragmente der Mitspieler für diesen Schatz verfallen.
29. Ein besiegter berüchtigter Pirat bringt Kopfgeld. Gunst gibt es dafür nicht mehr (`favor.notoriousGain: 0`): Mit +1 bei allen Nationen machten Titel 42 % aller Punkte aus, jetzt sind es 33 %. Er wird beim Weltjahreswechsel ersetzt, bis der Vorrat von 6 Piraten leer ist.
30. Es gibt zwei Arten von Aufträgen. Lieferaufträge werden beim Gouverneur einer beliebigen Stadt der Nation erfüllt. Kaperaufträge erfüllen sich sofort bei einem Sieg, wenn man den Kaperbrief des Auftraggebers hat. Kaperaufträge gegen Nationen, mit denen inzwischen Frieden herrscht, verfallen.

**Wertung**
31. Vermögen und halbe Kasse werden addiert, dann durch 5 geteilt und abgerundet.

**Spielende (Varianten)**
32. Weil immer der Hinterste zieht, stehen beim ersten Ruhestand alle anderen schon auf oder hinter der Ziellinie; nach Regel 14 endet die Partie also sofort. Zwei Stellschrauben in `balance.ts` ändern das: `time.finishLineGrace` (Nachlauf in Jahreszeiten) und `time.retireMinAge`. Gewählt: Ruhestand ab 38 statt 35 und 4 Jahreszeiten Nachlauf; die übrigen Spieler bekommen also nach dem ersten Ruhestand noch ein Jahr. Mit `retireMinAge: 35, finishLineGrace: 0` gilt Regel 14 wörtlich.
33. Lieferaufträge bringen 2 Gunst statt 1. Damit hält der friedliche Weg zu Titeln mit dem Kapern mit. Die KI-Gewichte der Persönlichkeiten sind per Simulation abgestimmt (je etwa 27–31 % Siegquote). Ein Sieg im Gefecht bringt weiter Gunst bei allen passenden Kaperbrief-Gebern; mit `favor.combatFavorAllLetters: false` nur beim Geber mit der höchsten Gunst.
