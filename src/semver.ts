import { semver } from 'bun';

export function parse(tag: string): string | null {
  // Common prefixes
  let cleanTag = tag;
  if (cleanTag.startsWith('release-')) {
    cleanTag = cleanTag.substring('release-'.length);
  }
  if (cleanTag.startsWith('v')) {
    cleanTag = cleanTag.substring(1);
  }

  // Check if valid using order (Bun currently lacks a direct valid() function)
  // If order comparison with itself returns 0, it's valid.
  try {
    if (semver.order(cleanTag, cleanTag) === 0) {
      return cleanTag;
    }
  } catch (e) {
    // Invalid semver
    return null;
  }

  return null;
}

export function isStable(version: string): boolean {
  // Check for prerelease hyphen before any build metadata (+)
  const versionPart = version.split('+')[0] || '';
  return !versionPart.includes('-');
}

export function compare(a: string, b: string): number {
  return semver.order(a, b);
}

export function sort(versions: string[]): string[] {
  return versions.sort(semver.order);
}
