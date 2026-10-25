"""Turns what the sync stored into the work each role has waiting. No network here."""

import re
import time

from . import roles as R
from . import text as T

FINISHING, INBOX, PULL_REQUEST, REVIEW, QUEUE, SWEEP = 5, 10, 20, 30, 40, 90
DAY = 24 * 60 * 60
# A story one step from Ready For QA, or sent back, goes ahead of everything else its role
# has waiting, its comments included; so does a pull request waiting on the lead's review,
# one passed and waiting to merge, and one that conflicts with main.
FINISHING_STATES = ("Passed Code Review", "Failed QA", "Failed Code Review")
FINISHING_KINDS = ("to-qa", "review", "threads", "merge", "conflict")


def threads(story):
    """Each top-level comment with its replies, oldest first."""
    comments = sorted(story["comments"], key=lambda c: (c["at"] or "", c["id"]))
    roots = {c["id"]: [c] for c in comments if not c["parent"]}
    for comment in comments:
        if comment["parent"]:
            roots.setdefault(comment["parent"], []).append(comment)
    return list(roots.values())


def open_for(role, story, handled=frozenset()):
    """Comments addressed to the role, with no later reply from it in their thread, that no
    finished run has already dealt with."""
    found = []
    for thread in threads(story):
        for index, comment in enumerate(thread):
            if role not in R.addressees(comment["text"], story["labels"]):
                continue
            if R.author(comment["text"]) == role:
                continue
            if any(R.author(later["text"]) == role for later in thread[index + 1:]):
                continue
            if (role, comment["id"]) in handled:
                continue
            found.append(comment)
    return found


def involves(role, thread, labels):
    return any(role in R.addressees(c["text"], labels) or R.author(c["text"]) == role
               for c in thread)


def latest_verdict(pr):
    return max(pr["lead"], key=lambda v: v["at"]) if pr["lead"] else None


def covers(verdict, sha, carried=None):
    if not (verdict and verdict["sha"]):
        return False
    return sha.startswith(verdict["sha"]) or carried == verdict["sha"]


def carried(pr, cache, same_change, before=None):
    """The passed sha whose change the head still makes, as after merging main in. `cache`
    holds each answer by sha pair, since a pair's answer never changes. A merged head is part
    of main, so nothing can compare it: it keeps the carry `before`, last sync's record, made."""
    verdict = latest_verdict(pr)
    if not verdict or verdict["verdict"] != "pass" or not verdict["sha"] \
            or covers(verdict, pr["head_sha"]):
        return None
    if pr["state"] != "open":
        before = before or {}
        kept = before.get("carried") if before.get("head_sha") == pr["head_sha"] else None
        return kept if kept == verdict["sha"] else None
    key = f"{verdict['sha']}..{pr['head_sha']}"
    if key not in cache:
        cache[key] = same_change(verdict["sha"], pr["head_sha"])
    return verdict["sha"] if cache[key] else None


def open_threads(pr):
    return [t for t in pr["threads"] if not t["resolved"]]


SIGNED = re.compile(r"\(from ([a-z0-9]+)\)")


def answered_threads(pr):
    """Open threads with a reply whose last word is not the lead's, so the lead has a reply
    to check and a thread to resolve or answer. Whoever opened it: a thread QA or the owner
    started, once answered, holds the merge as surely as a finding does."""
    found = []
    for t in open_threads(pr):
        first, last = (t["comments"][0], t["comments"][-1]) if t["comments"] else (None, None)
        if not first or last is first:
            continue
        signed = SIGNED.findall(last["text"])
        if signed and signed[-1] == "lead":
            continue
        found.append(t)
    return found


def unanswered_by(role, pr):
    """Open threads whose last word is not the role's own, so the role has a reply to give."""
    found = []
    for t in open_threads(pr):
        if not t["comments"]:
            continue
        signed = SIGNED.findall(t["comments"][-1]["text"])
        if signed and signed[-1] == role:
            continue
        found.append(t)
    return found


