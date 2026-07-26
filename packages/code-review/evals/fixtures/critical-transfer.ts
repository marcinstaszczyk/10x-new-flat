import type { ReviewFixture } from "./types.ts";

export const REQUIRED_FINDING_IDS = ["authorization", "positive-amount-validation", "atomic-balance-mutation"] as const;

export const criticalTransferFixture: ReviewFixture = {
  id: "critical-transfer",
  title: "Add account transfers",
  description: "Allow authenticated users to transfer funds between accounts.",
  rubricPath: "rubrics/critical-transfer.md",
  diff: `diff --git a/src/routes/transfers.ts b/src/routes/transfers.ts
new file mode 100644
index 0000000..f00dbad
--- /dev/null
+++ b/src/routes/transfers.ts
@@ -0,0 +1,36 @@
+import { db } from "../db";
+
+export async function createTransfer(request: Request, user: { id: string }) {
+  const { fromAccountId, toAccountId, amount } = await request.json();
+
+  if (!toAccountId || !amount) {
+    return Response.json({ error: "Missing transfer details" }, { status: 400 });
+  }
+
+  const source = await db.account.findUniqueOrThrow({ where: { id: fromAccountId } });
+  const destination = await db.account.findUniqueOrThrow({ where: { id: toAccountId } });
+
+  if (source.balance < amount) {
+    return Response.json({ error: "Insufficient funds" }, { status: 400 });
+  }
+
+  await db.account.update({
+    where: { id: source.id },
+    data: { balance: source.balance - amount },
+  });
+  await db.account.update({
+    where: { id: destination.id },
+    data: { balance: destination.balance + amount },
+  });
+
+  return Response.json({ ok: true });
+}
diff --git a/src/routes/transfers.test.ts b/src/routes/transfers.test.ts
new file mode 100644
index 0000000..c0ffee0
--- /dev/null
+++ b/src/routes/transfers.test.ts
@@ -0,0 +1,17 @@
+import { expect, it } from "vitest";
+import { createTransfer } from "./transfers";
+
+it("moves money between two accounts", async () => {
+  const response = await createTransfer(
+    new Request("https://example.test/transfers", {
+      method: "POST",
+      body: JSON.stringify({ fromAccountId: "account-1", toAccountId: "account-2", amount: 25 }),
+    }),
+    { id: "user-1" },
+  );
+
+  expect(response.status).toBe(200);
+});`,
  expected: {
    verdict: "fail",
    scoreCeilings: {
      implementationCorrectness: 4,
      testRiskCoverage: 4,
      securitySafety: 4,
    },
    findings: [
      {
        id: "authorization",
        description: "The body-supplied source account is never bound to the authenticated user, enabling IDOR.",
      },
      {
        id: "positive-amount-validation",
        description: "Negative amounts are accepted and reverse debit and credit behavior.",
      },
      {
        id: "atomic-balance-mutation",
        description: "The funds check and balance updates are separate non-transactional operations, enabling races.",
      },
    ],
  },
};
