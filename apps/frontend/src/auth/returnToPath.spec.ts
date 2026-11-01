import { describe, expect, it } from 'vitest';
import { toReturnToPath } from './returnToPath';

describe('toReturnToPath', () => {
  it('joins path, query and hash', () => {
    expect(toReturnToPath({ pathname: '/alexa/link', search: '?state=a', hash: '#x' })).toBe(
      '/alexa/link?state=a#x',
    );
  });

  it('is undefined without a location', () => {
    expect(toReturnToPath(undefined)).toBeUndefined();
  });
});
