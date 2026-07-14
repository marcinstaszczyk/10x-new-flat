const MARKER = "<!-- codex-code-review -->";

const labels = {
  "ai-cr:passed": { color: "0e8a16", description: "AI code review passed" },
  "ai-cr:failed": { color: "b60205", description: "AI code review found issues" },
  "ai-cr:error": { color: "fbca04", description: "AI code review could not complete" },
  "ai-cr:review": { color: "1d76db", description: "Request an AI code review retry" },
};

function outcomeFor(execution, verdict) {
  if (execution !== "success") return "ai-cr:error";
  return verdict === "pass" ? "ai-cr:passed" : "ai-cr:failed";
}

async function ensureLabels(github, owner, repo) {
  for (const [name, label] of Object.entries(labels)) {
    try {
      await github.rest.issues.createLabel({ owner, repo, name, ...label });
    } catch (error) {
      if (error.status !== 422) throw error;
    }
  }
}

async function upsertComment(github, owner, repo, issueNumber, body) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
  });
  const previous = comments.find(
    (comment) => comment.user?.login === "github-actions[bot]" && comment.body?.includes(MARKER),
  );

  if (previous) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: previous.id, body: `${MARKER}\n${body}` });
    return;
  }

  await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: `${MARKER}\n${body}` });
}

async function reconcileLabels(github, owner, repo, issueNumber, outcome) {
  const terminalLabels = ["ai-cr:passed", "ai-cr:failed", "ai-cr:error"];
  for (const name of [...terminalLabels.filter((name) => name !== outcome), "ai-cr:review"]) {
    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }

  await github.rest.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [outcome] });
}

async function publishCodeReview({ github, owner, repo, issueNumber, execution, verdict, summary }) {
  const outcome = outcomeFor(execution, verdict);
  const body =
    outcome === "ai-cr:error"
      ? "## AI code review error\n\nThe review could not complete. Check the workflow run for details."
      : summary;

  await ensureLabels(github, owner, repo);
  await upsertComment(github, owner, repo, issueNumber, body);
  await reconcileLabels(github, owner, repo, issueNumber, outcome);
  return outcome;
}

module.exports = { MARKER, outcomeFor, publishCodeReview };
