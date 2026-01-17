import * as core from '@actions/core';
import * as github from '@actions/github';

export type Octokit = ReturnType<typeof github.getOctokit>;

export function getClient(): Octokit {
  const token = process.env.GITHUB_TOKEN || core.getInput('token') || process.env.GH_TOKEN;

  if (!token) {
    throw new Error('No GitHub token found. Please set GITHUB_TOKEN env var.');
  }

  return github.getOctokit(token);
}

export const context = github.context;
