"""`sq run` and `sq worker`, against a fake platform: nothing here starts a unit or a model."""

import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock

from soirely_queue import checkout, runlog, runner, shared, store

from .fakes import FakeRefs

MINUTE = 60
ON_ZERO = 3 * MINUTE * 1000  # a minute whose offset is 0
ON_ONE = ON_ZERO + MINUTE


class FakePlatform:
    name = "fake"

    def __init__(self, active=(), fail=False):
        self.active = set(active)
        self.fail = fail
        self.launched = []
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

    def work_with(self, result, code=0):
        calls = []

        def claude(argv, **kwargs):
            calls.append((argv, kwargs))
            return subprocess.CompletedProcess(argv, code, json.dumps(result), "")

        entry = runner.worker(self.db, self.home, self.platform, "ops", 1, run_claude=claude,
                              load=lambda: config(self.root),
                              prepare=lambda *_: ("c" * 40, None), now=ON_ZERO)
        return entry, calls

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

    def test_a_report_waiting_on_the_owner_notifies(self):
        self.work_with({"result": "PR #280 is open.\nWaiting on the owner to merge #280."})
        self.assertEqual(self.platform.notes[0][0], "Soirely: ops needs you")
        self.assertEqual(store.get_meta(self.db, "owner:ops")["lines"],
                         ["Waiting on the owner to merge #280."])

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
