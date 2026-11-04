import {
  ALEXA_MESSAGE_CATALOG,
  ALEXA_MESSAGE_KEYS,
  AlexaMessages,
  placeholdersOf,
  renderTemplate,
  toAlexaLocale,
  unknownPlaceholdersInOverride,
} from './alexa-messages';

describe('Alexa message catalog', () => {
  it('has the same keys in German and English', () => {
    expect(Object.keys(ALEXA_MESSAGE_CATALOG.en).sort()).toEqual([...ALEXA_MESSAGE_KEYS].sort());
  });

  it.each(ALEXA_MESSAGE_KEYS)('uses the same placeholders in both languages for %s', (key) => {
    expect(placeholdersOf(ALEXA_MESSAGE_CATALOG.en[key]).sort()).toEqual(
      placeholdersOf(ALEXA_MESSAGE_CATALOG.de[key]).sort(),
    );
  });

  it('has no empty texts', () => {
    for (const locale of ['de', 'en'] as const) {
      for (const key of ALEXA_MESSAGE_KEYS) {
        // `side.*`-style fragments may be short, but never empty.
        expect(ALEXA_MESSAGE_CATALOG[locale][key].trim()).not.toBe('');
      }
    }
  });
});

describe('toAlexaLocale', () => {
  it.each([
    ['de-DE', 'de'],
    ['de-AT', 'de'],
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['fr-FR', 'en'],
    [undefined, 'en'],
  ] as const)('maps %s to %s', (input, expected) => {
    expect(toAlexaLocale(input)).toBe(expected);
  });
});

describe('renderTemplate', () => {
  it('fills placeholders and keeps unknown ones visible', () => {
    expect(renderTemplate('{a} und {b} und {c}', { a: 'eins', b: 2 })).toBe('eins und 2 und {c}');
  });
});

describe('AlexaMessages', () => {
  it('uses the built-in text by default', () => {
    expect(new AlexaMessages().t('de', 'goodbye')).toBe(ALEXA_MESSAGE_CATALOG.de.goodbye);
  });

  it('applies per-locale overrides from config.yml', () => {
    const messages = new AlexaMessages({
      de: { solidLogged: 'Brei für {childName} notiert.' },
    });

    expect(messages.t('de', 'solidLogged', { childName: 'Emma' })).toBe('Brei für Emma notiert.');
    expect(messages.t('en', 'solidLogged', { childName: 'Emma' })).toBe(
      'Okay, logged solids for Emma.',
    );
  });

  it('ignores unknown override keys', () => {
    const messages = new AlexaMessages({ de: { notAKey: 'x' } });
    expect(messages.t('de', 'goodbye')).toBe(ALEXA_MESSAGE_CATALOG.de.goodbye);
  });
});

describe('unknownPlaceholdersInOverride', () => {
  it('reports placeholders the built-in template does not provide', () => {
    expect(unknownPlaceholdersInOverride('de', 'solidLogged', '{childName} {chidlName}')).toEqual([
      'chidlName',
    ]);
  });

  it('accepts a subset of the provided placeholders', () => {
    expect(unknownPlaceholdersInOverride('en', 'bottleLogged', 'Bottle logged.')).toEqual([]);
  });
});
