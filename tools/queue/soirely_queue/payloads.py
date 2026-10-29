"""The payload for each kind of work: what the role needs to act, and the commands to act
with, filled in. Anything more is one `sq <role> <read>` away."""

import time

from . import github, store
from . import roles as R
from . import text as T
from . import views as V
from . import work as W

SQ = V.SQ


# The states a developer or tester claims a story from.
CLAIMABLE = ("Ready For Dev", "Failed Code Review", "Failed QA", "Ready For QA")


def cached_diff(cache, pr):
    path = cache / f"diff-{pr['number']}-{pr['head_sha'][:12]}.patch"
    if path.exists():
        return path.read_text()
    body = github.diff(pr["number"])
    cache.mkdir(parents=True, exist_ok=True)
    for old in cache.glob(f"diff-{pr['number']}-*.patch"):
        old.unlink()
    path.write_text(body)
    return body


def next_lines(p, *commands):
    p.add("", "Next:")
    for command in commands:
        p.add(f"  {command}")


def story_for(p, db, story, kind_role):
    """A story as the role works on it. AC is always in full for the roles that build or
    test against it; the rest goes through the ledger."""
    role = p.role
    p.add(*V.header(story))
    V.notes(p, story)
    if role in R.TESTERS:
        V.description(p, story, always=(T.is_ac, T.is_design))
    elif role in R.DEVS:
        V.description(p, story, always=(T.is_ac,))
    else:
        V.description(p, story)
    if story["tasks"]:
        p.add("", "Tasks:")
        for task in story["tasks"]:
            p.add(f"  [{'x' if task['done'] else ' '}] {task['id']} {task['text']}")
    if story["links"]:
        p.add("", "Related: " + ", ".join(
            f"sc-{link['subject']} {link['verb']} sc-{link['object']}" for link in story["links"]))
    report = V.latest_qa_report(story)
    if report and story["state"] == "Failed QA" and role in R.DEVS:
        p.add("", "Latest QA report:")
        V.thread(p, story, [report], set(), always_ids={report["id"]})
    V.comments(p, story, always_ids={report["id"]} if report else ())
    for pr in store.prs_for_story(db, story["id"]):
        V.pr_status(p, pr, compact=role not in R.DEVS)
        if role in R.TESTERS:
            V.pr_section(p, pr, "Risks", always=True)


