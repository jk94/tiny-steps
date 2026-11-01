import { sanitizeReturnTo } from './return-to';

describe('sanitizeReturnTo', () => {
  it.each([
    ['/alexa/link?client_id=a&state=b', '/alexa/link?client_id=a&state=b'],
    ['/invites/abc', '/invites/abc'],
    ['/households/1#top', '/households/1#top'],
    ['/a/../b', '/b'],
  ])('keeps the same-origin path %s', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it.each([
    [undefined],
    [''],
    [['/a', '/b']],
    ['https://evil.example/'],
    ['//evil.example/'],
    ['/\\evil.example/'],
    ['\\\\evil.example'],
    ['javascript:alert(1)'],
    ['relative/path'],
    ['/api/auth/me'],
    ['/api'],
    ['/a\nb'],
    ['/' + 'x'.repeat(2048)],
  ])('rejects %p', (input) => {
    expect(sanitizeReturnTo(input)).toBeUndefined();
  });
});
