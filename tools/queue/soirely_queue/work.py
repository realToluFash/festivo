"""Turns what the sync stored into the work each role has waiting. No network here."""

import datetime
import re
import time

from . import roles as R

FINISHING, INBOX, PULL_REQUEST, REVIEW, QUEUE, SWEEP = 5, 10, 20, 30, 40, 90
# A story one step from Ready For QA, or sent back, goes ahead of everything else its role
# has waiting, its comments included.
FINISHING_STATES = ("Passed Code Review", "Failed QA", "Failed Code Review")


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


def inbox_items(stories, handled=frozenset()):
    items = []
    for story in stories:
        if story["done"]:
            continue
        for role in R.ROLES:
            waiting = open_for(role, story, handled)
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
    if "qa failed" not in story["labels"] or not story.get("moved_at"):
        return None
    try:
        moved = datetime.datetime.fromisoformat(story["moved_at"].replace("Z", "+00:00"))
    except ValueError:
        return None
    age = (now or time.time()) - moved.timestamp()
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
                rank=build_order[story["id"]] if story["state"] in R.BUILD_QUEUE else 0)
    return list(merged.values())


REVIEWED = ("In Review", "Passed Code Review")


def review_items(stories, prs):
    by_story = {}
    for pr in prs:
        if pr["state"] == "open" and not pr["draft"] and pr["story_id"]:
            by_story.setdefault(pr["story_id"], []).append(pr)
    items = []
    for story in stories:
        # A push after the pass leaves the story in Passed Code Review, but the pass no
        # longer covers its head, so the lead looks again.
        if story["done"] or story["state"] not in REVIEWED:
            continue
        open_prs = by_story.get(story["id"], [])
        merged = any(pr["story_id"] == story["id"] and pr["state"] == "merged" for pr in prs)
        if not open_prs and not merged and story["state"] == "In Review":
            items.append(_item(f"lead:review:sc-{story['id']}:none:{story['moved_at']}", "lead",
                               ["lead"], "review",
                               f"sc-{story['id']} is In Review with no open pull request",
                               REVIEW, story))
        for pr in open_prs:
            if pr["checks"] == "pending":
                continue
            verdict = latest_verdict(pr)
            sha = pr["head_sha"]
            returned = verdict and verdict["verdict"] == "back" \
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
        if pr["state"] != "open" or pr["number"] in reviewing or not story or story["done"]:
            continue
        answered = answered_threads(pr)
        if answered:
            last = max(t["comments"][-1]["id"] for t in answered)
            items.append(_item(f"lead:threads:#{pr['number']}@{last}", "lead", ["lead"],
                               "threads", f"replies on open threads on PR #{pr['number']} "
                               f"(sc-{story['id']}): {len(answered)} open threads",
                               REVIEW, story, pr))
    return items


# The states in which an open pull request is its developer's to act on.
BUILDING_PR = ("In Progress", "Failed Code Review", "In Review", "Passed Code Review")


def voided_passes(stories, prs):
    """Stories in Passed Code Review whose open pull request moved past the pass."""
    by_id = {story["id"]: story for story in stories}
    found = []
    for pr in prs:
        story = by_id.get(pr["story_id"])
        if not story or story["done"] or story["state"] != "Passed Code Review" \
                or pr["state"] != "open":
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
        if not story or story["done"]:
            continue
        role = R.builder_of(story["labels"])
        sha = pr["head_sha"][:7]
        verdict = latest_verdict(pr)
        covered = covers(verdict, pr["head_sha"], pr.get("carried"))
        number = pr["number"]

        def add(kind, reason):
            items.append(_item(f"{role}:{kind}:#{number}@{sha}", role, [role], kind,
                               reason, PULL_REQUEST, story, pr))

        if pr["state"] == "merged":
            if story["state"] in R.MERGING:
                if covered and verdict["verdict"] == "pass":
                    after = "Ready For QA" if role != "ops" or "needs qa" in story["labels"] \
                        else "Done"
                    add("to-qa", f"PR #{number} merged at the passed {sha}: "
                                 f"move sc-{story['id']} to {after} with `to-qa`")
                else:
                    add("merged-unpassed", f"PR #{number} merged at {sha}, "
                                           "which no lead pass covers: ask [lead]")
            continue
        if pr["state"] != "open" or story["state"] not in BUILDING_PR:
            continue
        if pr["checks"] == "red":
            add("checks-red", f"PR #{number} checks are red at {sha}")
        elif pr["checks"] == "green" and story["state"] in ("In Progress", "Failed Code Review") \
                and not covered:
            add("to-review", f"PR #{number} is green at {sha}: move sc-{story['id']} "
                             "to In Review")
        elif pr["checks"] == "green" and story["state"] in R.MERGING \
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
            conflict = ", but it conflicts with main" if pr["mergeable"] == "conflicting" else ""
            add("merge", f"PR #{number} passed at {sha}{conflict}: merge it")
    return items


def main_items(main_run):
    if not main_run or main_run.get("conclusion") in (None, "", "success", "skipped"):
        return []
    sha = main_run["headSha"][:7]
    return [_item(f"ops:main:{sha}", "ops", ["ops"], "main",
                  f"main is {main_run['conclusion']} at {sha}: {main_run.get('url', '')}",
                  PULL_REQUEST)]


def heartbeat_items(stories, last_runs, busy_roles, now, epics=None):
    """After a quiet spell, a sweeping role sweeps and any other role with a queue picks."""
    items = []
    for role, config in R.ROLES.items():
        if role in busy_roles:
            continue
        period = config["heartbeat"] * 60
        last = last_runs.get(role)
        if last and now - last < period:
            continue
        if config.get("sweeps"):
            kind, reason = "sweep", f"your sweep, {config['heartbeat']} minutes on"
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


def finishing_first(items, stories):
    finishing = {s["id"] for s in stories if not s["done"] and s["state"] in FINISHING_STATES}
    for item in items:
        if item["story_id"] in finishing or item["kind"] == "to-qa":
            item["priority"] = FINISHING
    return items


def derive(stories, prs, main_run=None, last_runs=None, busy_roles=(), now=0,
           handled=frozenset(), moves=None, checks=None, epics=None):
    return finishing_first(
        inbox_items(stories, handled) + developer_items(stories, prs)
        + review_items(stories, prs) + queue_items(stories, moves, now, epics)
        + main_items(main_run)
        + heartbeat_items(stories, last_runs or {}, set(busy_roles), now, epics)
        + machine_items(checks), stories)
