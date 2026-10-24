"""ops@<machine>: what each machine checks for itself, and the work it becomes."""

import unittest

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

    def test_sizes_read_as_docker_prints_them(self):
        self.assertEqual(local.gigabytes("12.5GB"), 12.5)
        self.assertEqual(local.gigabytes("800MB"), 0.8)
        self.assertEqual(local.gigabytes("0B"), 0.0)
