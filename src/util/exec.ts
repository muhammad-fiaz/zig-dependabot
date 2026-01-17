import * as exec from '@actions/exec';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function run(command: string, args: string[], cwd?: string, silent: boolean = true): Promise<ExecResult> {
  let stdout = '';
  let stderr = '';

  const options: exec.ExecOptions = {
    cwd,
    silent,
    ignoreReturnCode: true, // We handle checking exit code
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      }
    }
  };

  const exitCode = await exec.exec(command, args, options);

  if (exitCode !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')} (Exit Code: ${exitCode})\nStderr: ${stderr.trim()}\nStdout: ${stdout.trim()}`
    );
  }

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}
