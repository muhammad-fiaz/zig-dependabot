import * as semver from 'semver';

export function parse(tag: string): semver.SemVer | null {
  // Common prefixes
  let cleanTag = tag;
  if (cleanTag.startsWith('release-')) {
    cleanTag = cleanTag.substring('release-'.length);
  }

  // semver.clean handles 'v' prefix and whitespace
  // loose: true allows 'v' and more flexibility
  const cleaned = semver.clean(cleanTag, { loose: true });
  if (cleaned) {
    return semver.parse(cleaned);
  }

  // Fallback: try parsing directly if clean failed (rare but possible w/ specific formats)
  return semver.parse(cleanTag, { loose: true });
}

export function isStable(version: semver.SemVer): boolean {
  return version.prerelease.length === 0;
}

export function compare(a: semver.SemVer, b: semver.SemVer): number {
  return semver.compare(a, b);
}

export function sort(versions: semver.SemVer[]): semver.SemVer[] {
  return versions.sort(semver.compare);
}
