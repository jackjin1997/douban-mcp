import { createDataSource } from '../../../src/datasources/factory.js';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { FrodoDataSource } from '../../../src/datasources/FrodoDataSource.js';

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

  it('frodo returns FrodoDataSource', () => {
    expect(createDataSource({ kind: 'frodo' })).toBeInstanceOf(FrodoDataSource);
  });

  it('honors DOUBAN_DATA_SOURCE=frodo env', () => {
    process.env.DOUBAN_DATA_SOURCE = 'frodo';
    try {
      expect(createDataSource({})).toBeInstanceOf(FrodoDataSource);
    } finally {
      delete process.env.DOUBAN_DATA_SOURCE;
    }
  });
});
