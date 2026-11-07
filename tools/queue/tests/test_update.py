"""The self-update: the installed `sq` moves to `main` only on a commit CI passed."""

import pathlib
import tempfile
import unittest
from unittest import mock

from soirely_queue import store, update

SHA, TREE = "a" * 40, "t" * 40


class Green(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")

    def test_ci_word_on_a_commit(self):
        store.set_meta(self.db, "main_runs", [{"headSha": SHA, "conclusion": "success"},
                                              {"headSha": SHA, "conclusion": "skipped"}])
        self.assertTrue(update.green(self.db, SHA))
        store.set_meta(self.db, "main_runs", [{"headSha": SHA, "conclusion": "failure"}])
        self.assertFalse(update.green(self.db, SHA))
        self.assertIsNone(update.green(self.db, "b" * 40))


class Check(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.home = pathlib.Path(self.folder.name) / "soirely-roles"
        self.db = store.connect(":memory:")
        self.said = []

    def tearDown(self):
        self.folder.cleanup()

    def check(self, runs, installed=None, now=1000.0, force=True):
        if installed:
            (self.home / "sq").mkdir(parents=True, exist_ok=True)
            update.tree_file(self.home).write_text(installed)
        store.set_meta(self.db, "main_runs", runs)
        answers = {"rev-parse origin/main": SHA, "rev-parse origin/main:tools/queue": TREE}
        with mock.patch.object(update, "git", side_effect=lambda _, *a: answers[" ".join(a)]), \
                mock.patch.object(update, "install_from_main") as install:
            done = update.check(self.db, self.home, now, self.said.append, force=force,
                                fetch=False)
        return done, install

    def test_a_green_main_with_a_new_sq_is_installed(self):
        done, install = self.check([{"headSha": SHA, "conclusion": "success"}], "old")
        self.assertTrue(done)
        install.assert_called_once_with(self.home, SHA, TREE)

    def test_a_red_main_keeps_the_installed_sq(self):
        done, install = self.check([{"headSha": SHA, "conclusion": "failure"}], "old")
        self.assertFalse(done)
        install.assert_not_called()
        self.assertIn("CI has not passed it", self.said[0])

    def test_the_same_tree_is_not_installed_again(self):
        done, install = self.check([{"headSha": SHA, "conclusion": "success"}], TREE)
        self.assertFalse(done)
        install.assert_not_called()

    def test_it_checks_at_most_every_ten_minutes(self):
        store.set_meta(self.db, "update_checked_at", 1000.0)
        done, install = self.check([{"headSha": SHA, "conclusion": "success"}], "old",
                                   now=1300.0, force=False)
        self.assertFalse(done)
        install.assert_not_called()

    def test_copy_leaves_the_tests_and_records_the_tree(self):
        source = pathlib.Path(self.folder.name) / "queue"
        (source / "tests").mkdir(parents=True)
        (source / "sq").write_text("run")
        (source / "README.md").write_text("docs")
        update.copy(source, self.home, TREE)
        self.assertEqual(sorted(p.name for p in (self.home / "sq").iterdir()), [".tree", "sq"])
        self.assertEqual(update.installed(self.home), TREE)
