"""GitHub through the gh CLI, which already holds the owner's login.

GraphQL and REST have separate hourly budgets. The sync reads through GraphQL, one query for
everything, and falls back to REST when GraphQL is spent. Single reads and writes that REST
does as well go through REST, so they never wait on the GraphQL budget. Only resolving a
thread has no REST equivalent."""

import json
import os
import re
import subprocess

PR_FIELDS = """
number title url state isDraft headRefName headRefOid baseRefName mergedAt body updatedAt
mergeCommit { oid }
reviews(last: 30) { nodes { databaseId body createdAt commit { oid } } }
"""

OPEN_FIELDS = PR_FIELDS + """
mergeable
commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
reviewThreads(first: 40) { nodes { id isResolved isOutdated path line
  comments(first: 30) { nodes { databaseId body createdAt } } } }
"""

# About 13 points a sync, where open and merged both asking for every thread cost about 68.
QUERY = """
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    open: pullRequests(states: OPEN, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { %s }
    }
    merged: pullRequests(states: MERGED, first: 15, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { %s }
    }
  }
}
""" % (OPEN_FIELDS, PR_FIELDS)

LEAD_HEADER = "## Review (from lead)"
# The last line of the lead's review, written by `sq lead review` and read back here.
PASS_LINE = "Review passed at {sha}. Ready to merge."
BACK_LINE = "Failed code review: {blocking} blocking."
PASSED = re.compile(r"Review passed at ([0-9a-f]{7,40})")
# Reviews from before the code review states end "Back to In Progress", and still count.
BACK = re.compile(r"(?:Failed code review|Back to In Progress): (\d+) blocking")
STORY = re.compile(r"sc-(\d+)")
REMOTE = re.compile(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?/?$")
LIMITED = re.compile(r"rate limit", re.I)
# A thread read over REST has no GraphQL id until the next GraphQL sync.
REST_THREAD = "rest:"


class GitHubError(RuntimeError):
    pass


class RateLimited(GitHubError):
    pass


def gh(*args, stdin=None):
    result = subprocess.run(["gh", *args], input=stdin, capture_output=True, text=True)
    if result.returncode != 0:
        error = RateLimited if LIMITED.search(result.stderr) else GitHubError
        raise error(f"gh {args[0]} {args[1] if len(args) > 1 else ''}: "
                    f"{result.stderr.strip()[:200]}")
    return result.stdout


def api(path, *args, stdin=None):
    return json.loads(gh("api", path, *args, stdin=stdin) or "null")


def pages(path):
    """Every item of a REST list, across pages."""
    return [item for page in api(path, "--paginate", "--slurp") for item in page]


_repository = []


def repository():
    """From the checkout's remote, so it costs no call; gh asks GitHub only if that fails."""
    if not _repository:
        here = os.path.dirname(os.path.abspath(__file__))
        remote = subprocess.run(["git", "-C", here, "remote", "get-url", "origin"],
                                capture_output=True, text=True).stdout.strip()
        found = REMOTE.search(remote)
        if found:
            _repository.extend(found.groups())
        else:
            _repository.extend(gh("repo", "view", "--json", "nameWithOwner", "-q",
                                  ".nameWithOwner").strip().split("/"))
    return tuple(_repository)


def repo_path():
    owner, name = repository()
    return f"repos/{owner}/{name}"


def pull_requests(owner, name, known=None):
    """The open and recently merged pull requests. `known` is what the last sync stored, by
    number, which the REST fallback reuses for a pull request that has not changed."""
    try:
        out = gh("api", "graphql", "-f", f"query={QUERY}", "-F", f"owner={owner}",
                 "-F", f"name={name}")
    except RateLimited:
        return rest_pull_requests(owner, name, known or {})
    repo = json.loads(out)["data"]["repository"]
    return [slim(node) for node in repo["open"]["nodes"] + repo["merged"]["nodes"]]


def checks(node):
    commits = (node.get("commits") or {}).get("nodes") or []
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


def lead_verdicts(reviews):
    lead = []
    for review in reviews:
        found = verdict(review)
        if found:
            found["at"] = review["createdAt"]
            found["id"] = review["databaseId"]
            lead.append(found)
    return lead


def slim(node):
    story = STORY.search(node["headRefName"]) or STORY.search(node["title"])
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
        "updated_at": node.get("updatedAt"),
        "checks": checks(node),
        "mergeable": (node.get("mergeable") or "UNKNOWN").lower(),
        "merged_at": node["mergedAt"],
        "merge_sha": (node.get("mergeCommit") or {}).get("oid"),
        "lead": lead_verdicts(node["reviews"]["nodes"]),
        "threads": [
            {"id": t["id"], "resolved": t["isResolved"], "outdated": t["isOutdated"],
             "path": t["path"], "line": t["line"],
             "comments": [{"id": c["databaseId"], "at": c["createdAt"], "text": c["body"]}
                          for c in t["comments"]["nodes"]]}
            for t in (node.get("reviewThreads") or {}).get("nodes", [])
        ],
    }


