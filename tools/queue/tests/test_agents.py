"""`just agents up | down`, against a fake platform and a temporary workspace."""

import pathlib
import tempfile
import unittest
from unittest import mock

from soirely_queue import agents, runner, store

from tests.test_runner import FakePlatform, config, login, work


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


class StartStop(unittest.TestCase):
    """Through `sq start` and `sq stop` themselves, as the owner and the skill run them."""

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        for name in ("festivo", "soirely-ops", "soirely-dev2"):
            (self.root / name).mkdir()
        self.db = store.connect(":memory:")
        self.platform = FakePlatform()
        settings = config(self.root, roles={"ops": {}, "dev2": {}, "lead": {}})
        for patch in (mock.patch("soirely_queue.machine.load", return_value=settings),
                      mock.patch("soirely_queue.cli.open_db", return_value=self.db),
                      mock.patch("soirely_queue.cli.home", return_value=self.root / "home"),
                      mock.patch("soirely_queue.cli.this_platform", return_value=self.platform),
                      mock.patch("soirely_queue.machine.load_env"),
                      mock.patch("soirely_queue.update.check", return_value=False)):
            patch.start()
            self.addCleanup(patch.stop)

    def tearDown(self):
        self.folder.cleanup()

    def sq(self, *argv):
        from soirely_queue import cli
        with mock.patch("sys.stdout"), self.assertRaises(SystemExit) as ended:
            cli.admin(list(argv))
        return ended.exception.code

    def test_start_sets_and_stop_clears_the_started_flag(self):
        self.assertEqual(self.sq("start", "ops", "dev2"), 0)
        self.assertEqual(runner.started(self.db), {"ops", "dev2"})
        self.assertTrue(self.platform.enabled)
        self.assertEqual(self.sq("stop", "dev2"), 0)
        self.assertEqual(runner.started(self.db), {"ops"})

    def test_all_starts_every_ready_role(self):
        self.assertEqual(self.sq("start", "--all"), 1)  # lead has no checkout
        self.assertEqual(runner.started(self.db), {"ops", "dev2"})

    def test_a_role_this_machine_does_not_list_is_refused(self):
        self.assertEqual(self.sq("start", "qa"), 1)
        self.assertEqual(self.sq("stop", "qa"), 1)
        self.assertEqual(runner.started(self.db), set())
        self.assertFalse(hasattr(self.platform, "enabled"))

    def test_a_worker_cannot_stop_pause_or_start_the_roles(self):
        self.sq("start", "ops")
        with mock.patch.dict("os.environ", {"SOIRELY_WORKER": "dev2"}):
            for argv in (("stop", "ops"), ("pause",), ("resume",), ("start", "dev2"),
                         ("run",), ("agents", "down", "--now")):
                self.assertEqual(self.sq(*argv), 1, argv)
        self.assertEqual(runner.started(self.db), {"ops"})
        self.assertIsNone(store.get_meta(self.db, "paused"))

    def test_a_listed_role_that_cannot_run_is_not_started(self):
        self.assertEqual(self.sq("start", "lead"), 1)
        self.assertEqual(runner.started(self.db), set())


class Accounts(unittest.TestCase):
    def test_setup_makes_each_folder_copies_settings_and_names_the_login(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            settings = config(root, roles={"ops": {}, "dev2": {
                "claudeConfigDir": str(root / "claude-b")}})
            (root / "claude" / "settings.json").write_text('{"permissions": {}}')
            said = []
            agents.accounts(settings, said.append)
            self.assertEqual((root / "claude-b" / "settings.json").read_text(),
                             '{"permissions": {}}')
            self.assertIn(f"  {root / 'claude'}: owner@example.test for ops", said)
            self.assertTrue(any(line.startswith(f"  {root / 'claude-b'}: not logged in")
                                and "for dev2" in line for line in said))

    def test_a_later_setup_names_a_folder_whose_settings_drifted(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            settings = config(root, roles={"ops": {}, "dev2": {
                "claudeConfigDir": str(root / "claude-b")}})
            (root / "claude" / "settings.json").write_text('{"permissions": {}}')
            agents.accounts(settings, lambda line: None)
            (root / "claude" / "settings.json").write_text('{"permissions": {"deny": ["x"]}}')
            said = []
            agents.accounts(settings, said.append)
            self.assertTrue(any("claude-b" in line and "differs" in line and "dev2" in line
                                for line in said))
            self.assertEqual((root / "claude-b" / "settings.json").read_text(),
                             '{"permissions": {}}')
