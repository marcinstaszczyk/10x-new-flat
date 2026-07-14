import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
interface PublicationModule {
  MARKER: string;
  outcomeFor(execution: string, verdict: string): string;
  publishCodeReview(input: unknown): Promise<string>;
}

const publication = require("../../.github/scripts/publish-code-review.cjs") as PublicationModule;

function github(comments: unknown[] = []) {
  return {
    paginate: vi.fn().mockResolvedValue(comments),
    rest: {
      issues: {
        addLabels: vi.fn().mockResolvedValue(undefined),
        createComment: vi.fn().mockResolvedValue(undefined),
        createLabel: vi.fn().mockResolvedValue(undefined),
        listComments: vi.fn(),
        removeLabel: vi.fn().mockRejectedValue({ status: 404 }),
        updateComment: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
}

describe("code review publication", () => {
  it("maps review state to exclusive terminal outcomes", () => {
    expect(publication.outcomeFor("success", "pass")).toBe("ai-cr:passed");
    expect(publication.outcomeFor("success", "fail")).toBe("ai-cr:failed");
    expect(publication.outcomeFor("error", "pass")).toBe("ai-cr:error");
  });

  it("creates a bot marker comment, provisions labels, and consumes retries", async () => {
    const client = github();
    await publication.publishCodeReview({
      github: client,
      owner: "owner",
      repo: "repo",
      issueNumber: 4,
      execution: "success",
      verdict: "pass",
      summary: "## Pass",
    });

    expect(client.rest.issues.createLabel).toHaveBeenCalledTimes(4);
    expect(client.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ body: `${publication.MARKER}\n## Pass` }),
    );
    expect(client.rest.issues.removeLabel).toHaveBeenCalledWith(expect.objectContaining({ name: "ai-cr:review" }));
    expect(client.rest.issues.addLabels).toHaveBeenCalledWith(expect.objectContaining({ labels: ["ai-cr:passed"] }));
  });

  it("updates only the GitHub Actions marker comment", async () => {
    const client = github([
      { id: 1, body: `${publication.MARKER}\nold`, user: { login: "another-bot" } },
      { id: 2, body: `${publication.MARKER}\nold`, user: { login: "github-actions[bot]" } },
    ]);
    await publication.publishCodeReview({
      github: client,
      owner: "owner",
      repo: "repo",
      issueNumber: 4,
      execution: "success",
      verdict: "fail",
      summary: "## Fail",
    });

    expect(client.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 2 }));
    expect(client.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("publishes a safe diagnostic and propagates API failures", async () => {
    const client = github();
    await publication.publishCodeReview({
      github: client,
      owner: "owner",
      repo: "repo",
      issueNumber: 4,
      execution: "error",
      verdict: "",
      summary: "untrusted provider response",
    });
    const [[{ body }]] = client.rest.issues.createComment.mock.calls as [[{ body: string }]];
    expect(body).toContain("AI code review error");

    client.rest.issues.createLabel.mockRejectedValueOnce(new Error("API unavailable"));
    await expect(
      publication.publishCodeReview({
        github: client,
        owner: "owner",
        repo: "repo",
        issueNumber: 4,
        execution: "success",
        verdict: "pass",
        summary: "## Pass",
      }),
    ).rejects.toThrow("API unavailable");
  });
});
