import { HouseholdRole } from '../../household/household-role.enum';
import type { AccessibleChild } from '../alexa-child-directory.service';
import { matchChildrenByName, normalizeName, resolveChild } from './child-resolver';

function child(id: string, name: string, householdId = 'h1'): AccessibleChild {
  return { id, name, householdId, householdName: 'Familie', role: HouseholdRole.OWNER };
}

const EMMA = child('c-emma', 'Emma');
const PAUL = child('c-paul', 'Paul Maximilian');
const ZOE = child('c-zoe', 'Zoë');
const JUERGEN = child('c-juergen', 'Jürgen');

describe('resolveChild', () => {
  it('reports when there is no child at all', () => {
    expect(resolveChild([], undefined, null)).toEqual({ kind: 'noChildren' });
    expect(resolveChild([], 'Emma', null)).toEqual({ kind: 'noChildren' });
  });

  it('uses the only child when none is named', () => {
    expect(resolveChild([EMMA], undefined, null)).toEqual({ kind: 'resolved', child: EMMA });
  });

  it('uses the default child when none is named', () => {
    expect(resolveChild([EMMA, PAUL], undefined, PAUL.id)).toEqual({
      kind: 'resolved',
      child: PAUL,
    });
  });

  it('ignores a default child the user can no longer reach', () => {
    expect(resolveChild([EMMA, PAUL], undefined, 'c-gone')).toEqual({
      kind: 'ambiguous',
      candidates: [EMMA, PAUL],
    });
  });

  it('lets a spoken name win over the default', () => {
    expect(resolveChild([EMMA, PAUL], 'Emma', PAUL.id)).toEqual({ kind: 'resolved', child: EMMA });
  });

  it('never falls back to the default for an unknown name', () => {
    expect(resolveChild([EMMA, PAUL], 'Lotta', PAUL.id)).toEqual({
      kind: 'notFound',
      spokenName: 'Lotta',
      candidates: [EMMA, PAUL],
    });
  });

  it('reports a name shared by two children as ambiguous', () => {
    const otherEmma = child('c-emma-2', 'Emma', 'h2');
    expect(resolveChild([EMMA, otherEmma], 'Emma', null)).toEqual({
      kind: 'ambiguous',
      candidates: [EMMA, otherEmma],
    });
  });
});

describe('matchChildrenByName', () => {
  const all = [EMMA, PAUL, ZOE, JUERGEN];

  it.each([
    ['emma', EMMA],
    ['Emmas', EMMA],
    ["Emma's", EMMA],
    ['Paul', PAUL],
    ['paul maximilian', PAUL],
    ['Zoe', ZOE],
    ['Juergen', JUERGEN],
    ['Jurgen', JUERGEN],
    ['Ema', EMMA],
  ])('matches "%s"', (spoken, expected) => {
    expect(matchChildrenByName(all, spoken)).toEqual([expected]);
  });

  it('prefers an exact match over a near one', () => {
    const lea = child('c-lea', 'Lea');
    const lena = child('c-lena', 'Lena');
    expect(matchChildrenByName([lea, lena], 'Lea')).toEqual([lea]);
    expect(matchChildrenByName([lea, lena], 'Lena')).toEqual([lena]);
  });

  it('does not match names that are too different', () => {
    expect(matchChildrenByName([child('c-mia', 'Mia')], 'Max')).toEqual([]);
    expect(matchChildrenByName(all, '')).toEqual([]);
  });
});

describe('normalizeName', () => {
  it('folds case, umlauts, accents and punctuation', () => {
    expect(normalizeName('  Zoë-Marie ')).toBe('zoemarie');
    expect(normalizeName('Jürgen  Groß')).toBe('juergen gross');
  });
});
