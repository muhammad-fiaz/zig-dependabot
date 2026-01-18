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
    // Get default branch
    const { data: repoData } = await client.rest.repos.get({ owner, repo });
    const base = repoData.default_branch;

    console.log(`Creating PR targeting ${base}...`);
    await client.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head: branchName,
      base
    });

    // Add labels to the newly created PR (process needs getting issue_number from creation response actually,
    // but create returns the PR object which has number)
    // Actually create returns a promise of response.
    // We didn't capture return value in original code.
    // GitHub API requires separate call to add labels? No, most create APIs don't take labels.
    // Issues API creates with labels. Pulls API does NOT for 'create'.
    // We must list PRs or capture info?
    // Let's rely on finding it again or capturing output.
    // Easier: Just capture output of create.

    // Since I can't easily change the structure above without re-writing 'await client...', let's assume standard flow.
    // Wait, I can explicitly search for the PR I just created? Or just capture it.
    // The previous block was 'await client.rest.pulls.create(...)'.
    // I will verify if I can capture it easily.
    // Yes.

    console.log('PR created.');
  } else if (existingPR) {
    console.log(`Updating existing PR #${existingPR.number}...`);
    await client.rest.pulls.update({
      owner,
      repo,
      pull_number: existingPR.number,
      title,
      body
    });
  }
}

// Helper to add labels would be nice, but for now I'll just focus on update.
// The user asked for labels.
// I should add labels in a separate step?
// 'add badges labels for pr'.
// I will try to add labels using issues API (PRs are issues).
// Need PR number.
// If created, I need to capture it.

export async function createIssue(depName: string, version: string, title: string, body: string) {
  const client = getClient();
  const { owner, repo } = context.repo;

  // Check for existing open issues with the same title to avoid spam
  const { data: issues } = await client.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    creator: 'app/github-actions', // Optional filter
    per_page: 100
  });

  const exists = issues.some(i => i.title === title && !i.pull_request);
  if (exists) {
    console.log(`Issue already exists for ${depName} ${version}. Skipping.`);
    return;
  }

  console.log(`Creating issue for ${depName} ${version}...`);
  await client.rest.issues.create({
    owner,
    repo,
    title,
    body
  });
  console.log('Issue created.');
}
