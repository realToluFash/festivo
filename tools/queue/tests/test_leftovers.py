import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

from soirely_queue import leftovers, runner, sessions, store

from .test_runner import ON_ZERO, FakePlatform, config, work


def orphan(run_dir, seconds):
    """A `sleep` left behind as on 2 Nov: started through a shell that exits at once, so its
    parent is no longer anything the run owns, and only the mark ties it to the run."""
    env = dict(os.environ, **{leftovers.MARK: str(run_dir)})
    subprocess.run(["sh", "-c", f"sleep {seconds} >/dev/null 2>&1 &"], env=env,
                   start_new_session=True, check=True)
    for _ in range(50):
        found = [pid for pid, folder in leftovers.marked().items() if folder == str(run_dir)]
        if found:
            return found
        time.sleep(0.1)
    raise AssertionError("the orphan never started")


def gradle_daemon(run_dir):
    """A stand-in for the Gradle daemon a QA run's build started and every later build shares."""
    env = dict(os.environ, **{leftovers.MARK: str(run_dir)})
    return subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)",
                             "org.gradle.launcher.daemon.bootstrap.GradleDaemon"], env=env,
                            start_new_session=True)


class Leftovers(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        (self.root / "soirely-ops").mkdir()
        self.home = self.root / "home"
        self.db = store.connect(":memory:")
        store.record(self.db, [work("ops")], ON_ZERO)
        store.claim(self.db, "ops", ON_ZERO)
        self.platform = FakePlatform()
        self.left = []

    def tearDown(self):
        leftovers.stop(self.left, sleep=lambda _: None)
        self.folder.cleanup()

    def test_a_process_the_session_left_running_is_gone_when_the_run_ends(self):
        def claude(argv, input, cwd, env, finished):
            self.left += orphan(env["SQ_RUN_DIR"], 3071)
            store.finish(self.db, 1, "done")
            return 0, json.dumps({"type": "result", "result": "Done."}) + "\n", "", None

        runner.worker(self.db, self.home, self.platform, "ops", 1, run_claude=claude,
                      load=lambda: config(self.root), prepare=lambda *_: ("c" * 40, None),
                      now=ON_ZERO)
        self.assertTrue(self.left)
        time.sleep(0.2)
        self.assertFalse([pid for pid in self.left if leftovers.alive(pid)
                          and pid in leftovers.marked()])

    def test_a_process_that_outlived_its_run_is_named_and_stopped_by_the_tick(self):
        gone = runner.run_dir(self.home, "dev-2", 22221738)
        self.left += orphan(gone, 3072)
        found = leftovers.ended(self.home)
        self.assertEqual([(f["pid"], f["worker"], f["item"]) for f in found],
                         [(pid, "dev-2", "22221738") for pid in self.left])
        self.assertIsInstance(found[0]["age"], int)
        said = []
        runner.stop_leftovers(self.db, self.home, self.platform, said.append, big=lambda: [])
        self.assertIn(f"pid {self.left[0]} from dev-2 item 22221738", said[0])
        self.assertEqual(self.platform.notes[0][0], "Soirely: a worker left a process running")
        self.assertEqual(leftovers.ended(self.home), [])

    def test_a_shared_server_the_run_started_outlives_it(self):
        scratch = runner.run_dir(self.home, "qa", 5)
        daemon = gradle_daemon(scratch)
        self.addCleanup(daemon.wait)
        self.addCleanup(daemon.kill)
        self.left += orphan(scratch, 3074)
        self.assertEqual(sorted(runner.leftovers.stop_run(scratch, sleep=lambda _: None)),
                         sorted(self.left))
        self.assertEqual(leftovers.ended(self.home), [])
        self.assertIsNone(daemon.poll())

    def test_a_background_run_stopped_at_its_limit_ends_what_it_started(self):
        tasks = self.root / "tmp" / "-home-x-soirely-ops" / "s-bg" / "tasks"
        tasks.mkdir(parents=True)
        self.left += orphan(runner.run_dir(self.home, "ops", 1), 3075)
        sessions.begin(self.db, "ops", {"at": ON_ZERO, "item": 1, "role": "ops",
                                        "session": "s-bg", "bg": "b1",
                                        "folder": str(self.root / "claude")})
        with mock.patch.dict("os.environ", {"SERVICE_RESULT": "timeout"}), \
                mock.patch("soirely_queue.background.stop") as stopped, \
                mock.patch.object(leftovers, "temp_roots", return_value=[str(self.root / "tmp")]):
            runner.worker_ended(self.home, self.platform, "ops", 1, now=ON_ZERO, db=self.db)
        stopped.assert_called_once()
        self.assertFalse(tasks.exists())
        time.sleep(0.2)
        self.assertFalse([pid for pid in self.left if pid in leftovers.marked()])

    def test_the_tick_tells_ops_once_of_task_output_past_the_limit(self):
        big = lambda: [("/tmp/claude-1/p/s/tasks/b1.output", 3 << 30)]
        said = []
        for _ in range(2):
            runner.stop_leftovers(self.db, self.home, self.platform, said.append,
                                  find=lambda _: [], big=big)
        self.assertEqual(len(said), 2)
        self.assertEqual([n[0] for n in self.platform.notes],
                         ["Soirely: a task's output is past 1 GB"])

    def test_a_running_run_is_not_a_leftover(self):
        live = runner.run_dir(self.home, "ops", 1)
        live.mkdir(parents=True)
        self.left += orphan(live, 3073)
        self.assertEqual(leftovers.ended(self.home), [])

    def test_the_sessions_task_output_goes_with_the_run(self):
        tasks = self.root / "tmp" / "-home-x-soirely-dev2" / "s-1" / "tasks"
        tasks.mkdir(parents=True)
        (tasks / "b1.output").write_text("side.txt: No such file")
        scratch = runner.run_dir(self.home, "dev-2", 7)
        scratch.mkdir(parents=True)
        with mock.patch.object(leftovers, "temp_roots", return_value=[str(self.root / "tmp")]):
            runner.end_run(scratch, "s-1", stop=lambda _: [])
        self.assertFalse(tasks.exists())
        self.assertFalse(scratch.exists())

    def test_task_output_past_the_limit_is_flagged(self):
        tasks = self.root / "tmp" / "project" / "s-2" / "tasks"
        tasks.mkdir(parents=True)
        (tasks / "big.output").write_bytes(b"x" * 11)
        (tasks / "small.output").write_bytes(b"x" * 3)
        self.assertEqual(leftovers.oversized([str(self.root / "tmp")], limit=10),
                         [(str(tasks / "big.output"), 11)])

    def test_ages_read_every_shape_of_etime(self):
        out = "  1 05:07\n  2 01:00:00\n  3 2-00:00:01\n"
        run = lambda *a, **k: subprocess.CompletedProcess(a, 0, stdout=out)
        self.assertEqual(leftovers.ages(run), {1: 307, 2: 3600, 3: 172801})

    def test_the_mac_reads_the_mark_from_ps(self):
        out = f"  41 sleep 9 HOME=/u {leftovers.MARK}=/h/scratch/qa-5 PATH=/bin\n  42 zsh\n"
        run = lambda *a, **k: subprocess.CompletedProcess(a, 0, stdout=out)
        self.assertEqual(leftovers.marked("darwin", run=run), {41: "/h/scratch/qa-5"})


if __name__ == "__main__":
    unittest.main()