# REST, for when GraphQL is spent. Each function returns what the GraphQL path does.

MERGEABLE = {True: "MERGEABLE", False: "CONFLICTING", None: "UNKNOWN"}
RUN_RED = {"failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"}


def rest_node(pull, merged):
    """A REST pull request in the shape `slim` reads."""
    return {"number": pull["number"], "title": pull["title"], "url": pull["html_url"],
            "state": "MERGED" if merged else pull["state"].upper(), "isDraft": pull["draft"],
            "headRefName": pull["head"]["ref"], "headRefOid": pull["head"]["sha"],
            "baseRefName": pull["base"]["ref"], "mergedAt": pull.get("merged_at"),
            "body": pull.get("body"), "updatedAt": pull["updated_at"],
            "mergeCommit": {"oid": pull["merge_commit_sha"]} if merged else None}


def rest_reviews(owner, name, number):
    return [{"databaseId": r["id"], "body": r.get("body"), "createdAt": r.get("submitted_at"),
             "commit": {"oid": r.get("commit_id")}}
            for r in pages(f"repos/{owner}/{name}/pulls/{number}/reviews?per_page=100")]


def rest_threads(owner, name, number, known_threads):
    """Review comments grouped into threads by the comment each replies to. Whether a thread
    is resolved is GraphQL's alone, so a known thread keeps what the last sync saw and a new
    one counts as open."""
    known = {t["comments"][0]["id"]: t for t in known_threads if t["comments"]}
    roots, order = {}, []
    for c in pages(f"repos/{owner}/{name}/pulls/{number}/comments?per_page=100"):
        root = c.get("in_reply_to_id") or c["id"]
        if root not in roots:
            seen = known.get(root, {})
            roots[root] = {"id": seen.get("id") or f"{REST_THREAD}{root}",
                           "resolved": seen.get("resolved", False),
                           "outdated": c.get("line") is None, "path": c["path"],
                           "line": c.get("line"), "comments": []}
            order.append(root)
        roots[root]["comments"].append({"id": c["id"], "at": c["created_at"],
                                        "text": c["body"]})
    return [roots[root] for root in order]


def rest_check_runs(owner, name, sha):
    runs = api(f"repos/{owner}/{name}/commits/{sha}/check-runs?per_page=100")["check_runs"]
    statuses = api(f"repos/{owner}/{name}/commits/{sha}/status")["statuses"]
    return runs, statuses


def rest_checks(owner, name, sha):
    """The rollup GraphQL gives: red on any failure, pending while any runs, else green."""
    runs, statuses = rest_check_runs(owner, name, sha)
    if not runs and not statuses:
        return "pending"
    if any(r["conclusion"] in RUN_RED for r in runs) \
            or any(s["state"] in ("failure", "error") for s in statuses):
        return "red"
    if any(r["status"] != "completed" for r in runs) \
            or any(s["state"] == "pending" for s in statuses):
        return "pending"
    return "green"