def _item(fingerprint, pool, roles, kind, reason, priority, story=None, pr=None, comments=None,
          rank=0):
    return {"fingerprint": fingerprint, "pool": pool, "roles": roles, "kind": kind,
            "reason": reason, "priority": priority, "rank": rank, "comments": comments,
            "story_id": story["id"] if story else None, "pr": pr["number"] if pr else None}


def finished(story):
    """Done but not archived: its comments and follow-up pull requests still wake roles, and
    it stays Done."""
    return bool(story.get("done")) and not story.get("archived")


def inbox_items(stories, handled=frozenset()):
    """A comment on a Done story wakes as on any other, if it came after the story was done:
    what was left open before then was settled by finishing it."""
    items = []
    for story in stories:
        if story.get("archived"):
            continue
        for role in R.ROLES:
            waiting = open_for(role, story, handled)
            if finished(story):
                waiting = [c for c in waiting if (c["at"] or "") > (story["moved_at"] or "")]
            if waiting:
                ids = ", ".join(f"#{c['id']}" for c in waiting)
                items.append(_item(f"{role}:inbox:sc-{story['id']}:{waiting[-1]['id']}", role,
                                   [role], "inbox", f"comments for you on sc-{story['id']}: {ids}",
                                   INBOX, story, comments=[c["id"] for c in waiting]))
    return items


def held_epic(story, epics):
    """The epic holding back a Ready For Dev story, or None. Only an epic in progress offers
    its stories to build; To Do and Waiting for Owner Approval hold them until it is."""
    epic = (epics or {}).get(str(story.get("epic_id")))
    if story["state"] != "Ready For Dev" or not epic or epic.get("state") == "in progress":
        return None
    return epic


def queued(role, stories, epics=None):
    config = R.ROLES[role]
    return [story for story in stories
            if not story["done"] and story["state"] in config["queue"]
            and config["filter"](set(story["labels"]), story["state"])
            and not held_epic(story, epics)]


def retester(story, now=None):
    """The tester a failed story is waiting for, while its retest window is open."""
    moved = T.epoch(story.get("moved_at"))
    if "qa failed" not in story["labels"] or moved is None:
        return None
    age = (now or time.time()) - moved
    return R.last_tester(story) if age < R.RETEST_MINUTES * 60 else None


def epic_order(epics):
    """A story's place in the build order: its epic's place in Shortcut's epic list, then its
    own place in the story list. A story in no epic comes after every epic's."""
    epics = epics or {}

    def key(story):
        epic = epics.get(str(story.get("epic_id"))) or {}
        place = epic.get("position") or story.get("epic_id")
        return (place is None, place or 0, story.get("position") or 0)
    return key


def queue_items(stories, moves=None, now=None, epics=None):
    """A story entering a role's queue is work once, unless the role moved it there itself.
    One sitting there waits for a pick. A failed story back in Ready For QA is offered only
    to the tester who failed it, until its retest window closes."""
    moves = moves or {}
    merged = {}
    build_order = {s["id"]: i for i, s in enumerate(sorted(stories, key=epic_order(epics)))}
    for role, config in R.ROLES.items():
        for story in queued(role, stories, epics):
            if moves.get((story["id"], story["state"], story["moved_at"])) == role:
                continue
            pool = R.pool(role, story["state"], story["labels"])
            fingerprint = f"{pool}:story:sc-{story['id']}:{story['state']}:{story['moved_at']}"
            if role in R.TESTERS and story["state"] == "Ready For QA":
                first = retester(story, now)
                if first and first != role:
                    continue
                if first:
                    fingerprint += f":retest:{first}"
            if fingerprint in merged:
                merged[fingerprint]["roles"].append(role)
                continue
            merged[fingerprint] = _item(
                fingerprint, pool, [role], "story", f"sc-{story['id']} moved to {story['state']}",
                QUEUE + config["queue"].index(story["state"]), story,
                rank=build_order[story["id"]] if story["state"] in R.EPIC_ORDERED else 0)
    return list(merged.values())


