/**
 * Every external page the development calendar links to, in one place so a
 * moved URL is a one-line fix rather than a hunt through 152 content entries.
 *
 * Only public-health and paediatric institutions — no commercial parenting
 * portals, and nothing built on the scientifically unsupported "leaps"/
 * "wonder weeks" model. The entries only ever *link* out; nothing is embedded
 * or fetched, so the self-hosted app makes no third-party requests on its own.
 *
 * `language` is the language the linked page is written in, so the UI can flag
 * an English source to German readers (and vice versa).
 */
export interface DevelopmentSource {
  url: string;
  title: string;
  publisher: string;
  language: 'de' | 'en';
}

const KGI = 'https://www.kindergesundheit-info.de';
const KGI_PUBLISHER = 'kindergesundheit-info.de (BIÖG)';
const CDC_MILESTONES = 'https://www.cdc.gov/act-early/milestones';
const CDC_PUBLISHER = 'CDC – Learn the Signs. Act Early.';

export const DEVELOPMENT_SOURCES = {
  kgiFirstYear: {
    url: `${KGI}/themen/entwicklung/0-12-monate/`,
    title: 'Entwicklung im 1. Lebensjahr',
    publisher: KGI_PUBLISHER,
    language: 'de',
  },
  kgiDevelopmentTasks: {
    url: `${KGI}/themen/entwicklung/0-12-monate/entwicklungsaufgaben/`,
    title: '„Entwicklungsaufgaben“ der ersten Monate',
    publisher: KGI_PUBLISHER,
    language: 'de',
  },
  kgiCrying: {
    url: `${KGI}/themen/entwicklung/0-12-monate/schreien/`,
    title: 'Das Schreien des Babys',
    publisher: KGI_PUBLISHER,
    language: 'de',
  },
  kgiCryingProblems: {
    url: `${KGI}/themen/entwicklung/0-12-monate/schreien/schreiprobleme/`,
    title: 'Schreiprobleme',
    publisher: KGI_PUBLISHER,
    language: 'de',
  },
  kgiBabySleep: {
    url: `${KGI}/themen/schlafen/0-12-monate/babyschlaf/`,
    title: 'Babyschlaf',
    publisher: KGI_PUBLISHER,
    language: 'de',
  },
  kgiSleepProblems: {
    url: `${KGI}/themen/schlafen/schlafprobleme/schlafprobleme-baby/`,
    title: 'Schlafprobleme bei Babys',
    publisher: KGI_PUBLISHER,
    language: 'de',
  },
  kgiCheckups: {
    url: `${KGI}/themen/frueherkennung-u1-u9-und-j1/untersuchungen-u1-bis-u9/`,
    title: 'Früherkennungsuntersuchungen U1 bis U9',
    publisher: KGI_PUBLISHER,
    language: 'de',
  },
  kgiHome: {
    url: `${KGI}/`,
    title: 'Gesundheit und Entwicklung von Kindern',
    publisher: KGI_PUBLISHER,
    language: 'de',
  },
  bmgCheckups: {
    url: 'https://www.bundesgesundheitsministerium.de/themen/praevention/kindergesundheit/frueherkennungsuntersuchung-bei-kindern',
    title: 'Gesundheitsuntersuchungen für Kinder und Jugendliche',
    publisher: 'Bundesministerium für Gesundheit',
    language: 'de',
  },
  rkiVaccinationSchedule: {
    url: 'https://www.rki.de/impfkalender',
    title: 'Impfkalender der STIKO',
    publisher: 'Robert Koch-Institut',
    language: 'de',
  },
  elternsein: {
    url: 'https://www.elternsein.info/',
    title: 'Elternsein – Infos und Hilfe für die ersten Lebensjahre',
    publisher: 'Nationales Zentrum Frühe Hilfen',
    language: 'de',
  },
  gesundInsLeben: {
    url: 'https://www.gesund-ins-leben.de/',
    title: 'Ernährung von Säuglingen und Kleinkindern',
    publisher: 'Netzwerk Gesund ins Leben',
    language: 'de',
  },
  whoMotorMilestones: {
    url: 'https://www.who.int/tools/child-growth-standards/standards/motor-development-milestones',
    title: 'Motor development milestones',
    publisher: 'World Health Organization',
    language: 'en',
  },
  cdc2Months: {
    url: `${CDC_MILESTONES}/2-months.html`,
    title: 'Milestones by 2 Months',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc4Months: {
    url: `${CDC_MILESTONES}/4-months.html`,
    title: 'Milestones by 4 Months',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc6Months: {
    url: `${CDC_MILESTONES}/6-months.html`,
    title: 'Milestones by 6 Months',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc9Months: {
    url: `${CDC_MILESTONES}/9-months.html`,
    title: 'Milestones by 9 Months',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc1Year: {
    url: `${CDC_MILESTONES}/1-year.html`,
    title: 'Milestones by 1 Year',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc15Months: {
    url: `${CDC_MILESTONES}/15-months.html`,
    title: 'Milestones by 15 Months',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc18Months: {
    url: `${CDC_MILESTONES}/18-months.html`,
    title: 'Milestones by 18 Months',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc2Years: {
    url: `${CDC_MILESTONES}/2-years.html`,
    title: 'Milestones by 2 Years',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc30Months: {
    url: `${CDC_MILESTONES}/30-months.html`,
    title: 'Milestones by 30 Months',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  cdc3Years: {
    url: `${CDC_MILESTONES}/3-years.html`,
    title: 'Milestones by 3 Years',
    publisher: CDC_PUBLISHER,
    language: 'en',
  },
  nhsBabyMoves: {
    url: 'https://www.nhs.uk/start-for-life/baby/baby-moves/',
    title: 'Baby moves – tummy time, rolling and crawling',
    publisher: 'NHS Start for Life',
    language: 'en',
  },
  nhsCryingBaby: {
    url: 'https://www.nhs.uk/baby/caring-for-a-newborn/soothing-a-crying-baby/',
    title: 'Soothing a crying baby',
    publisher: 'NHS',
    language: 'en',
  },
} as const satisfies Record<string, DevelopmentSource>;

export type DevelopmentSourceId = keyof typeof DEVELOPMENT_SOURCES;
