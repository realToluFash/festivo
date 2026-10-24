"""Every write a role makes, each checked against what that role may do before anything is
sent. A refusal says why and what to do instead."""

import datetime
import re
import socket
import time

from . import github, store, sync
from . import roles as R
from . import text as T
from . import work as W
from .shortcut import Shortcut, ShortcutError


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


def void_passes(c):
    """A push after the pass, such as main merged in to fix a conflict, sends the story back
    to In Review, so the board never shows a pass the head no longer has. No role makes the
    move, so it wakes the lead like any other."""
    moved = []
    for story, pr in W.voided_passes(store.stories(c.db), store.prs(c.db)):
        story = c.story(story["id"])
        if story["state"] != "Passed Code Review":
            continue
        state_id, state = c.state_id("In Review")
        c.shortcut.update(story["id"], workflow_state_id=state_id)
        c.shortcut.comment(story["id"], f"PR #{pr['number']} moved on to "
                                        f"{pr['head_sha'][:7]} after its pass: back to {state} "
                                        "for the lead.")
        c.story(story["id"])
        moved.append(story["id"])
    return moved


def story_number(ref):
    match = re.fullmatch(r"(?:sc-)?(\d+)", str(ref).strip())
    if not match:
        raise Refused(f"{ref} is not a story: write sc-<n>")
    return int(match.group(1))


def signature(role):
    return role


def resync(c):
    """The write is done by now, so a failed refresh must not read as a failed write: it
    is reported after what was done, and the next tick's sync catches up."""
    try:
        sync.sync_github(c.db)
    except github.GitHubError as error:
        return f" (done; the refresh after it failed: {error})"
    return ""


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
    unknown = [t for t in to if t not in R.ROLES and t != "dev" and t not in R.LOCALES]
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


def to_draw(c, a):
    """An unattended run has no Artifact tool, so it lists the screens it cannot draw for
    the owner, who pastes the prompt into a `/soirely-designer` session."""
    guard(c, "to-draw")
    story = c.story(a.story, fresh=False)
    prompt = a.text.strip()
    if not prompt.startswith("/soirely-designer"):
        prompt = f"/soirely-designer Draw sc-{story['id']} ({story['name']}). {prompt}"
    store.add_drawing(c.db, story["id"], story["name"], prompt)
    return f"sc-{story['id']} is on the owner's list to draw (sq web)"


def drawn(c, a):
    guard(c, "drawn")
    story_id = story_number(a.story)
    if not store.drop_drawing(c.db, story_id):
        return f"sc-{story_id} was not on the list to draw"
    return f"sc-{story_id} is off the list to draw"


# Moving and labelling


def holder(c, story):
    """Who is working on an In Progress story, or None. A pull request that only mentions a
    story moves it through Shortcut's GitHub link, and nobody holds it then."""
    moved_by = store.moves(c.db).get((story["id"], story["state"], story["moved_at"]))
    if moved_by:
        return f"{moved_by} moved it there"
    labelled = sorted(set(story["labels"]) & set(R.DEVELOPERS.values()))
    if labelled:
        return f"it carries {', '.join(labelled)}"
    try:
        sync.sync_github(c.db)
    except github.GitHubError as error:
        return f"its open pull requests could not be read ({error})"
    branch = re.compile(rf"(?<!\d)sc-{story['id']}(?!\d)")
    open_prs = [pr for pr in store.prs(c.db)
                if pr["state"] == "open" and branch.search(pr.get("branch") or "")]
    if open_prs:
        return f"PR #{open_prs[0]['number']} is open on its branch"
    return None


def ops_only(c, story):
    if c.role == "ops" and R.OPS_LABEL not in story["labels"]:
        raise Refused(f"ops moves only its own stories, labelled {R.OPS_LABEL}; "
                      f"sc-{story['id']} is not")


def move(c, a):
    guard(c, "move")
    story = c.story(a.story)
    ops_only(c, story)
    state = set_state(c, story, a.state, check=c.role != "pm")
    c.refresh(story["id"])
    return f"sc-{story['id']} is now {state}"


OPS_TAKES = ("Backlog", "Ready For Dev", "In Progress")


