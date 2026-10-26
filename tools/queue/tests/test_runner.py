"""`sq run` and `sq worker`, against a fake platform: nothing here starts a unit or a model."""

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import textwrap
import time
import unittest
from unittest import mock

from soirely_queue import checkout, github, review, runlog, runner, shared, store

from .fakes import FakeRefs

MINUTE = 60
ON_ZERO = 3 * MINUTE * 1000  # a minute whose offset is 0
FIXTURES = pathlib.Path(__file__).parent / "fixtures"
ON_ONE = ON_ZERO + MINUTE


class FakePlatform:
    name = "fake"

    def __init__(self, active=(), fail=False):
        self.active = set(active)
        self.fail = fail
        self.launched = []
        self.cwds = []
        self.notes = []
        self.installed = 0

    def install(self, sq, env_file, python):
        self.installed += 1

    def worker_active(self, role):
        return role in self.active

    def launch(self, role, item_id, values, sq, python, cwd, env_file):
        if self.fail:
            raise subprocess.CalledProcessError(1, "systemd-run")
        self.launched.append((role, item_id, values))
        self.cwds.append(cwd)

    def notify(self, title, body):
        self.notes.append((title, body))

    def after_run(self):
        pass

    def enable(self):
        self.enabled = True


def login(folder, email="owner@example.test"):
    """A Claude config folder that looks logged in, as `account` reads it: no real token."""
    folder = pathlib.Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / ".claude.json").write_text(json.dumps({"oauthAccount": {"emailAddress": email}}))
    (folder / ".credentials.json").write_text("{}")
    return folder


def config(root, **changes):
    login(pathlib.Path(root) / "claude")
    base = {"machine": "here", "workspace": str(root), "mainCheckout": "festivo",
            "claudeConfigDir": str(pathlib.Path(root) / "claude"),
            "roles": {"ops": {}, "dev2": {}, "lead": {}},
            "defaults": {"model": "claude-opus-5-5", "effort": "medium", "memoryMax": "3G",
                         "maxRuntime": "90m", "maxBudgetUsd": None}}
    base.update(changes)
    return base


def work(role, fingerprint=None):
    return {"fingerprint": fingerprint or f"inbox:{role}", "pool": role, "roles": [role],
            "kind": "inbox", "reason": f"[{role}] on sc-1", "priority": 1}


