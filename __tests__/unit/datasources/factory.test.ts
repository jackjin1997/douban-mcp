import { createDataSource } from '../../../src/datasources/factory.js';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { FrodoDataSource } from '../../../src/datasources/FrodoDataSource.js';
import { AuthError } from '../../../src/errors.js';

describe('createDataSource', () => {
  it('default returns HtmlDataSource', () => {
    expect(createDataSource({ kind: 'html' })).toBeInstanceOf(HtmlDataSource);
  });

  it('omitting kind defaults to html', () => {
    expect(createDataSource({})).toBeInstanceOf(HtmlDataSource);
  });

  it('throws for unknown kind', () => {
    expect(() => createDataSource({ kind: 'mystery' as any })).toThrow();
  });

  it('frodo is disabled by default', () => {
    expect(() => createDataSource({ kind: 'frodo' })).toThrow(AuthError);
  });

  it('frodo returns FrodoDataSource when explicitly enabled', () => {
    expect(createDataSource({ kind: 'frodo', allowExperimentalFrodo: true })).toBeInstanceOf(FrodoDataSource);
  });

  it('honors DOUBAN_DATA_SOURCE=frodo env only with explicit opt-in', () => {
    process.env.DOUBAN_DATA_SOURCE = 'frodo';
    process.env.DOUBAN_EXPERIMENTAL_FRODO = 'true';
    try {
      expect(createDataSource({})).toBeInstanceOf(FrodoDataSource);
    } finally {
      delete process.env.DOUBAN_DATA_SOURCE;
      delete process.env.DOUBAN_EXPERIMENTAL_FRODO;
    }
  });
});
