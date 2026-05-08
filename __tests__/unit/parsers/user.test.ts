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
    expect(profile.uid.length).toBeGreaterThan(0);
    expect(profile.name.length).toBeGreaterThan(0);
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