def rest_pull_requests(owner, name, known):
    base = f"repos/{owner}/{name}/pulls"
    main = api(f"repos/{owner}/{name}/git/ref/heads/main")["object"]["sha"]
    opened = api(f"{base}?state=open&sort=updated&direction=desc&per_page=30")
    closed = api(f"{base}?state=closed&sort=updated&direction=desc&per_page=30")
    out = []
    for pull, merged in [(p, False) for p in opened] + \
            [(p, True) for p in closed if p.get("merged_at")][:15]:
        before = known.get(pull["number"]) or {}
        same = before.get("updated_at") == pull["updated_at"] \
            and before.get("head_sha") == pull["head"]["sha"]
        if same and (merged or before.get("checks") != "pending"):
            # A pull request that never changes still starts to conflict when main moves, and
            # GitHub answers null until it has worked the answer out.
            if not merged and (before.get("mergeable") == "unknown"
                               or before.get("main_sha") != main):
                before = dict(before, main_sha=main, mergeable=MERGEABLE[
                    api(f"{base}/{pull['number']}").get("mergeable")].lower())
            out.append(before)
            continue
        pr = slim({**rest_node(pull, merged), "reviews": {"nodes": []}})
        pr["lead"] = before["lead"] if same else \
            lead_verdicts(rest_reviews(owner, name, pull["number"]))
        if not merged:
            pr["threads"] = before["threads"] if same else \
                rest_threads(owner, name, pull["number"], before.get("threads", []))
            pr["checks"] = rest_checks(owner, name, pull["head"]["sha"])
            pr["mergeable"] = before["mergeable"] if same and before.get("main_sha") == main \
                and before["mergeable"] != "unknown" else \
                MERGEABLE[api(f"{base}/{pull['number']}").get("mergeable")].lower()
            pr["main_sha"] = main
        out.append(pr)
    return out


def main_runs(limit=5):
    out = gh("run", "list", "-R", "/".join(repository()), "--branch", "main",
             "--limit", str(limit), "--json",
             "databaseId,headSha,conclusion,status,url,displayTitle,createdAt,workflowName")
    return json.loads(out)


def diff(number):
    return gh("api", f"{repo_path()}/pulls/{number}", "-H", "Accept: application/vnd.github.diff")


def bucket(run):
    if run["status"] != "completed":
        return "pending"
    return {"success": "pass", "neutral": "pass", "skipped": "skipping",
            "cancelled": "cancel"}.get(run["conclusion"], "fail")


def rest_pr_checks(number):
    owner, name = repository()
    sha = api(f"{repo_path()}/pulls/{number}")["head"]["sha"]
    runs, statuses = rest_check_runs(owner, name, sha)
    workflows = {}
    out = []
    for run in runs:
        job = JOB_LINK.search(run.get("html_url") or "")
        if job and job.group(1) not in workflows:
            workflows[job.group(1)] = api(f"{repo_path()}/actions/runs/{job.group(1)}")["name"]
        out.append({"name": run["name"], "state": (run["conclusion"] or run["status"]).upper(),
                    "bucket": bucket(run), "link": run.get("html_url") or "",
                    "workflow": workflows.get(job.group(1), "") if job else ""})
    for status in statuses:
        out.append({"name": status["context"], "state": status["state"].upper(),
                    "bucket": {"success": "pass", "pending": "pending"}.get(status["state"],
                                                                           "fail"),
                    "link": status.get("target_url") or "", "workflow": ""})
    return out


def pr_checks(number):
    out = subprocess.run(["gh", "pr", "checks", str(number), "-R", "/".join(repository()),
                          "--json", "name,state,bucket,link,workflow"],
                         capture_output=True, text=True)
    # It exits 1 for a failing check too, so the limit is told apart by what it says.
    if out.returncode and LIMITED.search(out.stderr):
        return rest_pr_checks(number)
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
    result = subprocess.run(["gh", "run", "view", *args, "-R", "/".join(repository()),
                             "--log-failed"], capture_output=True, text=True)
    lines = []
    for line in result.stdout.splitlines():
        # Each line is "<job>\t<step>\t<timestamp> <text>"; the text is what matters.
        text = line.split("\t", 2)[-1]
        lines.append(text.split(" ", 1)[1] if text[:4].isdigit() and " " in text else text)
    return "\n".join(lines[-tail:])


def rerun_failed(run_id):
    gh("run", "rerun", str(run_id), "-R", "/".join(repository()), "--failed")


def compare(owner, name, base, head):
    body = api(f"repos/{owner}/{name}/compare/{base}...{head}")
    return {"commits": [(c["sha"][:7], c["commit"]["message"].split("\n", 1)[0])
                        for c in body.get("commits", [])],
            "files": [f["filename"] for f in body.get("files", [])]}


