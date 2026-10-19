"""Every write a role makes, each checked against what that role may do before anything is
sent. A refusal says why and what to do instead."""

import datetime
import re
import time

from . import github, store, sync
from . import roles as R
from . import text as T
from . import work as W
from .shortcut import Shortcut


class Refused(RuntimeError):
    pass


class Context:
    def __init__(self, db, role, cache):
        self.db, self.role, self.cache = db, role, cache
        self._shortcut = None

    @property
    def shortcut(self):
        if not self._shortcut:
            self._shortcut = Shortcut()
        return self._shortcut

    def story(self, ref, fresh=True):
        story_id = story_number(ref)
        if fresh:
            return sync.refresh_story(self.db, self.shortcut, story_id)
        return store.story(self.db, story_id) or sync.refresh_story(self.db, self.shortcut,
                                                                     story_id)

    def refresh(self, story_id):
        from .cli import refresh_work
        story = sync.refresh_story(self.db, self.shortcut, story_id)
        refresh_work(self.db, time.time())
        return story

    def repository(self):
        found = store.get_meta(self.db, "repository")
        if not found:
            found = list(github.repository())
            store.set_meta(self.db, "repository", found)
        return found

    def pr(self, number):
        """A pull request as GitHub has it now: a decision is never made on a stale sync."""
        sync.sync_github(self.db)
        pr = store.pr(self.db, number)
        if not pr:
            raise Refused(f"PR #{number} is neither open nor recently merged")
        return pr

    def state_id(self, name):
        states = store.get_meta(self.db, "states") or sync.refresh_lookups(
            self.db, self.shortcut)[0]
        wanted = name.lower()
        for state_id, state in states.items():
            if state.lower() == wanted:
                return int(state_id), state
        raise Refused(f"no state {name!r}: one of {', '.join(sorted(set(states.values())))}")


def story_number(ref):
    match = re.fullmatch(r"(?:sc-)?(\d+)", str(ref).strip())
    if not match:
        raise Refused(f"{ref} is not a story: write sc-<n>")
    return int(match.group(1))


def signature(role):
    return role


def guard(c, command):
    if not R.may(c.role, command):
        raise Refused(f"{c.role} may not {command}: see `sq {c.role} help`")


def post(c, story, to, body, parent=None):
    head = " ".join([*(f"[{t}]" for t in to), f"(from {signature(c.role)})"])
    return c.shortcut.comment(story["id"], f"{head}\n{body.strip()}", parent)


def set_state(c, story, name, check=True):
    state_id, state = c.state_id(name)
    allowed = R.MOVES.get(c.role, {}).get(state, ())
    if check and not allowed:
        raise Refused(f"{c.role} never moves a story to {state}")
    if story["state"] == state:
        return state
    if check and story["state"] not in allowed:
        froms = " or ".join(allowed) if allowed else "nowhere"
        raise Refused(f"{c.role} moves a story to {state} only from {froms}; "
                      f"sc-{story['id']} is {story['state']}")
    moved = c.shortcut.update(story["id"], workflow_state_id=state_id)
    if moved and moved.get("moved_at"):
        store.mark_move(c.db, story["id"], state, moved["moved_at"], c.role)
    return state


def set_labels(c, story_id, add=(), remove=()):
    """Shortcut replaces the whole label set, so the update always sends the union."""
    if c.role != "pm":
        own = R.OWN_LABELS.get(c.role, set())
        stray = (set(add) | set(remove)) - own
        if stray:
            raise Refused(f"{c.role} may only touch the labels {', '.join(sorted(own))}")
    current = {label["name"] for label in c.shortcut.story(story_id).get("labels", [])}
    wanted = (current | set(add)) - set(remove)
    if wanted != current:
        c.shortcut.update(story_id, labels=[{"name": name} for name in sorted(wanted)])
    return sorted(wanted)


# Comments and notes


