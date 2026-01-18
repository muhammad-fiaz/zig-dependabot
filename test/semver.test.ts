import { describe, expect, it } from 'vitest';
import { compare, isStable, parse } from '../src/semver';

describe('SemVer Utils', () => {
  it('parses standard tags', () => {
    const v = parse('1.2.3');
    expect(v).toBe('1.2.3');
  });

  it('parses v-prefixed tags', () => {
    const v = parse('v1.0.0');
    expect(v).toBe('1.0.0');
  });

  it('parses release-prefixed tags', () => {
    const v = parse('release-2.5.0');
    expect(v).toBe('2.5.0');
  });

  it('detects stability', () => {
    const v1 = parse('1.0.0');
    const v2 = parse('1.0.0-rc1');
    expect(v1).toBeTruthy();
    expect(v2).toBeTruthy();
    if (v1 && v2) {
      expect(isStable(v1)).toBe(true);
      expect(isStable(v2)).toBe(false);
    }
  });

  it('compares correctly', () => {
    const v1 = parse('1.0.0');
    const v2 = parse('1.0.1');
    const v3 = parse('1.0.0-rc'); // < 1.0.0

    expect(v1).toBeTruthy();
    expect(v2).toBeTruthy();
    expect(v3).toBeTruthy();

    if (v1 && v2 && v3) {
      expect(compare(v1, v2)).toBe(-1);
      expect(compare(v2, v1)).toBe(1);
      expect(compare(v1, v3)).toBe(1); // 1.0.0 > 1.0.0-rc
    }
  });
});
