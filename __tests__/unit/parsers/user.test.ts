import { loadFixture } from '../../helpers/loadFixture.js';
import { parseUserCollections, parseUserProfile, parseUserDoulist } from '../../../src/datasources/parsers/user.js';

describe('parseUserCollections (movie/collect)', () => {
  const items = parseUserCollections(loadFixture('user/collections-watched.html'), 'movie', 'collect');
  it('returns items with subject id and title', () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].subject.id).toMatch(/^\d+$/);
    expect(items[0].subject.title.length).toBeGreaterThan(0);
  });
  it('preserves status', () => {
    expect(items[0].status).toBe('collect');
  });
});

describe('parseUserProfile', () => {
  const profile = parseUserProfile(loadFixture('user/profile.html'));
  it('extracts uid and name', () => {
    expect(profile.uid).toBe('1524942');
    expect(profile.name).toBe('山风如月');
  });
  it('signature is the h1 signature line, not the uid / join-date block', () => {
    expect(profile.signature).toBe('海上去');
  });
  it('signature is undefined when the user has none', () => {
    const html = loadFixture('user/profile.html').replace(/<div id="display" class="signature_display pl">[^<]*<\/div>/, '');
    expect(parseUserProfile(html).signature).toBeUndefined();
  });
});

describe('parseUserDoulist (lenient — fixture user has no public doulists)', () => {
  it('returns an array (empty allowed) without throwing', () => {
    expect(() => parseUserDoulist(loadFixture('user/doulist.html'))).not.toThrow();
    const doulists = parseUserDoulist(loadFixture('user/doulist.html'));
    expect(Array.isArray(doulists)).toBe(true);
    // No length assertion — fixture user has 0 public doulists
    for (const d of doulists) {
      expect(d.id).toMatch(/^\d+$/);
      expect(d.title.length).toBeGreaterThan(0);
    }
  });
});
