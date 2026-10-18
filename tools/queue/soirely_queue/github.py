"""GitHub through the gh CLI, which already holds the owner's login."""

import json
import re
import subprocess

PR_FIELDS = """
number title url state isDraft headRefName headRefOid baseRefName mergeable mergedAt body
mergeCommit { oid }
commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
reviews(last: 30) { nodes { databaseId body createdAt commit { oid } } }
reviewThreads(first: 100) { nodes { id isResolved isOutdated path line
  comments(first: 50) { nodes { databaseId body createdAt } } } }
"""

QUERY = """
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    open: pullRequests(states: OPEN, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { %s }
    }
    merged: pullRequests(states: MERGED, first: 15, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { %s }
    }
  }
}
""" % (PR_FIELDS, PR_FIELDS)

LEAD_HEADER = "## Review (from lead)"
PASSED = re.compile(r"Review passed at ([0-9a-f]{7,40})")
BACK = re.compile(r"Back to In Progress: (\d+) blocking")
STORY = re.compile(r"sc-(\d+)")


class GitHubError(RuntimeError):
    pass


def gh(*args, stdin=None):
    result = subprocess.run(["gh", *args], input=stdin, capture_output=True, text=True)
    if result.returncode != 0:
        raise GitHubError(f"gh {args[0]} {args[1] if len(args) > 1 else ''}: "
                          f"{result.stderr.strip()[:200]}")
    return result.stdout


def repository():
    owner, name = gh("repo", "view", "--json", "nameWithOwner", "-q",
                     ".nameWithOwner").strip().split("/")
    return owner, name


def pull_requests(owner, name):
    out = gh("api", "graphql", "-f", f"query={QUERY}", "-F", f"owner={owner}",
             "-F", f"name={name}")
    repo = json.loads(out)["data"]["repository"]
    return [slim(node) for node in repo["open"]["nodes"] + repo["merged"]["nodes"]]


def checks(node):
    commits = node["commits"]["nodes"]
    rollup = commits[0]["commit"]["statusCheckRollup"] if commits else None
    state = (rollup or {}).get("state")
    return {"SUCCESS": "green", "FAILURE": "red", "ERROR": "red"}.get(state, "pending")


def verdict(review):
    body = review.get("body") or ""
    if not body.lstrip().startswith(LEAD_HEADER):
        return None
    passed = PASSED.search(body)
    if passed:
        return {"verdict": "pass", "sha": passed.group(1)}
    back = BACK.search(body)
    if back:
        return {"verdict": "back", "sha": (review.get("commit") or {}).get("oid"),
                "blocking": int(back.group(1))}
    return None


def slim(node):
    story = STORY.search(node["headRefName"]) or STORY.search(node["title"])
    lead = []
    for review in node["reviews"]["nodes"]:
        found = verdict(review)
        if found:
            found["at"] = review["createdAt"]
            found["id"] = review["databaseId"]
            lead.append(found)
    return {
        "number": node["number"],
        "title": node["title"],
        "url": node["url"],
        "state": node["state"].lower(),
        "draft": node["isDraft"],
        "branch": node["headRefName"],
        "story_id": int(story.group(1)) if story else None,
        "head_sha": node["headRefOid"],
        "base": node["baseRefName"],
        "body": node.get("body") or "",
        "checks": checks(node),
        "mergeable": node["mergeable"].lower(),
        "merged_at": node["mergedAt"],
        "merge_sha": (node.get("mergeCommit") or {}).get("oid"),
        "lead": lead,
        "threads": [
            {"id": t["id"], "resolved": t["isResolved"], "outdated": t["isOutdated"],
             "path": t["path"], "line": t["line"],
             "comments": [{"id": c["databaseId"], "at": c["createdAt"], "text": c["body"]}
                          for c in t["comments"]["nodes"]]}
            for t in node["reviewThreads"]["nodes"]
        ],
    }


def main_runs(limit=5):
    out = gh("run", "list", "--branch", "main", "--limit", str(limit), "--json",
             "databaseId,headSha,conclusion,status,url,displayTitle,createdAt,workflowName")
    return json.loads(out)


def diff(number):
    return gh("pr", "diff", str(number))


def pr_checks(number):
    out = subprocess.run(["gh", "pr", "checks", str(number), "--json",
                          "name,state,bucket,link,workflow"], capture_output=True, text=True)
    if out.returncode not in (0, 1, 8):
        raise GitHubError(f"gh pr checks: {out.stderr.strip()[:200]}")
    return json.loads(out.stdout or "[]")


JOB_LINK = re.compile(r"/actions/runs/(\d+)/job/(\d+)")


def failed_log(link=None, run=None, tail=60):
    """The last lines of a failed job's log, from a check's link or a whole run's id."""
    match = JOB_LINK.search(link or "")
    if match:
        args = [match.group(1), "--job", match.group(2)]
    elif run:
        args = [str(run)]
    else:
        return ""
    result = subprocess.run(["gh", "run", "view", *args, "--log-failed"],
                            capture_output=True, text=True)
    lines = []
    for line in result.stdout.splitlines():
        # Each line is "<job>\t<step>\t<timestamp> <text>"; the text is what matters.
        text = line.split("\t", 2)[-1]
        lines.append(text.split(" ", 1)[1] if text[:4].isdigit() and " " in text else text)
    return "\n".join(lines[-tail:])


def rerun_failed(run_id):
    gh("run", "rerun", str(run_id), "--failed")


def compare(owner, name, base, head):
    out = gh("api", f"repos/{owner}/{name}/compare/{base}...{head}")
    body = json.loads(out)
    return {"commits": [(c["sha"][:7], c["commit"]["message"].split("\n", 1)[0])
                        for c in body.get("commits", [])],
            "files": [f["filename"] for f in body.get("files", [])]}


def files(number):
    out = gh("pr", "view", str(number), "--json", "files")
    return [(f["path"], f["additions"], f["deletions"]) for f in json.loads(out)["files"]]


def live(number):
    """What a merge decision needs, read now rather than from the last sync."""
    out = gh("pr", "view", str(number), "--json",
             "headRefOid,mergeable,mergeStateStatus,state,mergeCommit")
    found = json.loads(out)
    found["mergeCommit"] = (found.get("mergeCommit") or {}).get("oid")
    return found


def post_review(owner, name, number, head, body, comments):
    payload = {"commit_id": head, "event": "COMMENT", "body": body,
               "comments": [{"path": c["path"], "line": c["line"], "side": "RIGHT",
                             "body": c["body"]} for c in comments]}
    out = gh("api", f"repos/{owner}/{name}/pulls/{number}/reviews", "--method", "POST",
             "--input", "-", stdin=json.dumps(payload))
    return json.loads(out)


def merge(number, head, method="merge", delete_branch=False):
    args = ["pr", "merge", str(number), f"--{method}", "--match-head-commit", head]
    if delete_branch:
        args.append("--delete-branch")
    gh(*args)


def create_pr(head, title, body, draft=False, base="main"):
    args = ["pr", "create", "--base", base, "--head", head, "--title", title,
            "--body-file", "-"]
    if draft:
        args.append("--draft")
    return gh(*args, stdin=body).strip()


def reply(owner, name, number, comment_id, text):
    gh("api", f"repos/{owner}/{name}/pulls/{number}/comments/{comment_id}/replies",
       "-F", "body=@-", stdin=text)


def resolve(thread_id):
    gh("api", "graphql", "-f",
       "query=mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}",
       "-f", f"id={thread_id}")
