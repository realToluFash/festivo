"""What more than one machine must agree on, kept as git references in the repository that
every machine already reaches: which machine runs each role, which story a shared queue's
worker has taken, each machine's heartbeat, and a pause for all of them.

A reference points at a commit whose message holds the record as JSON. Creating a
reference that exists is refused, and a non-forced update must descend from what is there,
so a take is a compare-and-swap: two machines can never both win. Commits never change, so
each message is read once and kept by its id."""

import json
import re
import subprocess
import time

from . import github, store

PREFIX = "refs/soirely"
HEARTBEAT_SECONDS = 5 * 60
CLAIM_SECONDS = 90 * 60
PAUSE = f"{PREFIX}/pause"
# The queues two roles share, and so two machines could both take a story from.
POOLS = ("dev", "qa")
UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def safe(name):
    return UNSAFE.sub("-", name).strip(".-") or "machine"


def role_ref(role):
    return f"{PREFIX}/roles/{role}"


def claim_ref(pool, story_id):
    return f"{PREFIX}/claims/{pool}/sc-{story_id}"


def machine_ref(machine):
    return f"{PREFIX}/machines/{safe(machine)}"


class Taken(RuntimeError):
    """The reference exists, or moved since it was read."""


class GitHubRefs:
    """The references through GitHub's REST API, as the owner's gh login."""

    def __init__(self, tree=None):
        self._tree = tree

    def path(self, rest=""):
        return f"{github.repo_path()}/git/{rest}"

    def tree(self):
        # Any tree GitHub has will do; the record lives in the message, not the files.
        if not self._tree:
            self._tree = subprocess.run(["git", "rev-parse", "origin/main^{tree}"],
                                        capture_output=True, text=True,
                                        check=True).stdout.strip()
        return self._tree

    def list(self):
        found = github.api(self.path("matching-refs/soirely/")) or []
        return {ref["ref"]: ref["object"]["sha"] for ref in found}

    def message(self, sha):
        return github.api(self.path(f"commits/{sha}"))["message"]

    def commit(self, message, parent=None):
        args = ["-f", f"message={message}", "-f", f"tree={self.tree()}"]
        if parent:
            args += ["-f", f"parents[]={parent}"]
        return github.api(self.path("commits"), *args)["sha"]

    def create(self, ref, message):
        sha = self.commit(message)
        try:
            github.api(self.path("refs"), "-f", f"ref={ref}", "-f", f"sha={sha}")
        except github.GitHubError as error:
            if "already exists" in str(error):
                raise Taken(ref) from error
            raise
        return sha

    def advance(self, ref, old, message):
        sha = self.commit(message, parent=old)
        try:
            github.api(self.path(f"refs/{ref[5:]}"), "-X", "PATCH", "-f", f"sha={sha}",
                       "-F", "force=false")
        except github.GitHubError as error:
            if "fast forward" in str(error).lower() or "not found" in str(error).lower():
                raise Taken(ref) from error
            raise
        return sha

    def put(self, ref, message, exists):
        """Overwrites a record only this machine writes, such as its heartbeat."""
        sha = self.commit(message)
        if exists:
            github.api(self.path(f"refs/{ref[5:]}"), "-X", "PATCH", "-f", f"sha={sha}",
                       "-F", "force=true")
        else:
            github.api(self.path("refs"), "-f", f"ref={ref}", "-f", f"sha={sha}")
        return sha

    def delete(self, ref):
        try:
            github.api(self.path(f"refs/{ref[5:]}"), "-X", "DELETE")
        except github.GitHubError as error:
            if "not found" not in str(error).lower() and "does not exist" not in str(error):
                raise


def record(kind, **fields):
    return f"soirely {kind}\n\n{json.dumps(fields, sort_keys=True)}"


def parse(message):
    try:
        return json.loads(message.split("\n\n", 1)[1])
    except (IndexError, ValueError):
        return {}


class View:
    """One minute's reading of the references, from this machine's side."""

    def __init__(self, machine, refs, records, now):
        self.machine, self.refs, self.records, self.now = machine, refs, records, now

    def get(self, ref):
        return self.records.get(self.refs.get(ref)) if ref in self.refs else None

    def machines(self):
        found = {}
        for ref in self.refs:
            if ref.startswith(f"{PREFIX}/machines/"):
                data = self.get(ref) or {}
                if data.get("machine"):
                    found[data["machine"]] = data
        return found

    def seen(self, machine):
        """Seconds since `machine` last wrote its heartbeat, or None if it never has."""
        data = self.machines().get(machine)
        return self.now - data["at"] if data and data.get("at") else None

    def alive(self, machine):
        if machine == self.machine:
            return True
        ago = self.seen(machine)
        return ago is not None and ago < HEARTBEAT_SECONDS

    def holder(self, role):
        data = self.get(role_ref(role))
        return data.get("machine") if data else None

    def claims(self):
        """Every live story claim, as {(pool, story id): record}. A claim lapses after 90
        minutes, or as soon as its machine stops writing its heartbeat."""
        found = {}
        for ref in self.refs:
            match = re.fullmatch(rf"{PREFIX}/claims/([a-z0-9]+)/sc-(\d+)", ref)
            data = self.get(ref) if match else None
            if not data:
                continue
            if self.now - data.get("at", 0) < CLAIM_SECONDS and self.alive(data.get("machine")):
                found[(match.group(1), int(match.group(2)))] = data
        return found

    def taken_elsewhere(self):
        return {key for key, data in self.claims().items() if data.get("machine") != self.machine}

    def paused(self):
        return self.get(PAUSE)


