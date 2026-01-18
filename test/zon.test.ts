import { describe, expect, it } from 'bun:test';
import { updateDependency } from '../src/zon/editor';
import { parseZon } from '../src/zon/parser';

const sampleZon = `
.{
    .name = "my-project",
    .version = "0.0.1",
    .dependencies = .{
        .zstd = .{
            .url = "git+https://github.com/facebook/zstd.git#v1.5.5",
            .hash = "12345",
        },
        .other_git = .{
            .url = "https://github.com/user/repo.git#v1.0.0",
            .hash = "67890",
        },
        .tarball = .{
            .url = "https://example.com/archive.tar.gz",
            .hash = "abcde",
        },
    },
}
`;

describe('ZON Parser', () => {
  it('extracts git dependencies', () => {
    const { deps } = parseZon(sampleZon);
    expect(deps).toHaveLength(2); // zstd + other_git
    expect(deps.find(d => d.name === 'zstd')).toBeDefined();
    expect(deps.find(d => d.name === 'other_git')).toBeDefined();
  });

  it('ignores non-git dependencies', () => {
    const { deps } = parseZon(sampleZon);
    const tarball = deps.find(d => d.name === 'tarball');
    expect(tarball).toBeUndefined();
  });
});

describe('ZON Editor', () => {
  it('updates dependency url and hash', () => {
    const updated = updateDependency(sampleZon, 'zstd', 'git+https://github.com/facebook/zstd.git#v1.5.6', '67890');

    expect(updated).toContain('.url = "git+https://github.com/facebook/zstd.git#v1.5.6"');
    expect(updated).toContain('.hash = "67890"');
    // Ensure minimal diff - other parts untouched
    expect(updated).toContain('.name = "my-project"');
    expect(updated).toContain('.other_git = .{');
  });
});