class Run(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        for name in ("festivo", "soirely-ops", "soirely-dev2", "soirely-lead"):
            (self.root / name).mkdir()
        self.home = self.root / "home"
        self.db = store.connect(":memory:")
        self.config = config(self.root)
        self.said = []
        self.platform = FakePlatform()
        for patch in (mock.patch.dict("os.environ", {"SHORTCUT_API_TOKEN": "x",
                                                      "SOIRELY_CONFIG": str(self.root)}),
                      mock.patch("soirely_queue.sync.sync", return_value=[]),
                      mock.patch("soirely_queue.cli.refresh_work"),
                      mock.patch("soirely_queue.update.check", return_value=False),
                      mock.patch("soirely_queue.machine.free_gb", return_value=100.0),
                      mock.patch("soirely_queue.local.build_cache_gb", return_value=1.0)):
            patch.start()
            self.addCleanup(patch.stop)
        runner.set_started(self.db, ["ops", "dev2", "lead"], True)
        self.remote = FakeRefs()

    def tearDown(self):
        self.folder.cleanup()

    def run_once(self, now=ON_ZERO, **kwargs):
        runner.run(self.db, self.home, self.platform, "sq", "python3", now=now,
                   say=self.said.append, load=lambda: self.config,
                   probe=lambda: kwargs.pop("version", "2.1.304"),
                   remote=kwargs.pop("remote", self.remote), **kwargs)

    def test_a_due_role_with_work_gets_one_worker(self):
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual([(r, v["model"], v["maxRuntimeMinutes"])
                          for r, _, v in self.platform.launched],
                         [("ops", "claude-opus-5-5", 90)])
        self.assertTrue(store.held_by(self.db, "ops", ON_ZERO))
        self.assertIn("ops: woke for [ops] on sc-1 (item 1)", self.said)

    def test_a_role_with_several_workers_starts_one_per_item_each_in_its_own_checkout(self):
        (self.root / "soirely-pm").mkdir()
        self.config["roles"]["pm"] = {"workers": 3, "wakeEvery": "1m"}
        runner.set_started(self.db, ["pm"], True)
        store.record(self.db, [work("pm", f"pm:{n}") for n in range(4)], ON_ZERO)
        with mock.patch("soirely_queue.checkout.ensure") as ensured:
            self.run_once()
        self.assertEqual([r for r, _, _ in self.platform.launched if r.startswith("pm")],
                         ["pm", "pm-2", "pm-3"])
        self.assertEqual([c.name for c in self.platform.cwds if "pm" in c.name],
                         ["soirely-pm", "soirely-pm-2", "soirely-pm-3"])
        self.assertEqual(ensured.call_count, 2)
        self.assertEqual(len(store.waiting(self.db, "pm")), 1)

        self.platform.active.update({"pm", "pm-3"})
        self.run_once(ON_ZERO + 60)
        self.assertIn("pm-2: item 2 given back, its worker ended without finishing it",
                      self.said)

    def test_the_lead_may_run_two_workers_on_two_pull_requests(self):
        self.config["roles"]["lead"] = {"workers": 2, "wakeEvery": "1m"}
        store.record(self.db, [dict(work("lead", f"lead:{n}"), pr=n, kind="review")
                               for n in (40, 41)], ON_ZERO)
        with mock.patch("soirely_queue.checkout.ensure"):
            self.run_once()
        self.assertFalse([line for line in self.said if line.startswith("error: lead")])
        self.assertEqual([r for r, _, _ in self.platform.launched], ["lead", "lead-2"])
        self.assertEqual({row["pr"] for row in self.db.execute(
            "select pr from work where status = 'claimed'")}, {40, 41})

    def test_only_a_role_without_a_stack_may_run_several_workers(self):
        self.config["roles"]["dev2"] = {"workers": 2}
        self.run_once()
        self.assertTrue(any(line.startswith("error: dev2: workers is 2, but dev2 keeps one stack")
                            for line in self.said))

    def test_the_drawing_list_is_drawn_while_ux_runs_here(self):
        (self.root / "soirely-ux").mkdir()
        self.config["roles"]["ux"] = {}
        with mock.patch("soirely_queue.drawing.tick") as drew:
            self.run_once()
            drew.assert_not_called()
            runner.set_started(self.db, ["ux"], True)
            self.run_once(ON_ZERO + 60)
        drew.assert_called_once()

    def test_a_role_only_ticks_on_its_own_minute(self):
        store.record(self.db, [work("ops"), work("dev2")], ON_ZERO)
        self.run_once(ON_ONE)
        self.assertEqual([r for r, _, _ in self.platform.launched], ["dev2"])

    def test_a_role_not_started_never_wakes(self):
        runner.set_started(self.db, ["ops"], False)
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual(self.platform.launched, [])

    def test_a_running_worker_is_left_to_finish(self):
        self.platform.active.add("ops")
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual(self.platform.launched, [])
        self.assertIn("ops: worker still running", self.said)

    def test_no_token_stops_before_any_sync(self):
        with mock.patch.dict("os.environ", {"SHORTCUT_API_TOKEN": ""}), \
                mock.patch("soirely_queue.sync.sync") as synced:
            self.run_once()
        synced.assert_not_called()
        self.assertTrue(self.said[0].startswith("error: SHORTCUT_API_TOKEN is not set"))

    def test_a_started_role_without_its_checkout_is_an_error_and_the_rest_run(self):
        (self.root / "soirely-lead").rmdir()
        store.record(self.db, [work("lead"), work("ops")], ON_ZERO)
        self.run_once()
        self.assertIn(f"error: lead: no checkout at {self.root / 'soirely-lead'}", self.said)
        self.assertEqual([r for r, _, _ in self.platform.launched], ["ops"])
        self.assertTrue(store.waiting(self.db, "lead"))

    def test_a_listed_role_not_started_is_only_refused(self):
        (self.root / "soirely-lead").rmdir()
        runner.set_started(self.db, ["lead"], False)
        self.run_once()
        self.assertIn(f"refused: lead: no checkout at {self.root / 'soirely-lead'}", self.said)

    def test_a_null_runtime_on_a_role_keeps_the_floor(self):
        self.config["roles"]["lead"] = {"maxRuntime": None}
        store.record(self.db, [work("lead"), work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual(sorted((r, v["maxRuntimeMinutes"]) for r, _, v in self.platform.launched),
                         [("lead", 90), ("ops", 90)])

    def test_a_missing_runtime_claims_nothing_it_cannot_launch(self):
        self.config["defaults"].pop("maxRuntime")
        store.record(self.db, [work("lead"), work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual(sorted((r, v["maxRuntimeMinutes"]) for r, _, v in self.platform.launched),
                         [("lead", 90), ("ops", 90)])

    def test_paused_wakes_nobody(self):
        store.set_meta(self.db, "paused", "2026-10-20 09:00")
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual(self.platform.launched, [])
        self.assertTrue(self.said[0].startswith("paused since"))

    def test_low_disk_holds_new_workers_and_tells_the_owner_once(self):
        store.record(self.db, [work("ops")], ON_ZERO)
        with mock.patch("soirely_queue.machine.free_gb", return_value=4.0):
            self.run_once()
            self.run_once(ON_ZERO + 3 * MINUTE)
        self.assertEqual(self.platform.launched, [])
        self.assertEqual(len(self.platform.notes), 1)
        self.assertIn("only 4 GB free", self.platform.notes[0][1])

    def test_a_disk_that_moves_under_the_floor_notifies_once(self):
        store.record(self.db, [work("ops")], ON_ZERO)
        for minute, free in enumerate((4.0, 3.0, 3.6, 2.1)):
            with mock.patch("soirely_queue.machine.free_gb", return_value=free):
                self.run_once(ON_ZERO + minute * 3 * MINUTE)
        self.assertEqual(len(self.platform.notes), 1)
        self.assertEqual(store.get_meta(self.db, "told:disk"),
                         runner.datetime.date.today().isoformat())

    def test_the_daily_cap_holds_new_workers(self):
        self.config["dailyBudgetUsd"] = 5
        runlog.append(self.home, "lead", {"at": runner.time.time(), "cost_usd": 6.5})
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual(self.platform.launched, [])
        self.assertIn("held: $6.50 spent today, at dailyBudgetUsd 5: no new workers", self.said)

    def test_a_dry_run_says_what_would_wake_and_changes_nothing(self):
        store.record(self.db, [work("ops")], ON_ZERO)
        runner.set_started(self.db, ["ops"], False)
        self.run_once(ON_ONE, dry_run=True)
        self.assertIn("ops: would wake for [ops] on sc-1", self.said)
        self.assertEqual(self.platform.launched, [])
        self.assertEqual(self.platform.installed, 0)
        self.assertFalse(store.held_by(self.db, "ops", ON_ZERO))

    def test_a_drifted_claude_warns_every_run_and_notifies_once(self):
        self.config["claudeVersion"] = "2.1.300"
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.run_once(ON_ZERO + 11 * MINUTE)
        warnings = [s for s in self.said if s.startswith("warning: claude is 2.1.304")]
        self.assertEqual(len(warnings), 2)
        self.assertEqual([t for t, _ in self.platform.notes], ["Soirely: claude version drifted"])
        self.assertEqual(len(self.platform.launched), 1)

    def test_drift_can_stop_the_roles(self):
        self.config.update(claudeVersion="2.1.300", onVersionDrift="stop")
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual(self.platform.launched, [])

    def test_a_matching_pin_says_nothing(self):
        self.config["claudeVersion"] = "2.1.304"
        self.run_once()
        self.assertFalse([s for s in self.said if s.startswith("warning")])

    def test_a_role_wakes_only_as_often_as_its_wake_every(self):
        self.config["roles"]["ops"] = {"wakeEvery": "15m"}
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once(ON_ZERO + 3 * MINUTE)
        self.assertEqual(self.platform.launched, [])
        self.run_once(ON_ZERO + 15 * MINUTE)
        self.assertEqual(len(self.platform.launched), 1)

    def test_an_item_whose_worker_died_is_given_back_at_the_next_minute(self):
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertTrue(store.held_by(self.db, "ops", ON_ZERO))
        self.run_once(ON_ZERO + 3 * MINUTE)
        self.assertIn("ops: item 1 given back, its worker ended without finishing it",
                      self.said)
        self.assertEqual([item for _, item, _ in self.platform.launched], [1, 1])

    def test_a_workers_item_is_given_back_when_the_runner_did_not_launch_it(self):
        store.record(self.db, [work("ops", "inbox:a"), work("ops", "inbox:b")], ON_ZERO)
        store.claim(self.db, "ops", ON_ZERO, worker="ops")
        self.run_once()
        self.assertIn("ops: item 1 given back, its worker ended without finishing it",
                      self.said)
        self.assertEqual([item for _, item, _ in self.platform.launched], [1])

    def test_an_item_a_running_worker_holds_is_kept(self):
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.platform.active.add("ops")
        self.run_once(ON_ZERO + 3 * MINUTE)
        self.assertEqual(len(self.platform.launched), 1)
        self.assertTrue(store.held_by(self.db, "ops", ON_ZERO + 3 * MINUTE))

    def test_an_item_claimed_by_hand_is_kept(self):
        store.record(self.db, [work("ops")], ON_ZERO)
        store.claim(self.db, "ops", ON_ZERO)
        self.run_once()
        self.assertIn("ops: busy", self.said)
        self.assertEqual(self.platform.launched, [])

    def test_a_worker_that_will_not_start_gives_its_item_back(self):
        self.platform.fail = True
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertFalse(store.held_by(self.db, "ops", ON_ZERO))
        self.assertEqual(store.waiting(self.db, "ops")[0]["id"], 1)

    def machine_work(self, key="disk"):
        return {"fingerprint": f"ops@here:{key}:1", "pool": "ops@here", "roles": ["ops"],
                "kind": "machine", "reason": f"{key} on here", "priority": 20}

    def test_a_role_another_machine_runs_does_not_wake_here(self):
        self.remote.beat("tolu-mac", ON_ONE, started={"dev2"})
        self.remote.create(shared.role_ref("dev2"), shared.record("role", role="dev2",
                                                                  machine="tolu-mac"))
        store.record(self.db, [work("dev2")], ON_ONE)
        self.run_once(ON_ONE + 30)
        self.assertEqual(self.platform.launched, [])
        self.assertIn("dev2: running on tolu-mac, last seen 30s ago", self.said)

    def test_ops_on_a_machine_without_the_ops_lease_does_only_this_machines_work(self):
        self.remote.beat("tolu-mac", ON_ZERO, started={"ops"})
        self.remote.create(shared.role_ref("ops"), shared.record("role", role="ops",
                                                                 machine="tolu-mac"))
        store.record(self.db, [work("ops"), self.machine_work()], ON_ZERO)
        self.run_once()
        self.assertEqual([r for r, _, _ in self.platform.launched], ["ops"])
        self.assertEqual(store.held_by(self.db, "ops", ON_ZERO)["kind"], "machine")

    def test_a_full_disk_still_lets_ops_clear_it(self):
        store.record(self.db, [work("dev2"), work("ops"), self.machine_work()], ON_ONE)
        with mock.patch("soirely_queue.machine.free_gb", return_value=4.0):
            self.run_once(ON_ZERO)
            self.run_once(ON_ONE)
        self.assertEqual([r for r, _, _ in self.platform.launched], ["ops"])
        self.assertEqual(store.held_by(self.db, "ops", ON_ONE)["kind"], "machine")

    def test_a_shared_story_taken_on_another_machine_is_left_to_it(self):
        self.config["roles"]["qa"] = {}
        (self.root / "soirely-qa").mkdir()
        runner.set_started(self.db, ["qa"], True)
        self.remote.beat("tolu-mac", ON_ZERO, started={"qa2"})
        self.remote.create(shared.claim_ref("qa", "sc-7"), shared.record(
            "claim", pool="qa", key="sc-7", role="qa2", machine="tolu-mac", at=ON_ZERO))
        store.record(self.db, [dict(work("qa", "qa:7"), pool="qa", story_id=7),
                               dict(work("qa", "qa:8"), pool="qa", story_id=8)], ON_ZERO)
        self.run_once()
        self.assertEqual(store.held_by(self.db, "qa", ON_ZERO)["story_id"], 8)
        self.assertEqual(self.remote.data(shared.claim_ref("qa", "sc-8"))["machine"], "here")

    def test_a_claim_github_refuses_gives_the_item_back_and_the_run_goes_on(self):
        store.record(self.db, [work("ops"), work("lead")], ON_ZERO)
        refused = github.GitHubError("Reference does not exist (HTTP 422)")
        with mock.patch("soirely_queue.shared.claim_item", side_effect=refused):
            self.run_once()
        self.assertEqual(self.platform.launched, [])
        self.assertIsNone(store.held_by(self.db, "ops", ON_ZERO))
        self.assertIsNone(store.held_by(self.db, "lead", ON_ZERO))
        self.assertTrue(any(line.startswith("error: lead: could not claim") for line in self.said))

    def test_work_with_no_story_is_claimed_by_its_kind(self):
        store.record(self.db, [dict(work("ops"), kind="main")], ON_ZERO)
        self.run_once()
        self.assertEqual(self.remote.data(shared.claim_ref("ops", "main"))["machine"], "here")

    def test_without_github_only_this_machines_own_ops_work_starts(self):
        self.run_once()
        store.record(self.db, [work("ops"), work("lead"), self.machine_work()], ON_ZERO)
        self.remote.list = mock.Mock(side_effect=RuntimeError("offline"))
        self.run_once(ON_ZERO + 3 * MINUTE)
        self.assertEqual([r for r, _, _ in self.platform.launched], ["ops"])
        self.assertEqual(store.held_by(self.db, "ops", ON_ZERO + 3 * MINUTE)["kind"], "machine")
        self.assertIn("lead: held back, offline", self.said)
        self.assertTrue(any(s.startswith("warning: could not reach the shared leases")
                            for s in self.said))

    def test_a_pause_everywhere_wakes_nobody_here(self):
        shared.pause_everywhere(self.remote, "tolu-mac", ON_ZERO)
        store.record(self.db, [work("ops")], ON_ZERO)
        self.run_once()
        self.assertEqual(self.platform.launched, [])
        self.assertIn("paused everywhere by tolu-mac", self.said[-1])

    def test_a_local_pause_keeps_this_machines_roles(self):
        self.run_once()
        store.set_meta(self.db, "paused", "now")
        self.run_once(ON_ZERO + 10 * MINUTE)
        self.assertEqual(self.remote.data(shared.role_ref("ops"))["machine"], "here")

    def test_a_dry_run_writes_nothing_shared(self):
        self.run_once(ON_ONE, dry_run=True)
        self.assertEqual(self.remote.refs, {})

    def test_one_machine_alone_takes_every_lease_and_wakes_as_before(self):
        store.record(self.db, [work("ops"), work("dev2"), work("lead")], ON_ZERO)
        self.run_once()
        self.run_once(ON_ONE)
        self.assertEqual(sorted(r for r, _, _ in self.platform.launched), ["dev2", "lead", "ops"])
        for role in ("ops", "dev2", "lead"):
            self.assertEqual(self.remote.data(shared.role_ref(role))["machine"], "here")
        self.assertFalse([s for s in self.said if "running on" in s or "held back" in s
                          or "standby" in s])

    def test_every_minute_writes_a_heartbeat_paused_or_not(self):
        self.config["roles"]["lead"] = {"standby": True}
        self.run_once()
        beat = self.remote.data(shared.machine_ref("here"))
        self.assertEqual((beat["at"], beat["started"], beat["standby"]),
                         (ON_ZERO, ["dev2", "lead", "ops"], ["lead"]))
        self.assertEqual(beat["listed"], ["dev2", "lead", "ops"])
        store.set_meta(self.db, "paused", "now")
        self.run_once(ON_ZERO + 3 * MINUTE)
        self.assertEqual(self.remote.data(shared.machine_ref("here"))["at"], ON_ZERO + 3 * MINUTE)

    def test_a_minute_that_stops_before_github_writes_no_heartbeat(self):
        with mock.patch.dict("os.environ", {"SHORTCUT_API_TOKEN": ""}):
            self.run_once()
        self.config.update(claudeVersion="2.1.300", onVersionDrift="stop")
        self.run_once(ON_ZERO + 3 * MINUTE)
        self.config.pop("claudeVersion")
        self.config["roles"]["qa9"] = {}
        self.run_once(ON_ZERO + 6 * MINUTE)
        self.assertEqual(self.remote.refs, {})

    def test_a_role_this_machine_refuses_gives_its_lease_back(self):
        self.run_once()
        self.assertIn(shared.role_ref("lead"), self.remote.refs)
        (self.root / "soirely-lead").rmdir()
        self.run_once(ON_ZERO + 3 * MINUTE)
        self.assertNotIn(shared.role_ref("lead"), self.remote.refs)
        self.assertIn(shared.role_ref("ops"), self.remote.refs)

    def test_a_machine_without_ops_listed_refuses_only_ops(self):
        del self.config["roles"]["ops"]
        store.record(self.db, [work("ops"), work("dev2")], ON_ZERO)
        self.run_once(ON_ONE)
        self.assertTrue(any(s.startswith("error: ops: not listed in") for s in self.said))
        self.assertEqual([r for r, _, _ in self.platform.launched], ["dev2"])
        runner.set_started(self.db, ["ops"], False)
        self.run_once(ON_ONE + 3 * MINUTE)
        self.assertTrue(any(s.startswith("refused: ops: not listed in") for s in self.said))

    def test_machine_work_is_never_claimed(self):
        store.record(self.db, [self.machine_work()], ON_ZERO)
        self.run_once()
        self.assertEqual([r for r, _, _ in self.platform.launched], ["ops"])
        self.assertFalse([ref for ref in self.remote.refs
                          if ref.startswith("refs/soirely/claims/")])

    def test_a_claim_lost_to_another_machine_gives_the_item_back(self):
        store.record(self.db, [dict(work("lead"), story_id=7)], ON_ZERO)
        with mock.patch("soirely_queue.shared.claim_item", return_value=False):
            self.run_once()
        self.assertEqual(self.platform.launched, [])
        self.assertIsNone(store.held_by(self.db, "lead", ON_ZERO))
        self.assertIn("lead: sc-7 was just taken on another machine", self.said)

    def test_every_hold_but_the_disk_stops_this_machines_own_ops_work(self):
        holds = {
            "budget": lambda: (self.config.update(dailyBudgetUsd=5),
                               runlog.append(self.home, "lead",
                                             {"at": runner.time.time(), "cost_usd": 6.5})),
            "pause": lambda: store.set_meta(self.db, "paused", "now"),
            "everywhere": lambda: shared.pause_everywhere(self.remote, "tolu-mac", ON_ZERO),
            "drift": lambda: self.config.update(claudeVersion="2.1.300", onVersionDrift="stop"),
        }
        for name, hold in holds.items():
            with self.subTest(name):
                self.setUp()
                hold()
                store.record(self.db, [self.machine_work()], ON_ZERO)
                self.run_once()
                self.assertEqual(self.platform.launched, [])

    def test_a_pause_everywhere_keeps_every_heartbeat_and_lease(self):
        self.run_once()
        shared.pause_everywhere(self.remote, "tolu-mac", ON_ZERO)
        self.run_once(ON_ZERO + 10 * MINUTE)
        self.assertEqual(self.remote.data(shared.machine_ref("here"))["at"], ON_ZERO + 10 * MINUTE)
        self.assertEqual(self.remote.data(shared.role_ref("dev2"))["machine"], "here")
        self.assertIn("paused everywhere by tolu-mac: sq resume --everywhere starts every "
                      "machine again", self.said)

class Command(unittest.TestCase):
    VALUES = {"model": "claude-opus-5-5", "effort": "medium"}

    def test_no_spending_ceiling_by_default(self):
        argv, env = runner.command(dict(self.VALUES, maxBudgetUsd=None), "~/.claude-soirely")
        self.assertNotIn("--max-budget-usd", argv)
        self.assertTrue(env["CLAUDE_CONFIG_DIR"].endswith(".claude-soirely"))

    def test_claudes_own_folder_runs_with_nothing_set(self):
        with tempfile.TemporaryDirectory() as folder, \
                mock.patch("soirely_queue.machine.CLAUDE_DEFAULT", pathlib.Path(folder)), \
                mock.patch.dict("os.environ", {"CLAUDE_CONFIG_DIR": "/elsewhere"}):
            _, env = runner.command(dict(self.VALUES, maxBudgetUsd=None), folder)
        self.assertNotIn("CLAUDE_CONFIG_DIR", env)

    def test_a_set_ceiling_is_passed_to_claude(self):
        argv, _ = runner.command(dict(self.VALUES, maxBudgetUsd=2.5), "~/.claude-soirely")
        self.assertEqual(argv[argv.index("--max-budget-usd") + 1], "2.5")

    def test_granted_and_denied_rules_go_on_the_command_line_only(self):
        argv, _ = runner.command(dict(self.VALUES, maxBudgetUsd=None), "~/.claude-soirely",
                                 ["Bash(xcrun simctl boot:*)"], ["Bash(just agents:*)"])
        self.assertEqual(argv[argv.index("--allowedTools") + 1], "Bash(xcrun simctl boot:*)")
        self.assertEqual(argv[argv.index("--disallowedTools") + 1], "Bash(just agents:*)")


class Worker(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        (self.root / "soirely-ops").mkdir()
        self.home = self.root / "home"
        self.db = store.connect(":memory:")
        store.record(self.db, [work("ops")], ON_ZERO)
        store.claim(self.db, "ops", ON_ZERO)
        self.platform = FakePlatform()

    def tearDown(self):
        self.folder.cleanup()

    def work_with(self, result, code=0, *later, ended=None):
        calls = []
        self.answers = []

        def claude(argv, input, cwd, env, finished):
            calls.append((argv, {"input": input, "cwd": cwd, "env": env,
                                 "run_dir_there": pathlib.Path(env["SQ_RUN_DIR"]).is_dir()}))
            self.answers.append(finished())
            store.finish(self.db, 1, "done")
            self.answers.append(finished())
            stream = [dict(event, type="result") for event in (result, *later)]
            return code, "".join(json.dumps(event) + "\n" for event in stream), "", ended

        entry = runner.worker(self.db, self.home, self.platform, "ops", 1, run_claude=claude,
                              load=lambda: config(self.root),
                              prepare=lambda *_: ("c" * 40, None), now=ON_ZERO)
        return entry, calls

    def test_a_worker_starts_with_its_roles_applied_rules_and_the_denied_list(self):
        applied = [{"rule": "Bash(docker system df:*)", "roles": ["ops"]},
                   {"rule": "Bash(maestro test:*)", "roles": ["qa"]},
                   {"rule": "Bash(just prune-build-cache)", "roles": ["all"]}]
        with mock.patch("soirely_queue.permissions.applied", return_value=applied):
            _, calls = self.work_with({"result": "ok"})
        argv = calls[0][0]
        granted = argv[argv.index("--allowedTools") + 1:argv.index("--disallowedTools")]
        self.assertEqual(granted, ["Bash(docker system df:*)", "Bash(just prune-build-cache)"])
        denied = argv[argv.index("--disallowedTools") + 1:]
        for rule in ("Bash(just agents:*)", "Bash(systemctl --user:*)", "Bash(launchctl:*)"):
            self.assertIn(rule, denied)
        self.assertIn(f"Edit(/{self.root / 'claude'}/**)", denied)

    def test_a_worker_with_nothing_applied_gets_no_allowed_tools(self):
        with mock.patch("soirely_queue.permissions.applied", return_value=[]):
            _, calls = self.work_with({"result": "ok"})
        self.assertNotIn("--allowedTools", calls[0][0])

    def test_the_run_is_recorded_with_its_cost(self):
        entry, calls = self.work_with({"total_cost_usd": 0.42, "num_turns": 9,
                                       "result": "Fixed the cache step."})
        argv, kwargs = calls[0]
        self.assertEqual(argv[:6], ["claude", "-p", "--model", "claude-opus-5-5", "--effort",
                                    "medium"])
        self.assertIn("origin/main at ccccccc", kwargs["input"])
        self.assertEqual(kwargs["cwd"], self.root / "soirely-ops")
        self.assertEqual(runlog.last(self.home, "ops")["cost_usd"], 0.42)
        self.assertEqual(runlog.last(self.home, "ops")["account"], "owner@example.test")
        self.assertEqual(kwargs["env"]["CLAUDE_CONFIG_DIR"], str(self.root / "claude"))
        self.assertEqual(self.platform.notes, [])

    def test_the_item_counts_as_finished_once_the_run_closes_it(self):
        self.work_with({"result": "Done."})
        self.assertEqual(self.answers, [False, True])

    def test_the_report_is_the_runs_own_answer_not_a_later_notice(self):
        # Both results as claude 2.1.310 wrote them, the second after a background sleep ended.
        own, notice = [json.loads(line) for line in
                       (FIXTURES / "background-task-results.jsonl").read_text().splitlines()]
        entry, _ = self.work_with(own, 0, notice, ended=["expo start --port 28081"])
        self.assertEqual(entry["report"], "started")
        self.assertEqual(entry["cost_usd"], notice["total_cost_usd"])
        self.assertEqual(entry["exit"], 0)
        self.assertEqual(entry["ended"], ["expo start --port 28081"])

    def test_a_report_waiting_on_the_owner_notifies(self):
        self.work_with({"result": "PR #280 is open.\nWaiting on the owner to merge #280."})
        self.assertEqual(self.platform.notes[0][0], "Soirely: ops needs you")
        self.assertEqual(store.get_meta(self.db, "owner:ops")["lines"],
                         ["Waiting on the owner to merge #280."])

    def test_the_run_gets_a_private_folder_that_is_removed_afterwards(self):
        _, calls = self.work_with({"result": "Done."})
        folder = pathlib.Path(calls[0][1]["env"]["SQ_RUN_DIR"])
        self.assertEqual(folder, runner.run_dir(self.home, "ops", 1))
        self.assertTrue(calls[0][1]["run_dir_there"])
        self.assertFalse(folder.exists())

    def test_a_further_worker_gets_a_folder_of_its_own(self):
        self.assertNotEqual(runner.run_dir(self.home, "dev", 1),
                            runner.run_dir(self.home, "dev-2", 1))

    def test_the_folder_is_removed_when_the_model_crashes(self):
        def claude(argv, input, cwd, env, finished):
            (pathlib.Path(env["SQ_RUN_DIR"]) / "check.out").write_text("partial")
            raise OSError("claude is not installed")

        with self.assertRaises(OSError):
            runner.worker(self.db, self.home, self.platform, "ops", 1, run_claude=claude,
                          load=lambda: config(self.root),
                          prepare=lambda *_: ("c" * 40, None), now=ON_ZERO)
        self.assertFalse(runner.run_dir(self.home, "ops", 1).exists())

    def test_a_worker_stopped_by_its_limit_has_its_folder_removed(self):
        folder = runner.run_dir(self.home, "ops", 1)
        folder.mkdir(parents=True)
        (folder / "check.out").write_text("half a log")
        with mock.patch.dict("os.environ", {"SERVICE_RESULT": "timeout"}):
            runner.worker_ended(self.home, self.platform, "ops", 1, now=ON_ZERO)
        self.assertFalse(folder.exists())

    def test_a_checkout_that_cannot_fetch_is_reported_and_runs_no_model(self):
        def unprepared(*_):
            raise checkout.Unprepared("git fetch failed 3 times: cannot lock ref")

        claude = mock.Mock()
        entry = runner.worker(self.db, self.home, self.platform, "ops", 1, run_claude=claude,
                              load=lambda: config(self.root), prepare=unprepared, now=ON_ZERO)
        claude.assert_not_called()
        self.assertIn("cannot lock ref", runlog.last(self.home, "ops")["report"])
        self.assertEqual(self.platform.notes[0], ("Soirely: ops's worker stopped",
                                                  entry["report"]))
        self.assertIsNone(runner.worker_ended(self.home, self.platform, "ops", 1))

    def lead_review(self, claude, pr=None):
        (self.root / "soirely-lead").mkdir()
        made = []

        def make(path, base, head, number, rules):
            made.append((path.name, base.name, head, number))
            self.rules = rules
            return review.place(path)

        if pr:
            store.put_pr(self.db, {"number": pr, "story_id": 1, "head_sha": "e" * 40})
        store.record(self.db, [dict(work("lead"), pr=pr)], ON_ZERO)
        item_id = store.waiting(self.db, "lead")[0]["id"]
        with mock.patch("soirely_queue.review.remove") as removed:
            try:
                runner.worker(self.db, self.home, self.platform, "lead-2", item_id,
                              run_claude=claude, load=lambda: config(self.root),
                              prepare=lambda *_: ("c" * 40, None), make_review=make,
                              now=ON_ZERO)
            finally:
                self.removed = [call.args[0].name for call in removed.call_args_list]
        return made

    def test_a_lead_review_runs_in_a_worktree_at_the_pull_requests_head(self):
        calls = []

        def claude(argv, input, cwd, env, finished):
            calls.append((input, cwd))
            return 0, json.dumps({"type": "result", "result": "Passed."}), "", None

        made = self.lead_review(claude, pr=40)
        self.assertEqual(made, [("soirely-lead-2", "soirely-lead", "e" * 40, 40)])
        self.assertEqual(self.rules, "c" * 40)
        self.assertEqual(calls[0][1], self.root / "soirely-lead-2-review")
        self.assertIn("#40's head eeeeeee", calls[0][0])
        self.assertEqual(self.removed, ["soirely-lead-2"])

    def test_a_lead_item_with_no_pull_request_reviews_at_main(self):
        made = self.lead_review(lambda *_: (0, "", "", None))
        self.assertEqual(made, [("soirely-lead-2", "soirely-lead", "c" * 40, None)])

    def test_the_review_worktree_goes_even_when_the_run_fails(self):
        def claude(*_):
            raise OSError("claude is not installed")

        with self.assertRaises(OSError):
            self.lead_review(claude, pr=40)
        self.assertEqual(self.removed, ["soirely-lead-2"])

    def test_a_lead_run_stopped_at_its_limit_takes_its_worktree_away(self):
        with mock.patch.dict("os.environ", {"SERVICE_RESULT": "timeout"}), \
                mock.patch("soirely_queue.review.remove") as removed:
            runner.worker_ended(self.home, self.platform, "lead-2", 1, now=ON_ZERO,
                                load=lambda: config(self.root))
        removed.assert_called_once_with(self.root / "soirely-lead-2")

    def test_a_worker_that_exits_with_an_error_says_its_status(self):
        with mock.patch.dict("os.environ", {"SERVICE_RESULT": "exit-code", "EXIT_STATUS": "1"}):
            entry = runner.worker_ended(self.home, self.platform, "ops", 1, now=ON_ZERO)
        self.assertEqual(entry["report"],
                         "the worker ended without a report: it exited with status 1")

    def test_a_worker_stopped_by_its_limit_leaves_a_record(self):
        with mock.patch.dict("os.environ", {"SERVICE_RESULT": "timeout"}):
            entry = runner.worker_ended(self.home, self.platform, "ops", 1, now=ON_ZERO)
        self.assertEqual(entry["report"], "the worker ended without a report: timeout")
        self.assertIsNone(runner.worker_ended(self.home, self.platform, "ops", 1))


FAKE_CLAUDE = textwrap.dedent("""
    import json, subprocess, sys, time
    sys.stdin.read()
    def result(text, **more):
        print(json.dumps(dict(type="result", result=text, **more)), flush=True)
    # As claude does, the background shell gets a session of its own.
    background = subprocess.Popen(["sleep", sys.argv[1]], start_new_session=True)
    result("Done, item closed.", total_cost_usd=1.0)
    background.wait()
    result("The background sleep ended.", total_cost_usd=1.1,
           origin={"kind": "task-notification"})
""")


class RunUntilDone(unittest.TestCase):
    """A stand-in for claude that answers, leaves a background process running, and stays up
    until it ends, as `claude -p` does."""

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.script = pathlib.Path(self.folder.name) / "claude.py"
        self.script.write_text(FAKE_CLAUDE)

    def tearDown(self):
        self.folder.cleanup()

    def run_fake(self, seconds, finished):
        started = time.monotonic()
        with mock.patch.object(runner, "SETTLE_SECONDS", 0):
            outcome = runner.run_until_done([sys.executable, str(self.script), seconds],
                                            "the prompt", self.folder.name, dict(os.environ),
                                            finished, poll=0.1)
        return outcome, time.monotonic() - started

    def test_a_done_run_is_ended_with_what_it_left_running(self):
        (code, stdout, _, ended), took = self.run_fake("307", lambda: True)
        self.assertLess(took, runner.STOP_GRACE_SECONDS)
        self.assertEqual(code, 0)
        self.assertEqual(ended, ["sleep 307"])
        self.assertEqual(runner.own_result([stdout])["result"], "Done, item closed.")
        self.assertNotIn("sleep 307",
                         [command for _, command in runner.process_table().values()])

    def test_a_run_whose_item_is_open_is_left_to_end_by_itself(self):
        (code, stdout, _, ended), _ = self.run_fake("1", lambda: False)
        self.assertEqual(code, 0)
        self.assertIsNone(ended)
        self.assertEqual([event["result"] for event in runner.results(stdout)],
                         ["Done, item closed.", "The background sleep ended."])
        self.assertEqual(runner.own_result([stdout])["result"], "Done, item closed.")

    def test_a_done_item_without_an_answer_yet_is_not_ended(self):
        calls = []

        def finished():
            calls.append(1)
            return True

        script = pathlib.Path(self.folder.name) / "quiet.py"
        script.write_text("import sys, time\nsys.stdin.read()\ntime.sleep(1)\n")
        with mock.patch.object(runner, "SETTLE_SECONDS", 0):
            code, _, _, ended = runner.run_until_done([sys.executable, str(script)], "",
                                                      self.folder.name, dict(os.environ),
                                                      finished, poll=0.1)
        self.assertEqual((code, ended, calls), (0, None, []))

    def test_a_process_that_escaped_with_the_pipes_does_not_hold_the_worker(self):
        pidfile = pathlib.Path(self.folder.name) / "orphan.pid"
        script = pathlib.Path(self.folder.name) / "escaped.py"
        script.write_text(textwrap.dedent(f"""
            import subprocess, sys
            sys.stdin.read()
            subprocess.run(["sh", "-c", "sleep 30 & echo $! > {pidfile}"])
            print('{{"type": "result", "result": "Done."}}', flush=True)
        """))
        started = time.monotonic()
        with mock.patch.object(runner, "READER_SECONDS", 0.5):
            code, stdout, _, _ = runner.run_until_done([sys.executable, str(script)], "",
                                                       self.folder.name, dict(os.environ),
                                                       lambda: False, poll=0.1)
        subprocess.run(["kill", pidfile.read_text().strip()])
        self.assertLess(time.monotonic() - started, 10)
        self.assertEqual((code, runner.own_result([stdout])["result"]), (0, "Done."))