def inbox(p, db, row, story):
    p.add(*V.header(story))
    if story["done"]:
        p.add("", f"sc-{story['id']} is Done and stays Done. Answer here, but new work goes on "
                  "an open story or a new one.")
    V.notes(p, story)
    V.comments(p, story, mode="open")
    for pr in store.prs_for_story(db, story["id"]):
        if pr["state"] == "open":
            V.pr_status(p, pr, compact=True)
    p.add("", f"The story's sections: {'; '.join(h for h, _, _ in T.sections(story['description']))}"
              f" (`{SQ} {p.role} story sc-{story['id']} --section <name>`)")
    next_lines(p, f"{SQ} {p.role} comment sc-{story['id']} --reply-to <id> --text \"…\"",
               f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")


def review(p, db, row, story, pr, cache):
    p.add(*V.header(story))
    V.notes(p, story)
    V.description(p, story, always=(T.is_ac,), only=(T.is_ac,), outline_rest=True)
    V.comments(p, story)
    if not pr:
        p.add("", "No open pull request. Ask the developer with "
                  f"`{SQ} lead comment sc-{story['id']} --to {R.developer_of(story['labels'])}`.")
        return next_lines(p, f"{SQ} lead done {row['id']} --note \"<one line>\"")
    V.pr_status(p, pr)
    V.lead_threads(p, pr)
    V.pr_section(p, pr, "Risks", always=True)
    files = V.diff_files(cached_diff(cache, pr))
    p.add("", f"Diff at {pr['head_sha'][:7]} ({len(files)} files):", *V.diff_stat(files))
    verdict = W.latest_verdict(pr)
    if verdict and verdict["sha"]:
        owner, name = store.get_meta(db, "repository")
        try:
            delta = github.compare(owner, name, verdict["sha"], pr["head_sha"])
            # A merge of main brings main's commits and files along; only the PR's own
            # files say what the developer changed.
            touched = [path for path in delta["files"] if path in files]
            own = [(sha, message) for sha, message in delta["commits"]
                   if not message.startswith("Merge ")]
            p.add("", f"Since your {verdict['verdict']} at {verdict['sha'][:7]}: "
                      f"{len(delta['commits'])} commits; the PR's files changed: "
                      f"{', '.join(touched) or 'none'}")
            p.add(*[f"  {sha} {message}" for sha, message in own[-10:]])
        except github.GitHubError as error:
            p.add("", f"(no delta since {verdict['sha'][:7]}: {error})")
    if pr["checks"] == "red":
        p.add("", f"Checks are red: `{SQ} lead checks {pr['number']}` names them.")
    n = pr["number"]
    next_lines(p, f"{SQ} lead diff {n} <path> [<path>…]   (one file's diff; --all for every file)",
               f"{SQ} lead story sc-{story['id']} --section <name>",
               f"{SQ} lead review {n} --pass|--back --findings <file> < summary.md",
               f"{SQ} lead resolve {n} <comment id> --text \"Resolved in <sha>.\"",
               f"{SQ} lead done {row['id']} --note \"<one line>\"")


def threads(p, pr, story, row):
    p.add(*V.header(story))
    V.notes(p, story)
    V.pr_status(p, pr)
    n = pr["number"]
    next_lines(p, f"{SQ} lead resolve {n} <comment id> --text \"…\"   (the reply settles it)",
               f"{SQ} lead pr-reply {n} <comment id> --text \"…\"   (it does not; stays open)",
               f"{SQ} lead diff {n} <path>",
               f"{SQ} lead done {row['id']} --note \"<one line>\"")


def answer_threads(p, pr, story, row):
    p.add(*V.header(story))
    V.notes(p, story)
    V.pr_status(p, pr)
    n = pr["number"]
    p.add("", "The lead passed this head, but an open thread holds the merge. Fix it and push "
              "(the push voids the pass), or answer it so the lead can resolve it.")
    next_lines(p, f"{SQ} {p.role} pr-reply {n} <comment id> --text \"…\"",
               f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")


def checks_red(p, pr, story, row):
    V.pr_status(p, pr, compact=True)
    failed = [c for c in github.pr_checks(pr["number"]) if c.get("bucket") == "fail"]
    p.add("", f"Failing checks ({len(failed)}):")
    for check in failed:
        p.add("", f"  {check['workflow']} / {check['name']} {check['link']}")
        log = github.failed_log(check["link"], tail=40)
        if log:
            p.add(*["    " + line for line in log.splitlines()])
    next_lines(p, f"fix it in your checkout, push; or `{SQ} {p.role} rerun {pr['number']}` "
                  "for a flaky job",
               f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")


def merge(p, pr, story, row):
    V.pr_status(p, pr, compact=True)
    live = github.live(pr["number"])
    if live["mergeable"] == "CONFLICTING" and p.role in R.LINGUISTS:
        p.add("", "It conflicts with main. Merge origin/main into the branch and push; the "
                  "green checks on the new head wake you to merge.")
        return next_lines(p, f"{SQ} {p.role} done {row['id']} --note \"brought main in\"")
    if live["mergeable"] == "CONFLICTING":
        p.add("", "It conflicts with main, so it cannot merge as passed. Merge origin/main into "
                  "the branch and push. The push voids the pass, and the lead reviews the new "
                  "head, wherever the story is.")
        return next_lines(p, f"{SQ} {p.role} done {row['id']} --note \"brought main in\"")
    if p.role in R.LINGUISTS:
        merges = ("merges it once it changes only locale files; then move the ticket to Ready "
                  "For QA if everything it covers is merged, as your skill's section 5 says")
    elif W.side_pr(story, pr) and not W.finished(story):
        merges = (f"merges at the passed sha; sc-{story['id']} is a translation ticket and "
                  "stays where the linguist put it, so the merge is still yours")
    elif W.follow_up(story):
        merges = f"merges at the passed sha; sc-{story['id']} stays {story['state']}"
    else:
        merges = ("checks every condition, merges at the passed sha, moves the story to Ready "
                  "For QA and tells QA")
    next_lines(p, f"{SQ} {p.role} merge {pr['number']}   ({merges})",
               f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")


def close(p, pr, story, row):
    p.add(*V.header(story))
    V.pr_status(p, pr, compact=True)
    p.add("", f"sc-{story['id']} is archived, so this pull request has nowhere to land. If its "
              "change is still wanted, say on the open story that carries it on; then close it.")
    next_lines(p, f"{SQ} {p.role} pr-close {pr['number']} --text \"sc-{story['id']} is archived: "
                  "<why, and where its change went>\"",
               f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")


def stranded(p, db, row):
    found = W.stranded(store.stories(db), store.prs(db), time.time())
    p.add(f"Open pull requests with no story, or untouched for a day ({len(found)}):")
    for f in found:
        story = f["story"]
        where = f"sc-{story['id']} {story['state']}" if story else "no story"
        p.add(f"  #{f['pr']['number']} {f['hours']}h idle · {where} · {f['pr']['title']}",
              f"    waits on: {f['step']}")
    p.add("", "Tag the role whose step it is on its story, or close the pull request with the "
              "reason. One with no story is yours to place or close.")
    next_lines(p, f"{SQ} ops comment sc-<n> --to <role> --text \"PR #<n> waits on you: …\"",
               f"{SQ} ops pr-close <n> --text \"<why>\"",
               f"{SQ} ops done {row['id']} --note \"<one line>\"")


def conflict(p, pr, story, row):
    V.pr_status(p, pr, compact=True)
    p.add("", f"It conflicts with main, so it can neither be reviewed as it will land nor merge. "
              f"In your checkout, on {pr['branch']}: `git fetch origin && git merge origin/main`. "
              "Resolve each file so both changes survive: what main has is merged, and what "
              "the branch has is yours. Run the suites the files touch, commit the merge, and "
              "push. Never rebase or force-push. "
              + ("The green checks on the new head wake you to merge." if p.role in R.LINGUISTS
                 else "A push after a pass voids it, and the lead reviews the new head."))
    next_lines(p, f"{SQ} {p.role} done {row['id']} --note \"brought main in\"")


def main_red(p, db, row):
    runs = store.get_meta(db, "main_runs") or []
    p.add("main, newest first:")
    for run in runs:
        p.add(f"  {run['headSha'][:7]} {run['workflowName']} {run['conclusion'] or run['status']}"
              f" · {run['displayTitle']} · {run['url']}")
    failing = next((r for r in runs if r.get("conclusion") == "failure"), None)
    if failing:
        log = github.failed_log(run=failing["databaseId"], tail=60)
        p.add("", f"Failed log of {failing['databaseId']} (last 60 lines):",
              *["  " + line for line in log.splitlines()])
    next_lines(p, f"{SQ} ops rerun {failing['databaseId'] if failing else '<run id>'}",
               f"{SQ} ops done {row['id']} --note \"<one line>\"")


def plan(p, db, row, story):
    story_for(p, db, story, p.role)
    person = W.planned_for(row["fingerprint"])
    p.add("", f"Write {person}'s test plan (soirely-qa-tester, \"A plan for a person\"). "
              "Check out the story's merge commit on their stack (`node scripts/qa-env.mjs "
              "--tester lan setup`, then `checkout`), make the accounts and data with the QA "
              "script, start the app for their phone with `node scripts/qa-env.mjs --tester "
              "lan serve`, then post the plan as one comment with the QR code it wrote "
              "attached, its claim the last line. Do not test it yourself, and do not claim it.")
    p.add("", "Next:", f"  {SQ} {p.role} comment sc-{story['id']} --to {person} "
                       "--files <the QR code serve wrote> <<'PLAN'",
          "…", "", f"QA claim: {person}", "PLAN",
          f"  {SQ} {p.role} done {row['id']} --note \"<one line>\"")


def render(p, db, row, cache):
    """The payload for a claimed work item."""
    from . import digests
    kind = row["kind"]
    story = store.story(db, row["story_id"]) if row["story_id"] else None
    pr = store.pr(db, row["pr"]) if row["pr"] else None
    p.add(f"Work {row['id']}: {row['reason']}", "")
    if kind == "inbox":
        return inbox(p, db, row, story)
    if kind == "review":
        return review(p, db, row, story, pr, cache)
    if kind == "threads":
        return threads(p, pr, story, row)
    if kind == "answer-threads":
        return answer_threads(p, pr, story, row)
    if kind == "checks-red":
        p.add(*V.header(story))
        return checks_red(p, pr, story, row)
    if kind == "merge":
        p.add(*V.header(story))
        return merge(p, pr, story, row)
    if kind == "conflict":
        p.add(*V.header(story))
        return conflict(p, pr, story, row)
    if kind == "to-qa":
        p.add(*V.header(story), f"  merged as {pr['merge_sha']}")
        return next_lines(p, f"{SQ} {p.role} to-qa sc-{story['id']} --text \"<what to look at>\"",
                          f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")
    if kind == "to-review":
        p.add(*V.header(story))
        V.pr_status(p, pr, compact=True)
        return next_lines(p, f"{SQ} {p.role} move sc-{story['id']} \"In Review\"",
                          f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")
    if kind == "merged-unpassed":
        p.add(*V.header(story))
        V.pr_status(p, pr, compact=True)
        return next_lines(p, f"{SQ} {p.role} comment sc-{story['id']} --to lead --text \"…\"",
                          f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")
    if kind == "unblocked":
        story_for(p, db, story, p.role)
        return next_lines(p, f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")
    if kind == "main":
        return main_red(p, db, row)
    if kind == "close":
        return close(p, pr, story, row)
    if kind == "stranded":
        return stranded(p, db, row)
    if kind in ("pick", "sweep"):
        return digests.render(p, db, row)
    if kind == "held":
        story_for(p, db, story, p.role)
        p.add("", "You claimed this and no report followed. Test it now if your stack answers; "
                  "if it cannot be tested, give it back rather than leave it In QA.")
        return next_lines(p, f"{SQ} {p.role} report sc-{story['id']} passed|failed --text \"…\"",
                          f"{SQ} {p.role} unclaim sc-{story['id']} "
                          "--text \"<why it was not tested>\"",
                          f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")
    if kind == "plan":
        return plan(p, db, row, story)
    if kind == "story":
        story_for(p, db, story, p.role)
        if p.role in R.DEVS + R.TESTERS and story["state"] in CLAIMABLE:
            return next_lines(p, f"{SQ} {p.role} claim sc-{story['id']}",
                              f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")
        return next_lines(p, f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")
    if kind == "machine":
        p.add(f"You are {row['pool']}: this machine only. Never run a command against another "
              "computer, and leave CI, deploys and stories to the machine holding the ops "
              "lease.", "",
              "Look with `docker system df`, `df -h`, `sq status`; clean with "
              "`just prune-build-cache` (volumes are kept). Never delete a volume, a database "
              "or data you did not create.")
        return next_lines(p, f"{SQ} {p.role} done {row['id']} --note \"<one line>\"")
    p.add(f"(no payload for {kind})")