def take_over(c, story):
    """Only a story nobody is building, so no product story reaches Done unseen."""
    if R.OPS_LABEL in story["labels"]:
        return
    if story["state"] not in OPS_TAKES:
        raise Refused(f"sc-{story['id']} is {story['state']}; ops takes over only a story in "
                      f"{', '.join(OPS_TAKES)}")
    taken = {*R.DEVELOPERS.values(), "translation"} & set(story["labels"])
    if taken:
        raise Refused(f"sc-{story['id']} is labelled {', '.join(sorted(taken))}, so it is "
                      "another role's to build")
    held = story["state"] == "In Progress" and holder(c, story)
    if held:
        raise Refused(f"sc-{story['id']} is In Progress and held: {held}")


def label(c, a):
    guard(c, "label")
    story_id = story_number(a.story)
    taking = c.role == "ops" and R.OPS_LABEL in (a.add or ())
    if c.role == "ops":
        story = c.story(story_id)
        if taking:
            take_over(c, story)
        if set(a.add or ()) - {R.OPS_LABEL} or a.remove:
            ops_only(c, story)
    labels = set_labels(c, story_id, a.add or (), a.remove or ())
    if taking and R.OPS_LABEL not in story["labels"]:
        post(c, story, ["pm"], f"sc-{story_id} is now ops' to build, labelled "
             f"{R.OPS_LABEL}, and has left your queue. A merged ops story goes to Done "
             "without QA unless it carries needs qa.", None)
    c.refresh(story_id)
    return f"sc-{story_id} labels: {', '.join(labels) or 'none'}"


STALE_CLAIM_HOURS = 3


def claim(c, a):
    guard(c, "claim")
    story = c.story(a.story)
    if c.role in R.DEVS:
        if story["state"] not in R.BUILD_QUEUE \
                or not R.ROLES[c.role]["filter"](set(story["labels"]), story["state"]):
            raise Refused(f"sc-{story['id']} is {story['state']} "
                          f"({', '.join(story['labels']) or 'no labels'}), not in your queue")
        held = W.held_epic(story, store.get_meta(c.db, "epics"))
        if held:
            raise Refused(f"sc-{story['id']} is in epic {held['name']}, which is "
                          f"{held.get('state_name') or held.get('state')}: its stories wait "
                          "until the owner moves it to In Progress")
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
        else:
            first = W.retester(story)
            if first and first != c.role:
                raise Refused(f"sc-{story['id']} came back after {first} failed it, and is "
                              f"{first}'s to retest for {R.RETEST_MINUTES} minutes: pick another")
        holder = store.take_story(c.db, story, c.role)
        if holder != c.role:
            raise Refused(f"{holder} claimed sc-{story['id']} first: pick another")
        set_state(c, story, "In QA")
        set_labels(c, story["id"], add={R.TESTERS_LABELS[c.role]})
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


def description_of(c, target):
    if target.startswith("epic-"):
        epic_id = int(target[5:])
        return lambda: c.shortcut.epic(epic_id), lambda body: c.shortcut.update_epic(
            epic_id, description=body)
    story_id = story_number(target)

    def save(body):
        c.shortcut.update(story_id, description=body)
        c.refresh(story_id)
    return lambda: c.shortcut.story(story_id), save


def rewrite(c, target, change, attempts=3):
    """Saves change(description) only if the story still reads as the version it was worked
    out from. Shortcut's PUT takes no precondition, so a save landing between that last
    read and this one is still written over: this narrows the window, it does not close it."""
    read, save = description_of(c, target)
    raw = read()
    seen, body = raw.get("updated_at"), raw.get("description") or ""
    for _ in range(attempts):
        changed = change(body)
        latest = read()
        if latest.get("updated_at") == seen:
            save(changed)
            return
        seen, body = latest.get("updated_at"), latest.get("description") or ""
    raise Refused(f"{target} kept changing while this edit was saving; nothing saved, "
                  f"run it again")


