# E2E Testing Rules

- Use `getByRole`, `getByLabel`, and `getByText` as primary locators.
- Fall back to `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, DOM structure, or `page.waitForTimeout()`.
- Each test must be independently runnable with its own setup, action, assertion, and cleanup.
- Use `storageState` for authentication; do not log in through the UI inside specs.
- Use unique identifiers for test data and assert the business outcome tied to `context/foundation/test-plan.md`.
- Mock only expensive external providers. Keep auth, routing, API, and database boundaries real.
