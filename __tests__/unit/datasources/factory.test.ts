import { createDataSource } from '../../../src/datasources/factory.js';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';

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

  it('frodo throws "M6" until implemented', () => {
    expect(() => createDataSource({ kind: 'frodo' })).toThrow(/M6/);
  });

  it('honors DOUBAN_DATA_SOURCE env when kind not passed', () => {
    process.env.DOUBAN_DATA_SOURCE = 'frodo';
    try {
      expect(() => createDataSource({})).toThrow(/M6/);
    } finally {
      delete process.env.DOUBAN_DATA_SOURCE;
    }
  });
});
