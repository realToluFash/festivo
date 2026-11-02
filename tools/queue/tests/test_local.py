"""ops@<machine>: what each machine checks for itself, and the work it becomes."""

import os
import pathlib
import subprocess
import tempfile
import time
import unittest
import urllib.error
from unittest import mock

from soirely_queue import cli, local, store, work

DAY = 24 * 60 * 60


class Checks(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")
        self.config = {"machine": "tolu-linux", "minFreeGb": 15}

    def found(self, now=DAY * 10, free=100.0, cache=1.0):
        return local.checks(self.db, self.config, now, cache=lambda: cache, free=lambda c: free,
                            largest=lambda c, start: "soirely-qa3 16.0 GB")

    def items(self):
        return work.machine_items(store.get_meta(self.db, "machine_checks"))

    def test_a_quiet_machine_gets_only_its_daily_sweep(self):
        self.found()
        self.assertEqual([(i["kind"], i["pool"], i["roles"]) for i in self.items()],
                         [("machine", "ops@tolu-linux", ["ops"])])
        self.assertIn("daily sweep of tolu-linux", self.items()[0]["reason"])

    def test_a_low_disk_and_a_large_build_cache_each_wake_ops_here(self):
        self.found(free=4.0, cache=40.0)
        reasons = [i["reason"] for i in self.items()]
        self.assertIn("only 4 GB free on tolu-linux", reasons[0])
        self.assertIn("build cache is 40 GB", reasons[1])
        self.assertEqual([i["priority"] for i in self.items()][:2], [work.PULL_REQUEST] * 2)

    def test_docker_is_asked_at_most_every_half_hour(self):
        asked = []
        local.checks(self.db, self.config, DAY, cache=lambda: asked.append(1) or 1.0,
                     free=lambda c: 100.0)
        local.checks(self.db, self.config, DAY + 600, cache=lambda: asked.append(1) or 1.0,
                     free=lambda c: 100.0)
        self.assertEqual(len(asked), 1)

    def test_one_finding_wakes_ops_once_a_day(self):
        self.found(free=4.0)
        today = {i["fingerprint"] for i in self.items()}
        self.found(now=DAY * 10 + 3600, free=4.0)
        self.assertEqual({i["fingerprint"] for i in self.items()}, today)
        self.found(now=DAY * 11, free=4.0)
        self.assertFalse(today & {i["fingerprint"] for i in self.items()})

    def test_urgent_findings_come_before_the_sweep_and_go_once_cleared(self):
        self.found(free=4.0, cache=40.0)
        self.assertIn("just prune-build-cache", self.items()[1]["reason"])
        self.assertIn("daily sweep", self.items()[-1]["reason"])
        self.assertLess(self.items()[0]["priority"], self.items()[-1]["priority"])
        self.found(now=DAY * 10 + 60, free=100.0)
        self.assertFalse([i for i in self.items() if "GB free" in i["reason"]])

    def test_a_falling_disk_names_the_largest_folders_before_the_floor(self):
        self.found(free=25.0, cache=1.0)
        falling = [i for i in self.items() if "twice minFreeGb" in i["reason"]]
        self.assertEqual(len(falling), 1)
        self.assertNotEqual(falling[0]["priority"], work.PULL_REQUEST)

    def test_the_largest_folders_are_measured_once_a_day(self):
        asked = []
        for now in (DAY * 10, DAY * 10 + 60):
            local.checks(self.db, self.config, now, cache=lambda: 1.0, free=lambda c: 25.0,
                         largest=lambda c, start: asked.append(start) or "soirely-qa3 16.0 GB")
        self.assertEqual(asked, [True])
        self.assertIn("soirely-qa3 16.0 GB", self.items()[0]["reason"])

    def stored_falling(self):
        return [row["reason"] for row in self.db.execute("select reason from work")
                if "twice minFreeGb" in row["reason"]]

    def test_ops_is_woken_with_the_folders_once_the_measure_has_finished(self):
        answers, asked = [None, None, "soirely-qa3 16.0 GB"], []
        for minute in range(4):
            now = DAY * 10 + 60 * minute
            local.checks(self.db, self.config, now, cache=lambda: 1.0, free=lambda c: 25.0,
                         largest=lambda c, start: asked.append(start) or answers.pop(0))
            cli.refresh_work(self.db, now)
            if minute < 2:
                self.assertEqual(self.stored_falling(), [])
        self.assertEqual(asked, [True, False, False])
        self.assertEqual(len(self.stored_falling()), 1)
        self.assertIn("soirely-qa3 16.0 GB", self.stored_falling()[0])

    def test_a_measure_that_never_finishes_wakes_ops_saying_so(self):
        for now in (DAY * 10, DAY * 10 + local.MEASURE_SECONDS):
            local.checks(self.db, self.config, now, cache=lambda: 1.0, free=lambda c: 25.0,
                         largest=lambda c, start: None)
            cli.refresh_work(self.db, now)
        self.assertEqual(len(self.stored_falling()), 1)
        self.assertIn("du still running after 30 minutes", self.stored_falling()[0])

    def test_a_dry_run_measures_nothing(self):
        local.checks(self.db, self.config, DAY * 10, cache=lambda: 1.0, free=lambda c: 25.0,
                     largest=lambda c, start: self.fail("measured"), dry_run=True)
        self.assertFalse([i for i in self.items() if "twice minFreeGb" in i["reason"]])

    def test_a_disk_under_the_floor_is_urgent_and_not_also_falling(self):
        self.found(free=4.0)
        self.assertFalse([i for i in self.items() if "twice minFreeGb" in i["reason"]])

    def test_sizes_read_as_docker_prints_them(self):
        self.assertEqual(local.gigabytes("12.5GB"), 12.5)
        self.assertEqual(local.gigabytes("800MB"), 0.8)
        self.assertEqual(local.gigabytes("0B"), 0.0)


class Stack(unittest.TestCase):
    def setUp(self):
        self.place = tempfile.TemporaryDirectory()
        self.addCleanup(self.place.cleanup)
        for name, value in (("load", {}), ("checkout", pathlib.Path(self.place.name))):
            patcher = mock.patch(f"soirely_queue.machine.{name}", return_value=value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def compose(self, **result):
        return mock.patch("soirely_queue.local.subprocess.run", **result)

    def test_docker_that_hangs_is_a_stack_that_cannot_be_tested(self):
        with self.compose(side_effect=subprocess.TimeoutExpired("docker", 30)):
            self.assertIn("Docker did not answer", local.stack_problem("qa2"))

    def test_an_api_not_running_is_named(self):
        with self.compose(return_value=subprocess.CompletedProcess([], 1, "", "no such service")):
            self.assertIn("api service", local.stack_problem("qa2"))

    def test_an_api_that_refuses_its_port_is_named(self):
        running = subprocess.CompletedProcess([], 0, "0.0.0.0:28080\n", "")
        with self.compose(return_value=running), \
                mock.patch("soirely_queue.local.urllib.request.urlopen",
                           side_effect=ConnectionRefusedError("refused")):
            self.assertIn("port 28080 does not answer", local.stack_problem("qa2"))

    def test_a_stack_whose_api_answers_is_fine(self):
        running = subprocess.CompletedProcess([], 0, "0.0.0.0:28080\n", "")
        reply = mock.MagicMock()
        reply.__enter__.return_value.status = 200
        with self.compose(return_value=running), \
                mock.patch("soirely_queue.local.urllib.request.urlopen", return_value=reply):
            self.assertIsNone(local.stack_problem("qa2"))

    def test_an_api_that_answers_unhealthy_is_named(self):
        running = subprocess.CompletedProcess([], 0, "0.0.0.0:28080\n", "")
        unhealthy = urllib.error.HTTPError("http://x", 503, "Service Unavailable", {}, None)
        with self.compose(return_value=running), \
                mock.patch("soirely_queue.local.urllib.request.urlopen", side_effect=unhealthy):
            self.assertIn("port 28080 answers 503", local.stack_problem("qa2"))

    def test_docker_missing_from_path_is_named(self):
        with self.compose(side_effect=FileNotFoundError("docker")):
            self.assertIn("not on PATH", local.stack_problem("qa2"))

    def test_a_role_with_no_checkout_here_is_not_checked(self):
        with mock.patch("soirely_queue.machine.checkout", return_value=None):
            self.assertIsNone(local.stack_problem("qa2"))


class Scratch(unittest.TestCase):
    NOW = DAY * 100

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = pathlib.Path(self.folder.name)
        self.config = {"machine": "tolu-linux", "workspace": str(self.root)}
        self.db = store.connect(":memory:")
        self.said = []

    def entry(self, name, days, size=2_000_000, tester="qa3"):
        path = self.root / f"soirely-{tester}" / ".qa" / name
        path.mkdir(parents=True, exist_ok=True)
        inside = path / "shot.png"
        inside.write_bytes(b"x" * size)
        at = self.NOW - days * DAY
        os.utime(inside, (at, at))
        os.utime(path, (at, at))
        return path

    def sweep(self, now=None):
        local.sweep_scratch(self.db, self.config, now or self.NOW, self.said.append)

    def test_a_large_entry_untouched_for_three_days_goes(self):
        old, recent = self.entry("s10118", 4), self.entry("s10200", 1)
        self.sweep()
        self.assertFalse(old.exists())
        self.assertTrue(recent.exists())

    def test_one_recent_file_keeps_its_whole_entry(self):
        old = self.entry("s10118", 10)
        fresh = old / "new.png"
        fresh.write_bytes(b"x")
        os.utime(fresh, (self.NOW - DAY, self.NOW - DAY))
        self.sweep()
        self.assertTrue(old.exists())

    def test_a_small_entry_is_kept_for_fourteen_days(self):
        week, month = self.entry("report-1", 7, size=10), self.entry("report-2", 15, size=10)
        self.sweep()
        self.assertTrue(week.exists())
        self.assertFalse(month.exists())

    def test_a_story_still_in_qa_under_that_tester_keeps_its_entries(self):
        store.put_story(self.db, {"id": 10118, "state": "In QA", "done": False,
                                  "comments": [{"text": "QA claim: qa3"}]})
        mine, theirs = self.entry("sc10118", 30), self.entry("sc10118", 30, tester="qa2")
        self.sweep()
        self.assertTrue(mine.exists())
        self.assertFalse(theirs.exists())

    def test_untracked_before_main_is_never_swept(self):
        kept = self.entry("untracked-before-main-20261001", 60)
        self.sweep()
        self.assertTrue(kept.exists())

    def test_the_harness_and_its_state_are_never_swept(self):
        kept = [self.entry(name, 60) for name in ("bin", "state.json", ".batch")]
        self.sweep()
        self.assertTrue(all(path.exists() for path in kept))

    def test_an_old_release_folder_keeps_the_record_of_what_is_installed(self):
        release = self.entry("release", 30)
        record = release / "installed"
        record.write_text("com.soirely.app")
        os.utime(record, (self.NOW - 30 * DAY, self.NOW - 30 * DAY))
        self.sweep()
        self.assertTrue(record.exists())
        self.assertFalse((release / "shot.png").exists())

    def test_a_sweep_that_frees_space_says_how_much_and_where(self):
        self.entry("s10118", 4, size=3_000_000)
        self.entry("s10119", 1, tester="qa")
        self.sweep()
        self.assertEqual(len(self.said), 1)
        self.assertIn("swept 3 MB", self.said[0])
        self.assertIn("soirely-qa3/.qa", self.said[0])

    def test_it_sweeps_once_a_day(self):
        self.sweep()
        old = self.entry("s10118", 4)
        self.sweep(self.NOW + 3600)
        self.assertTrue(old.exists())
        self.sweep(self.NOW + DAY)
        self.assertFalse(old.exists())

    def test_the_largest_folders_come_largest_first_then_the_devices(self):
        for name, size in (("soirely-qa2", 3), ("soirely-qa3", 9), ("soirely-ops", 1),
                           ("soirely-dev2", 4), ("soirely-dev3", 5), ("soirely-l10n", 2)):
            self.entry("s1", 0, size=size * 100_000, tester=name.split("-")[1])
        elsewhere = tempfile.TemporaryDirectory()
        self.addCleanup(elsewhere.cleanup)
        home = pathlib.Path(elsewhere.name)
        for device in local.DEVICES:
            folder = pathlib.Path(device.replace("~", str(home)))
            folder.mkdir(parents=True)
            (folder / "disk.img").write_bytes(b"x" * 900_000)
        out = self.root / "largest-folders"
        with mock.patch.dict(os.environ, {"HOME": str(home)}):
            self.assertIsNone(local.largest_folders(self.config, True, out))
            for _ in range(200):
                if out.exists():
                    break
                time.sleep(0.05)
            named = local.largest_folders(self.config, False, out).split(", ")
        self.assertEqual([n.split()[0].rsplit("/", 1)[-1] for n in named],
                         ["soirely-qa3", "soirely-dev3", "soirely-dev2", "soirely-qa2",
                          "soirely-l10n", "Devices", "avd"])

    def test_a_machine_without_testers_sweeps_nothing(self):
        (self.root / "soirely-ops").mkdir()
        self.sweep()
        self.assertEqual(self.said, [])
