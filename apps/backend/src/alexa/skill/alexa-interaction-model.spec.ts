import { readFileSync } from 'fs';
import { join } from 'path';
import { ALEXA_BUILT_IN_INTENTS, ALEXA_INTENTS, SLOT, SLOT_TYPE_IDS } from './alexa-slots';
import { REMINDERS_PERMISSION } from './alexa-response';

/**
 * Keeps the shipped skill package (`alexa/skill-package/`) and the handlers in
 * sync: operators paste these models into their own skill, so an intent or slot
 * renamed on only one side would silently break voice commands (ALX-13).
 */
const PACKAGE_DIR = join(__dirname, '..', '..', '..', '..', '..', 'alexa', 'skill-package');
const LOCALES = ['de-DE', 'en-US'] as const;

interface ModelSlot {
  name: string;
  type: string;
  samples?: string[];
}
interface ModelIntent {
  name: string;
  slots?: ModelSlot[];
  samples: string[];
}
interface InteractionModel {
  interactionModel: {
    languageModel: {
      invocationName: string;
      intents: ModelIntent[];
      types: Array<{ name: string; values: Array<{ id: string; name: { value: string } }> }>;
    };
    dialog: { intents: Array<{ name: string; slots: Array<{ name: string; type: string }> }> };
  };
}

function loadModel(locale: string): InteractionModel {
  return JSON.parse(
    readFileSync(join(PACKAGE_DIR, 'interactionModels', 'custom', `${locale}.json`), 'utf8'),
  ) as InteractionModel;
}

const CUSTOM_INTENTS = Object.values(ALEXA_INTENTS).sort();
const SLOT_NAMES: string[] = Object.values(SLOT);

describe.each(LOCALES)('interaction model %s', (locale) => {
  const model = loadModel(locale).interactionModel;
  const intents = model.languageModel.intents;
  const custom = intents.filter((intent) => !intent.name.startsWith('AMAZON.'));

  it('declares exactly the custom intents the backend handles', () => {
    expect(custom.map((intent) => intent.name).sort()).toEqual(CUSTOM_INTENTS);
  });

  it('declares the built-in intents the backend answers', () => {
    const names = intents.map((intent) => intent.name);
    for (const builtIn of Object.values(ALEXA_BUILT_IN_INTENTS)) {
      expect(names).toContain(builtIn);
    }
  });

  it('gives every custom intent a child slot and only known slot names', () => {
    for (const intent of custom) {
      const slotNames = (intent.slots ?? []).map((slot) => slot.name);
      expect(slotNames).toContain(SLOT.child);
      for (const name of slotNames) {
        expect(SLOT_NAMES).toContain(name);
      }
    }
  });

  it('only references declared slots in sample utterances', () => {
    for (const intent of custom) {
      const declared = new Set((intent.slots ?? []).map((slot) => slot.name));
      const samples = [
        ...intent.samples,
        ...(intent.slots ?? []).flatMap((slot) => slot.samples ?? []),
      ];
      for (const sample of samples) {
        for (const [, ref] of sample.matchAll(/\{(\w+)\}/g)) {
          expect(declared.has(ref)).toBe(true);
        }
        // Alexa rejects digits in sample utterances.
        expect(sample).not.toMatch(/\d/);
      }
    }
  });

  it('uses exactly the value IDs the handlers understand for each custom slot type', () => {
    const types = new Map(model.languageModel.types.map((type) => [type.name, type]));
    for (const [typeName, ids] of Object.entries(SLOT_TYPE_IDS)) {
      const type = types.get(typeName);
      expect(type).toBeDefined();
      expect(type!.values.map((value) => value.id).sort()).toEqual([...ids].sort());
    }
  });

  it('lists every custom intent with its slots in the dialog model (needed for Dialog.ElicitSlot)', () => {
    const dialog = new Map(model.dialog.intents.map((intent) => [intent.name, intent]));
    for (const intent of custom) {
      expect(
        dialog
          .get(intent.name)
          ?.slots.map((slot) => slot.name)
          .sort(),
      ).toEqual((intent.slots ?? []).map((slot) => slot.name).sort());
    }
  });
});

describe('skill package', () => {
  it('uses the same slots and slot types in every locale', () => {
    const shapes = LOCALES.map((locale) =>
      loadModel(locale)
        .interactionModel.languageModel.intents.map((intent) => ({
          name: intent.name,
          slots: (intent.slots ?? []).map((slot) => `${slot.name}:${slot.type}`).sort(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    expect(shapes[1]).toEqual(shapes[0]);
  });

  it('requests the reminders permission and ships both locales in the manifest', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'skill.json'), 'utf8')) as {
      manifest: {
        permissions: Array<{ name: string }>;
        publishingInformation: { locales: Record<string, unknown> };
        apis: { custom: { endpoint: { uri: string } } };
      };
    };
    expect(manifest.manifest.permissions).toContainEqual({ name: REMINDERS_PERMISSION });
    expect(Object.keys(manifest.manifest.publishingInformation.locales).sort()).toEqual([
      ...LOCALES,
    ]);
    expect(manifest.manifest.apis.custom.endpoint.uri).toMatch(/\/api\/alexa\/skill$/);
  });
});
