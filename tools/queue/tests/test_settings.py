"""The settings `sq web` changes in `agents.json`, against a file in a temporary folder."""

import json
import pathlib
import tempfile
import unittest

from soirely_queue import settings

from tests.test_runner import config


class Settings(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = pathlib.Path(self.folder.name)
        for name in ("festivo", "soirely-ops", "soirely-dev2", "soirely-pm"):
            (self.root / name).mkdir()
        self.file = self.root / "agents.json"
        start = config(self.root, roles={"ops": {"wakeEvery": "1m"}, "dev2": {},
                                         "pm": {"effort": "high"}},
                       dailyBudgetUsd=None)
        self.file.write_text(json.dumps(start, indent=2) + "\n")
        self.file.chmod(0o600)

    def read(self):
        return settings.read(self.file)

    def save(self, where, changes, revision=None):
        return settings.save(where, changes, revision or self.read()["revision"], self.file,
                             logged_in=lambda folder: "owner@example.com")

    def on_disk(self):
        return json.loads(self.file.read_text())

    def test_each_role_shows_its_own_value_and_the_one_in_force_with_where_it_comes_from(self):
        found = self.read()
        self.assertEqual(found["roles"]["pm"]["effort"],
                         {"value": "high", "in_force": "high", "from": "role"})
        self.assertEqual(found["roles"]["dev2"]["effort"],
                         {"value": None, "in_force": "medium", "from": "defaults"})
        self.assertEqual(found["roles"]["dev2"]["wakeEvery"],
                         {"value": None, "in_force": "3m", "from": "built-in"})
        self.assertEqual(found["defaults"]["model"], "claude-opus-5-5")
        self.assertEqual(found["machine"], {"dailyBudgetUsd": None})
        self.assertIn("claude-opus-5-5", found["models"])
        self.assertIn("pm", found["parallel"])
        self.assertFalse(found["undo"])

    def test_a_change_writes_only_its_field_and_keeps_every_other_key_in_order(self):
        before = self.file.read_text()
        done = self.save("dev2", {"effort": "high", "wakeEvery": "1m"})
        self.assertEqual(done, {"effort": {"old": None, "new": "high"},
                                "wakeEvery": {"old": None, "new": "1m"}})
        after = self.on_disk()
        self.assertEqual(after["roles"]["dev2"], {"effort": "high", "wakeEvery": "1m"})
        self.assertEqual(list(after), list(json.loads(before)))
        self.assertEqual(dict(after, roles=None), dict(json.loads(before), roles=None))
        self.assertEqual(self.file.stat().st_mode & 0o777, 0o600)
        self.assertEqual(settings.previous(self.file).read_text(), before)

    def test_a_cleared_field_falls_back_to_the_defaults(self):
        self.save("pm", {"effort": None})
        self.assertNotIn("effort", self.on_disk()["roles"]["pm"])
        self.assertEqual(self.read()["roles"]["pm"]["effort"]["from"], "defaults")

    def test_the_defaults_and_the_machines_budget_are_changed_where_they_live(self):
        self.save("defaults", {"effort": "low"})
        self.save("machine", {"dailyBudgetUsd": 40})
        after = self.on_disk()
        self.assertEqual((after["defaults"]["effort"], after["dailyBudgetUsd"]), ("low", 40))
        self.assertEqual(self.read()["roles"]["dev2"]["effort"]["in_force"], "low")

    def test_a_value_sq_run_refuses_writes_nothing_and_says_what_sq_run_says(self):
        before = self.file.read_text()
        for where, changes, said in (
                ("dev2", {"workers": 2}, "only pm, ux, bm, cd, lead run more"),
                ("dev2", {"effort": "furious"}, "effort 'furious' is not one"),
                ("dev2", {"model": "gpt-9"}, "model 'gpt-9' is not one sq accepts"),
                ("ops", {"wakeEvery": "soon"}, "wakeEvery 'soon' is not a time"),
                ("defaults", {"model": None}, "no default model"),
                ("machine", {"dailyBudgetUsd": -1}, "dailyBudgetUsd is -1")):
            with self.subTest(where=where, changes=changes):
                with self.assertRaises(settings.Refused) as refused:
                    self.save(where, changes)
                self.assertEqual(refused.exception.status, 409)
                self.assertIn(said, str(refused.exception))
        self.assertEqual(self.file.read_text(), before)
        self.assertFalse(settings.previous(self.file).exists())

    def test_more_workers_are_taken_by_a_role_that_may_run_them(self):
        self.save("pm", {"workers": 2})
        self.assertEqual(self.on_disk()["roles"]["pm"]["workers"], 2)

    def test_a_field_the_page_does_not_own_or_a_role_not_listed_is_refused(self):
        for where, changes, status in (("dev2", {"claudeConfigDir": "~/.x"}, 400),
                                       ("machine", {"workspace": "~/x"}, 400),
                                       ("defaults", {"workers": 3}, 400),
                                       ("qa", {"effort": "high"}, 404)):
            with self.subTest(where=where), self.assertRaises(settings.Refused) as refused:
                self.save(where, changes)
            self.assertEqual(refused.exception.status, status)

    def test_a_role_already_refused_for_something_else_can_still_be_changed(self):
        (self.root / "soirely-pm").rmdir()
        self.save("pm", {"effort": "low"})
        self.assertEqual(self.on_disk()["roles"]["pm"]["effort"], "low")

    def test_a_file_changed_since_the_page_read_it_is_not_written_over(self):
        stale = self.read()["revision"]
        self.save("dev2", {"effort": "high"})
        with self.assertRaises(settings.Refused) as refused:
            self.save("dev2", {"effort": "low"}, stale)
        self.assertEqual(refused.exception.status, 409)
        self.assertIn("changed since the page read it", str(refused.exception))
        self.assertEqual(self.on_disk()["roles"]["dev2"]["effort"], "high")

    def test_the_last_change_is_undone_once(self):
        before = self.file.read_text()
        self.save("dev2", {"effort": "high"})
        self.assertTrue(self.read()["undo"])
        self.assertTrue(settings.undo(self.read()["revision"], self.file))
        self.assertEqual(self.file.read_text(), before)
        self.assertFalse(self.read()["undo"])
        self.assertFalse(settings.undo(self.read()["revision"], self.file))

    def test_an_unchanged_value_writes_nothing(self):
        self.assertEqual(self.save("pm", {"effort": "high"}), {})
        self.assertFalse(settings.previous(self.file).exists())
