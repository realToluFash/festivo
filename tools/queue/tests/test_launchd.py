"""The Mac runner. launchd is never called; the supervisor and a detached worker run for
real, since they need only POSIX."""

import json
import os
import pathlib
import plistlib
import signal
import sys
import tempfile
import time
import unittest
from unittest import mock

from soirely_queue import launchd, machine

PYTHON = sys.executable


def script(code):
    return [PYTHON, "-c", code]


class Agent(unittest.TestCase):
    def test_the_agent_runs_sq_every_minute(self):
        with mock.patch("shutil.which", return_value=None):
            made = launchd.agent("/q/sq/sq", "/usr/bin/python3")
        self.assertEqual(made["ProgramArguments"], ["/usr/bin/python3", "/q/sq/sq", "run"])
        self.assertEqual(made["StartInterval"], 60)
        self.assertIn("/opt/homebrew/bin", made["EnvironmentVariables"]["PATH"])

    def test_the_token_is_read_from_the_file_never_written_into_the_agent(self):
        with mock.patch.dict("os.environ", {"SHORTCUT_API_TOKEN": "secret-value"}):
            made = plistlib.dumps(launchd.agent("/q/sq/sq", "python3"))
        self.assertNotIn(b"secret-value", made)

    def test_the_agent_runs_the_python3_on_its_path_when_that_is_this_python(self):
        with tempfile.TemporaryDirectory() as folder:
            versioned = pathlib.Path(folder) / "python3.14"
            versioned.write_text("")
            stable = pathlib.Path(folder) / "python3"
            stable.symlink_to(versioned)
            with mock.patch("shutil.which", return_value=str(stable)):
                self.assertEqual(launchd.stable_python(versioned), str(stable))
                self.assertEqual(launchd.stable_python("/elsewhere/python3"),
                                 "/elsewhere/python3")

    def test_sizes_read_as_systemd_reads_them(self):
        self.assertEqual(launchd.size_bytes("3G"), 3 * 1024 ** 3)
        self.assertEqual(launchd.size_bytes("512M"), 512 * 1024 ** 2)
        self.assertIsNone(launchd.size_bytes(None))


class Supervise(unittest.TestCase):
    def test_a_worker_that_finishes_is_a_success_or_its_exit_code(self):
        self.assertEqual(launchd.supervise(script("pass"), 60, None, poll=0.01), ("success", 0))
        self.assertEqual(launchd.supervise(script("raise SystemExit(3)"), 60, None, poll=0.01),
                         ("exit-code", 3))

    def test_a_worker_past_its_time_is_stopped_with_everything_it_started(self):
        with tempfile.TemporaryDirectory() as folder:
            mark = pathlib.Path(folder) / "child"
            code = (f"import subprocess, sys, time; p = subprocess.Popen([sys.executable, '-c', "
                    f"'import time; time.sleep(30)']); open({str(mark)!r}, 'w').write(str(p.pid));"
                    f" time.sleep(30)")
            started = time.monotonic()
            result, _ = launchd.supervise(script(code), 0.5, None, poll=0.05)
            self.assertEqual(result, "timeout")
            self.assertLess(time.monotonic() - started, 10)
            grandchild = int(mark.read_text())
        time.sleep(0.2)
        with self.assertRaises(ProcessLookupError):
            os.kill(grandchild, 0)

    def test_a_worker_over_its_memory_is_stopped(self):
        result, _ = launchd.supervise(script("import time; time.sleep(30)"), 60, 3 * 1024 ** 3,
                                      poll=0.05, rss=lambda pgid: 4 * 1024 ** 3)
        self.assertEqual(result, "oom-kill")

    def test_a_supervisor_told_to_stop_stops_its_worker(self):
        def sleep(seconds):
            os.kill(os.getpid(), signal.SIGTERM)
            time.sleep(0.01)
        result, _ = launchd.supervise(script("import time; time.sleep(30)"), 60, None,
                                      poll=0.05, sleep=sleep)
        self.assertEqual(result, "stopped")


