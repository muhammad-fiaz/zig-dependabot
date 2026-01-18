import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Octokit } from '../src/github/client';
import * as client from '../src/github/client';
import { createIssue, managePR } from '../src/pr/manager';

// Mock client
vi.mock('../src/github/client', () => ({
  getClient: vi.fn(),
  context: { repo: { owner: 'me', repo: 'my-project' } }
}));

const mockIssues = {
  create: vi.fn(),
  update: vi.fn(),
  listForRepo: vi.fn(),
  addLabels: vi.fn()
};
const mockSearch = {
  issuesAndPullRequests: vi.fn()
};

const mockOctokit = {
  rest: {
    pulls: mockPulls,
    git: mockGit,
    repos: mockRepos,
    issues: mockIssues,
    search: mockSearch
  }
} as unknown as Octokit;

describe('PR Manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(client.getClient).mockReturnValue(mockOctokit);
  });

  // ... (Existing PR tests: Creates, Closes Old, Updates Existing)
  it('creates PR if none exists', async () => {
    mockPulls.list.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [] });
    mockRepos.get.mockResolvedValue({ data: { default_branch: 'main' } });
    mockPulls.create.mockResolvedValue({ data: { number: 101 } });

    await managePR('dep', '1.0.0', 'zig-deps/dep-1.0.0', 'Title', 'Body');

    expect(mockPulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        head: 'zig-deps/dep-1.0.0',
        base: 'main'
      })
    );
  });

  it('closes older PRs', async () => {
    const oldPR = {
      number: 123,
      head: { ref: 'zig-deps/dep-0.9.0' }
    };
    mockPulls.list.mockResolvedValueOnce({ data: [oldPR] }).mockResolvedValueOnce({ data: [] });
    mockRepos.get.mockResolvedValue({ data: { default_branch: 'main' } });
    mockPulls.create.mockResolvedValue({ data: { number: 102 } });

    await managePR('dep', '1.0.0', 'zig-deps/dep-1.0.0', 'Title', 'Body');

    expect(mockPulls.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pull_number: 123,
        state: 'closed'
      })
    );
    expect(mockGit.deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: 'heads/zig-deps/dep-0.9.0'
      })
    );
    expect(mockPulls.create).toHaveBeenCalled();
  });

  it('updates existing PR if same version PR exists', async () => {
    const existingPR = {
      number: 456,
      head: { ref: 'zig-deps/dep-1.0.0' }
    };
    mockPulls.list.mockResolvedValue({ data: [existingPR] });

    await managePR('dep', '1.0.0', 'zig-deps/dep-1.0.0', 'Title', 'Body');

    expect(mockPulls.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pull_number: 456,
        title: 'Title',
        body: 'Body'
      })
    );
    expect(mockPulls.create).not.toHaveBeenCalled();
  });
});

describe('Issue Manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(client.getClient).mockReturnValue(mockOctokit);
  });

  it('creates issue if none exists', async () => {
    // Search returns empty
    mockSearch.issuesAndPullRequests.mockResolvedValue({ data: { items: [] } });
    // Outdated issues empty
    mockIssues.listForRepo.mockResolvedValue({ data: [] });
    // Create returns new issue
    mockIssues.create.mockResolvedValue({ data: { number: 201 } });

    await createIssue('dep', '1.0.0', 'Title', 'Body');

    expect(mockIssues.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Title',
        body: 'Body',
        labels: ['dependencies', 'zig']
      })
    );
  });

  it('skips creation if open issue exists', async () => {
    const existing = { number: 200, title: 'Title', state: 'open' };
    mockSearch.issuesAndPullRequests.mockResolvedValue({ data: { items: [existing] } });

    await createIssue('dep', '1.0.0', 'Title', 'Body');

    expect(mockIssues.create).not.toHaveBeenCalled();
    expect(mockIssues.update).not.toHaveBeenCalled();
  });

  it('reopens issue if closed issue exists', async () => {
    const existing = { number: 200, title: 'Title', state: 'closed' };
    mockSearch.issuesAndPullRequests.mockResolvedValue({ data: { items: [existing] } });

    await createIssue('dep', '1.0.0', 'Title', 'Body');

    expect(mockIssues.update).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 200,
        state: 'open'
      })
    );
    expect(mockIssues.create).not.toHaveBeenCalled();
  });
});
