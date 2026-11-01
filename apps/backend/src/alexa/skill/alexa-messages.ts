/**
 * Everything the Alexa skill says, per locale (ALX-13).
 *
 * Templates use `{placeholder}` slots that the skill fills in. Operators can
 * override any entry per locale in `config.yml` (`alexa.responses.<de|en>.<key>`);
 * `configuration.schema.ts` rejects unknown keys and placeholders a template
 * does not provide at startup, so a typo fails fast instead of making Alexa
 * read out a literal "{chidlName}".
 *
 * Deliberately not part of the frontend's i18n JSON: these are spoken
 * sentences with their own grammar (German dative after "vor"/"nach", counted
 * nouns), consumed only by the backend.
 */

export type AlexaLocale = 'de' | 'en';

export const ALEXA_LOCALES: readonly AlexaLocale[] = ['de', 'en'];

/** Maps an Alexa request locale (`de-DE`, `en-GB`, …) to a catalog. */
export function toAlexaLocale(requestLocale: string | undefined): AlexaLocale {
  return requestLocale?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

const de = {
  // --- session -------------------------------------------------------------
  welcome:
    'Hallo! Du kannst zum Beispiel sagen: Windel nass, Flasche mit 120 Millilitern, oder: Wann wurde zuletzt gefüttert?',
  welcomeReprompt: 'Was möchtest du eintragen oder wissen?',
  help:
    'Ich kann Fütterungen, Windeln und Schlaf eintragen, zum Beispiel: Emma hatte eine volle Windel, Stillen links starten, oder: Emma schläft jetzt. ' +
    'Du kannst fragen: Wann wurde Emma zuletzt gewickelt? Oder: Wie war Emmas Tag? ' +
    'Und ich stelle Erinnerungen, zum Beispiel: Erinnere mich in drei Stunden ans Füttern. Was möchtest du tun?',
  helpReprompt: 'Was möchtest du tun?',
  goodbye: 'Bis bald!',
  fallback:
    'Das habe ich leider nicht verstanden. Du kannst Fütterungen, Windeln und Schlaf eintragen, nachfragen, wann zuletzt gefüttert wurde, oder Hilfe sagen. Was möchtest du tun?',
  fallbackReprompt: 'Sag zum Beispiel: Windel nass. Oder: Hilfe.',
  error: 'Da ist leider etwas schiefgelaufen. Bitte versuche es gleich noch einmal.',

  // --- account & permissions ------------------------------------------------
  linkAccount:
    'Dafür musst du zuerst dein TinySteps-Konto verknüpfen. Ich habe dir dazu eine Karte in der Alexa-App geschickt.',
  noChildren:
    'In deinem TinySteps-Konto ist noch kein Kind angelegt. Lege es bitte zuerst in der App an.',
  childNotFound:
    'Ich habe kein Kind namens {spokenName} gefunden. Ich kenne {childList}. Für welches Kind?',
  childAmbiguous: 'Für welches Kind: {childList}?',
  childReprompt: 'Für welches Kind: {childList}?',
  forbiddenRecord:
    'Als {roleLabel} kannst du für {childName} nichts eintragen. Du kannst aber fragen, wann {childName} zuletzt gefüttert, gewickelt oder schlafen gelegt wurde.',
  'role.OWNER': 'Elternteil',
  'role.CO_PARENT': 'Elternteil',
  'role.CAREGIVER': 'Betreuer',
  'role.OBSERVER': 'Beobachter',

  // --- feeding ----------------------------------------------------------------
  feedingTypeQuestion: 'Was hat {childName} bekommen: Flasche, Stillen oder Beikost?',
  bottleAmountQuestion: 'Wie viele Milliliter waren in der Flasche?',
  amountOutOfRange:
    'Die Menge muss zwischen {min} und {max} Millilitern liegen. Wie viele Milliliter waren es?',
  breastSideQuestion: 'Links oder rechts?',
  bottleLogged: 'Okay, Flasche mit {amount} Millilitern für {childName} eingetragen.',
  solidLogged: 'Okay, Beikost für {childName} eingetragen.',
  breastLogged: 'Okay, {duration} Stillen {sideText} für {childName} eingetragen.',
  breastTimerStarted:
    'Okay, Stillen {sideText} für {childName} läuft. Sag einfach: Stillen beendet, wenn ihr fertig seid.',
  breastTimerAlreadyRunning: 'Für {childName} läuft schon ein Stilltimer, seit {duration}.',
  breastTimerStopped: 'Okay, Stillen für {childName} nach {duration} beendet.',
  noBreastTimer: 'Für {childName} läuft gerade kein Stilltimer.',
  'side.LEFT': 'links',
  'side.RIGHT': 'rechts',

  // --- diaper -----------------------------------------------------------------
  diaperTypeQuestion: 'War die Windel nass, voll oder beides?',
  diaperLogged: 'Okay, {diaperAdjective} Windel für {childName} eingetragen.',
  'diaperAdjective.PEE': 'nasse',
  'diaperAdjective.STOOL': 'volle',
  'diaperAdjective.BOTH': 'nasse und volle',
  'diaperState.PEE': 'nass',
  'diaperState.STOOL': 'voll',
  'diaperState.BOTH': 'nass und voll',

  // --- sleep ------------------------------------------------------------------
  sleepStarted:
    'Okay, Schlaf für {childName} gestartet. Sag einfach Bescheid, wenn {childName} aufgewacht ist.',
  sleepAlreadyRunning: '{childName} schläft laut TinySteps schon seit {duration}.',
  sleepStopped: 'Okay, {childName} hat {duration} geschlafen.',
  noSleepTimer: 'Für {childName} läuft gerade kein Schlaf.',
  sleepDurationQuestion: 'Wie lange hat {childName} geschlafen?',
  sleepLogged: 'Okay, {duration} Schlaf für {childName} eingetragen.',
  durationOutOfRange: 'Die Dauer muss zwischen einer Minute und {maxHours} Stunden liegen.',

  // --- "when was the last …" --------------------------------------------------
  lastFeeding: 'Die letzte Fütterung von {childName} war {relative}, {when}: {detail}.',
  'feedingDetail.BOTTLE': 'Flasche mit {amount} Millilitern',
  'feedingDetail.BOTTLE_NO_AMOUNT': 'Flasche',
  'feedingDetail.SOLID': 'Beikost',
  'feedingDetail.BREAST': 'Stillen {sideText}',
  breastRunning: '{childName} wird gerade gestillt, seit {duration}.',
  noFeeding: 'Für {childName} ist noch keine Fütterung eingetragen.',
  lastDiaper: 'Die letzte Windel von {childName} war {relative}, {when}: {diaperState}.',
  noDiaper: 'Für {childName} ist noch keine Windel eingetragen.',
  sleepRunning: '{childName} schläft seit {duration}, eingeschlafen {when}.',
  lastSleep: '{childName} ist {relative} aufgewacht, {when}, nach {duration} Schlaf.',
  noSleep: 'Für {childName} ist noch kein Schlaf eingetragen.',
  relativePast: 'vor {duration}',
  justNow: 'gerade eben',
  lessThanAMinute: 'weniger als einer Minute',
  lessThanAMinuteNominative: 'weniger als eine Minute',
  whenToday: 'um {time} Uhr',
  whenYesterday: 'gestern um {time} Uhr',
  whenOnDate: 'am {date} um {time} Uhr',
  whenFutureToday: 'heute um {time} Uhr',
  whenFutureTomorrow: 'morgen um {time} Uhr',
  whenDaily: 'jeden Tag um {time} Uhr',

  // --- daily summary ----------------------------------------------------------
  summaryToday: 'Heute hatte {childName} bisher {feedings} und {diapers}.',
  summaryOtherDay: '{dayLabel} hatte {childName} {feedings} und {diapers}.',
  dayYesterday: 'Gestern',
  dayOnDate: 'Am {date}',
  summarySleep: 'Geschlafen hat {childName} insgesamt {duration}.',
  summaryNoSleep: 'Ein abgeschlossener Schlaf ist nicht eingetragen.',
  summarySleepRunning: 'Gerade schläft {childName} seit {duration}.',
  summaryLastFeeding: 'Die letzte Fütterung war {relative}.',
  'count.feeding.zero': 'keine Fütterung',
  'count.feeding.one': 'eine Fütterung',
  'count.feeding.other': '{count} Fütterungen',
  'count.diaper.zero': 'keine Windel',
  'count.diaper.one': 'eine Windel',
  'count.diaper.other': '{count} Windeln',

  // --- reminders --------------------------------------------------------------
  reminderDurationQuestion: 'In wie vielen Stunden oder Minuten soll ich dich erinnern?',
  reminderOutOfRange:
    'Ich kann dich frühestens in einer Minute und spätestens in 24 Stunden erinnern.',
  reminderFeedingCreated: 'Okay, ich erinnere dich in {duration} daran, {childName} zu füttern.',
  reminderFeedingText: 'Zeit, {childName} zu füttern.',
  reminderTimeQuestion: 'Um wie viel Uhr soll ich dich erinnern?',
  reminderMedicationCreated: 'Okay, ich erinnere dich {when} an {medication} für {childName}.',
  reminderMedicationText: 'Zeit für {medication} für {childName}.',
  medicationGeneric: 'das Medikament',
  reminderPermissionDenied:
    'Ohne deine Erlaubnis kann ich keine Erinnerungen anlegen. Du kannst sie jederzeit in der Alexa-App in den Einstellungen dieses Skills erteilen.',
  reminderFailed:
    'Die Erinnerung konnte ich leider nicht anlegen. Bitte versuche es später noch einmal.',

  // --- planned medications/vaccinations ---------------------------------------
  upcomingNone: 'Für {childName} sind keine Medikamente oder Impfungen geplant.',
  upcomingIntro: 'Für {childName} geplant: {items}.',
  upcomingItem: '{kindLabel} {name} {due}',
  'healthKind.MEDICATION': 'Medikament',
  'healthKind.VACCINATION': 'Impfung',
  dueToday: 'heute',
  dueTomorrow: 'morgen',
  dueOn: 'am {date}',
  overdueSince: 'überfällig seit dem {date}',

  // --- default child ----------------------------------------------------------
  defaultChildQuestion: 'Welches Kind soll dein Standardkind werden?',
  defaultChildSet: 'Okay, {childName} ist jetzt dein Standardkind für Alexa.',
} as const;

export type AlexaMessageKey = keyof typeof de;

const en: Record<AlexaMessageKey, string> = {
  welcome:
    'Hi! You can say things like: wet diaper, bottle with 120 milliliters, or: when was the last feeding?',
  welcomeReprompt: 'What would you like to log or know?',
  help:
    'I can log feedings, diapers and sleep, for example: Emma had a dirty diaper, start breastfeeding on the left, or: Emma is asleep. ' +
    'You can ask: when was Emma last changed? Or: how was Emma’s day? ' +
    'And I can set reminders, for example: remind me in three hours to feed. What would you like to do?',
  helpReprompt: 'What would you like to do?',
  goodbye: 'Bye for now!',
  fallback:
    'Sorry, I didn’t get that. You can log feedings, diapers and sleep, ask when the baby was last fed, or say help. What would you like to do?',
  fallbackReprompt: 'Try saying: wet diaper. Or: help.',
  error: 'Sorry, something went wrong. Please try again in a moment.',

  linkAccount:
    'To do that, please link your TinySteps account first. I’ve sent a card to the Alexa app to help you.',
  noChildren: 'There’s no child in your TinySteps account yet. Please add one in the app first.',
  childNotFound: 'I couldn’t find a child called {spokenName}. I know {childList}. Which child?',
  childAmbiguous: 'Which child: {childList}?',
  childReprompt: 'Which child: {childList}?',
  forbiddenRecord:
    'As {roleLabel}, you can’t log anything for {childName}. You can still ask when {childName} was last fed, changed or put to sleep.',
  'role.OWNER': 'a parent',
  'role.CO_PARENT': 'a parent',
  'role.CAREGIVER': 'a caregiver',
  'role.OBSERVER': 'an observer',

  feedingTypeQuestion: 'What did {childName} have: bottle, breastfeeding or solids?',
  bottleAmountQuestion: 'How many milliliters were in the bottle?',
  amountOutOfRange:
    'The amount must be between {min} and {max} milliliters. How many milliliters was it?',
  breastSideQuestion: 'Left or right?',
  bottleLogged: 'Okay, logged a bottle with {amount} milliliters for {childName}.',
  solidLogged: 'Okay, logged solids for {childName}.',
  breastLogged: 'Okay, logged {duration} of breastfeeding {sideText} for {childName}.',
  breastTimerStarted:
    'Okay, breastfeeding {sideText} for {childName} is running. Just say: breastfeeding done, when you’re finished.',
  breastTimerAlreadyRunning:
    'A breastfeeding timer is already running for {childName}, for {duration}.',
  breastTimerStopped: 'Okay, stopped breastfeeding for {childName} after {duration}.',
  noBreastTimer: 'There’s no breastfeeding timer running for {childName}.',
  'side.LEFT': 'on the left',
  'side.RIGHT': 'on the right',

  diaperTypeQuestion: 'Was the diaper wet, dirty or both?',
  diaperLogged: 'Okay, logged a {diaperAdjective} diaper for {childName}.',
  'diaperAdjective.PEE': 'wet',
  'diaperAdjective.STOOL': 'dirty',
  'diaperAdjective.BOTH': 'wet and dirty',
  'diaperState.PEE': 'wet',
  'diaperState.STOOL': 'dirty',
  'diaperState.BOTH': 'wet and dirty',

  sleepStarted: 'Okay, started sleep for {childName}. Just let me know when {childName} wakes up.',
  sleepAlreadyRunning:
    'According to TinySteps, {childName} has already been asleep for {duration}.',
  sleepStopped: 'Okay, {childName} slept for {duration}.',
  noSleepTimer: 'There’s no sleep running for {childName}.',
  sleepDurationQuestion: 'How long did {childName} sleep?',
  sleepLogged: 'Okay, logged {duration} of sleep for {childName}.',
  durationOutOfRange: 'The duration must be between one minute and {maxHours} hours.',

  lastFeeding: '{childName}’s last feeding was {relative}, {when}: {detail}.',
  'feedingDetail.BOTTLE': 'a bottle with {amount} milliliters',
  'feedingDetail.BOTTLE_NO_AMOUNT': 'a bottle',
  'feedingDetail.SOLID': 'solids',
  'feedingDetail.BREAST': 'breastfeeding {sideText}',
  breastRunning: '{childName} has been breastfeeding for {duration}.',
  noFeeding: 'No feeding has been logged for {childName} yet.',
  lastDiaper: '{childName}’s last diaper was {relative}, {when}: {diaperState}.',
  noDiaper: 'No diaper has been logged for {childName} yet.',
  sleepRunning: '{childName} has been asleep for {duration}; fell asleep {when}.',
  lastSleep: '{childName} woke up {relative}, {when}, after {duration} of sleep.',
  noSleep: 'No sleep has been logged for {childName} yet.',
  relativePast: '{duration} ago',
  justNow: 'just now',
  lessThanAMinute: 'less than a minute',
  lessThanAMinuteNominative: 'less than a minute',
  whenToday: 'at {time}',
  whenYesterday: 'yesterday at {time}',
  whenOnDate: 'on {date} at {time}',
  whenFutureToday: 'today at {time}',
  whenFutureTomorrow: 'tomorrow at {time}',
  whenDaily: 'every day at {time}',

  summaryToday: 'So far today, {childName} had {feedings} and {diapers}.',
  summaryOtherDay: '{dayLabel}, {childName} had {feedings} and {diapers}.',
  dayYesterday: 'Yesterday',
  dayOnDate: 'On {date}',
  summarySleep: 'In total, {childName} slept {duration}.',
  summaryNoSleep: 'No completed sleep is logged.',
  summarySleepRunning: '{childName} has been asleep for {duration} right now.',
  summaryLastFeeding: 'The last feeding was {relative}.',
  'count.feeding.zero': 'no feedings',
  'count.feeding.one': 'one feeding',
  'count.feeding.other': '{count} feedings',
  'count.diaper.zero': 'no diapers',
  'count.diaper.one': 'one diaper',
  'count.diaper.other': '{count} diapers',

  reminderDurationQuestion: 'In how many hours or minutes should I remind you?',
  reminderOutOfRange:
    'I can remind you in one minute at the earliest and in 24 hours at the latest.',
  reminderFeedingCreated: 'Okay, I’ll remind you in {duration} to feed {childName}.',
  reminderFeedingText: 'Time to feed {childName}.',
  reminderTimeQuestion: 'What time should I remind you?',
  reminderMedicationCreated: 'Okay, I’ll remind you {when} about {medication} for {childName}.',
  reminderMedicationText: 'Time for {medication} for {childName}.',
  medicationGeneric: 'the medication',
  reminderPermissionDenied:
    'Without your permission I can’t create reminders. You can grant it any time in the Alexa app, in this skill’s settings.',
  reminderFailed: 'Sorry, I couldn’t create the reminder. Please try again later.',

  upcomingNone: 'No medications or vaccinations are planned for {childName}.',
  upcomingIntro: 'Planned for {childName}: {items}.',
  upcomingItem: '{kindLabel} {name} {due}',
  'healthKind.MEDICATION': 'medication',
  'healthKind.VACCINATION': 'vaccination',
  dueToday: 'today',
  dueTomorrow: 'tomorrow',
  dueOn: 'on {date}',
  overdueSince: 'overdue since {date}',

  defaultChildQuestion: 'Which child should be your default child?',
  defaultChildSet: 'Okay, {childName} is now your default child for Alexa.',
};

/** The built-in catalogs. Read-only; overrides are layered on top by `AlexaMessages`. */
export const ALEXA_MESSAGE_CATALOG: Readonly<Record<AlexaLocale, Record<AlexaMessageKey, string>>> =
  { de, en };

export const ALEXA_MESSAGE_KEYS = Object.keys(de) as AlexaMessageKey[];

export function isAlexaMessageKey(value: string): value is AlexaMessageKey {
  return Object.prototype.hasOwnProperty.call(de, value);
}

const PLACEHOLDER_PATTERN = /\{([a-zA-Z]+)\}/g;

/** The `{placeholder}` names a template uses, in order of first appearance. */
export function placeholdersOf(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
}

/**
 * Placeholders an override uses that the built-in template for the same key
 * does not — those would never be filled in at runtime. Used by the config
 * schema to fail fast.
 */
export function unknownPlaceholdersInOverride(
  locale: AlexaLocale,
  key: AlexaMessageKey,
  override: string,
): string[] {
  const allowed = new Set(placeholdersOf(ALEXA_MESSAGE_CATALOG[locale][key]));
  return placeholdersOf(override).filter((name) => !allowed.has(name));
}

export type AlexaMessageParams = Readonly<Record<string, string | number>>;

/** Fills `{placeholder}` slots; an unknown slot is left visible rather than silently dropped. */
export function renderTemplate(template: string, params: AlexaMessageParams = {}): string {
  return template.replace(PLACEHOLDER_PATTERN, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

export type AlexaResponseOverrides = Partial<Record<AlexaLocale, Partial<Record<string, string>>>>;

/**
 * The effective catalog: built-in texts with the operator's `config.yml`
 * overrides on top. Constructed once at bootstrap.
 */
export class AlexaMessages {
  private readonly catalog: Record<AlexaLocale, Record<AlexaMessageKey, string>>;

  constructor(overrides: AlexaResponseOverrides = {}) {
    this.catalog = {
      de: { ...ALEXA_MESSAGE_CATALOG.de },
      en: { ...ALEXA_MESSAGE_CATALOG.en },
    };
    for (const locale of ALEXA_LOCALES) {
      for (const [key, value] of Object.entries(overrides[locale] ?? {})) {
        // The config schema already rejected unknown keys; this guard only
        // keeps a hand-constructed instance (tests) from widening the catalog.
        if (isAlexaMessageKey(key) && typeof value === 'string') {
          this.catalog[locale][key] = value;
        }
      }
    }
  }

  t(locale: AlexaLocale, key: AlexaMessageKey, params?: AlexaMessageParams): string {
    return renderTemplate(this.catalog[locale][key], params);
  }
}
