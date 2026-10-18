"""GitHub through the gh CLI, which already holds the owner's login."""

import json
import re
import subprocess

PR_FIELDS = """
number title url state isDraft headRefName headRefOid mergeable mergedAt
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


def main_run():
    out = gh("run", "list", "--branch", "main", "--limit", "1", "--json",
             "headSha,conclusion,url")
    runs = json.loads(out)
    return runs[0] if runs else None


def reply(owner, name, number, comment_id, text):
    gh("api", f"repos/{owner}/{name}/pulls/{number}/comments/{comment_id}/replies",
       "-F", "body=@-", stdin=text)


def resolve(thread_id):
    gh("api", "graphql", "-f",
       "query=mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}",
       "-f", f"id={thread_id}")
