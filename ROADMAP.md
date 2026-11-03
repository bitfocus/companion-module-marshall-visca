# Roadmap: Funktionen, die ergänzt werden sollten

Stand: November 2026, nach dem Update auf `@companion-module/base` 2.2.

## Priorität hoch

1. **An Hardware verifizieren (CV612, CV630, CV730).**
   Pan/Tilt und Presets nutzen die Standard‑VISCA‑Befehle. Die Wertebereiche sind vorsichtig gewählt (Pan‑Speed 1–24, Tilt‑Speed 1–20, Presets 0–127). Gegen die Marshall‑VISCA‑Befehlsliste prüfen und bei Bedarf erweitern. Prüfen, ob der Befehl `Zoom - Memory Mode` (`81 01 04 47 00 0p FF`) korrekt ist: Er überschneidet sich mit `Zoom - Direct`.
2. **Inquiries (Abfragen) implementieren.**
   Die Bibliothek kennt bereits die Pakettypen `INQUERY`/`ANSWER`, es fehlt aber eine `InquiryRequest`‑Klasse. Darauf aufbauend:
   - **Variablen**: Power‑Status, Zoom‑/Fokus‑Position, Fokus‑Modus, Weißabgleich‑Modus, zuletzt aufgerufenes Preset
   - **Feedbacks**: z. B. „Kamera an“, „Autofokus aktiv“, „Preset X aktiv“
   - **Keepalive**: periodische Abfrage für einen zuverlässigen Verbindungsstatus. Bisher wird der Status nur beim Start und bei fehlschlagenden Befehlen geprüft.
3. **Button‑Presets** für die Companion‑Oberfläche:
   - Pan/Tilt‑Pfeile (Drive beim Drücken, Stop beim Loslassen)
   - Zoom‑Tasten
   - Preset‑Recall/Set 1–16
   - Power
4. **Exposure‑Steuerung**:
   - AE‑Modus (Auto/Manuell/Shutter‑/Iris‑Priorität)
   - Iris (die Lookup‑Tabelle `irisPositionArray` existiert schon, wird aber nicht genutzt)
   - Shutter, Gain, Belichtungskorrektur, Backlight, WDR

## Priorität mittel

5. **Pan/Tilt erweitern**:
   - Absolute und relative Position (dafür ist eine vorzeichenbehaftete Kodierung im Parameter‑Framework nötig)
   - Pan‑/Tilt‑Limits
   - Preset‑Recall‑Geschwindigkeit
   - Speed per Variable/Expression mit eigener „Speed‑Up/Down“‑Logik (wie bei anderen PTZ‑Modulen)
6. **Bildeinstellungen**:
   - Helligkeit, Schärfe, Farbsättigung, Gamma
   - Flip/Mirror
   - Rauschunterdrückung (2D/3D), Defog, Picture Freeze
7. **Modellauswahl in der Konfiguration.** Damit nur unterstützte Werte angeboten werden:
   - Auflösungen: 1080i fehlt bisher, 4K nur bei 4K‑Modellen
   - Zoombereich (5x/7x/12x/20x/30x)
8. **OSD‑Menüsteuerung** (Menü an/aus, Navigation, Enter), z. B. für die Einrichtung ohne Fernbedienung.
9. **Aktion „Custom VISCA Command“** zum Senden beliebiger Hex‑Befehle, für alles, was noch nicht abgedeckt ist.

## Priorität niedrig / Infrastruktur

10. **Weitere Transportwege**: VISCA über TCP bzw. „raw“ VISCA ohne Sony‑IP‑Header (falls einzelne Marshall‑Modelle/Firmwares das erfordern), Hostnamen statt nur IPv4.
11. **Tally**: prüfen, ob die Kameras eine Tally‑LED per VISCA unterstützen.
12. **CI**: `yarn test` im GitHub‑Workflow ausführen. Der Bitfocus‑Check baut nur das Paket.
13. **Release‑Workflow und Veröffentlichung** im Companion‑Modul‑Repository (`release.yaml` aus dem Template), danach Upgrade‑Scripts pflegen, sobald sich Action‑IDs ändern.
14. **Typisierung**: JSDoc‑Typen oder Umstieg auf TypeScript, damit Companion die Action‑Optionen typsicher prüfen kann.
