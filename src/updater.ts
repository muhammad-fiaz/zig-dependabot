import { getLatestVersion } from './git/tags';
import { createIssue, managePR } from './pr/manager';
import { compare, parse } from './semver';
import { run } from './util/exec';
import { updateDependency } from './zon/editor';
import { parseZon } from './zon/parser';

const ZON_FILE = 'build.zig.zon';

export async function checkUpdates(
  extraDomains: string = '',
  createPr: boolean = true,
  createIssueFlag: boolean = false,
  runValidation: boolean = true,
  buildCommand: string = 'zig build',
  testCommand: string = 'zig build test'
) {
  const cwd = process.cwd();
  console.log(`Working directory: ${cwd}`);
  const zonPath = `${cwd}/${ZON_FILE}`;
  console.log(`Reading ${zonPath}...`);

  const zonFile = Bun.file(zonPath);
  if (!(await zonFile.exists())) {
    console.error(`${zonPath} not found.`);
    return;
  }

  const content = await zonFile.text();
  const { deps, minimumZigVersion } = parseZon(content, extraDomains);

  if (minimumZigVersion) {
    console.log(`Project requires Zig version >= ${minimumZigVersion}`);
  }

  if (deps.length === 0) {
    console.log(`Found 0 git dependencies. Content snippet:\n${content.substring(0, 500)}...`);
  } else {
    console.log(`Found ${deps.length} git dependencies.`);
  }

  for (const dep of deps) {
    console.log('--------------------------------------------------');
    console.log(`Checking ${dep.name} (current: ${dep.version})...`);

    const cleanRepoUrl = dep.repoUrl || dep.url;

    // Remove git+ prefix for git ls-remote if needed, though getLatestVersion handles some cleaning
    const fetchUrl = cleanRepoUrl.replace(/^git\+/, '');

    // Detect latest version
    const latestTag = await getLatestVersion(fetchUrl);

    if (!latestTag) {
      console.log(`  No tags found for ${dep.name}. Skipping.`);
      continue;
    }

    const currentVer = parse(dep.version);
    const latestVer = parse(latestTag);

    if (!currentVer || !latestVer) {
      console.warn(`  Could not parse versions for ${dep.name} (${dep.version} vs ${latestTag}). Skipping.`);
      continue;
    }

    if (compare(latestVer, currentVer) > 0) {
      console.log(`  Update available: ${dep.version} -> ${latestTag}`);
      await performUpdate(
        content,
        dep.name,
        dep.url, // rawUrl
        cleanRepoUrl, // repoUrl for display
        dep.version,
        latestTag,
        createPr,
        createIssueFlag,
        runValidation,
        buildCommand,
        testCommand
      );
    } else {
      console.log(`  Up to date.`);
    }
  }
}

async function performUpdate(
  originalContent: string,
  name: string,
  rawUrl: string,
  repoUrl: string,
  oldVersion: string,
  newVersion: string,
  createPr: boolean,
  createIssueFlag: boolean,
  runValidation: boolean,
  buildCommand: string,
  testCommand: string
) {
  const newBranch = `zig-deps/${name}-${newVersion}`;

  let newUrl = '';
  if (rawUrl.includes(oldVersion)) {
    // If the URL contains the version (e.g. archive URL), replace it.
    newUrl = rawUrl.replace(oldVersion, newVersion);
  } else {
    // Otherwise assume it's a git URL needing a fragment
    newUrl = `${rawUrl}#${newVersion}`;
  }

  // 1. Calculate Hash
  console.log(`  Fetching hash for ${newVersion}...`);
  let newHash = '';
  try {
    const { stdout } = await run('zig', ['fetch', newUrl]);
    newHash = stdout.trim();
  } catch (e) {
    console.error(`  Failed to fetch ${newUrl}. Skipping update.`, e);
    return;
  }

  const validationCheck = runValidation ? `- [x] Validation passed: \`${buildCommand}\`` : `- [ ] Validation skipped`;

  const title = `build(deps): bump ${name} from ${oldVersion} to ${newVersion}`;
  const body = `## Dependency Update: ${name}

Updates **[${name}](${repoUrl})** from \`${oldVersion}\` to \`${newVersion}\`.

### Details
- **Dependency**: ${name}
- **Repository**: ${repoUrl}
- **Update**: \`${oldVersion}\` -> \`${newVersion}\`
- **New URL**: \`${newUrl}\`
- **New Hash**: \`${newHash}\`

### Verification
- [x] Update \`build.zig.zon\`
${validationCheck}

_Automated by [zig-dependabot](https://github.com/muhammad-fiaz/zig-dependabot)_`;

  // 2-4. PR Workflow (Branch, Edit, Commit, Push, PR)
  if (createPr) {
    // 2. Prepare Branch
    console.log(`  Switching to branch ${newBranch}...`);
    try {
      await run('git', ['checkout', '-B', newBranch]);
    } catch (e) {
      console.error('  Failed to create branch', e);
      return;
    }

    // 3. Edit File
    try {
      const newContent = updateDependency(originalContent, name, newUrl, newHash);
      await Bun.write(ZON_FILE, newContent);
    } catch (e) {
      console.error('  Failed to update content', e);
      // Reset and return
      await run('git', ['checkout', '.']);
      await run('git', ['checkout', '-']);
      return;
    }

    // Validation Steps
    if (runValidation) {
      console.log('  Running validation...');
      try {
        // Build
        console.log(`  Running build: ${buildCommand}`);
        const buildParts = buildCommand.split(' ');
        if (buildParts.length > 0 && buildParts[0]) {
          await run(buildParts[0], buildParts.slice(1));
        }

        // Test
        console.log(`  Running test: ${testCommand}`);
        const testParts = testCommand.split(' ');
        if (testParts.length > 0 && testParts[0]) {
          await run(testParts[0], testParts.slice(1));
        }

        console.log('  Validation passed.');
      } catch (e: any) {
        // Log just the message to avoid internal stack traces
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  Validation failed. Skipping update. PR will not be created.\n${msg}`);
        console.error(
          `  (Hint: To create the PR despite build failures, set 'run_validation: false' in your workflow)`
        );

        // Clean up and abort
        await run('git', ['checkout', '.']);
        await run('git', ['checkout', '-']);
        return;
      }
    }

    // 4. Commit and Push
    try {
      await run('git', ['config', 'user.name', 'zig-dependabot']);
      await run('git', ['config', 'user.email', 'zig-dependabot@users.noreply.github.com']);

      await run('git', ['add', ZON_FILE]);
      await run('git', ['commit', '-m', title]);

      console.log('  Pushing branch...');
      await run('git', ['push', 'origin', newBranch, '--force']);
    } catch (e) {
      console.error('  Git operations failed', e);
      // if push fails, PR creation will fail or point to nothing. Returns.
      return;
    }

    // 5. Create PR (only if git ops succeeded)
    try {
      await managePR(name, newVersion, newBranch, title, body);
    } catch (e) {
      console.error('  PR management failed', e);
    }

    // Cleanup: Switch back to previous branch
    await run('git', ['checkout', '-']);
  }

  // 6. Create Issue (Optional)
  if (createIssueFlag) {
    try {
      await createIssue(name, newVersion, title, body);
    } catch (e) {
      console.error('  Issue creation failed', e);
    }
  }
}