def held_items(stories):
    """A story left In QA under a tester's claim is that tester's before anything new in Ready
    For QA, to test or to give back with `unclaim`, so no tester strands one and moves on."""
    items = []
    for story in stories:
        if story["done"] or story["state"] != "In QA":
            continue
        tester = R.last_tester(story)
        if tester:
            items.append(_item(f"{tester}:held:sc-{story['id']}:{story['moved_at']}", tester,
                               [tester], "held",
                               f"sc-{story['id']} is In QA under your claim with no report",
                               QUEUE - 1, story))
    return items


# A push after the pass leaves the story in Passed Code Review, but the pass no longer
# covers its head, so the lead looks again.
REVIEWED = ("In Review", "Passed Code Review")


def review_items(stories, prs):
    by_story = {}
    for pr in prs:
        if pr["state"] == "open" and not pr["draft"] and pr["story_id"]:
            by_story.setdefault(pr["story_id"], []).append(pr)
    items = []
    for story in stories:
        if story.get("archived"):
            continue
        open_prs = by_story.get(story["id"], [])
        if story["state"] not in REVIEWED:
            open_prs = [pr for pr in open_prs if side_pr(story, pr) or finished(story)]
            if not open_prs:
                continue
        merged = any(pr["story_id"] == story["id"] and pr["state"] == "merged" for pr in prs)
        if not open_prs and not merged and story["state"] == "In Review":
            items.append(_item(f"lead:review:sc-{story['id']}:none:{story['moved_at']}", "lead",
                               ["lead"], "review",
                               f"sc-{story['id']} is In Review with no open pull request",
                               REVIEW, story))
        for pr in open_prs:
            # On a Done story the lead cannot send red checks back; the builder is woken.
            if pr["checks"] == "pending" or pr["checks"] == "red" and finished(story):
                continue
            verdict = latest_verdict(pr)
            sha = pr["head_sha"]
            returned = verdict and verdict["verdict"] == "back" and not story["done"] \
                and (story["moved_at"] or "") > verdict["at"]
            if covers(verdict, sha, pr.get("carried")) and not returned:
                continue
            if verdict and verdict["verdict"] == "pass":
                why = f"pushed after the pass at {verdict['sha'][:7]}"
            elif verdict:
                why = "back in review after the last findings"
            else:
                why = "not reviewed yet"
            items.append(_item(f"lead:review:#{pr['number']}@{sha[:7]}:{story['moved_at']}",
                               "lead", ["lead"], "review",
                               f"review sc-{story['id']}, PR #{pr['number']} at {sha[:7]}: {why}"
                               f"{', checks red' if pr['checks'] == 'red' else ''}",
                               REVIEW, story, pr))
    # A review item already shows every open thread; otherwise a reply in an open thread
    # is work of its own, whatever state the story is in.
    reviewing = {item["pr"] for item in items}
    by_id = {story["id"]: story for story in stories}
    for pr in prs:
        story = by_id.get(pr["story_id"])
        if pr["state"] != "open" or pr["number"] in reviewing or not story \
                or story.get("archived"):
            continue
        answered = answered_threads(pr)
        if answered:
            last = max(t["comments"][-1]["id"] for t in answered)
            items.append(_item(f"lead:threads:#{pr['number']}@{last}", "lead", ["lead"],
                               "threads", f"replies on open threads on PR #{pr['number']} "
                               f"(sc-{story['id']}): {len(answered)} open threads",
                               REVIEW, story, pr))
    return items


def side_pr(story, pr):
    """A developer's pull request on a linguist's ticket, such as a test that has to take the
    new wording. The lead reviews it and its developer merges it, while the ticket keeps the
    state the linguist gives it."""
    return linguists(story) and not (pr.get("branch") or "").startswith("l10n/")


def linguists(story):
    return R.translation(story["labels"], None) and R.OPS_LABEL not in story["labels"]


# The states in which an open pull request is its developer's to act on.
BUILDING_PR = ("In Progress", "Failed Code Review", "In Review", "Passed Code Review")


