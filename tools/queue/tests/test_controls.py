"""Pause, resume, start and stop, as `sq web` asks for them."""

import json
import pathlib
import tempfile
import unittest
from unittest import mock

from soirely_queue import controls, github, runner, shared, store

from tests.fakes import FakeRefs
from tests.test_runner import FakePlatform, config

NOW = 1_000_000


class Act(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = pathlib.Path(self.folder.name)
        for name in ("festivo", "soirely-ops", "soirely-dev2"):
            (self.root / name).mkdir()
        self.home = self.root / "home"
        self.db = store.connect(":memory:")
        self.platform = FakePlatform()
        self.platform.timer_active = lambda: True
        self.platform.enable = mock.Mock()
        self.settings = config(self.root, machine="tolu-linux",
                               roles={"ops": {}, "dev2": {}, "lead": {}})
        self.refs = FakeRefs()
        for patch in (mock.patch("soirely_queue.machine.load", return_value=self.settings),
                      mock.patch("soirely_queue.agents.start_stacks")):
            patch.start()
            self.addCleanup(patch.stop)

    def act(self, action, role=None, refs=None):
        return controls.act(self.db, self.home, self.platform, action, role, by="192.168.1.20",
                            refs=lambda: refs or self.refs, load=lambda: self.settings, now=NOW)

    def logged(self):
        path = self.home / "runs" / f"{controls.LOG}.jsonl"
        return [json.loads(line) for line in path.read_text().splitlines()]

    def test_a_pause_and_a_resume_say_what_sq_pause_and_sq_resume_say(self):
        self.assertEqual(self.act("pause"),
                         (200, {"said": "paused: no role ticks, running workers finish their "
                                        "item"}))
        self.assertTrue(runner.paused(self.db))
        self.assertEqual(self.act("resume"), (200, {"said": "resumed"}))
        self.assertIsNone(runner.paused(self.db))

    def test_resuming_one_machine_says_every_machine_is_still_paused(self):
        store.set_meta(self.db, "shared_view", {"paused": {"machine": "tolu-mac"}})
        self.assertEqual(self.act("resume")[1]["said"],
                         "resumed; every machine is still paused by tolu-mac: "
                         "sq resume --everywhere")

    def test_a_pause_everywhere_is_shared_and_shown_here_at_once(self):
        status, said = self.act("pause-everywhere")
        self.assertEqual(status, 200)
        self.assertIn("paused every machine", said["said"])
        self.assertEqual(self.refs.data(shared.PAUSE)["machine"], "tolu-linux")
        self.assertEqual(store.get_meta(self.db, "shared_view")["paused"],
                         {"machine": "tolu-linux", "at": NOW})
        self.assertEqual(self.act("pause-everywhere")[1],
                         {"said": "every machine was already paused"})
        self.assertEqual(self.act("resume-everywhere")[0], 200)
        self.assertIsNone(self.refs.data(shared.PAUSE))
        self.assertIsNone(store.get_meta(self.db, "shared_view")["paused"])

    def test_github_out_of_reach_is_a_bad_gateway_and_changes_nothing_here(self):
        refs = mock.Mock()
        refs.create.side_effect = github.GitHubError("gh api: could not resolve host")
        status, said = self.act("pause-everywhere", refs=refs)
        self.assertEqual(status, 502)
        self.assertIn("could not resolve host", said["error"])
        self.assertIsNone(store.get_meta(self.db, "shared_view"))

    def test_a_role_is_started_and_stopped_as_sq_start_and_sq_stop_do(self):
        status, said = self.act("start", "dev2")
        self.assertEqual((status, said["said"]),
                         (200, "started dev2; the first tick is within a minute"))
        self.assertEqual(runner.started(self.db), {"dev2"})
        self.assertEqual(self.act("stop", "dev2"),
                         (200, {"said": "stopped dev2; a running worker finishes its item"}))
        self.assertEqual(runner.started(self.db), set())

    def test_a_start_from_the_page_leaves_the_manager_and_a_pause_as_they_are(self):
        store.set_meta(self.db, "paused", "24 Nov 10:00")
        with mock.patch("soirely_queue.update.check") as update:
            said = self.act("start", "ops")[1]["said"]
        self.assertEqual(said, "started ops; it ticks once this machine is resumed")
        self.assertEqual(self.platform.installed, 0)
        self.platform.enable.assert_not_called()
        update.assert_not_called()
        self.assertTrue(runner.paused(self.db))

    def test_a_start_while_every_machine_is_paused_says_so_after_this_machines_own_pause(self):
        store.set_meta(self.db, "shared_view", {"paused": {"machine": "tolu-mac"}})
        self.assertEqual(self.act("start", "ops")[1]["said"],
                         "started ops; it ticks once every machine is resumed")
        store.set_meta(self.db, "paused", "24 Nov 10:00")
        self.assertEqual(self.act("start", "dev2")[1]["said"],
                         "started dev2; it ticks once this machine is resumed")

    def test_a_start_says_so_when_the_manager_is_not_running(self):
        self.platform.timer_active = lambda: False
        self.assertEqual(self.act("start", "ops")[1]["said"],
                         "started ops; the manager is not running here: just agents up")

    def test_a_role_not_listed_or_not_ready_is_refused_with_sqs_own_error(self):
        status, said = self.act("start", "qa")
        self.assertEqual(status, 409)
        self.assertTrue(said["error"].startswith("error: qa not in "))
        status, said = self.act("start", "lead")
        self.assertEqual(status, 409)
        self.assertTrue(said["error"].startswith("error: lead is refused here: "))
        self.assertEqual(self.act("stop", "qa")[0], 409)
        self.assertEqual(runner.started(self.db), set())

    def test_an_unknown_control_or_a_missing_or_stray_role_is_refused(self):
        self.assertEqual(self.act("down")[0], 404)
        self.assertEqual(self.act("start"), (400, {"error": "start needs a role"}))
        self.assertEqual(self.act("pause", "ops"), (400, {"error": "pause takes no role"}))
        self.assertFalse((self.home / "runs" / f"{controls.LOG}.jsonl").exists())

    def test_each_control_is_logged_with_the_address_it_came_from(self):
        self.act("stop", "ops")
        self.act("start", "qa")
        self.assertEqual(
            [(e["action"], e["role"], e["from"], e["failed"]) for e in self.logged()],
            [("stop", "ops", "192.168.1.20", False), ("start", "qa", "192.168.1.20", True)])
        self.assertEqual(self.logged()[0]["at"], NOW)