def edit_line(c, a):
    """One exact occurrence of --replace becomes --with, on every target or on none."""
    if c.role == "ux":
        raise Refused("the designer writes only the Design section: use --section Design")
    if a.section or a.dated:
        raise Refused("--replace edits text wherever it is: drop --section and --dated")
    if a.with_ is None:
        raise Refused("say what replaces it: --with \"<new>\" (an empty one deletes it)")
    if not a.replace:
        raise Refused("--replace needs the text to find")

    def problem(target, body):
        count = body.count(a.replace)
        return None if count == 1 else (f"{target} has it {count} times" if count
                                         else f"{target} does not have it")
    problems = [p for target in a.targets
                if (p := problem(target, description_of(c, target)[0]().get("description")
                                 or ""))]
    if problems:
        raise Refused(f"{'; '.join(problems)}; nothing changed")
    if a.dry:
        return "would change " + ", ".join(a.targets)

    def change(target):
        def apply(body):
            if found := problem(target, body):
                raise Refused(f"{found} any more")
            return body.replace(a.replace, a.with_)
        return apply
    saved = []
    for target in a.targets:
        try:
            rewrite(c, target, change(target))
        except (ShortcutError, Refused) as error:
            rest = a.targets[len(saved) + 1:]
            raise Refused(f"changed {', '.join(saved) or 'nothing'}; {target} failed: {error}"
                          + (f"; not tried: {', '.join(rest)}" if rest else "")) from error
        saved.append(target)
    return "changed " + ", ".join(saved)


def edit(c, a):
    guard(c, "edit")
    if a.replace is not None:
        return edit_line(c, a)
    if a.with_ is not None or a.dry:
        raise Refused("--with and --dry go with --replace")
    if len(a.targets) > 1:
        raise Refused("--section and --dated edit one story: name one, "
                      "or use --replace for several")
    a.target = a.targets[0]
    if not (a.section or a.dated):
        raise Refused("say which part: --section <name> or --dated <title>, "
                      "or --replace <old> --with <new>")
    name = a.section or a.dated
    if c.role == "ux" and not a.target.startswith("epic-") and not T.is_design(name):
        raise Refused("the designer writes only the Design section")
    if headed := [h for h, _, _ in T.sections(a.text) if h != T.TOP]:
        raise Refused(f"the text brings its own heading ({headed[0]}), which would add a "
                      f"section beside the one already there: edit that one with "
                      f"--section \"{headed[0]}\", one section per edit")
    target = a.target if a.target.startswith("epic-") else f"sc-{story_number(a.target)}"
    rewrite(c, target, lambda body: T.append_dated(body, a.dated, a.text) if a.dated
            else T.replace(body, a.section, a.text))
    what = "added " + a.dated if a.dated else "replaced " + a.section
    return f"epic {a.target[5:]}: {what}" if a.target.startswith("epic-") else \
        f"{target}: {what}"


MAX_IDEAS = 3


def new_story(c, a):
    guard(c, "new-story")
    if not a.epic:
        raise Refused(f"a new story belongs to an epic: pick one from `sq {c.role} epics`, or "
                      f"make one with `sq {c.role} new-epic` if none suits it, and pass --epic N")
    epic = (store.get_meta(c.db, "epics") or {}).get(str(a.epic))
    if not epic or epic.get("state") == "done":
        raise Refused(f"epic {a.epic} is {'done' if epic else 'not an open epic'}: pick one "
                      f"from `sq {c.role} epics`, or make one with `sq {c.role} new-epic`")
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
    if c.role == "ops":
        labels.add(R.OPS_LABEL)
    # A translation ticket is ready to work once filed, so a linguist files it in To Do.
    # Ops files infra work as it starts it, or for later.
    allowed = {"Backlog", "To Do"} if c.role in R.LINGUISTS else \
        {"Backlog", "In Progress"} if c.role == "ops" else {"Backlog"}
    if state not in allowed and c.role != "pm":
        raise Refused("a new story starts in Backlog; the product manager moves it on")
    fields = {"name": a.name, "description": a.text, "story_type": a.type or "feature",
              "workflow_state_id": c.state_id(state)[0],
              "labels": [{"name": name} for name in sorted(labels)], "epic_id": a.epic}
    if a.estimate is not None:
        fields["estimate"] = a.estimate
    created = c.shortcut.create_story(**fields)
    c.refresh(created["id"])
    return (f"created sc-{created['id']} in {state}: {created.get('app_url')}\n"
            f"branch: {created.get('formatted_vcs_branch_name') or '-'}")


APPROVAL = "Waiting for Owner Approval"


