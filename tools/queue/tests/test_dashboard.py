"""`sq web`: the snapshot it serves, and the page and JSON it answers with."""

import io
import json
import pathlib
import tempfile
import threading
import time
import unittest
import urllib.request
from contextlib import redirect_stdout
from unittest import mock

from soirely_queue import dashboard, runlog, runner, store

from tests.test_runner import FakePlatform, config, work

NOW = 1_000_000


class Snapshot(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        for name in ("festivo", "soirely-ops", "soirely-dev2"):
            (self.root / name).mkdir()
        self.home = self.root / "home"
        self.db = store.connect(":memory:")
        self.platform = FakePlatform()
        self.platform.timer_active = lambda: True
        self.settings = config(self.root, roles={"ops": {}, "dev2": {"wakeEvery": "1m"}})
        for patch in (mock.patch("soirely_queue.machine.free_gb", return_value=40),
                      mock.patch("soirely_queue.permissions.pending", return_value=[])):
            patch.start()
            self.addCleanup(patch.stop)

    def tearDown(self):
        self.folder.cleanup()

    def snap(self):
        return dashboard.snapshot(self.db, self.platform, NOW, self.home,
                                  load=lambda: self.settings)

    def test_each_role_shows_its_state_last_run_and_next_items(self):
        store.record(self.db, [work("ops"), work("dev2")], NOW)
        store.claim(self.db, "dev2", NOW)
        self.platform.active.add("ops")
        runlog.append(self.home, "ops", {"at": NOW - 60, "role": "ops", "item": 9,
                                         "cost_usd": 0.25, "exit": 0, "duration_ms": 42000,
                                         "report": "Fixed the cache step.\nMore."})
        view = self.snap()
        roles = {r["role"]: r for r in view["roles"]}
        self.assertEqual(roles["ops"]["state"], "running")
        self.assertEqual(roles["ops"]["last"]["report"], "Fixed the cache step.")
        self.assertEqual(roles["ops"]["last"]["seconds"], 42)
        self.assertEqual(roles["ops"]["next"][0]["reason"], "[ops] on sc-1")
        self.assertEqual(roles["dev2"]["state"], "busy")
        self.assertEqual(roles["dev2"]["wake_every"], "1m")
        self.assertEqual(view["recent"][0]["role"], "ops")
        self.assertEqual((view["machine"], view["free_gb"], view["manager"]), ("here", 40, True))

    def test_each_role_and_its_runs_name_the_account_it_runs_on(self):
        runlog.append(self.home, "ops", {"at": NOW, "role": "ops", "exit": 0, "report": "done"})
        with mock.patch("soirely_queue.machine.account",
                        side_effect=lambda folder: "ops@example.com"):
            view = self.snap()
        self.assertEqual({r["account"] for r in view["roles"]}, {"ops@example.com"})
        self.assertEqual(view["recent"][0]["account"], "ops@example.com")

    def test_the_stories_to_draw_are_listed_with_their_prompts(self):
        store.add_drawing(self.db, 7, "Calendar", "/soirely-designer Draw sc-7", NOW)
        self.assertEqual(self.snap()["drawings"],
                         [{"story_id": 7, "name": "Calendar",
                           "prompt": "/soirely-designer Draw sc-7", "at": NOW}])

    def test_the_story_being_drawn_shows_its_session_and_tries(self):
        store.set_meta(self.db, "drawing", {"story_id": 7, "session": "ab12cd34", "at": NOW,
                                            "state": "blocked"})
        store.set_meta(self.db, "draw_tries", {"9": 1})
        self.assertEqual(self.snap()["drawing"],
                         {"current": {"story_id": 7, "session": "ab12cd34", "at": NOW,
                                      "state": "blocked"},
                          "tries": {"9": 1}, "max_tries": 2})

    def test_a_role_with_several_workers_shows_what_each_works_on(self):
        (self.root / "soirely-pm").mkdir()
        self.settings["roles"]["pm"] = {"workers": 3}
        store.record(self.db, [dict(work("pm", f), story_id=n) for n, f in enumerate("abc")],
                     NOW)
        store.claim(self.db, "pm", NOW, worker="pm", workers=3)
        store.claim(self.db, "pm", NOW, worker="pm-3", workers=3)
        pm = next(r for r in self.snap()["roles"] if r["role"] == "pm")
        self.assertEqual([h["worker"] for h in pm["holding"]], ["pm", "pm-3"])
        ops = next(r for r in self.snap()["roles"] if r["role"] == "ops")
        self.assertEqual(ops["holding"], [])

    def test_a_run_names_the_worker_that_made_it(self):
        runlog.append(self.home, "ux", {"at": NOW, "role": "ux", "worker": "ux-draw",
                                        "exit": 0, "report": "drew sc-7"})
        self.assertEqual(self.snap()["recent"][0]["worker"], "ux-draw")

    def test_a_role_this_machine_does_not_run_is_listed_with_its_queue(self):
        store.record(self.db, [work("qa")], NOW)
        view = self.snap()
        self.assertEqual([(r["role"], r["waiting"]) for r in view["elsewhere"]], [("qa", 1)])

    def test_other_machines_their_roles_and_what_they_hold_are_shown(self):
        store.set_meta(self.db, "shared_view", {
            "elsewhere": {"dev2": ["tolu-mac", 40]}, "conflicts": [["dev2", "tolu-mac"]],
            "paused": {"machine": "tolu-mac"},
            "machines": {"tolu-mac": {"seen": 40, "started": ["dev2", "ops"]}}})
        runner.set_started(self.db, ["ops", "dev2"], True)
        view = self.snap()
        roles = {r["role"]: r for r in view["roles"]}
        self.assertEqual((roles["dev2"]["state"], roles["dev2"]["detail"]),
                         ("elsewhere", {"machine": "tolu-mac", "seen": 40}))
        self.assertEqual(view["machines"],
                         [{"name": "tolu-mac", "seen": 40, "started": ["dev2", "ops"]}])
        self.assertIn("paused everywhere by tolu-mac: sq resume --everywhere", view["warnings"])
        self.assertIn("dev2 is listed here and on tolu-mac, and neither marks it standby; only "
                      "one runs it", view["warnings"])

    def test_status_says_which_machine_runs_a_role_and_when_it_was_seen(self):
        from soirely_queue import cli
        store.set_meta(self.db, "shared_view", {"elsewhere": {"dev2": ["tolu-mac", 40]}})
        runner.set_started(self.db, ["ops", "dev2"], True)
        view, out = self.snap(), io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=view), \
                mock.patch.object(cli, "home", return_value=self.home), redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        self.assertIn("  dev2  on tolu-mac, seen 40s ago", out.getvalue())

    def test_status_prints_other_machines_each_warning_and_the_ops_refusal(self):
        from soirely_queue import cli
        self.settings["roles"] = {"dev2": {}}
        store.set_meta(self.db, "shared_view", {
            "conflicts": [["dev2", "tolu-mac"]], "paused": {"machine": "tolu-mac"},
            "machines": {"tolu-mac": {"seen": 40, "started": ["dev2", "ops"]}}})
        with mock.patch("soirely_queue.permissions.pending", return_value=["+ a", "- b"]):
            view = self.snap()
        out = io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=view), \
                mock.patch.object(cli, "home", return_value=self.home), \
                mock.patch.object(cli.shutil, "get_terminal_size",
                                  return_value=cli.os.terminal_size((1000, 50))), \
                redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        lines = out.getvalue().splitlines()
        for line in ("warning: paused everywhere by tolu-mac: sq resume --everywhere",
                     "warning: dev2 is listed here and on tolu-mac, and neither marks it "
                     "standby; only one runs it",
                     "warning: permissions: main grants 2 change(s) this machine has not "
                     "applied: just agents permissions apply",
                     "other machines",
                     "  tolu-mac  seen 40s ago   dev2, ops"):
            self.assertIn(line, lines)
        # The rest of the line is sc-13674's bug, which its own test pins.
        refusal = (f"  ops   refused: not listed in {cli.machine.path()}: every machine runs "
                   "ops, for its own disk, Docker, stacks and manager")
        self.assertTrue(any(line.startswith(refusal) for line in lines), lines)

    def test_rules_main_grants_and_this_machine_has_not_applied_are_a_warning(self):
        with mock.patch("soirely_queue.permissions.pending", return_value=["+ a", "- b"]):
            warnings = self.snap()["warnings"]
        self.assertIn("permissions: main grants 2 change(s) this machine has not applied: "
                      "just agents permissions apply", warnings)

    def test_a_failed_run_is_marked(self):
        runlog.append(self.home, "ops", {"at": NOW, "role": "ops", "exit": "1",
                                         "stopped": "exit-code", "report": "ended"})
        self.assertTrue(self.snap()["recent"][0]["failed"])

    def test_seven_days_of_spend_end_today(self):
        days = dashboard.spend(self.home, 7)
        self.assertEqual(len(days), 7)
        self.assertEqual(days[-1]["day"], time.strftime("%Y-%m-%d"))


class Serve(unittest.TestCase):
    def test_the_page_and_its_json_are_served_on_this_machine_only(self):
        said = []
        reads = []
        server_ready = threading.Event()

        def say(line):
            said.append(line)
            server_ready.set()

        thread = threading.Thread(target=dashboard.serve, daemon=True,
                                  args=(lambda now: reads.append(now) or {"machine": "here"}, 0),
                                  kwargs={"open_page": False, "say": say})
        thread.start()
        self.assertTrue(server_ready.wait(5))
        url = said[0].split()[2]
        self.assertTrue(url.startswith("http://127.0.0.1:"))
        with urllib.request.urlopen(url + "status.json") as answer:
            self.assertEqual(json.load(answer), {"machine": "here"})
        with urllib.request.urlopen(url) as answer:
            self.assertIn("<title>Soirely agents</title>", answer.read().decode())
        self.assertEqual(len(reads), 1)
