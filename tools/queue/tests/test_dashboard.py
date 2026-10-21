"""`sq web`: the snapshot it serves, and the page and JSON it answers with."""

import json
import pathlib
import tempfile
import threading
import time
import unittest
import urllib.request
from unittest import mock

from soirely_queue import dashboard, runlog, store

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
