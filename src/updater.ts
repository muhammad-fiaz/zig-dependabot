import { Glob } from 'bun';
import { getLatestVersion } from './git/tags';
import { createIssue, managePR } from './pr/manager';
import { compare, parse } from './semver';
import { run } from './util/exec';
import { updateDependency } from './zon/editor';
import { parseZon } from './zon/parser';

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

  // Use Bun Glob to find build.zig.zon files
  const glob = new Glob('**/build.zig.zon');
  const updatedBranches = new Set<string>();

  for await (const zonPathRel of glob.scan('.')) {
    // Exclude zig-cache and node_modules explicitly to be safe
    if (zonPathRel.includes('zig-cache') || zonPathRel.includes('node_modules')) continue;

    const zonPath = `${cwd}/${zonPathRel}`;
    console.log(`\nScanning ${zonPath}...`);

    const zonFile = Bun.file(zonPath);
    if (!(await zonFile.exists())) {
      console.log(`  File not found (skipped).`);
      continue;
    }

    const content = await zonFile.text();
    const { deps, minimumZigVersion } = parseZon(content, extraDomains);

    if (minimumZigVersion) {
      console.log(`  Project requires Zig version >= ${minimumZigVersion}`);
    }

    if (deps.length === 0) {
      console.log(`  Found 0 git dependencies.`);
    } else {
      console.log(`  Found ${deps.length} git dependencies.`);
    }

    for (const dep of deps) {
      console.log('  --------------------------------------------------');
      console.log(`  Checking ${dep.name} (current: ${dep.version})...`);

      const cleanRepoUrl = dep.repoUrl || dep.url;
      const fetchUrl = cleanRepoUrl.replace(/^git\+/, '');
      const latestTag = await getLatestVersion(fetchUrl);

      if (!latestTag) {
        console.log(`    No tags found for ${dep.name}. Skipping.`);
        continue;
      }

      const currentVer = parse(dep.version);
      const latestVer = parse(latestTag);

      if (!currentVer || !latestVer) {
        console.warn(`    Could not parse versions for ${dep.name}. Skipping.`);
        continue;
      }

      if (compare(latestVer, currentVer) > 0) {
        console.log(`    Update available: ${dep.version} -> ${latestTag}`);
        await performUpdate(
          content,
          zonPath, // Pass file path
          dep.name,
          dep.url,
          cleanRepoUrl,
          dep.version,
          latestTag,
          createPr,
          createIssueFlag,
          runValidation,
          buildCommand,
          testCommand,
          updatedBranches // Pass shared state
        );
      } else {
        console.log(`    Up to date.`);
      }
    }
  }
}

async function performUpdate(
  originalContent: string,
  filePath: string,
  name: string,
  rawUrl: string,
  repoUrl: string,
  oldVersion: string,
  newVersion: string,
  createPr: boolean,
  createIssueFlag: boolean,
  runValidation: boolean,
  buildCommand: string,
  testCommand: string,
  updatedBranches: Set<string>
) {
  const newBranch = `zig-deps/${name}-${newVersion}`;

  let newUrl = '';
  if (rawUrl.includes(oldVersion)) {
    newUrl = rawUrl.replace(oldVersion, newVersion);
  } else {
    newUrl = `${rawUrl}#${newVersion}`;
  }

  // 1. Calculate Hash
  console.log(`    Fetching hash for ${newVersion}...`);
  let newHash = '';
  try {
    const { stdout } = await run('zig', ['fetch', newUrl]);
    newHash = stdout.trim();
  } catch (e) {
    console.error(`    Failed to fetch ${newUrl}. Skipping update.`, e);
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

  // 2-4. PR Workflow
  if (createPr) {
    // 2. Prepare Branch
    console.log(`    Switching to branch ${newBranch}...`);
    try {
      if (updatedBranches.has(newBranch)) {
        // Branch already created in this run for another file, just checkout
        await run('git', ['checkout', newBranch]);
      } else {
        // Create new branch (reset if exists)
        await run('git', ['checkout', '-B', newBranch]);
        updatedBranches.add(newBranch);
      }
    } catch (e) {
      console.error('    Failed to switch branch', e);
      return;
    }

    // 3. Edit File
    try {
      const newContent = updateDependency(originalContent, name, newUrl, newHash);
      await Bun.write(filePath, newContent);
    } catch (e) {
      console.error('    Failed to update content', e);
      // Reset and return
      await run('git', ['checkout', '.']);
      await run('git', ['checkout', '-']);
      return;
    }

    // Validation Steps
    if (runValidation) {
      console.log('    Running validation...');
      try {
        if (buildCommand) await run('bash', ['-c', buildCommand]);
        if (testCommand) await run('bash', ['-c', testCommand]);
        console.log('    Validation passed.');
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`    Validation failed. Skipping update. PR will not be created.\n${msg}`);
        console.error(
          `    (Hint: To create the PR despite build failures, set 'run_validation: false' in your workflow)`
        );

        await run('git', ['checkout', '.']);
        await run('git', ['checkout', '-']);
        return;
      }
    }

    // 4. Commit and Push
    try {
      await run('git', ['config', 'user.name', 'zig-dependabot']);
      await run('git', ['config', 'user.email', 'zig-dependabot@users.noreply.github.com']);

      await run('git', ['add', filePath]);
      await run('git', ['commit', '-m', title]);

      console.log('    Pushing branch...');
      await run('git', ['push', 'origin', newBranch, '--force']);
    } catch (e) {
      console.error('    Git operations failed', e);
      return;
    }

    // Switch back
    await run('git', ['checkout', '-']);

    // 5. Create PR (only if git ops succeeded)
    try {
      await managePR(name, newVersion, newBranch, title, body);
    } catch (e) {
      console.error('    PR management failed', e);
    }
  }

  // 6. Create Issue (Optional)
  if (createIssueFlag) {
    try {
      await createIssue(name, newVersion, title, body);
    } catch (e) {
      console.error('    Issue creation failed', e);
    }
  }
}
