import { checkUpdates } from './updater';
import * as core from '@actions/core';

async function main() {
  try {
    const extraDomains = core.getInput('extra_domains');
    const createPr = core.getBooleanInput('create_pr');
    const createIssue = core.getBooleanInput('create_issue');

    if (!createPr && !createIssue) {
      throw new Error("At least one of 'create_pr' or 'create_issue' must be enabled.");
    }

    const runValidation = core.getBooleanInput('run_validation');
    const buildCommand = core.getInput('build_command');
    const testCommand = core.getInput('test_command');

    await checkUpdates(extraDomains, createPr, createIssue, runValidation, buildCommand, testCommand);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

main();
