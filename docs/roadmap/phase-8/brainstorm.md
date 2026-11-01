# Phase 8 – Brainstorm: Alexa-Integration

Ursprüngliche Ideensammlung (Stand 2026-11-01), unverändert festgehalten. Die daraus abgeleitete,
umgesetzte Planung mit Anforderungen, Entscheidungen und Definition of Done steht in
[`README.md`](README.md).

---

Erstellung eines Alexa-Skills zur Interaktion mit der App zur Nachverfolgung von Baby-Aktivitäten.

- Ermöglichung von Sprachbefehlen zur Protokollierung von Fütterungen, Windelwechseln und
  Schlafphasen.
- Abfragemöglichkeiten: Wann wurde das Baby zuletzt gefüttert, gewickelt oder hat geschlafen?
- Bereitstellung von Zusammenfassungen der Aktivitäten des Babys.
- Einrichtung von Erinnerungen für anstehende Fütterungen oder die Gabe von Medikamenten.
- Unterstützung für den Zugriff durch mehrere Familienmitglieder.
- Zukünftige Unterstützung für mehrere Babys: Entweder kann in den Sprachbefehlen angegeben werden,
  auf welches Baby sich die Aktion bezieht, oder es lässt sich ein Standard-Baby festlegen.
- Optional: Anpassbarkeit von Sprachbefehlen und Antworten.

Nutzung der „Account Linking"-Funktion im Alexa-Skill, um das Benutzerkonto mit der
Baby-Tracking-App zu verknüpfen. Prüfung, ob spezifische Alexa-Endpunkte erforderlich sind oder
bestehende genutzt werden können. Umgang mit Berechtigungen: Wie wird bei Alexa-Skills mit
unzureichenden Berechtigungen verfahren? Es sollte die Implementierung von Fallback-Antworten in
Betracht gezogen werden.