def voided_passes(stories, prs):
    """Stories in Passed Code Review whose open pull request moved past the pass. A side
    pull request leaves the linguist's ticket where it is: `review_items` wakes the lead."""
    by_id = {story["id"]: story for story in stories}
    found = []
    for pr in prs:
        story = by_id.get(pr["story_id"])
        if not story or story["done"] or story["state"] != "Passed Code Review" \
                or pr["state"] != "open" or side_pr(story, pr):
            continue
        verdict = latest_verdict(pr)
        if not (verdict and verdict["verdict"] == "pass"
                and covers(verdict, pr["head_sha"], pr.get("carried"))):
            found.append((story, pr))
    return found


def developer_items(stories, prs):
    by_id = {story["id"]: story for story in stories}
    items = []
    for pr in prs:
        story = by_id.get(pr["story_id"])
        if not story:
            continue
        side, follow = side_pr(story, pr), finished(story)
        own = linguists(story) and not side
        role = builder(story, pr)
        sha = pr["head_sha"][:7]
        verdict = latest_verdict(pr)
        covered = covers(verdict, pr["head_sha"], pr.get("carried"))
        number = pr["number"]

        def add(kind, reason, fingerprint=None):
            items.append(_item(fingerprint or f"{role}:{kind}:#{number}@{sha}", role, [role],
                               kind, reason, PULL_REQUEST, story, pr))

        if story.get("archived"):
            if pr["state"] == "open":
                add("close", f"PR #{number} is open on sc-{story['id']}, which is archived: "
                             "close it, saying why", f"{role}:close:#{number}")
            continue
        if pr["state"] == "merged":
            if story["state"] in R.MERGING and not linguists(story):
                if covered and verdict["verdict"] == "pass":
                    after = "Ready For QA" if role != "ops" or "needs qa" in story["labels"] \
                        else "Done"
                    add("to-qa", f"PR #{number} merged at the passed {sha}: "
                                 f"move sc-{story['id']} to {after} with `to-qa`")
                else:
                    add("merged-unpassed", f"PR #{number} merged at {sha}, "
                                           "which no lead pass covers: ask [lead]")
            continue
        if own:
            # The linguist merges its own once green, with no lead pass to wait for.
            if pr["state"] == "open" and pr["mergeable"] == "conflicting" \
                    and not pr.get("draft"):
                add("conflict", f"PR #{number} conflicts with main at {sha}: merge origin/main "
                                "into the branch, resolve it and push")
            elif pr["state"] == "open" and pr["checks"] == "red":
                add("checks-red", f"PR #{number} checks are red at {sha}")
            elif pr["state"] == "open" and pr["checks"] == "green":
                add("merge", f"PR #{number} is green at {sha}: merge it")
            continue
        if pr["state"] != "open" or not (side or follow or story["state"] in BUILDING_PR):
            continue
        if pr["mergeable"] == "conflicting" and not pr.get("draft"):
            add("conflict", f"PR #{number} conflicts with main at {sha}: merge origin/main into "
                            "the branch, resolve it and push")
        elif pr["checks"] == "red":
            add("checks-red", f"PR #{number} checks are red at {sha}")
        elif pr["checks"] == "green" and story["state"] in ("In Progress", "Failed Code Review") \
                and not covered and not linguists(story):
            add("to-review", f"PR #{number} is green at {sha}: move sc-{story['id']} "
                             "to In Review")
        elif pr["checks"] == "green" and (side or follow or story["state"] in R.MERGING
                                          and not linguists(story)) \
                and covered and verdict["verdict"] == "pass":
            if open_threads(pr):
                unanswered = unanswered_by(role, pr)
                if unanswered:
                    last = max(t["comments"][-1]["id"] for t in unanswered)
                    items.append(_item(f"{role}:answer-threads:#{number}@{sha}:{last}", role,
                                       [role], "answer-threads",
                                       f"PR #{number} passed at {sha} with {len(unanswered)} "
                                       "open threads to answer or fix before it can merge",
                                       PULL_REQUEST, story, pr))
                continue
            add("merge", f"PR #{number} passed at {sha}: merge it")
    return items


TRANSLATING = ("To Do", "Ready For Dev", "In Progress")


