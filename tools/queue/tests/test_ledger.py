import unittest

from soirely_queue import store
from soirely_queue.ledger import Printer

NOW = 1_000_000.0


class Ledger(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")

    def read(self, role="qa", always=False, version="v1", now=NOW, again=False):
        p = Printer(self.db, role, again=again, now=now)
        p.block("story:1:section:AC", version, ["full AC"], "## AC", always=always)
        p.block("story:1:section:AC", version, ["full AC"], "## AC", always=always)
        p.save()
        return p.lines

    def test_a_run_prints_a_thing_once(self):
        self.assertEqual(self.read(), ["full AC", "## AC (shown above)"])

    def test_a_later_run_gets_a_reference_to_what_it_read(self):
        self.read()
        later = NOW + 3 * 3600
        self.assertEqual(self.read(now=later)[0][:28], "## AC (unchanged since you r")

    def test_what_the_work_needs_is_printed_every_run(self):
        self.read(always=True)
        self.assertEqual(self.read(always=True, now=NOW + 3 * 3600)[0], "full AC")

    def test_a_change_is_printed_in_full(self):
        self.read()
        self.assertEqual(self.read(version="v2", now=NOW + 3 * 3600)[0], "full AC")

    def test_each_role_has_its_own_ledger(self):
        self.read(role="qa")
        self.assertEqual(self.read(role="qa2")[0], "full AC")

    def test_again_prints_in_full_what_the_run_already_read(self):
        self.read()
        self.assertEqual(self.read(again=True), ["full AC", "## AC (shown above)"])
