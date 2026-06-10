import { runHook } from "./run-command.mjs";

runHook("npx eslint --fix . --quiet", "Lint hook failed. Fix the reported ESLint errors.");