def covered(ticket):
    """The stories a translation ticket covers: those it links to as the subject."""
    return [link["object"] for link in ticket.get("links") or []
            if link["subject"] == ticket["id"] and link["object"] != ticket["id"]]


def last_worked(ticket, runs):
    """When the linguist last ran on the ticket: a finished item on it, or a comment signed
    by it, whichever is later."""
    signed = [T.epoch(c["at"]) for c in ticket["comments"] if R.author(c["text"]) == "l10n"]
    return max([t for t in signed if t] + [runs.get(ticket["id"]) or 0])


def unblocked_items(stories, prs, runs=None, raised=()):
    """A translation ticket waits on the pull requests of the stories it covers. Each one
    that merges after the linguist last worked on the ticket wakes it once. A wake already
    raised stays until the linguist works the ticket, though its PR has left the merged
    PRs a sync sees."""
    runs = runs or {}
    merged = {}
    for pr in prs:
        if pr["state"] == "merged" and pr["story_id"] and T.epoch(pr.get("merged_at")) \
                and not (pr.get("branch") or "").startswith("l10n/"):
            merged.setdefault(pr["story_id"], []).append(pr)
    items = []
    for ticket in stories:
        if ticket["done"] or "translation" not in ticket["labels"]:
            continue
        # A developer's pull request on the ticket itself wakes it in any state, since the
        # old flow left such tickets in review; one it covers, only while it is translated.
        own = ticket["state"] not in TRANSLATING
        since = last_worked(ticket, runs)
        wakes = []
        for story_id in sorted({ticket["id"]} if own else set(covered(ticket)) | {ticket["id"]}):
            for pr in merged.get(story_id, []):
                if T.epoch(pr["merged_at"]) <= since:
                    continue
                can = "go on" if story_id == ticket["id"] else "start"
                wakes.append(_item(f"l10n:unblocked:sc-{ticket['id']}:#{pr['number']}", "l10n",
                                   ["l10n"], "unblocked",
                                   f"PR #{pr['number']} (sc-{story_id}) merged: "
                                   f"sc-{ticket['id']} can {can}", INBOX, ticket, pr))
        seen = {item["fingerprint"] for item in wakes}
        wakes += [_item(row["fingerprint"], "l10n", ["l10n"], "unblocked", row["reason"], INBOX,
                        ticket, {"number": row["pr"]})
                  for row in raised if row["story_id"] == ticket["id"]
                  and row["fingerprint"] not in seen and row["first_seen"] > since
                  and not (own and not row["reason"].endswith("can go on"))]
        items += wakes
    return items


def main_items(main_run):
    if not main_run or main_run.get("conclusion") in (None, "", "success", "skipped"):
        return []
    sha = main_run["headSha"][:7]
    return [_item(f"ops:main:{sha}", "ops", ["ops"], "main",
                  f"main is {main_run['conclusion']} at {sha}: {main_run.get('url', '')}",
                  PULL_REQUEST)]


def heartbeat_items(stories, last_runs, busy_roles, now, epics=None, last_sweeps=None):
    """After a quiet spell, a sweeping role sweeps and any other role with a queue picks. A
    role with `sweepEvery` picks too, and sweeps once that long has passed since its last."""
    items = []
    for role, config in R.ROLES.items():
        if role in busy_roles:
            continue
        period = config["heartbeat"] * 60
        last = last_runs.get(role)
        if last and now - last < period:
            continue
        every = config.get("sweepEvery")
        swept = (last_sweeps or {}).get(role)
        if config.get("sweeps") and not (every and swept and now - swept < every * 60):
            kind, reason = "sweep", f"your sweep, {every or config['heartbeat']} minutes on"
        elif queued(role, stories, epics):
            kind, reason = "pick", f"{len(queued(role, stories, epics))} stories in your queue"
        else:
            continue
        items.append(_item(f"{role}:{kind}:{int(now // period)}", role, [role], kind, reason,
                           SWEEP))
    return items


