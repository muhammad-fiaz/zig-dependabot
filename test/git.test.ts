import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getLatestVersion } from '../src/git/tags';
import * as exec from '../src/util/exec'; // Mock this

// Mock the exec module
mock.module('../src/util/exec', () => ({
  run: mock()
}));

describe('Git Tags', () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it('picks highest stable version', async () => {
    const mockOutput = `
hash1\trefs/tags/v1.0.0
hash2\trefs/tags/v1.1.0
hash3\trefs/tags/v1.2.0-rc1
hash4\trefs/tags/v1.1.1
    `;

    // Setup mock return
    (exec.run as any).mockResolvedValue({
      stdout: mockOutput,
      stderr: '',
      exitCode: 0
    });

    const latest = await getLatestVersion('https://github.com/foo/bar');
    expect(latest).toBe('v1.1.1');
  });

  it('picks highest prerelease if no stable', async () => {
    const mockOutput = `
hash1\trefs/tags/v2.0.0-alpha
hash2\trefs/tags/v2.0.0-beta.1
    `;

    (exec.run as any).mockResolvedValue({
      stdout: mockOutput,
      stderr: '',
      exitCode: 0
    });

    const latest = await getLatestVersion('https://github.com/foo/bar');
    expect(latest).toBe('v2.0.0-beta.1');
  });

  it('ignores peeled refs', async () => {
    const mockOutput = `
hash1\trefs/tags/v1.0.0
hash1\trefs/tags/v1.0.0^{}
`;
    (exec.run as any).mockResolvedValue({
      stdout: mockOutput,
      stderr: '',
      exitCode: 0
    });
    // effectively just one standard tag
    const latest = await getLatestVersion('...');
    expect(latest).toBe('v1.0.0');
  });
});