def new_epic(c, a):
    """An epic a role creates waits for the owner's approval: none of its stories is built
    until the owner moves it to In Progress."""
    guard(c, "new-epic")
    waiting = next((s["id"] for s in c.shortcut.epic_states()
                    if s["name"].lower() == APPROVAL.lower()), None)
    if waiting is None:
        raise Refused(f"Shortcut's epic workflow has no {APPROVAL} state; ask the owner")
    created = c.shortcut.create_epic(name=a.name, description=a.text, epic_state_id=waiting)
    sync.refresh_lookups(c.db, c.shortcut)
    return (f"created epic {created['id']} in {APPROVAL}: {created.get('app_url')}; its "
            "stories are built once the owner moves it to In Progress")


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
    pairs = {(subject, other)} if a.verb != "relates to" else {(subject, other),
                                                                (other, subject)}
    links = c.shortcut.story(subject).get("story_links", [])
    if any(link.get("verb") == a.verb and (link.get("subject_id"), link.get("object_id"))
           in pairs for link in links):
        return f"already linked: sc-{subject} {a.verb} sc-{other}"
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
    last = github.PASS_LINE.format(sha=head) if a.verdict == "pass" else \
        github.BACK_LINE.format(blocking=blocking)
    owner, name = c.repository()
    posted = github.post_review(owner, name, a.pr, head, f"{summary}\n\n{last}",
                                [{"path": i["path"], "line": i["line"], "body": i["body"]}
                                 for i in items])
    url = posted.get("html_url", pr["url"])
    # Only a story in review moves: a linguist's ticket, say, keeps its own state.
    if story and story["state"] in W.REVIEWED and not W.side_pr(story, pr):
        set_state(c, story, "Passed Code Review" if a.verdict == "pass" else "Failed Code Review")
    if story and a.verdict == "pass":
        # A developer's change on a linguist's ticket is not the ticket ready for QA.
        if not W.side_pr(story, pr):
            post(c, story, ["qa"], f"PR #{a.pr} passed review at {head[:7]}: {pr['url']}\n\n"
                                   f"{a.qa or 'Nothing beyond the AC to look at hard.'}")
    elif story:
        post(c, story, [R.developer_of(story["labels"])],
             f"Review of PR #{a.pr} at {head[:7]}: {blocking} blocking. {url}\n"
             "Answer each finding in its thread, fix, push, and hand it back to In Review.")
    stale = resync(c)
    if story:
        c.refresh(story["id"])
    return f"posted the review on PR #{a.pr} ({len(items)} inline, {last}){stale}"


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
    return f"replied on PR #{a.pr}{resync(c)}"


def resolve(c, a):
    guard(c, "resolve")
    owner, name = c.repository()
    pr = c.pr(a.pr)
    found = thread_of(pr, a.comment)
    # Resolving first: when GraphQL is spent it fails, and nothing is posted to be repeated.
    github.resolve(found["id"])
    if a.text:
        github.reply(owner, name, a.pr, found["comments"][0]["id"], a.text)
    return f"resolved {found['path']}:{found['line'] or '-'} on PR #{a.pr}{resync(c)}"


def pr_create(c, a):
    guard(c, "pr-create")
    if a.draft:
        raise Refused("pull requests open ready for review, not as drafts, so the lead is "
                      "woken for them")
    url = github.create_pr(a.head, a.title, a.text, draft=a.draft)
    return f"opened {url}{resync(c)}"


def needs_qa(story):
    """An ops story goes to QA only when labelled `needs qa`; every other story always does."""
    return R.OPS_LABEL not in story["labels"] or "needs qa" in story["labels"]


def hand_to_qa(c, story, pr, merge_sha, note=""):
    """Returns where the story went."""
    others = [p["number"] for p in store.prs_for_story(c.db, story["id"])
              if p["state"] == "open" and p["number"] != pr["number"]]
    if others:
        # The story is done when its last pull request is.
        c.refresh(story["id"])
        return f"{story['state']}, waiting on #{', #'.join(map(str, others))}"
    if not needs_qa(story):
        set_state(c, story, "Done", check=False)
        post(c, story, [], f"PR #{pr['number']} merged as {merge_sha}. Infra with no QA "
                           "needed, so ops moved it to Done."
                           + (f"\n\n{note.strip()}" if note else ""))
        c.refresh(story["id"])
        return "Done"
    set_state(c, story, "Ready For QA", check=c.role != "ops")
    post(c, story, ["qa"], f"PR #{pr['number']} merged as {merge_sha}. Test what landed."
                           + (f"\n\n{note.strip()}" if note else ""))
    c.refresh(story["id"])
    return "Ready For QA"


