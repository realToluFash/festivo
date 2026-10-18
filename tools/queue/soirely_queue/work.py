"""Turns what the sync stored into the work each role has waiting. No network here."""

import re

from . import roles as R

INBOX, PULL_REQUEST, REVIEW, QUEUE, SWEEP = 10, 20, 30, 40, 90


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


def covers(verdict, sha):
    return bool(verdict and verdict["sha"] and sha.startswith(verdict["sha"]))


def open_threads(pr):
    return [t for t in pr["threads"] if not t["resolved"]]


FINDING = re.compile(r"^\s*(blocking|should|nit)\b", re.I)
SIGNED = re.compile(r"\(from ([a-z0-9]+)\)")


def answered_findings(pr):
    """Open threads the lead started with a finding whose last word is someone else's, so
    the lead has a reply to check and a thread to resolve or answer."""
    found = []
    for t in open_threads(pr):
        first, last = (t["comments"][0], t["comments"][-1]) if t["comments"] else (None, None)
        if not first or last is first or not FINDING.match(first["text"]):
            continue
        signed = SIGNED.findall(last["text"])
        if signed and signed[-1] == "lead":
            continue
        found.append(t)
    return found


def _item(fingerprint, pool, roles, kind, reason, priority, story=None, pr=None, comments=None):
    return {"fingerprint": fingerprint, "pool": pool, "roles": roles, "kind": kind,
            "reason": reason, "priority": priority, "comments": comments,
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


def queued(role, stories):
    config = R.ROLES[role]
    return [story for story in stories
            if not story["done"] and story["state"] in config["queue"]
            and config["filter"](set(story["labels"]), story["state"])]


def queue_items(stories):
    """A story entering a role's queue is work once. One sitting there waits for a pick."""
    merged = {}
    for role, config in R.ROLES.items():
        for story in queued(role, stories):
            pool = R.pool(role, story["state"], story["labels"])
            fingerprint = f"{pool}:story:sc-{story['id']}:{story['state']}:{story['moved_at']}"
            if fingerprint in merged:
                merged[fingerprint]["roles"].append(role)
                continue
            merged[fingerprint] = _item(
                fingerprint, pool, [role], "story", f"sc-{story['id']} moved to {story['state']}",
                QUEUE + config["queue"].index(story["state"]), story)
    return list(merged.values())


def review_items(stories, prs):
    by_story = {}
    for pr in prs:
        if pr["state"] == "open" and not pr["draft"] and pr["story_id"]:
            by_story.setdefault(pr["story_id"], []).append(pr)
    items = []
    for story in stories:
        if story["done"] or story["state"] != "In Review":
            continue
        open_prs = by_story.get(story["id"], [])
        merged = any(pr["story_id"] == story["id"] and pr["state"] == "merged" for pr in prs)
        if not open_prs and not merged:
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
            if covers(verdict, sha) and not returned:
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
    # A review item already shows every open thread; otherwise a reply in one of the
    # lead's threads is work of its own, whatever state the story is in.
    reviewing = {item["pr"] for item in items}
    by_id = {story["id"]: story for story in stories}
    for pr in prs:
        story = by_id.get(pr["story_id"])
        if pr["state"] != "open" or pr["number"] in reviewing or not story or story["done"]:
            continue
        answered = answered_findings(pr)
        if answered:
            last = max(t["comments"][-1]["id"] for t in answered)
            items.append(_item(f"lead:threads:#{pr['number']}@{last}", "lead", ["lead"],
                               "threads", f"replies on your findings on PR #{pr['number']} "
                               f"(sc-{story['id']}): {len(answered)} open threads",
                               REVIEW, story, pr))
    return items


def developer_items(stories, prs):
    by_id = {story["id"]: story for story in stories}
    items = []
    for pr in prs:
        story = by_id.get(pr["story_id"])
        if not story or story["done"]:
            continue
        role = R.developer_of(story["labels"])
        sha = pr["head_sha"][:7]
        verdict = latest_verdict(pr)
        number = pr["number"]

        def add(kind, reason):
            items.append(_item(f"{role}:{kind}:#{number}@{sha}", role, [role], kind,
                               reason, PULL_REQUEST, story, pr))

        if pr["state"] == "merged":
            if story["state"] == "In Review":
                if covers(verdict, pr["head_sha"]) and verdict["verdict"] == "pass":
                    add("to-qa", f"PR #{number} merged at the passed {sha}: "
                                 f"move sc-{story['id']} to Ready For QA")
                else:
                    add("merged-unpassed", f"PR #{number} merged at {sha}, "
                                           "which no lead pass covers: ask [lead]")
            continue
        if pr["state"] != "open" or story["state"] not in ("In Progress", "In Review"):
            continue
        if pr["checks"] == "red":
            add("checks-red", f"PR #{number} checks are red at {sha}")
        elif pr["checks"] == "green" and story["state"] == "In Progress" \
                and not covers(verdict, pr["head_sha"]):
            add("to-review", f"PR #{number} is green at {sha}: move sc-{story['id']} "
                             "to In Review")
        elif pr["checks"] == "green" and story["state"] == "In Review" \
                and covers(verdict, pr["head_sha"]) and verdict["verdict"] == "pass":
            if open_threads(pr):
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


def heartbeat_items(stories, last_runs, busy_roles, now):
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
        elif queued(role, stories):
            kind, reason = "pick", f"{len(queued(role, stories))} stories in your queue"
        else:
            continue
        items.append(_item(f"{role}:{kind}:{int(now // period)}", role, [role], kind, reason,
                           SWEEP))
    return items


def derive(stories, prs, main_run=None, last_runs=None, busy_roles=(), now=0,
           handled=frozenset()):
    return (inbox_items(stories, handled) + developer_items(stories, prs) + review_items(stories, prs)
            + queue_items(stories) + main_items(main_run)
            + heartbeat_items(stories, last_runs or {}, set(busy_roles), now))
