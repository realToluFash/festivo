"""The unattended drawing: a background session per story, settled by the manager."""

import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock

from soirely_queue import drawing, runlog, store

from tests.test_runner import FakePlatform, config

NOW = 1_000_000.0
VALUES = {"model": "claude-opus-5-5", "effort": "medium", "maxRuntime": "90m"}


class FakeClaude:
    def __init__(self):
        self.calls = []
        self.states = {}
        self.refuse = None

    def __call__(self, argv, **kwargs):
        self.calls.append((argv, kwargs))
        out = ""
        if argv[1] == "--bg":
            out = self.refuse or "backgrounded · ab12cd34 · draw\n"
        elif argv[1] == "agents":
            out = json.dumps([{"id": i, "kind": "background", "state": s}
                              for i, s in self.states.items()])
        return subprocess.CompletedProcess(argv, 0, out, "")

    def commands(self):
        return [argv[1] for argv, _ in self.calls]


class Tick(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        self.home = self.root / "home"
        self.db = store.connect(":memory:")
        self.config = config(self.root)
        self.platform = FakePlatform()
        self.claude = FakeClaude()
        self.said = []
        for patch in (mock.patch("soirely_queue.permissions.applied", return_value=[]),
                      mock.patch("soirely_queue.permissions.denied", return_value=[])):
            patch.start()
            self.addCleanup(patch.stop)

    def tearDown(self):
        self.folder.cleanup()

    def tick(self, now=NOW):
        drawing.tick(self.db, self.home, self.config, VALUES, self.platform, now,
                     self.said.append, self.claude)

    def test_the_oldest_story_on_the_list_starts_a_background_session(self):
        store.add_drawing(self.db, 7, "Calendar", "/soirely-designer Draw sc-7.", NOW - 60)
        store.add_drawing(self.db, 9, "Seats", "/soirely-designer Draw sc-9.", NOW)
        self.tick()
        argv, kwargs = self.claude.calls[0]
        self.assertEqual(argv[:5], ["claude", "--bg", "--name", "draw sc-7", "--model"])
        self.assertTrue(argv[-1].startswith("/soirely-designer Draw sc-7."))
        self.assertIn("run `sq ux drawn sc-7`", argv[-1])
        self.assertEqual(kwargs["cwd"], self.root / "soirely-ux")
        self.assertEqual(kwargs["env"]["SOIRELY_WORKER"], "ux-draw")
        self.assertEqual(store.get_meta(self.db, "drawing")["session"], "ab12cd34")

    def test_a_running_session_is_left_alone(self):
        store.add_drawing(self.db, 7, "Calendar", "p", NOW)
        self.tick()
        self.claude.states = {"ab12cd34": "working"}
        self.tick(NOW + 60)
        self.assertEqual(self.claude.commands(), ["--bg", "agents"])
        self.assertIn("ux-draw: drawing sc-7", self.said)

    def test_a_drawn_story_stops_and_removes_its_session_and_the_next_starts(self):
        store.add_drawing(self.db, 7, "Calendar", "p", NOW)
        store.add_drawing(self.db, 9, "Seats", "p", NOW + 1)
        self.tick()
        store.drop_drawing(self.db, 7)
        self.claude.states = {"ab12cd34": "idle"}
        self.tick(NOW + 600)
        self.assertEqual(self.claude.commands(), ["--bg", "agents", "stop", "rm"])
        self.assertEqual(runlog.last(self.home, "ux")["report"], "drew sc-7")
        self.tick(NOW + 660)
        self.assertEqual(self.claude.calls[-1][0][3], "draw sc-9")

    def test_a_session_that_ends_without_drawing_is_kept_and_tried_twice_at_most(self):
        store.add_drawing(self.db, 7, "Calendar", "p", NOW)
        for attempt in range(2):
            self.tick(NOW + attempt * 120)
            self.claude.states = {"ab12cd34": "idle"}
            self.tick(NOW + attempt * 120 + 60)
        self.assertNotIn("rm", self.claude.commands())
        self.assertEqual(self.platform.notes[-1][0], "Soirely: a drawing failed twice")
        self.claude.calls.clear()
        self.tick(NOW + 600)
        self.assertEqual(self.claude.calls, [])

    def test_a_session_past_its_time_limit_is_stopped(self):
        store.add_drawing(self.db, 7, "Calendar", "p", NOW)
        self.tick()
        self.claude.states = {"ab12cd34": "working"}
        self.tick(NOW + 91 * 60)
        self.assertIn("ux-draw: sc-7: stopped at its time limit", self.said)

    def test_a_blocked_session_tells_the_owner_once(self):
        store.add_drawing(self.db, 7, "Calendar", "p", NOW)
        self.tick()
        self.claude.states = {"ab12cd34": "blocked"}
        self.tick(NOW + 60)
        self.tick(NOW + 120)
        self.assertEqual([n[0] for n in self.platform.notes], ["Soirely: a drawing waits for you"])
        self.assertIn("ux-draw: sc-7 waits for you, claude attach ab12cd34", self.said)

    def test_an_untrusted_checkout_says_how_to_trust_it(self):
        store.add_drawing(self.db, 7, "Calendar", "p", NOW)
        self.claude.refuse = "Workspace not trusted. Run `claude` once."
        self.tick()
        self.assertIn("accept the trust prompt", self.said[-1])
        self.assertIsNone(store.get_meta(self.db, "drawing"))
