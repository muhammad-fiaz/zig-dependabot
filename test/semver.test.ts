import { describe, it, expect } from 'vitest';
import { parse, isStable, compare } from '../src/semver';

describe('SemVer Utils', () => {
  it('parses standard tags', () => {
    const v = parse('1.2.3');
    expect(v?.major).toBe(1);
    expect(v?.minor).toBe(2);
    expect(v?.patch).toBe(3);
  });

  it('parses v-prefixed tags', () => {
    const v = parse('v1.0.0');
    expect(v?.version).toBe('1.0.0');
  });

  it('parses release-prefixed tags', () => {
    const v = parse('release-2.5.0');
    expect(v?.version).toBe('2.5.0');
  });

  it('detects stability', () => {
    expect(isStable(parse('1.0.0')!)).toBe(true);
    expect(isStable(parse('1.0.0-rc1')!)).toBe(false);
  });

  it('compares correctly', () => {
    const v1 = parse('1.0.0')!;
    const v2 = parse('1.0.1')!;
    const v3 = parse('1.0.0-rc')!; // < 1.0.0

    expect(compare(v1, v2)).toBe(-1);
    expect(compare(v2, v1)).toBe(1);
    expect(compare(v1, v3)).toBe(1); // 1.0.0 > 1.0.0-rc
  });
});