def comment(c, a):
    guard(c, "comment")
    story = c.story(a.story, fresh=False)
    to = [t for t in (a.to or "").replace(",", " ").split() if t]
    if to and a.untagged:
        raise Refused("--untagged posts no tag: drop --to, or drop --untagged to address it")
    parent = None
    if a.reply_to:
        replied = next((x for x in story["comments"] if x["id"] == a.reply_to), None)
        if not replied:
            story = c.story(a.story)
            replied = next((x for x in story["comments"] if x["id"] == a.reply_to), None)
        if not replied:
            raise Refused(f"no comment #{a.reply_to} on sc-{story['id']}")
        # Shortcut threads one level deep, so a reply to a reply goes on the thread's root.
        parent = replied["parent"] or replied["id"]
        if not to and not a.untagged and R.author(replied["text"]):
            to = [R.author(replied["text"])]
    if not to and not a.untagged:
        raise Refused("say who it is for: --to pm,ux (a reply defaults to the asker), "
                      "or --untagged for a record or a confirmation that wakes nobody")
    unknown = [t for t in to if t not in R.ROLES and t != "dev"]
    if unknown:
        raise Refused(f"no role {', '.join(unknown)}")
    posted = post(c, story, to, a.text, parent)
    if a.reply_to:
        store.mark_handled(c.db, c.role, [a.reply_to])
    c.refresh(story["id"])
    return f"posted #{posted['id']} on sc-{story['id']}"


def note(c, a):
    story_id = story_number(a.story)
    store.add_note(c.db, c.role, story_id, a.text)
    return f"noted on sc-{story_id}, for your next run"


# Moving and labelling


def move(c, a):
    guard(c, "move")
    story = c.story(a.story)
    state = set_state(c, story, a.state)
    c.refresh(story["id"])
    return f"sc-{story['id']} is now {state}"


def label(c, a):
    guard(c, "label")
    story_id = story_number(a.story)
    labels = set_labels(c, story_id, a.add or (), a.remove or ())
    c.refresh(story_id)
    return f"sc-{story_id} labels: {', '.join(labels) or 'none'}"


STALE_CLAIM_HOURS = 3


def claim(c, a):
    guard(c, "claim")
    story = c.story(a.story)
    if c.role in R.DEVS:
        if story["state"] not in ("To Do", "Failed QA", "In Progress") \
                or not R.ROLES[c.role]["filter"](set(story["labels"]), story["state"]):
            raise Refused(f"sc-{story['id']} is {story['state']} "
                          f"({', '.join(story['labels']) or 'no labels'}), not in your queue")
        holder = store.take_story(c.db, story, c.role)
        if holder != c.role:
            raise Refused(f"{holder} claimed sc-{story['id']} first: pick another")
        set_labels(c, story["id"], add=R.OWN_LABELS[c.role])
        set_state(c, story, "In Progress")
    else:
        takeover = ""
        if story["state"] == "In QA":
            last = next((x for x in reversed(story["comments"])
                         if x["text"].startswith("QA claim:")), None)
            age = time.time() - datetime.datetime.fromisoformat(
                last["at"].replace("Z", "+00:00")).timestamp() if last else float("inf")
            if age < STALE_CLAIM_HOURS * 3600:
                raise Refused(f"sc-{story['id']} is In QA under \"{last['text']}\"; "
                              f"a claim goes stale after {STALE_CLAIM_HOURS} hours")
            if last:
                who = last["text"].split(":", 1)[1].split(",")[0].strip()
                takeover = f", taking over from {who}'s of {last['at'][11:16]}"
        elif story["state"] != "Ready For QA":
            raise Refused(f"sc-{story['id']} is {story['state']}, not Ready For QA")
        holder = store.take_story(c.db, story, c.role)
        if holder != c.role:
            raise Refused(f"{holder} claimed sc-{story['id']} first: pick another")
        set_state(c, story, "In QA")
        c.shortcut.comment(story["id"], f"QA claim: {c.role}{takeover}")
    c.refresh(story["id"])
    return None


def report(c, a):
    guard(c, "report")
    story = c.story(a.story)
    if story["state"] != "In QA":
        raise Refused(f"sc-{story['id']} is {story['state']}: claim it before reporting")
    if a.files:
        c.shortcut.upload(story["id"], a.files)
    posted = c.shortcut.comment(story["id"], a.text.strip())
    passed = a.result == "passed"
    set_state(c, story, "Passsed QA" if passed else "Failed QA")
    set_labels(c, story["id"], add={"qa passed" if passed else "qa failed"},
               remove={"qa failed", "needs qa"} if passed else {"qa passed"})
    c.refresh(story["id"])
    return (f"reported #{posted['id']} on sc-{story['id']}"
            f"{f' with {len(a.files)} files' if a.files else ''}; "
            f"it is now {'Passsed QA' if passed else 'Failed QA'}")


