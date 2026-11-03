# Roadmap

Stand: November 2026.

## Umgesetzt

- Inquiries mit Variablen, Feedbacks und Keepalive (Status‑Polling, einstellbares Intervall)
- Button‑Presets: Pan/Tilt, Zoom, Speed, Presets 0–15 (kurz drücken = abrufen, 2 s halten = speichern), Power, Fokus
- Exposure: AE‑Modus, Iris (nutzt `irisPositionArray`), Shutter, Gain, Bright, Belichtungskorrektur, Backlight, WDR
- Pan/Tilt: absolute und relative Position, Limits, Geschwindigkeit im Modul mit Speed‑Up/Down
- Bild: Aperture (Schärfe), Color Gain (Sättigung), Hue, Gamma, Rauschunterdrückung, Flip, Mirror, Defog, Picture Freeze
- Presets für Belichtung/Iris, Farbe/Weißabgleich und Bild mit Wertanzeige; Iris als Blendenwert
- Modellauswahl: Full‑HD‑Modelle bieten keine UHD‑Auflösungen an
- OSD‑Menü an/aus/umschalten, Navigation über _Pan Tilt - Drive_
- Aktion „Custom VISCA Command“
- Raw VISCA über TCP/UDP und Hostnamen
- Tally (Sony‑kompatibler Befehl)
- CI mit Tests, Formatprüfung und Typprüfung, Release‑Workflow
- JSDoc‑Typen mit Typprüfung für den Modulcode

## Offen

### Priorität hoch

1. **An Hardware verifizieren (CV612, CV630, CV730).** Alle Befehle nutzen Standard‑VISCA‑Codes nach der Sony‑Referenz, Marshall dokumentiert sie nicht öffentlich. Zu prüfen:
   - ✅ Pan/Tilt‑Steuerung an echter Kamera bestätigt (November 2026)
   - ✅ Feldtest: Die Kamera stempelt Antworten mit der zuletzt empfangenen Sequenznummer. Antworten werden deshalb nach Inhalt und Socket‑Nummer zugeordnet.
   - Fokus‑Modus‑Abfrage liefert `04` (undokumentiert, wird als `Unknown (0x04)` angezeigt): Bedeutung klären
   - Wertebereiche: Presets 0–127, Shutter/Gain/Bright/Gamma
   - Pan/Tilt‑Positionsbereich für absolute/relative Positionen und Limits
   - Codes für Bild, Exposure, Menü und Tally, Abfragen für Farbe/Exposure (Rot/Blau‑Gain, Color Gain, Hue, Aperture, Backlight, WDR)
   - Iris‑Tabelle (`irisPositionArray`): stimmt der angezeigte Blendenwert mit dem Kameramenü überein?
   - Der Befehl `Zoom - Memory Mode` (`81 01 04 47 00 0p FF`) überschneidet sich mit `Zoom - Direct` und ist vermutlich falsch.
2. **Preset‑Recall‑Geschwindigkeit.** Es gibt keinen dokumentierten Marshall‑Befehl. Sony nutzt `81 01 7E 01 0B pp FF`; das lässt sich bis zur Klärung über „Custom VISCA Command“ testen.
3. **Fehlende Auflösungscodes**: 1080i sowie UHD60 beim CV730. Die Codes sind unbekannt.

### Priorität mittel

4. **OSD‑Menü „Enter“.** Der Marshall‑Code ist unbekannt, Sony nutzt `81 01 7E 01 02 00 01 FF`.
5. **2D‑ und 3D‑Rauschunterdrückung getrennt** einstellbar machen, falls die Kameras das unterstützen. Bisher gibt es nur eine gemeinsame Stufe.
6. **Learn‑Callbacks**: aktuelle Pan/Tilt‑, Zoom‑ und Fokus‑Position per „Learn“ in die Direct‑/Absolute‑Actions übernehmen.
7. **Zoombereich je Modell** nutzen, z. B. die Zoom‑Position als Faktor (12x, 30x) in einer Variable anzeigen.

### Priorität niedrig

8. **Veröffentlichung** im Bitfocus‑Modulrepository. Danach Upgrade‑Scripts pflegen, sobald sich Action‑IDs ändern.
9. **Strengere Typisierung**: `noImplicitAny` aktivieren bzw. die VISCA‑Bibliothek auf TypeScript umstellen.
