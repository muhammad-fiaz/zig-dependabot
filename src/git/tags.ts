import { compare, isStable, parse } from '../semver';
import { run } from '../util/exec';

export async function getLatestVersion(repoUrl: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['ls-remote', '--tags', repoUrl]);

    // Output format: <hash>\trefs/tags/<tag>
    const tags = stdout
      .split('\n')
      .map(line => {
        const parts = line.split('\t');
        if (parts.length < 2) return null;
        const ref = parts[1];
        if (!ref) return null;
        if (ref.endsWith('^{}')) return null;
        return ref.replace('refs/tags/', '').trim();
      })
      .filter((t): t is string => t !== null && t.length > 0);

    const versions = tags
      .map(t => {
        const v = parse(t);
        return { tag: t, v };
      })
      .filter((x): x is { tag: string; v: NonNullable<ReturnType<typeof parse>> } => x.v !== null);

    if (versions.length === 0) return null;

    versions.sort((a, b) => compare(a.v, b.v));

    const stable = versions.filter(x => isStable(x.v));

    if (stable.length > 0) {
      return stable[stable.length - 1]?.tag ?? null;
    }

    return versions[versions.length - 1]?.tag ?? null;
  } catch (e) {
    console.warn(`Failed to list tags for ${repoUrl}:`, e);
    return null;
  }
}
