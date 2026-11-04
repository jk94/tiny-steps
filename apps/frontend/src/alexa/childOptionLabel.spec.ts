import { describe, expect, it } from 'vitest';
import { childOptionLabel } from './childOptionLabel';

const emma = { id: '1', name: 'Emma', householdName: 'Müller' };
const paul = { id: '2', name: 'Paul', householdName: 'Müller' };
const lotta = { id: '3', name: 'Lotta', householdName: 'Schmidt' };

describe('childOptionLabel', () => {
  it('shows only the name within one household', () => {
    expect(childOptionLabel(emma, [emma, paul])).toBe('Emma');
  });

  it('adds the household once children span several', () => {
    expect(childOptionLabel(emma, [emma, lotta])).toBe('Emma (Müller)');
  });
});
