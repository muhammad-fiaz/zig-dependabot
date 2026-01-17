export function updateDependency(content: string, depName: string, newUrl: string, newHash: string): string {
  // 1. Find .dependencyName = .{
  // We look for .name = .{ literally
  const startRegex = new RegExp(`\\.${depName}\\s*=\\s*\\.\\{`);
  const match = startRegex.exec(content);

  if (!match) {
    throw new Error(`Dependency .${depName} not found via regex`);
  }

  const startIdx = match.index;
  const braceStart = content.indexOf('{', startIdx);

  // 2. Find matching closing brace
  let depth = 1;
  let endIdx = -1;

  for (let i = braceStart + 1; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i; // Index of the closing struct brace `}`
        break;
      }
    }
  }

  if (endIdx === -1) {
    throw new Error(`Unbalanced braces for dependency .${depName}`);
  }

  const originalBlock = content.substring(startIdx, endIdx + 1);
  let newBlock = originalBlock;

  // 3. Replace URL
  newBlock = newBlock.replace(/(\.url\s*=\s*")([^"]+)(")/, `$1${newUrl}$3`);

  // 4. Replace Hash
  newBlock = newBlock.replace(/(\.hash\s*=\s*")([^"]+)(")/, `$1${newHash}$3`);

  // 5. Reconstruct content
  return content.substring(0, startIdx) + newBlock + content.substring(endIdx + 1);
}
