import { createDataSource, FRODO_UNAVAILABLE_MESSAGE } from '../../../src/datasources/factory.js';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { AuthError } from '../../../src/errors.js';

describe('createDataSource', () => {
  it('default returns HtmlDataSource', () => {
    expect(createDataSource({ kind: 'html' })).toBeInstanceOf(HtmlDataSource);
  });

  it('omitting kind defaults to html', () => {
    expect(createDataSource({})).toBeInstanceOf(HtmlDataSource);
  });

  it('throws for unknown kind', () => {
    expect(() => createDataSource({ kind: 'mystery' as any })).toThrow('Unknown DOUBAN_DATA_SOURCE=mystery');
  });

  it('frodo is removed: throws AuthError with the migration message', () => {
    expect(() => createDataSource({ kind: 'frodo' })).toThrow(AuthError);
    expect(() => createDataSource({ kind: 'frodo' })).toThrow(FRODO_UNAVAILABLE_MESSAGE);
  });

  it('DOUBAN_DATA_SOURCE=frodo from env fails the same way, even with the old opt-in flag', () => {
    process.env.DOUBAN_DATA_SOURCE = 'frodo';
    process.env.DOUBAN_EXPERIMENTAL_FRODO = 'true';
    try {
      expect(() => createDataSource({})).toThrow(AuthError);
    } finally {
      delete process.env.DOUBAN_DATA_SOURCE;
      delete process.env.DOUBAN_EXPERIMENTAL_FRODO;
    }
  });
});
