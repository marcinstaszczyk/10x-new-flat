import { runHook } from "./run-command.mjs";

runHook("npx tsc --noEmit", "Typecheck hook failed. Fix the reported TypeScript errors.");