# Writing stories and epics


def edit(c, a):
    guard(c, "edit")
    if not (a.section or a.dated):
        raise Refused("say which part: --section <name> or --dated <title>")
    if a.target.startswith("epic-"):
        epic_id = int(a.target[5:])
        epic = c.shortcut.epic(epic_id)
        body = T.append_dated(epic.get("description"), a.dated, a.text) if a.dated else \
            T.replace(epic.get("description"), a.section, a.text)
        c.shortcut.update_epic(epic_id, description=body)
        return f"epic {epic_id}: {'added ' + a.dated if a.dated else 'replaced ' + a.section}"
    name = a.section or a.dated
    if c.role == "ux" and not T.is_design(name):
        raise Refused("the designer writes only the Design section")
    raw = c.shortcut.story(story_number(a.target))
    body = T.append_dated(raw.get("description"), a.dated, a.text) if a.dated else \
        T.replace(raw.get("description"), a.section, a.text)
    c.shortcut.update(raw["id"], description=body)
    c.refresh(raw["id"])
    return f"sc-{raw['id']}: {'added ' + a.dated if a.dated else 'replaced ' + a.section}"


MAX_IDEAS = 3


def new_story(c, a):
    guard(c, "new-story")
    labels = set(a.label or [])
    state = a.state or "Backlog"
    if c.role == "cd":
        labels.add("idea")
        state = "Backlog"
        ideas = [s for s in store.stories(c.db) if "idea" in s["labels"] and not s["done"]]
        if len(ideas) >= MAX_IDEAS:
            raise Refused(f"{len(ideas)} ideas are open already; at most {MAX_IDEAS}")
    if c.role in R.LINGUISTS:
        labels.add("translation")
    # A translation ticket is ready to work once filed, so a linguist files it in To Do.
    allowed = {"Backlog", "To Do"} if c.role in R.LINGUISTS else {"Backlog"}
    if state not in allowed and c.role != "pm":
        raise Refused("a new story starts in Backlog; the product manager moves it on")
    fields = {"name": a.name, "description": a.text, "story_type": a.type or "feature",
              "workflow_state_id": c.state_id(state)[0],
              "labels": [{"name": name} for name in sorted(labels)]}
    if a.epic:
        fields["epic_id"] = a.epic
    if a.estimate is not None:
        fields["estimate"] = a.estimate
    created = c.shortcut.create_story(**fields)
    c.refresh(created["id"])
    return (f"created sc-{created['id']} in {state}: {created.get('app_url')}\n"
            f"branch: {created.get('formatted_vcs_branch_name') or '-'}")


def new_epic(c, a):
    guard(c, "new-epic")
    created = c.shortcut.create_epic(name=a.name, description=a.text)
    sync.refresh_lookups(c.db, c.shortcut)
    return f"created epic {created['id']}: {created.get('app_url')}"


def task(c, a):
    guard(c, "task")
    if not (a.add or a.done or a.undo):
        raise Refused("say what: --add <text>, --done <task id> or --undo <task id>")
    story_id = story_number(a.story)
    if a.add:
        made = c.shortcut.add_task(story_id, a.add)
        out = f"task {made['id']} on sc-{story_id}"
    else:
        c.shortcut.complete_task(story_id, a.done or a.undo, complete=bool(a.done))
        out = f"task {a.done or a.undo} {'done' if a.done else 'reopened'}"
    c.refresh(story_id)
    return out


def relate(c, a):
    guard(c, "relate")
    subject, other = story_number(a.story), story_number(a.other)
    c.shortcut.relate(subject, other, a.verb)
    c.refresh(subject)
    return f"sc-{subject} {a.verb} sc-{other}"


