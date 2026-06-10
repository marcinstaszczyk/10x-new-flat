/* global process */
import { spawn } from "node:child_process";

export function runHook(command, failureMessage) {
  const child = spawn(command, {
    shell: true,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    process.stdout.write(`${failureMessage}\n${error.message}\n`);
    process.exit(2);
  });

  child.on("exit", (code) => {
    if (code === 0) {
      process.exit(0);
    }

    process.stdout.write(`${failureMessage}\n`);
    process.exit(2);
  });
}
