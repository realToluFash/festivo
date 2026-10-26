"""ops@<machine>: what each machine checks for itself, and the work it becomes."""

import pathlib
import subprocess
import tempfile
import unittest
import urllib.error
from unittest import mock

from soirely_queue import local, store, work

DAY = 24 * 60 * 60


class Checks(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")
        self.config = {"machine": "tolu-linux", "minFreeGb": 15}

    def found(self, now=DAY * 10, free=100.0, cache=1.0):
        return local.checks(self.db, self.config, now, cache=lambda: cache, free=lambda c: free)

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
