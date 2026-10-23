"""`just agents up | down`, against a fake platform and a temporary workspace."""

import pathlib
import shutil
import subprocess
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

    def test_status_reaches_the_status_report(self):
        from soirely_queue import cli
        with mock.patch.object(cli, "status") as report, mock.patch("sys.stdout"):
            cli.admin(["status"])
        report.assert_called_once()

    def test_status_says_how_long_ago_in_the_largest_unit(self):
        from soirely_queue import cli
        self.assertEqual([cli.ago(s) for s in (49, 73, 2 * 3600 + 5, 3 * 86400, -4)],
                         ["49s ago", "1m ago", "2h ago", "3d ago", "0s ago"])

    def test_status_cuts_a_long_line_to_the_terminal(self):
        from soirely_queue import cli
        self.assertEqual(cli.clip("abcdef", 4), "abc…")
        self.assertEqual(cli.clip("abc", 4), "abc")


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


class Checkouts(unittest.TestCase):
    """Against real git, in a temporary folder: a pretend origin and its clone."""

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        root = pathlib.Path(self.folder.name)
        self.git("init", "-q", "-b", "main", str(root / "origin"))
        self.git("-C", str(root / "origin"), "-c", "user.name=t", "-c", "user.email=t@t",
                 "commit", "-q", "--allow-empty", "-m", "start")
        self.git("clone", "-q", str(root / "origin"), str(root / "festivo"))
        self.home = root / "festivo" / ".git" / "soirely-roles"
        self.config = config(root, roles={"qa2": {}})
        self.said = []

    def git(self, *args):
        subprocess.run(["git", *args], check=True, capture_output=True)

    def test_a_checkout_deleted_by_hand_is_made_again(self):
        path = pathlib.Path(self.folder.name) / "soirely-qa2"
        agents.make_checkout(self.config, "qa2", self.said.append, self.home)
        self.assertTrue((path / ".git").exists())
        shutil.rmtree(path)
        agents.make_checkout(self.config, "qa2", self.said.append, self.home)
        self.assertTrue((path / ".git").exists())
        self.assertFalse([line for line in self.said if "could not" in line])

    def test_a_checkout_git_refuses_is_said_not_raised(self):
        with mock.patch("soirely_queue.agents.subprocess.run",
                        side_effect=[mock.Mock(returncode=0), mock.Mock(returncode=0),
                                     mock.Mock(returncode=128, stderr="fatal: no\n")]):
            agents.make_checkout(self.config, "qa2", self.said.append, self.home)
        self.assertIn("could not create", self.said[-1])
        self.assertIn("fatal: no", self.said[-1])


class Stacks(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = pathlib.Path(self.folder.name)
        for name in ("soirely-dev2", "soirely-qa2"):
            (self.root / name).mkdir()
        (self.root / "soirely-dev2" / ".env").write_text("COMPOSE_PROJECT_NAME=soirely-dev2\n")
        self.config = config(self.root, roles={"dev2": {}, "qa2": {}, "dev": {}})
        self.said = []
        for patch in (mock.patch.object(agents, "REPO", self.root / "festivo"),
                      mock.patch.object(agents, "role_stacks", return_value=["dev2", "lead"])):
            patch.start()
            self.addCleanup(patch.stop)

    def make(self, role, running, setup_exit=0):
        def run(command, **_):
            if command[:2] == ["docker", "compose"]:
                return mock.Mock(returncode=0, stdout="abc\n" if running else "")
            return mock.Mock(returncode=setup_exit)
        with mock.patch("soirely_queue.agents.subprocess.run", side_effect=run) as calls:
            agents.make_stack(self.config, role, self.said.append)
        return [c.args[0] for c in calls.call_args_list if c.args[0][0] == "node"]

    def test_a_running_stack_is_left_alone(self):
        self.assertEqual(self.make("dev2", running=True), [])

    def test_a_stack_that_never_came_up_is_made_on_the_next_setup(self):
        self.assertEqual(self.make("dev2", running=False),
                         [["node", "scripts/dev-env.mjs", "setup", "--role", "dev2"]])

    def test_a_tester_s_stack_is_made_by_qa_env(self):
        self.assertEqual(self.make("qa2", running=False),
                         [["node", "scripts/qa-env.mjs", "setup", "--tester", "2"]])

    def test_a_role_with_no_stack_of_its_own_gets_none(self):
        self.assertEqual(self.make("dev", running=False), [])

    def test_a_stack_that_fails_is_said_and_setup_goes_on(self):
        self.make("dev2", running=False, setup_exit=1)
        self.assertIn("did not come up (exit 1)", self.said[-1])


class StartStacks(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        root = pathlib.Path(self.folder.name)
        for name, project in (("soirely-dev2", "soirely-dev2"), ("soirely-ops", "soirely-ops")):
            (root / name).mkdir()
            (root / name / ".env").write_text(f"COMPOSE_PROJECT_NAME={project}\n")
        (root / "soirely-lead").mkdir()
        self.config = config(root, roles={"dev2": {}, "ops": {}, "lead": {}})
        self.said = []

    def test_up_starts_each_stack_down_stopped_and_leaves_the_rest(self):
        def run(command, **_):
            running = command[3] == "soirely-ops" and command[4] == "ps"
            return mock.Mock(returncode=0, stdout="abc\n" if running else "", stderr="")
        with mock.patch("soirely_queue.agents.subprocess.run", side_effect=run) as calls:
            agents.start_stacks(self.config, ["dev2", "ops", "lead"], self.said.append)
        ups = [c.args[0] for c in calls.call_args_list if "up" in c.args[0]]
        self.assertEqual(ups, [["docker", "compose", "-p", "soirely-dev2", "up", "-d"]])
        self.assertEqual(self.said, ["started stack soirely-dev2"])
