import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestVersion } from '../src/git/tags';
import * as exec from '../src/util/exec'; // Mock this

// Mock the exec module
vi.mock('../src/util/exec', () => ({
  run: vi.fn()
}));

describe('Git Tags', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('picks highest stable version', async () => {
    const mockOutput = `
hash1\trefs/tags/v1.0.0
hash2\trefs/tags/v1.1.0
hash3\trefs/tags/v1.2.0-rc1
hash4\trefs/tags/v1.1.1
    `;

    // Setup mock return
    vi.mocked(exec.run).mockResolvedValue({
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

    vi.mocked(exec.run).mockResolvedValue({
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
    vi.mocked(exec.run).mockResolvedValue({
      stdout: mockOutput,
      stderr: '',
      exitCode: 0
    });
    // effectively just one standard tag
    const latest = await getLatestVersion('...');
    expect(latest).toBe('v1.0.0');
  });
});
