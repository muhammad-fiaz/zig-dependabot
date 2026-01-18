import * as core from '@actions/core';
import { checkUpdates } from './updater';

async function main() {
  try {
    const extraDomains = core.getInput('extra_domains');
    const createPr = core.getBooleanInput('create_pr');
    const createIssue = core.getBooleanInput('create_issue');

    if (!createPr && !createIssue) {
      throw new Error("At least one of 'create_pr' or 'create_issue' must be enabled.");
    }

    try {
      await checkUpdates(extraDomains, createPr, createIssue);
    } catch (e: any) {
      if (e.status === 403) {
        console.error(
          'Error: Insufficient permissions (403). check your GITHUB_TOKEN permissions. Ensure "contents: write" and "pull-requests: write" are enabled.'
        );
      } else {
        console.error('An unexpected error occurred:', e);
      }
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

main();