def archive(c, a):
    guard(c, "archive")
    story_id = story_number(a.story)
    c.shortcut.update(story_id, archived=True)
    c.refresh(story_id)
    return f"archived sc-{story_id}"


# Pull requests


FINDING = re.compile(r"^##\s+(\S+?):(\d+)\s*(.*)$")


def findings(path):
    """`## path:line severity` headings, each followed by its comment."""
    found = []
    for raw in open(path).read().splitlines():
        match = FINDING.match(raw)
        if match:
            severity = match.group(3).strip().lower()
            found.append({"path": match.group(1), "line": int(match.group(2)),
                          "severity": severity, "blocking": "blocking" in severity, "body": []})
        elif found:
            found[-1]["body"].append(raw)
    for item in found:
        item["body"] = "\n".join(item["body"]).strip()
        if not item["body"]:
            raise Refused(f"the finding at {item['path']}:{item['line']} has no text")
        # The developer reads the severity first, so the comment opens with it.
        if item["severity"] and not item["body"].lower().startswith(item["severity"]):
            item["body"] = f"{item['severity']}: {item['body']}"
    return found


def review(c, a):
    guard(c, "review")
    if a.verdict not in ("pass", "back"):
        raise Refused("say the verdict: --pass or --back")
    pr = c.pr(a.pr)
    story = c.story(pr["story_id"]) if pr["story_id"] else None
    live = github.live(a.pr)
    head = live["headRefOid"]
    items = findings(a.findings) if a.findings else []
    blocking = sum(1 for item in items if item["blocking"])
    if a.verdict == "pass" and blocking:
        raise Refused(f"{blocking} findings are marked blocking: a pass has none")
    if a.verdict == "back" and not blocking:
        raise Refused("back needs at least one finding marked blocking")
    summary = a.text.strip()
    if not summary.startswith("## Review (from lead)"):
        summary = "## Review (from lead)\n\n" + summary
    last = f"Review passed at {head}. Ready to merge." if a.verdict == "pass" else \
        f"Back to In Progress: {blocking} blocking."
    owner, name = c.repository()
    posted = github.post_review(owner, name, a.pr, head, f"{summary}\n\n{last}",
                                [{"path": i["path"], "line": i["line"], "body": i["body"]}
                                 for i in items])
    url = posted.get("html_url", pr["url"])
    if story and a.verdict == "pass":
        post(c, story, ["qa"], f"PR #{a.pr} passed review at {head[:7]}: {pr['url']}\n\n"
                               f"{a.qa or 'Nothing beyond the AC to look at hard.'}")
    elif story:
        set_state(c, story, "In Progress")
        post(c, story, [R.developer_of(story["labels"])],
             f"Review of PR #{a.pr} at {head[:7]}: {blocking} blocking. {url}\n"
             "Answer each finding in its thread, fix, push, and hand it back to In Review.")
    sync.sync_github(c.db)
    if story:
        c.refresh(story["id"])
    return f"posted the review on PR #{a.pr} ({len(items)} inline, {last})"


def thread_of(pr, comment_id):
    for t in pr["threads"]:
        if any(x["id"] == comment_id for x in t["comments"]):
            return t
    raise Refused(f"no review thread on PR #{pr['number']} holds comment {comment_id}")


def pr_reply(c, a):
    guard(c, "pr-reply")
    owner, name = c.repository()
    pr = c.pr(a.pr)
    first = thread_of(pr, a.comment)["comments"][0]["id"]
    # Signed, so the queue knows whose word a thread ends on.
    github.reply(owner, name, a.pr, first, f"{a.text.rstrip()} (from {signature(c.role)})")
    sync.sync_github(c.db)
    return f"replied on PR #{a.pr}"


def resolve(c, a):
    guard(c, "resolve")
    owner, name = c.repository()
    pr = c.pr(a.pr)
    found = thread_of(pr, a.comment)
    # Resolving first: when GraphQL is spent it fails, and nothing is posted to be repeated.
    github.resolve(found["id"])
    if a.text:
        github.reply(owner, name, a.pr, found["comments"][0]["id"], a.text)
    sync.sync_github(c.db)
    return f"resolved {found['path']}:{found['line'] or '-'} on PR #{a.pr}"