def finish_handover(c, story, pr, note):
    verdict = W.latest_verdict(pr)
    if not (verdict and verdict["verdict"] == "pass"
            and W.covers(verdict, pr["head_sha"], pr.get("carried"))):
        raise Refused(f"PR #{pr['number']} merged at a head no lead pass covers: ask [lead]")
    went = hand_to_qa(c, story, pr, pr["merge_sha"], note)
    return f"sc-{story['id']} is {went} after {pr['merge_sha'][:7]}"


PERMISSIONS_STORY = 4992
ASK_PARTS = ("Machine", "Rule", "For", "Without it")


def this_machine():
    from . import machine
    try:
        return machine.load().get("machine") or socket.gethostname()
    except machine.ConfigError:
        return socket.gethostname()


def permission_ask(c, a):
    """An ask on the standing story, in the format the owner answers. The answer is a
    record; only the owner, merging permissions.json and applying it, grants anything."""
    guard(c, "permission-ask")
    rule = a.rule.strip()
    from .permissions import RULE
    if not RULE.match(rule):
        raise Refused(f"{rule!r} is not a permission rule such as Bash(xcrun simctl boot:*)")
    story = c.story(PERMISSIONS_STORY)
    for thread in W.threads(story):
        if re.search(rf"^Rule: {re.escape(rule)}$", thread[0]["text"], re.M):
            answer = next((x["text"] for x in thread[1:] if not R.author(x["text"])), None)
            raise Refused(f"{rule} was asked in #{thread[0]['id']} on sc-{PERMISSIONS_STORY}"
                          + (f"; the owner answered: {answer.strip()[:200]}" if answer
                             else "; it is waiting on the owner. Note it on your story and "
                             "move on"))
    text = "\n".join([f"Permission ask (from {signature(c.role)})",
                      f"Machine: {this_machine()}", f"Rule: {rule}", f"For: {a.for_.strip()}",
                      f"Without it: {a.without.strip()}"])
    posted = c.shortcut.comment(PERMISSIONS_STORY, text, None)
    c.refresh(PERMISSIONS_STORY)
    return (f"asked in #{posted['id']} on sc-{PERMISSIONS_STORY}. Don't wait: note it on your story, finish what you can "
            "without it, and say so in your report")


def merge(c, a):
    guard(c, "merge")
    pr = c.pr(a.pr)
    if pr["state"] == "merged" and pr["story_id"] and c.role not in R.LINGUISTS:
        story = c.story(pr["story_id"])
        if story["state"] in R.MERGING and not W.linguists(story):
            return f"PR #{a.pr} was already merged; " + finish_handover(c, story, pr, a.text)
    if pr["state"] != "open":
        raise Refused(f"PR #{a.pr} is {pr['state']}")
    live = github.live(a.pr)
    head = live["headRefOid"]
    if pr["checks"] != "green":
        raise Refused(f"checks are {pr['checks']} at {head[:7]}")
    if live["mergeable"] == "CONFLICTING":
        raise Refused("it conflicts with main. Merge origin/main into the branch and push; "
                      "the push voids the pass, and the lead reviews the new head")
    if live["mergeable"] != "MERGEABLE":
        raise Refused(f"GitHub says {live['mergeable']}; try again in a minute")
    if any(path == "tools/queue/permissions.json" for path, _, _ in github.files(a.pr)):
        raise Refused("it changes tools/queue/permissions.json, which grants the workers "
                      "commands: only the owner merges it, even after the lead's pass")
    if c.role in R.LINGUISTS:
        mine = R.linguist_files()
        stray = [path for path, _, _ in github.files(a.pr) if path not in mine]
        if stray:
            raise Refused(f"the linguist merges only locale files; this also changes "
                          f"{', '.join(stray[:5])}")
        github.merge(a.pr, head, delete_branch=True)
        return f"merged PR #{a.pr}"
    story = c.story(pr["story_id"]) if pr["story_id"] else None
    side = bool(story) and W.side_pr(story, pr)
    follow_up = bool(story) and not side and story["state"] in R.FOLLOWING_UP
    if not story or story["state"] not in R.MERGING and not side and not follow_up:
        raise Refused(f"its story is {story['state'] if story else 'unknown'}, not "
                      "Passed Code Review")
    if R.builder_of(story["labels"]) != c.role and not (
            c.role in R.DEVS and R.builder_of(story["labels"]) in R.DEVS):
        raise Refused(f"sc-{story['id']} is {R.builder_of(story['labels'])}'s to merge")
    verdict = W.latest_verdict(pr)
    carried = pr.get("carried") if head == pr["head_sha"] else None
    if not (verdict and verdict["verdict"] == "pass" and W.covers(verdict, head, carried)):
        raise Refused(f"no lead pass covers the head {head[:7]}; wait for the lead's review")
    unresolved = W.open_threads(pr)
    if unresolved:
        raise Refused(f"{len(unresolved)} review threads are open; the lead resolves them")
    if live.get("draft"):
        github.ready(a.pr)
    github.merge(a.pr, head)
    merged = github.live(a.pr)["mergeCommit"]
    if side:
        return (f"merged PR #{a.pr} as {merged}; sc-{story['id']} stays {story['state']}, "
                f"the linguist's to move, and the linguist is woken{resync(c)}")
    if follow_up:
        return f"merged PR #{a.pr} as {merged}; sc-{story['id']} stays {story['state']}{resync(c)}"
    try:
        went = hand_to_qa(c, story, pr, merged, a.text)
    except ShortcutError as error:
        raise Refused(f"merged PR #{a.pr} as {merged}, but the handover failed "
                      f"({error}); run `sq {c.role} to-qa sc-{story['id']}` to finish it"
                      f"{resync(c)}") from error
    told = "; QA is told" if went == "Ready For QA" else ""
    return f"merged PR #{a.pr} as {merged}; sc-{story['id']} is {went}{told}{resync(c)}"


