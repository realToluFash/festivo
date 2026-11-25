"""The settings `sq web` changes in `agents.json`, against a file in a temporary folder."""

import difflib
import json
import pathlib
import tempfile
import unittest
from unittest import mock

from soirely_queue import settings

from tests.test_runner import config, login


class File(unittest.TestCase):
    """agents.json in a temporary folder, and Claude config folders in a temporary home."""

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
        self.machine_folder = str(self.root / "claude")
        self.home = self.root / "home"
        self.spare = str(login(self.home / ".claude-spare"))
        self.unused = self.home / ".claude-unused"
        self.unused.mkdir()
        (self.unused / "settings.json").write_text("{}")

    def logged_in(self, folder):
        return None if folder.name == ".claude-unused" else f"{folder.name}@example.test"

    def read(self):
        return settings.read(self.file, home=self.home, logged_in=self.logged_in)

    def save(self, where, changes=None, revision=None):
        """One where and its fields, or `{where: fields}` as a page's Save sends them."""
        asked = {where: changes} if changes is not None else where
        return settings.save(asked, revision or self.read()["revision"], self.file,
                             logged_in=self.logged_in, home=self.home)

    def on_disk(self):
        return json.loads(self.file.read_text())


class Settings(File):
    def test_each_role_shows_its_own_value_and_the_one_in_force_with_where_it_comes_from(self):
        found = self.read()
        self.assertEqual(found["roles"]["pm"]["effort"],
                         {"value": "high", "in_force": "high", "from": "role"})
        self.assertEqual(found["roles"]["dev2"]["effort"],
                         {"value": None, "in_force": "medium", "from": "defaults"})
        self.assertEqual(found["roles"]["dev2"]["wakeEvery"],
                         {"value": None, "in_force": "3m", "from": "built-in"})
        self.assertEqual(found["defaults"]["model"],
                         {"value": "claude-opus-5-5", "in_force": "claude-opus-5-5",
                          "from": "defaults"})
        self.assertEqual(found["defaults"]["wakeEvery"],
                         {"value": None, "in_force": "3m", "from": "built-in"})
        self.assertEqual(found["defaults"]["inboxEffort"],
                         {"value": None, "in_force": None, "from": None})
        self.assertEqual(found["machine"], {"dailyBudgetUsd": None,
                                            "claudeConfigDir": self.machine_folder})
        self.assertIn("claude-opus-5-5", found["models"])
        self.assertIn("pm", found["parallel"])
        self.assertFalse(found["undo"])

    def test_a_change_writes_only_its_field_and_keeps_every_other_key_in_order(self):
        before = self.file.read_text()
        done = self.save("dev2", {"effort": "high", "wakeEvery": "1m"})
        self.assertEqual(done, {"dev2": {"effort": {"old": None, "new": "high"},
                                         "wakeEvery": {"old": None, "new": "1m"}}})
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

    def test_one_save_across_the_defaults_and_the_machine_is_one_check_and_one_write(self):
        before = self.file.read_text()
        with self.assertRaises(settings.Refused) as refused:
            self.save({"defaults": {"effort": "low"}, "machine": {"dailyBudgetUsd": -1}})
        self.assertIn("error: dailyBudgetUsd is -1", str(refused.exception))
        self.assertEqual(self.file.read_text(), before)
        done = self.save({"defaults": {"effort": "low"}, "machine": {"dailyBudgetUsd": 40}})
        self.assertEqual(done, {"defaults": {"effort": {"old": "medium", "new": "low"}},
                                "machine": {"dailyBudgetUsd": {"old": None, "new": 40}}})
        self.assertEqual(settings.previous(self.file).read_text(), before)

    def test_a_save_that_names_no_fields_is_refused(self):
        for asked in ({}, {"dev2": {}}, {"dev2": "effort=high"}, "dev2"):
            with self.subTest(asked=asked), self.assertRaises(settings.Refused) as refused:
                settings.save(asked, self.read()["revision"], self.file)
            self.assertEqual(refused.exception.status, 400)

    def test_a_value_sq_run_refuses_writes_nothing_and_says_what_sq_run_says(self):
        before = self.file.read_text()
        for where, changes, said in (
                ("dev2", {"workers": 2}, "refused dev2: workers is 2, but dev2 keeps one stack"),
                ("dev2", {"effort": "furious"}, "effort 'furious' is not one"),
                ("dev2", {"model": "gpt-9"}, "model 'gpt-9' is not one sq accepts"),
                ("ops", {"wakeEvery": "soon"}, "wakeEvery 'soon' is not a time"),
                ("defaults", {"model": None}, "error: no default model"),
                ("machine", {"dailyBudgetUsd": -1}, "error: dailyBudgetUsd is -1")):
            with self.subTest(where=where, changes=changes):
                with self.assertRaises(settings.Refused) as refused:
                    self.save(where, changes)
                self.assertEqual(refused.exception.status, 409)
                self.assertIn(said, str(refused.exception))
        self.assertEqual(self.file.read_text(), before)
        self.assertFalse(settings.previous(self.file).exists())

    def test_more_workers_in_the_defaults_is_refused_naming_each_role_it_would_stop(self):
        with self.assertRaises(settings.Refused) as refused:
            self.save("defaults", {"workers": 2})
        lines = str(refused.exception).splitlines()
        self.assertEqual(sorted(line.split(":")[0] for line in lines),
                         ["refused dev2", "refused ops"])
        self.assertNotIn("workers", self.on_disk()["defaults"])

    def test_a_save_changes_only_the_lines_of_the_fields_it_changed(self):
        self.save("pm", {"effort": "low"})
        diff = [line for line in difflib.unified_diff(
            settings.previous(self.file).read_text().splitlines(),
            self.file.read_text().splitlines(), lineterm="", n=0)
            if line[:1] in "+-" and line[:3] not in ("+++", "---")]
        self.assertEqual(diff, ['-      "effort": "high"', '+      "effort": "low"'])

    def test_more_workers_are_taken_by_a_role_that_may_run_them(self):
        self.save("pm", {"workers": 2})
        self.assertEqual(self.on_disk()["roles"]["pm"]["workers"], 2)

    def test_a_field_the_page_does_not_own_or_a_role_not_listed_is_refused(self):
        for where, changes, status in (("dev2", {"claudeConfigDir": "~/.x"}, 400),
                                       ("machine", {"workspace": "~/x"}, 400),
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

    def test_the_last_change_is_undone_once_and_says_what_it_put_back(self):
        before = self.file.read_text()
        self.save({"defaults": {"effort": "low"}, "machine": {"dailyBudgetUsd": 40}})
        self.assertTrue(self.read()["undo"])
        self.assertEqual(settings.undo(self.read()["revision"], self.file),
                         {"defaults": {"effort": {"old": "low", "new": "medium"}},
                          "machine": {"dailyBudgetUsd": {"old": 40, "new": None}}})
        self.assertEqual(self.file.read_text(), before)
        self.assertFalse(self.read()["undo"])
        self.assertIsNone(settings.undo(self.read()["revision"], self.file))

    def test_an_undo_after_a_hand_edit_is_refused_and_puts_nothing_back(self):
        self.save("dev2", {"effort": "high"})
        edited = self.on_disk()
        edited["roles"]["qa"] = {}
        self.file.write_text(json.dumps(edited, indent=2) + "\n")
        self.assertFalse(self.read()["undo"])
        with self.assertRaises(settings.Refused) as refused:
            settings.undo(self.read()["revision"], self.file)
        self.assertEqual(refused.exception.status, 409)
        self.assertIn("changed by hand since the last change", str(refused.exception))
        self.assertIn("qa", self.on_disk()["roles"])

    def test_an_undo_with_a_revision_read_before_a_hand_edit_is_refused(self):
        self.save("dev2", {"effort": "high"})
        read = self.read()["revision"]
        self.file.write_text(self.file.read_text().replace('"high"', '"low"'))
        with self.assertRaises(settings.Refused) as refused:
            settings.undo(read, self.file)
        self.assertIn("changed since the page read it", str(refused.exception))
        self.assertEqual(self.on_disk()["roles"]["dev2"]["effort"], "low")

    def test_a_save_checks_and_writes_holding_the_lock_an_undo_holds(self):
        held = []
        real = settings.problems
        with mock.patch.object(settings, "problems",
                               lambda *asked: held.append(settings.WRITING.locked())
                               or real(*asked)):
            self.save("dev2", {"effort": "high"})
        self.assertEqual(held, [True])
        self.assertFalse(settings.WRITING.locked())

    def test_fixing_one_of_two_things_wrong_with_a_role_is_taken(self):
        broken = self.on_disk()
        broken["roles"]["dev2"] = {"wakeEvery": "soon", "maxBudgetUsd": -1}
        self.file.write_text(json.dumps(broken, indent=2) + "\n")
        self.save("dev2", {"wakeEvery": "5m"})
        self.assertEqual(self.on_disk()["roles"]["dev2"]["wakeEvery"], "5m")

    def test_an_unchanged_value_writes_nothing(self):
        self.assertEqual(self.save("pm", {"effort": "high"}), {})
        self.assertFalse(settings.previous(self.file).exists())


class Accounts(File):
    """A role's, or the machine's, Claude account: the folder its workers run under."""

    def test_the_folders_sq_found_are_offered_with_who_each_runs_as_and_its_roles(self):
        found = self.read()
        self.assertEqual(found["accounts"], [
            {"folder": self.machine_folder, "account": "claude@example.test",
             "roles": ["ops", "dev2", "pm"]},
            {"folder": self.spare, "account": ".claude-spare@example.test", "roles": []},
            {"folder": str(self.unused), "account": None, "roles": []}])
        self.assertEqual(found["roles"]["dev2"]["claudeConfigDir"],
                         {"value": None, "in_force": self.machine_folder, "from": "machine"})

    def test_a_role_moves_to_another_folder_and_back_to_the_machines(self):
        done = self.save("dev2", {"claudeConfigDir": self.spare})
        self.assertEqual(done, {"dev2": {"claudeConfigDir": {"old": None, "new": self.spare}}})
        self.assertEqual(self.read()["roles"]["dev2"]["claudeConfigDir"],
                         {"value": self.spare, "in_force": self.spare, "from": "role"})
        self.save("dev2", {"claudeConfigDir": None})
        self.assertNotIn("claudeConfigDir", self.on_disk()["roles"]["dev2"])

    def test_a_folder_with_no_login_is_refused_in_sq_runs_words(self):
        before = self.file.read_text()
        with self.assertRaises(settings.Refused) as refused:
            self.save("dev2", {"claudeConfigDir": str(self.unused)})
        self.assertEqual(refused.exception.status, 409)
        self.assertIn(f"refused dev2: no Claude login in {self.unused}", str(refused.exception))
        self.assertEqual(self.file.read_text(), before)

    def test_a_folder_sq_did_not_find_is_refused_and_nothing_is_written(self):
        before = self.file.read_text()
        elsewhere = self.root / "elsewhere"
        login(elsewhere)
        for value in (str(elsewhere), "/etc", "", 3, ["~/.claude"]):
            with self.subTest(value=value), self.assertRaises(settings.Refused) as refused:
                self.save("dev2", {"claudeConfigDir": value})
            self.assertEqual(refused.exception.status, 400)
            self.assertIn("is not a Claude config folder sq found", str(refused.exception))
        self.assertEqual(self.file.read_text(), before)

    def test_the_machines_folder_changes_and_cannot_be_cleared(self):
        self.save("machine", {"claudeConfigDir": self.spare})
        self.assertEqual(self.on_disk()["claudeConfigDir"], self.spare)
        self.assertEqual(self.read()["roles"]["ops"]["claudeConfigDir"]["in_force"], self.spare)
        with self.assertRaises(settings.Refused) as refused:
            self.save("machine", {"claudeConfigDir": None})
        self.assertIn("error: no claudeConfigDir", str(refused.exception))

    def test_moving_the_machine_to_a_folder_with_no_login_names_each_role_it_would_stop(self):
        self.save("pm", {"claudeConfigDir": self.spare})
        with self.assertRaises(settings.Refused) as refused:
            self.save("machine", {"claudeConfigDir": str(self.unused)})
        self.assertEqual(sorted(line.split(":")[0] for line in
                                str(refused.exception).splitlines()),
                         ["refused dev2", "refused ops"])

    def test_a_folder_with_no_login_is_refused_for_a_role_already_refused_for_more(self):
        (self.root / "soirely-pm").rmdir()
        with self.assertRaises(settings.Refused) as refused:
            self.save("pm", {"claudeConfigDir": str(self.unused)})
        self.assertIn(f"refused pm: no Claude login in {self.unused}", str(refused.exception))
        self.assertNotIn("claudeConfigDir", self.on_disk()["roles"]["pm"])

    def test_the_machines_folder_needs_a_login_when_no_role_runs_under_it(self):
        for role in ("ops", "dev2", "pm"):
            self.save(role, {"claudeConfigDir": self.spare})
        with self.assertRaises(settings.Refused) as refused:
            self.save("machine", {"claudeConfigDir": str(self.unused)})
        self.assertEqual(str(refused.exception).split(":")[:2],
                         ["error", f" no Claude login in {self.unused}"])
        self.assertEqual(self.on_disk()["claudeConfigDir"], self.machine_folder)

    def test_a_folder_is_matched_where_it_resolves_and_written_as_the_logins_show_it(self):
        with mock.patch("pathlib.Path.home", return_value=self.home), \
                mock.patch.dict("os.environ", {"HOME": str(self.home)}):
            self.save("dev2", {"claudeConfigDir": self.spare})
            self.assertEqual(self.on_disk()["roles"]["dev2"]["claudeConfigDir"],
                             "~/.claude-spare")
            self.assertEqual(self.read()["roles"]["dev2"]["claudeConfigDir"]["value"],
                             "~/.claude-spare")
            self.assertEqual(self.save("dev2", {"claudeConfigDir": "~/.claude-spare/"}), {})

    def test_an_undo_puts_the_account_back_and_says_so(self):
        self.save("dev2", {"claudeConfigDir": self.spare})
        self.assertEqual(settings.undo(self.read()["revision"], self.file),
                         {"dev2": {"claudeConfigDir": {"old": self.spare, "new": None}}})