def pr_create(c, a):
    guard(c, "pr-create")
    if a.draft and c.role != "ops":
        raise Refused("pull requests open ready for review, not as drafts")
    url = github.create_pr(a.head, a.title, a.text, draft=a.draft)
    sync.sync_github(c.db)
    return f"opened {url}"


def hand_to_qa(c, story, pr, merge_sha, note=""):
    set_state(c, story, "Ready For QA")
    post(c, story, ["qa"], f"PR #{pr['number']} merged as {merge_sha}. Test what landed."
                           + (f"\n\n{note.strip()}" if note else ""))
    c.refresh(story["id"])


def merge(c, a):
    guard(c, "merge")
    pr = c.pr(a.pr)
    if pr["state"] != "open":
        raise Refused(f"PR #{a.pr} is {pr['state']}")
    live = github.live(a.pr)
    head = live["headRefOid"]
    if pr["checks"] != "green":
        raise Refused(f"checks are {pr['checks']} at {head[:7]}")
    if live["mergeable"] == "CONFLICTING":
        raise Refused("it conflicts with main. Merge origin/main into the branch and push; "
                      "the push voids the pass, so the story stays In Review for the lead")
    if live["mergeable"] != "MERGEABLE":
        raise Refused(f"GitHub says {live['mergeable']}; try again in a minute")
    if c.role in R.LINGUISTS:
        mine = R.linguist_files()
        stray = [path for path, _, _ in github.files(a.pr) if path not in mine]
        if stray:
            raise Refused(f"the linguist merges only locale files; this also changes "
                          f"{', '.join(stray[:5])}")
        github.merge(a.pr, head, delete_branch=True)
        return f"merged PR #{a.pr}"
    story = c.story(pr["story_id"]) if pr["story_id"] else None
    if not story or story["state"] != "In Review":
        raise Refused(f"its story is {story['state'] if story else 'unknown'}, not In Review")
    verdict = W.latest_verdict(pr)
    carried = pr.get("carried") if head == pr["head_sha"] else None
    if not (verdict and verdict["verdict"] == "pass" and W.covers(verdict, head, carried)):
        raise Refused(f"no lead pass covers the head {head[:7]}; wait for the lead's review")
    unresolved = W.open_threads(pr)
    if unresolved:
        raise Refused(f"{len(unresolved)} review threads are open; the lead resolves them")
    github.merge(a.pr, head)
    merged = github.live(a.pr)["mergeCommit"]
    sync.sync_github(c.db)
    hand_to_qa(c, story, pr, merged, a.text)
    return f"merged PR #{a.pr} as {merged}; sc-{story['id']} is Ready For QA and QA is told"


def to_qa(c, a):
    guard(c, "to-qa")
    story = c.story(a.story)
    merged = [pr for pr in store.prs_for_story(c.db, story["id"]) if pr["state"] == "merged"]
    if not merged:
        raise Refused(f"sc-{story['id']} has no merged pull request")
    pr = merged[-1]
    verdict = W.latest_verdict(pr)
    if not (verdict and verdict["verdict"] == "pass"
            and W.covers(verdict, pr["head_sha"], pr.get("carried"))):
        raise Refused(f"PR #{pr['number']} merged at a head no lead pass covers: ask [lead]")
    hand_to_qa(c, story, pr, pr["merge_sha"], a.text)
    return f"sc-{story['id']} is Ready For QA; QA is told about {pr['merge_sha'][:7]}"


def rerun(c, a):
    guard(c, "rerun")
    if not (a.run or a.pr):
        raise Refused("say what to rerun: a pull request number, or --run <id>")
    if a.run:
        github.rerun_failed(a.run)
        return f"rerunning the failed jobs of run {a.run}"
    runs = sorted({github.JOB_LINK.search(x["link"]).group(1)
                   for x in github.pr_checks(a.pr)
                   if x.get("bucket") == "fail" and github.JOB_LINK.search(x.get("link") or "")})
    if not runs:
        raise Refused(f"no failed job on PR #{a.pr} to rerun")
    for run in runs:
        github.rerun_failed(run)
    return f"rerunning the failed jobs of runs {', '.join(runs)}"