class Mac(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = pathlib.Path(self.folder.name)
        for name, value in (("log_dir", self.root / "logs"),
                            ("agent_path", self.root / "LaunchAgents" / "routine.plist"),
                            ("web_agent_path", self.root / "LaunchAgents" / "web.plist")):
            patch = mock.patch.object(launchd, name, return_value=value)
            patch.start()
            self.addCleanup(patch.stop)
        config = mock.patch.dict("os.environ", {"SOIRELY_CONFIG": str(self.root)})
        config.start()
        self.addCleanup(config.stop)
        self.mac = launchd.Mac(self.root / "roles")

    def configure(self, **settings):
        (self.root / "agents.json").write_text(json.dumps(settings))

    def test_the_agent_is_written_once_and_kept_while_it_matches(self):
        with mock.patch.object(launchd.Mac, "loaded", return_value=False):
            self.assertTrue(self.mac.install("/q/sq/sq", "/c/env", "python3"))
            self.assertFalse(self.mac.install("/q/sq/sq", "/c/env", "python3"))
        made = plistlib.loads(launchd.agent_path().read_bytes())
        self.assertEqual(made["Label"], "com.soirely.routine")

    def test_a_long_log_is_set_aside(self):
        (self.root / "logs").mkdir()
        (self.root / "logs" / "routine.log").write_bytes(b"x" * (launchd.LOG_LIMIT_BYTES + 1))
        with mock.patch.object(launchd.Mac, "loaded", return_value=False):
            self.mac.install("/q/sq/sq", "/c/env", "python3")
        self.assertTrue((self.root / "logs" / "routine.log.1").exists())

    def test_a_tick_that_changes_its_agent_reloads_it_only_after_the_run(self):
        with mock.patch.object(launchd.Mac, "loaded", return_value=True), \
                mock.patch.dict("os.environ", {"SOIRELY_TICK": "1"}), \
                mock.patch("subprocess.Popen") as popen, mock.patch("subprocess.run") as run:
            self.assertTrue(self.mac.install("/q/sq/sq", "/c/env", "python3"))
            popen.assert_not_called()
            run.assert_not_called()
            self.mac.after_run()
            self.mac.after_run()
        popen.assert_called_once()
        self.assertIn("bootstrap", popen.call_args.args[0][-1])

    def test_an_agent_changed_by_hand_is_reloaded_at_once(self):
        with mock.patch.object(launchd.Mac, "loaded", return_value=True), \
                mock.patch.dict("os.environ"), mock.patch("subprocess.Popen") as popen, \
                mock.patch("subprocess.run") as run:
            os.environ.pop("SOIRELY_TICK", None)
            self.mac.install("/q/sq/sq", "/c/env", "python3")
            self.mac.after_run()
        popen.assert_not_called()
        self.assertIn("bootstrap", run.call_args.args[0][-1])

    def test_with_web_set_its_page_is_kept_running_on_that_address(self):
        self.configure(web={"listen": "0.0.0.0", "port": 8766})
        with mock.patch.object(launchd.Mac, "loaded", return_value=False), \
                mock.patch("subprocess.run") as run:
            run.return_value.returncode = 0
            self.mac.install("/q/sq/sq", "/c/env", "python3")
            calls = [c.args[0][1] for c in run.call_args_list]
            run.reset_mock()
            self.assertFalse(self.mac.install("/q/sq/sq", "/c/env", "python3"))
        self.assertEqual(calls, ["bootout", "bootstrap"])
        self.assertEqual([c.args[0][1] for c in run.call_args_list], ["print"])
        made = plistlib.loads(launchd.web_agent_path().read_bytes())
        self.assertEqual(made["ProgramArguments"][1:],
                         ["/q/sq/sq", "web", "--no-open", "--listen", "0.0.0.0", "--port", "8766"])
        self.assertTrue(made["KeepAlive"])

    def test_a_web_agent_that_stopped_is_started_again(self):
        self.configure(web={})
        with mock.patch.object(launchd.Mac, "loaded", return_value=False), \
                mock.patch("subprocess.run") as run:
            run.return_value.returncode = 0
            self.mac.install("/q/sq/sq", "/c/env", "python3")
            run.reset_mock()
            run.return_value.returncode = 113
            self.mac.install("/q/sq/sq", "/c/env", "python3")
        self.assertEqual([c.args[0][1] for c in run.call_args_list], ["print", "bootstrap"])

    def test_without_web_the_agent_is_taken_away(self):
        self.configure(web={})
        with mock.patch.object(launchd.Mac, "loaded", return_value=False), \
                mock.patch("subprocess.run") as run:
            run.return_value.returncode = 0
            self.mac.install("/q/sq/sq", "/c/env", "python3")
            self.configure()
            run.reset_mock()
            self.assertTrue(self.mac.install("/q/sq/sq", "/c/env", "python3"))
        self.assertEqual([c.args[0][1] for c in run.call_args_list], ["bootout"])
        self.assertFalse(launchd.web_agent_path().exists())

    def test_down_unloads_the_agent_and_keeps_it_off_at_the_next_login(self):
        with mock.patch("subprocess.run") as run:
            self.mac.disable()
        calls = [c.args[0][1] for c in run.call_args_list]
        self.assertEqual(calls, ["bootout", "disable"])

    def test_a_worker_outlives_its_launch_and_is_stopped_on_request(self):
        sq = self.root / "sq"
        sq.write_text("import sys, time\nassert sys.argv[1] == 'worker-supervise'\n"
                      "time.sleep(30)\n")
        values = {"maxRuntimeMinutes": 90, "memoryMax": "3G"}
        self.mac.launch("qa", 41, values, sq, PYTHON, self.root, self.root / "env")
        self.addCleanup(self.mac.stop_workers, 5)
        self.assertTrue(self.mac.worker_active("qa"))
        pid = int(self.mac.pidfile("qa").read_text())
        self.assertEqual(os.getpgid(pid), pid)
        self.mac.stop_workers(5)
        self.assertFalse(self.mac.worker_active("qa"))
        self.assertTrue((self.root / "logs" / "worker-qa.log").exists())

    def test_a_stale_pidfile_is_no_worker(self):
        self.mac.pidfile("qa").parent.mkdir(parents=True)
        self.mac.pidfile("qa").write_text(str(os.getpid()))
        self.assertFalse(self.mac.worker_active("qa"))

    def test_a_notification_passes_its_text_as_arguments_never_as_script(self):
        with mock.patch("subprocess.run") as run:
            self.mac.notify("Soirely", 'dev2 said "stop"')
        argv = run.call_args.args[0]
        self.assertEqual(argv[0], "osascript")
        self.assertEqual(argv[-2:], ["Soirely", 'dev2 said "stop"'])


class EnvFile(unittest.TestCase):
    def test_the_env_file_fills_only_what_is_missing(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / "env"
            path.write_text("# token\nexport SHORTCUT_API_TOKEN='abc'\nGH_HOST=github.com\n"
                            "KEEP=file\n")
            with mock.patch.dict("os.environ", {"KEEP": "shell"}, clear=False):
                os.environ.pop("SHORTCUT_API_TOKEN", None)
                machine.load_env(path)
                self.assertEqual(os.environ["SHORTCUT_API_TOKEN"], "abc")
                self.assertEqual(os.environ["KEEP"], "shell")
                self.assertEqual(os.environ["GH_HOST"], "github.com")


class SuperviseCommand(unittest.TestCase):
    def test_the_supervisor_records_how_its_worker_ended_and_clears_its_pidfile(self):
        from soirely_queue import cli, runlog
        with tempfile.TemporaryDirectory() as folder:
            home = pathlib.Path(folder)
            with mock.patch.dict("os.environ", {"SQ_HOME": folder}), \
                    mock.patch("sys.platform", "darwin"), \
                    mock.patch.object(machine, "load_env"), \
                    mock.patch.object(launchd, "supervise", return_value=("oom-kill", -9)), \
                    mock.patch.object(launchd.Mac, "notify") as notify:
                pidfile = launchd.Mac(home).pidfile("qa")
                pidfile.parent.mkdir()
                pidfile.write_text(str(os.getpid()))
                cli.main(["worker-supervise", "qa", "41", "--minutes", "90", "--memory", "8G"])
            entry = runlog.entries(home, "qa")[-1]
            self.assertEqual((entry["item"], entry["stopped"]), (41, "oom-kill"))
            notify.assert_called_once()
            self.assertFalse(pidfile.exists())


class RunCommand(unittest.TestCase):
    def test_the_platform_finishes_after_the_run_even_when_it_fails(self):
        from soirely_queue import cli
        platform = mock.Mock()
        with mock.patch.object(cli, "this_platform", return_value=platform), \
                mock.patch.object(cli, "open_db"), mock.patch.object(machine, "load_env"), \
                mock.patch.object(cli.runner, "run", side_effect=RuntimeError("sync")):
            with self.assertRaises(RuntimeError):
                cli.admin(["run"])
        platform.after_run.assert_called_once()

    def test_status_reaches_the_status_report(self):
        from soirely_queue import cli
        with mock.patch.object(cli, "this_platform"), mock.patch.object(cli, "open_db"), \
                mock.patch.object(machine, "load_env"), mock.patch.object(cli, "status") as report:
            cli.admin(["status"])
        report.assert_called_once()
