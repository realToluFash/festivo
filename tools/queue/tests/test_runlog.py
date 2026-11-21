"""The run log: one line per run, parsed once while it is unchanged."""

import pathlib
import tempfile
import unittest
from unittest import mock

from soirely_queue import runlog


class Entries(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.home = pathlib.Path(folder.name)

    def test_a_role_that_never_ran_has_none(self):
        self.assertEqual(runlog.entries(self.home, "qa"), [])

    def test_an_unchanged_log_is_parsed_once_and_a_new_run_is_seen(self):
        runlog.append(self.home, "qa", {"at": 1, "cost_usd": 2})
        with mock.patch.object(runlog.json, "loads", wraps=runlog.json.loads) as loads:
            first = runlog.entries(self.home, "qa")
            self.assertEqual(runlog.entries(self.home, "qa"), [{"at": 1, "cost_usd": 2}])
            self.assertEqual(loads.call_count, 1)
        first.clear()
        runlog.append(self.home, "qa", {"at": 2})
        self.assertEqual([e["at"] for e in runlog.entries(self.home, "qa")], [1, 2])