def read(remote, db, machine, now):
    refs = remote.list()
    known = store.get_meta(db, "shared_records") or {}
    records = {sha: known[sha] if sha in known else parse(remote.message(sha))
               for sha in set(refs.values())}
    store.set_meta(db, "shared_records", records)
    return View(machine, refs, records, now)


def heartbeat(remote, view, config, started, paused):
    roles_ = config.get("roles") or {}
    data = {"machine": view.machine, "at": view.now, "listed": sorted(roles_),
            "standby": sorted(r for r, v in roles_.items() if (v or {}).get("standby")),
            "started": sorted(started), "paused": bool(paused)}
    ref = machine_ref(view.machine)
    sha = remote.put(ref, record("machine", **data), ref in view.refs)
    view.refs[ref], view.records[sha] = sha, data


def standby(config, role):
    return bool(((config.get("roles") or {}).get(role) or {}).get("standby"))


def wanted_elsewhere(view, role):
    """A live machine that runs `role` as its first choice, not as a standby."""
    for machine, data in view.machines().items():
        if machine != view.machine and view.alive(machine) and role in data.get("started", []) \
                and role not in data.get("standby", []):
            return machine
    return None


def leases(remote, view, config, started, busy):
    """Takes, keeps and gives back this machine's role leases. Returns
    `(mine, elsewhere)`: the started roles this machine holds, and for each started role
    another machine holds, that machine and how long ago it was seen."""
    mine, elsewhere = set(), {}
    for role in sorted(set(started)):
        ref = role_ref(role)
        holder = view.holder(role)
        if holder == view.machine:
            if standby(config, role) and wanted_elsewhere(view, role) and not busy(role):
                remote.delete(ref)
                elsewhere[role] = (wanted_elsewhere(view, role), 0)
                continue
            mine.add(role)
            continue
        if holder and view.alive(holder):
            elsewhere[role] = (holder, int(view.seen(holder) or 0))
            continue
        if standby(config, role) and wanted_elsewhere(view, role):
            elsewhere[role] = (wanted_elsewhere(view, role), 0)
            continue
        message = record("role", role=role, machine=view.machine, at=view.now)
        try:
            if holder:
                remote.advance(ref, view.refs[ref], message)
            else:
                remote.create(ref, message)
        except Taken:
            elsewhere[role] = ("another machine", 0)
            continue
        mine.add(role)
    for ref in list(view.refs):
        match = re.fullmatch(rf"{PREFIX}/roles/([a-z0-9]+)", ref)
        if match and match.group(1) not in started and view.holder(match.group(1)) == \
                view.machine:
            remote.delete(ref)
    return mine, elsewhere


def claim_story(remote, view, pool, story_id, role):
    """Takes a story from a shared queue for one of this machine's workers. False when
    another machine has it."""
    ref = claim_ref(pool, story_id)
    message = record("claim", pool=pool, story=story_id, role=role, machine=view.machine,
                     at=view.now)
    current = view.get(ref) if ref in view.refs else None
    try:
        if current is None:
            remote.create(ref, message)
        elif (pool, story_id) in view.taken_elsewhere():
            return False
        else:
            remote.advance(ref, view.refs[ref], message)
    except Taken:
        return False
    return True


def release_claims(remote, view, holding):
    """Gives back each claim of this machine whose story no local worker holds now."""
    for (pool, story_id), data in view.claims().items():
        if data.get("machine") == view.machine and (pool, story_id) not in holding:
            remote.delete(claim_ref(pool, story_id))


def conflicts(view, config):
    """Roles this machine lists, also listed on another live machine, neither as standby."""
    found = []
    for role in config.get("roles") or {}:
        if role == "ops" or standby(config, role):
            continue
        for machine, data in view.machines().items():
            if machine != view.machine and view.alive(machine) and role in data.get("listed", []) \
                    and role not in data.get("standby", []):
                found.append((role, machine))
    return found


def reconcile(remote, db, config, started, busy, holding, now, paused_here=False):
    """The runner's minute: read every record, write this machine's heartbeat, settle its
    leases and give back finished claims. What it found is kept for `sq status`."""
    view = read(remote, db, config.get("machine") or "machine", now)
    heartbeat(remote, view, config, started, paused_here)
    store.set_meta(db, "shared_records", view.records)
    mine, elsewhere = leases(remote, view, config, started, busy)
    release_claims(remote, view, holding)
    store.set_meta(db, "shared_view", {
        "at": now, "mine": sorted(mine),
        "elsewhere": {role: list(where) for role, where in elsewhere.items()},
        "conflicts": conflicts(view, config), "paused": view.paused(),
        "machines": {m: {"seen": int(now - d.get("at", now)), "started": d.get("started", [])}
                     for m, d in view.machines().items() if m != view.machine}})
    return view, mine, elsewhere


def pause_everywhere(remote, machine, now=None):
    try:
        remote.create(PAUSE, record("pause", machine=machine,
                                    at=now or time.time()))
    except Taken:
        return False
    return True


def resume_everywhere(remote):
    remote.delete(PAUSE)
