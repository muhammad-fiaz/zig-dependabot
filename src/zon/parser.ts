export interface ZonDependency {
  name: string;
  url: string;
  hash: string;
  version: string;
}

export interface ZonResult {
  deps: ZonDependency[];
  minimumZigVersion?: string;
}

export function parseZon(content: string, extraDomains: string = ''): ZonResult {
  const deps: ZonDependency[] = [];

  // Extract minimum_zig_version if present
  const minVerMatch = content.match(/\.minimum_zig_version\s*=\s*"([^"]+)"/);
  const minimumZigVersion = minVerMatch ? minVerMatch[1] : undefined;

  // Find start of .dependencies
  const depKeyIdx = content.indexOf('.dependencies');
  if (depKeyIdx === -1) return { deps, minimumZigVersion };

  // Find opening brace after .dependencies
  const openBraceIdx = content.indexOf('.{', depKeyIdx);
  if (openBraceIdx === -1) return { deps, minimumZigVersion };

  // Extract block via brace counting
  let depth = 1;
  let closeBraceIdx = -1;

  for (let i = openBraceIdx + 2; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        closeBraceIdx = i;
        break;
      }
    }
  }

  if (closeBraceIdx === -1) return { deps, minimumZigVersion };

  const block = content.substring(openBraceIdx + 2, closeBraceIdx);

  // Parse individual dependencies inside the block
  // Pattern: .name = .{ ... }
  const depRegex = /^\s*\.([a-zA-Z0-9_-]+)\s*=\s*\.\{([\s\S]*?)\}(?:,?)/gm;

  const extraDomainsList = extraDomains
    .split(',')
    .map(d => d.trim())
    .filter(Boolean);
  const extraDomainsRegex =
    extraDomainsList.length > 0
      ? new RegExp(`(${extraDomainsList.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`)
      : null;

  while (true) {
    const match = depRegex.exec(block);
    if (!match) break;

    const name = match[1];
    const body = match[2];
    if (!name || !body) continue;

    const urlMatch = body.match(/\.url\s*=\s*"([^"]+)"/);
    const hashMatch = body.match(/\.hash\s*=\s*"([^"]+)"/);

    if (urlMatch && hashMatch && urlMatch[1] && hashMatch[1]) {
      const rawUrl = urlMatch[1];
      const hash = hashMatch[1];
      // Support generic git URLs: starting with git+, ssh:, git@, or ending/containing .git before hash
      // Also support common git forge URLs even without .git extension (e.g. github.com/user/repo)
      const isKnownForge = /https?:\/\/(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)/.test(rawUrl);
      const isUserTrusted = extraDomainsRegex ? extraDomainsRegex.test(rawUrl) : false;

      const isGit =
        rawUrl.startsWith('git+') ||
        rawUrl.startsWith('ssh:') ||
        rawUrl.startsWith('git@') ||
        rawUrl.includes('.git') ||
        isKnownForge ||
        isUserTrusted;

      if (!isGit) continue;

      const tagIdx = rawUrl.lastIndexOf('#');
      if (tagIdx !== -1) {
        const version = rawUrl.substring(tagIdx + 1);

        deps.push({
          name,
          url: rawUrl,
          hash,
          version
        });
      }
    }
  }

  return { deps, minimumZigVersion };
}
