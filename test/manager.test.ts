import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Octokit } from '../src/github/client';
import * as client from '../src/github/client';
import { managePR } from '../src/pr/manager';

// Mock client
vi.mock('../src/github/client', () => ({
  getClient: vi.fn(),
  context: { repo: { owner: 'me', repo: 'my-project' } }
}));

const mockPulls = {
  list: vi.fn(),
  update: vi.fn(),
  create: vi.fn()
};
const mockGit = {
  deleteRef: vi.fn()
};
const mockRepos = {
  get: vi.fn()
};

const mockOctokit = {
  rest: {
    pulls: mockPulls,
    git: mockGit,
    repos: mockRepos
  }
} as unknown as Octokit;

describe('PR Manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(client.getClient).mockReturnValue(mockOctokit);
  });

  it('creates PR if none exists', async () => {
    // No open PRs
    mockPulls.list.mockResolvedValue({ data: [] });
    mockRepos.get.mockResolvedValue({ data: { default_branch: 'main' } });

    await managePR('dep', '1.0.0', 'zig-deps/dep-1.0.0', 'Title', 'Body');

    expect(mockPulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        head: 'zig-deps/dep-1.0.0',
        base: 'main'
      })
    );
  });

  it('closes older PRs', async () => {
    // Existing PR for older version
    const oldPR = {
      number: 123,
      head: { ref: 'zig-deps/dep-0.9.0' }
    };

    mockPulls.list.mockResolvedValue({ data: [oldPR] });
    mockRepos.get.mockResolvedValue({ data: { default_branch: 'main' } });

    await managePR('dep', '1.0.0', 'zig-deps/dep-1.0.0', 'Title', 'Body');

    // Should close old PR
    expect(mockPulls.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pull_number: 123,
        state: 'closed'
      })
    );

    // Should delete old branch
    expect(mockGit.deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: 'heads/zig-deps/dep-0.9.0'
      })
    );

    // Should create new PR
    expect(mockPulls.create).toHaveBeenCalled();
  });

  it('does nothing if same version PR exists', async () => {
    const existingPR = {
      number: 456,
      head: { ref: 'zig-deps/dep-1.0.0' }
    };

    mockPulls.list.mockResolvedValue({ data: [existingPR] });

    await managePR('dep', '1.0.0', 'zig-deps/dep-1.0.0', 'Title', 'Body');

    // No close, no create
    expect(mockPulls.update).not.toHaveBeenCalled();
    expect(mockPulls.create).not.toHaveBeenCalled();
  });
});
