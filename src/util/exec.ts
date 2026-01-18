export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function run(command: string, args: string[], cwd?: string, silent: boolean = true): Promise<ExecResult> {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')} (Exit Code: ${exitCode})\nStderr: ${stderr.trim()}\nStdout: ${stdout.trim()}`
    );
  }

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}