def machine_items(checks):
    """ops@<machine>'s work, from this machine's own checks. A finding wakes ops once a day
    at most, and the sweep once a day."""
    if not checks:
        return []
    name, items = checks["machine"], []
    for found in checks["found"]:
        items.append(_item(f"ops@{name}:{found['key']}:{found['period']}", f"ops@{name}", ["ops"],
                           "machine", found["reason"],
                           PULL_REQUEST if found.get("urgent") else SWEEP))
    return items


def builder(story, pr):
    return "l10n" if linguists(story) and not side_pr(story, pr) else R.builder_of(story["labels"])


def waits_on(story, pr):
    """The role whose step an open pull request waits for, and the step."""
    if not story:
        named = f"sc-{pr['story_id']} is not in Shortcut" if pr["story_id"] \
            else "no sc-N in its branch or title"
        return None, f"a story ({named})"
    role = builder(story, pr)
    verdict = latest_verdict(pr)
    covered = covers(verdict, pr["head_sha"], pr.get("carried"))
    passed = covered and verdict["verdict"] == "pass"
    if story.get("archived"):
        return role, f"{role} to close it: sc-{story['id']} is archived"
    if pr["draft"]:
        return role, f"{role} to mark it ready for review"
    if pr["checks"] == "pending":
        return role, "its checks, or a push to start them"
    if pr["checks"] == "red":
        return role, f"{role} to fix its red checks"
    if role == "l10n" or passed:
        if pr.get("mergeable") == "conflicting":
            return role, f"{role} to merge main in"
        if role != "l10n" and open_threads(pr):
            return role, f"{role} to answer its open threads, and lead to resolve them"
        return role, f"{role} to merge it"
    returned = not story["done"] and story["state"] in REVIEWED \
        and (story["moved_at"] or "") > verdict["at"] if verdict else False
    if covered and verdict["verdict"] == "back" and not returned:
        return role, f"{role} to fix the findings and push"
    if story["state"] in ("In Progress", "Failed Code Review"):
        return role, f"{role} to move sc-{story['id']} to In Review"
    return "lead", "lead to review it"


def stranded(stories, prs, now):
    """Open pull requests with no story, or untouched for a day: each with its age in hours,
    its story and the role whose step it waits on."""
    by_id = {story["id"]: story for story in stories}
    found = []
    for pr in prs:
        if pr["state"] != "open":
            continue
        story = by_id.get(pr["story_id"])
        idle = now - (T.epoch(pr.get("updated_at")) or now)
        if story and idle < DAY:
            continue
        role, step = waits_on(story, pr)
        found.append({"pr": pr, "story": story, "hours": int(idle // 3600), "role": role,
                      "step": step})
    return found


def stranded_items(stories, prs, now):
    """Ops sees the stranded pull requests once a day at most, and tags or closes each."""
    found = stranded(stories, prs, now) if now else []
    if not found:
        return []
    numbers = ", ".join(f"#{f['pr']['number']}" for f in found)
    return [_item(f"ops:stranded:{int(now // DAY)}", "ops", ["ops"], "stranded",
                  f"{len(found)} pull requests stranded: {numbers}", SWEEP)]


def finishing_first(items, stories):
    finishing = {s["id"] for s in stories if not s["done"] and s["state"] in FINISHING_STATES}
    for item in items:
        if item["story_id"] in finishing or item["kind"] in FINISHING_KINDS:
            item["priority"] = FINISHING
    return items


def derive(stories, prs, main_run=None, last_runs=None, busy_roles=(), now=0,
           handled=frozenset(), moves=None, checks=None, epics=None, translated=None,
           raised=(), last_sweeps=None):
    return finishing_first(
        inbox_items(stories, handled) + developer_items(stories, prs)
        + unblocked_items(stories, prs, translated, raised)
        + review_items(stories, prs) + held_items(stories)
        + queue_items(stories, moves, now, epics)
        + main_items(main_run)
        + heartbeat_items(stories, last_runs or {}, set(busy_roles), now, epics, last_sweeps)
        + machine_items(checks) + stranded_items(stories, prs, now), stories)
