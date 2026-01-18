import { context, getClient } from '../github/client';

export async function managePR(depName: string, version: string, branchName: string, title: string, body: string) {
  const client = getClient();
  const { owner, repo } = context.repo;

  console.log(`Checking PRs for ${depName}...`);

  // List all open PRs
  const { data: pulls } = await client.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    per_page: 100
  });

  let currentExists = false;
  let existingPR: any = null;

  for (const pr of pulls) {
    const headRef = pr.head.ref;

    // Check if this PR belongs to the same dependency
    if (headRef.startsWith(`zig-deps/${depName}-`)) {
      if (headRef === branchName) {
        currentExists = true;
        existingPR = pr;
        console.log(`PR #${pr.number} already exists for ${version}.`);
      } else {
        console.log(`Closing outdated PR #${pr.number} (${headRef})...`);
        await client.rest.pulls.update({
          owner,
          repo,
          pull_number: pr.number,
          state: 'closed'
        });

        try {
          console.log(`Deleting branch ${headRef}...`);
          await client.rest.git.deleteRef({
            owner,
            repo,
            ref: `heads/${headRef}`
          });
        } catch (e) {
          console.warn(`Failed to delete branch ${headRef}:`, e);
        }
      }
    }
  }

  if (!currentExists) {
    // Check if a closed PR already exists for this branch (user closed it)
    const { data: closedPulls } = await client.rest.pulls.list({
      owner,
      repo,
      state: 'closed',
      head: `${owner}:${branchName}`,
      per_page: 1
    });

    if (closedPulls.length > 0) {
      console.log(
        `PR for ${version} (branch ${branchName}) was previously closed. Skipping creation to respect user decision.`
      );
      return null;
    }

    // Get default branch
    const { data: repoData } = await client.rest.repos.get({ owner, repo });
    const base = repoData.default_branch;

    console.log(`Creating PR targeting ${base}...`);
    const { data: newPr } = await client.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head: branchName,
      base
    });

    console.log(`PR #${newPr.number} created.`);

    // Add labels
    try {
      await client.rest.issues.addLabels({
        owner,
        repo,
        issue_number: newPr.number,
        labels: ['dependencies', 'zig']
      });
    } catch (e) {
      console.warn('Failed to add labels to PR:', e);
    }

    return newPr.number;
  } else if (existingPR) {
    console.log(`Updating existing PR #${existingPR.number}...`);
    await client.rest.pulls.update({
      owner,
      repo,
      pull_number: existingPR.number,
      title,
      body
    });
    return existingPR.number;
  }

  return null;
}

export async function createIssue(depName: string, version: string, title: string, body: string, prNumber?: number) {
  const client = getClient();
  const { owner, repo } = context.repo;

  // Search for existing issues (open or closed) to handle reopening
  // Using search API is more efficient than listing all issues for checking duplicates
  const q = `repo:${owner}/${repo} is:issue in:title "${title}"`;
  const { data: searchResults } = await client.rest.search.issuesAndPullRequests({
    q,
    per_page: 1
  });

  const existingIssue = searchResults.items.find(i => i.title === title);

  if (existingIssue) {
    if (existingIssue.state === 'closed') {
      console.log(`Reopening existing issue #${existingIssue.number}...`);
      await client.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        state: 'open'
      });
      console.log('Issue reopened.');
      return existingIssue.number;
    } else {
      console.log(`Issue already exists for ${depName} ${version}. Skipping.`);
      return existingIssue.number;
    }
  }

  // Close outdated issues for this dependency (search for open ones)
  // We can stick to listing open issues for this cleanup task
  const { data: openIssues } = await client.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    per_page: 100
  });

  const outdatedIssues = openIssues.filter(
    i => !i.pull_request && i.title.startsWith(`build(deps): bump ${depName} from`) && i.title !== title
  );

  for (const issue of outdatedIssues) {
    console.log(`Closing outdated issue #${issue.number}: ${issue.title}`);
    await client.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed',
      state_reason: 'completed'
    });
  }

  let finalBody = body;
  if (prNumber) {
    finalBody += `\n\n### Related PR\n- #${prNumber}`;
  }

  console.log(`Creating issue for ${depName} ${version}...`);
  const { data: newIssue } = await client.rest.issues.create({
    owner,
    repo,
    title,
    body: finalBody,
    labels: ['dependencies', 'zig']
  });
  console.log('Issue created.');
  return newIssue.number;
}

export async function updatePrLink(prNumber: number, issueNumber: number) {
  const client = getClient();
  const { owner, repo } = context.repo;

  try {
    const { data: pr } = await client.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    if (pr.body && !pr.body.includes(`### Related Issue`)) {
      const newBody = pr.body + `\n\n### Related Issue\n- #${issueNumber}`;
      await client.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body: newBody
      });
      console.log(`Linked PR #${prNumber} to Issue #${issueNumber}.`);
    }
  } catch (e) {
    console.warn('Failed to link PR to Issue:', e);
  }
}
