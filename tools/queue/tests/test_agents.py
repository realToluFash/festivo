"""`just agents up | down`, against a fake platform and a temporary workspace."""

import pathlib
import tempfile
import unittest
from unittest import mock

from soirely_queue import agents, runner, store

from tests.test_runner import FakePlatform, config, work


class Down(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        for name in ("festivo", "soirely-ops", "soirely-dev2", "soirely-lead"):
            (self.root / name).mkdir()
        (self.root / "soirely-dev2" / ".env").write_text("COMPOSE_PROJECT_NAME=soirely-dev2\n")
        (self.root / "festivo" / ".env").write_text("COMPOSE_PROJECT_NAME=soirely\n")
        self.db = store.connect(":memory:")
        self.platform = FakePlatform()
        self.platform.disabled = self.platform.stopped = False
        self.platform.disable = lambda: setattr(self.platform, "disabled", True)
        self.platform.stop_workers = lambda: setattr(self.platform, "stopped", True)
        self.said = []
        settings = config(self.root, roles={"ops": {}, "dev2": {}, "dev": {}})
        patch = mock.patch("soirely_queue.machine.load", return_value=settings)
        patch.start()
        self.addCleanup(patch.stop)

    def tearDown(self):
        self.folder.cleanup()

    def down(self, now=False):
        with mock.patch("subprocess.run") as run:
            agents.down(self.db, self.root, self.platform, self.said.append, now=now,
                        sleep=lambda _: None)
        return [call.args[0] for call in run.call_args_list]

    def test_down_stops_the_manager_gives_work_back_and_keeps_volumes(self):
        runner.set_started(self.db, ["ops", "dev2"], True)
        store.record(self.db, [work("dev2")])
        store.claim(self.db, "dev2")
        commands = self.down(now=True)
        self.assertTrue(self.platform.disabled and self.platform.stopped)
        self.assertEqual(runner.started(self.db), set())
        self.assertFalse(store.held_by(self.db, "dev2"))
        self.assertIn(["docker", "compose", "-p", "soirely-dev2", "down"], commands)
        self.assertFalse([c for c in commands if "-v" in c or "--volumes" in c])

    def test_developer_1_stopping_the_owners_stack_is_said_out_loud(self):
        self.down(now=True)
        self.assertIn("dev shares the owner's own stack, soirely; stopping it", self.said)

    def test_down_waits_for_a_running_worker_before_stopping_it(self):
        self.platform.active.add("ops")
        self.down()
        self.assertTrue(self.platform.stopped)
        self.assertTrue(self.said[1].startswith("waiting for ops to finish"))