def files(number):
    return [(f["filename"], f["additions"], f["deletions"])
            for f in pages(f"{repo_path()}/pulls/{number}/files?per_page=100")]


def live(number):
    """What a merge decision needs, read now rather than from the last sync."""
    pull = api(f"{repo_path()}/pulls/{number}")
    return {"headRefOid": pull["head"]["sha"], "mergeable": MERGEABLE[pull.get("mergeable")],
            "mergeStateStatus": (pull.get("mergeable_state") or "unknown").upper(),
            "state": "MERGED" if pull.get("merged") else pull["state"].upper(),
            "draft": bool(pull.get("draft")),
            "mergeCommit": pull["merge_commit_sha"] if pull.get("merged") else None}


HUNK = re.compile(r"^@@[^\n]*", re.M)
UNCOMPARABLE = re.compile(r"HTTP 4(04|22)")


def change_key(files):
    """What a comparison changes, without hunk positions: merging main in moves a hunk without
    changing it. None for no change at all, which every merged head shows, or when GitHub
    leaves out a patch or the list, so nothing is assumed."""
    if not files or len(files) >= 300 or any("patch" not in f for f in files):
        return None
    return sorted((f["filename"], f.get("previous_filename"), f["status"],
                   HUNK.sub("@@", f["patch"])) for f in files)


def same_change(before, after):
    """Whether `after` changes main exactly as `before` did. A sha GitHub cannot compare, as
    after a force-push, never will be, so it answers no rather than failing."""
    try:
        keys = [change_key(api(f"{repo_path()}/compare/main...{sha}").get("files") or [])
                for sha in (before, after)]
    except RateLimited:
        raise
    except GitHubError as error:
        if UNCOMPARABLE.search(str(error)):
            return False
        raise
    return keys[0] is not None and keys[0] == keys[1]


def post_review(owner, name, number, head, body, comments):
    payload = {"commit_id": head, "event": "COMMENT", "body": body,
               "comments": [{"path": c["path"], "line": c["line"], "side": "RIGHT",
                             "body": c["body"]} for c in comments]}
    return api(f"repos/{owner}/{name}/pulls/{number}/reviews", "--method", "POST",
               "--input", "-", stdin=json.dumps(payload))


def merge(number, head, method="merge", delete_branch=False):
    """Merges only if the head is still `head`, as `--match-head-commit` did."""
    path = f"{repo_path()}/pulls/{number}"
    api(f"{path}/merge", "--method", "PUT", "--input", "-",
        stdin=json.dumps({"sha": head, "merge_method": method}))
    if delete_branch:
        branch = api(path)["head"]["ref"]
        gh("api", f"{repo_path()}/git/refs/heads/{branch}", "--method", "DELETE")


def close(number, text):
    """The reason first, so a closed pull request never lacks one."""
    api(f"{repo_path()}/issues/{number}/comments", "--method", "POST", "--input", "-",
        stdin=json.dumps({"body": text}))
    api(f"{repo_path()}/pulls/{number}", "--method", "PATCH", "--input", "-",
        stdin=json.dumps({"state": "closed"}))


def ready(number):
    """A draft cannot be merged; a passed one is marked ready first."""
    owner, name = repository()
    gh("pr", "ready", str(number), "--repo", f"{owner}/{name}")


def create_pr(head, title, body, draft=False, base="main"):
    return api(f"{repo_path()}/pulls", "--method", "POST", "--input", "-",
               stdin=json.dumps({"title": title, "head": head, "base": base, "body": body,
                                 "draft": draft}))["html_url"]


def reply(owner, name, number, comment_id, text):
    gh("api", f"repos/{owner}/{name}/pulls/{number}/comments/{comment_id}/replies",
       "-F", "body=@-", stdin=text)


def resolve(thread_id):
    if not thread_id or thread_id.startswith(REST_THREAD):
        raise RateLimited("GitHub's GraphQL limit is spent, and resolving a thread needs it; "
                          "try again after the hourly reset")
    gh("api", "graphql", "-f",
       "query=mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}",
       "-f", f"id={thread_id}")