def owns(c, story_id, refusal):
    """The story's builder, or the developers on each other's, or ops on any."""
    story = c.story(story_id) if story_id else None
    builder = (None if not story else "l10n" if W.linguists(story)
               else R.builder_of(story["labels"]))
    if c.role != "ops" and builder != c.role and not (
            c.role in R.DEVS and builder in R.DEVS):
        raise Refused(refusal.format(builder or "nobody"))


def pr_close(c, a):
    """Closes unmerged. The story's builder closes its own; ops, which keeps the queue, any."""
    guard(c, "pr-close")
    if not (a.text or "").strip():
        raise Refused("say why it closes unmerged: --text")
    pr = c.pr(a.pr)
    if pr["state"] != "open":
        raise Refused(f"PR #{a.pr} is {pr['state']}")
    owns(c, pr["story_id"], f"PR #{a.pr} is {{}}'s to close; ask [ops]")
    github.close(a.pr, f"{a.text.rstrip()} (from {signature(c.role)})")
    return f"closed PR #{a.pr} unmerged{resync(c)}"


def pr_edit(c, a):
    """One section of the body, read from GitHub now; a merged body is the record, so it is
    corrected too. The pull request is all that changes: no commit, no story, no wake."""
    guard(c, "pr-edit")
    if not (a.text or "").strip():
        raise Refused("the new text is empty; a section that does not apply says `None.`")
    if headed := [h for h, _, _ in T.sections(a.text) if h != T.TOP]:
        raise Refused(f"the text brings its own heading ({headed[0]}); send only the "
                      "section's text")
    live = github.live(a.pr)
    if live["state"] == "CLOSED":
        raise Refused(f"PR #{a.pr} is closed unmerged")
    owns(c, live["story_id"], f"PR #{a.pr} is {{}}'s to edit; ask [ops]")
    found = [h for h in T.matching(live["body"], a.section) if h != T.TOP]
    if len(found) != 1:
        headings = "; ".join(h for h, _, _ in T.sections(live["body"]) if h != T.TOP)
        raise Refused(f"{'no heading matches' if not found else f'{len(found)} headings match'} "
                      f"{a.section}; the body has: {headings or 'no headings'}")
    body = T.swap(live["body"], found[0], a.text)
    github.edit_body(a.pr, body)
    if known := store.pr(c.db, a.pr):
        store.put_pr(c.db, dict(known, body=body))
    return f"PR #{a.pr}: replaced {found[0]}"


def to_qa(c, a):
    guard(c, "to-qa")
    story = c.story(a.story)
    merged = [pr for pr in store.prs_for_story(c.db, story["id"]) if pr["state"] == "merged"]
    if not merged:
        raise Refused(f"sc-{story['id']} has no merged pull request")
    return finish_handover(c, story, merged[-1], a.text)


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
