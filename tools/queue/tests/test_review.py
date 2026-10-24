import os
import pathlib
import subprocess
import tempfile
import unittest

from soirely_queue import checkout, review


def git(path, *args):
    return subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True,
                          check=True).stdout.strip()


class Worktree(unittest.TestCase):
    """Against a real repository: the lead's checkout with packages installed, and a pull
    request's head that changes a workspace package."""

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.folder.name)
        self.lead = root / "soirely-lead"
        subprocess.run(["git", "init", "-q", "-b", "main", str(self.lead)], check=True)
        git(self.lead, "config", "user.email", "t@example.test")
        git(self.lead, "config", "user.name", "t")
        for name, text in {".gitignore": "node_modules\nvendor\n",
                           "packages/domain/index.js": "main",
                           "apps/web/package.json": "{}",
                           "services/api/composer.json": "{}"}.items():
            (self.lead / name).parent.mkdir(parents=True, exist_ok=True)
            (self.lead / name).write_text(text)
        git(self.lead, "add", ".")
        git(self.lead, "commit", "-qm", "main")
        self.main = git(self.lead, "rev-parse", "HEAD")
        git(self.lead, "checkout", "-qb", "feature")
        (self.lead / "packages/domain/index.js").write_text("pr")
        git(self.lead, "commit", "-qam", "pr")
        self.head = git(self.lead, "rev-parse", "HEAD")
        git(self.lead, "checkout", "-q", "--detach", self.main)
        modules = self.lead / "node_modules"
        (modules / "react").mkdir(parents=True)
        (modules / "react/index.js").write_text("react")
        (modules / "@soirely").mkdir()
        os.symlink("../../packages/domain", modules / "@soirely/domain")
        (self.lead / "apps/web/node_modules/vite").mkdir(parents=True)
        (self.lead / "services/api/vendor/composer").mkdir(parents=True)
        (self.lead / "services/api/vendor/autoload.php").write_text("<?php")

    def tearDown(self):
        self.folder.cleanup()

    def test_the_worktree_sits_at_the_head_with_the_packages_linked_in(self):
        tree = review.make(self.lead, self.lead, self.head, 40)
        self.assertEqual(git(tree, "rev-parse", "HEAD"), self.head)
        self.assertEqual((tree / "node_modules/react/index.js").read_text(), "react")
        self.assertTrue((tree / "node_modules/react").is_symlink())
        self.assertEqual((tree / "node_modules/@soirely/domain/index.js").read_text(), "pr")
        self.assertTrue((tree / "apps/web/node_modules/vite").exists())
        vendor = tree / "services/api/vendor"
        self.assertFalse(vendor.is_symlink())
        self.assertEqual((vendor / "autoload.php").read_text(), "<?php")

    def test_the_lead_checkout_stays_on_its_commit(self):
        review.make(self.lead, self.lead, self.head, 40)
        review.remove(self.lead)
        self.assertEqual(git(self.lead, "rev-parse", "HEAD"), self.main)
        self.assertEqual((self.lead / "node_modules/react/index.js").read_text(), "react")
        self.assertEqual((self.lead / "services/api/vendor/autoload.php").read_text(), "<?php")

    def test_remove_takes_the_worktree_and_its_registration_away(self):
        tree = review.make(self.lead, self.lead, self.head, 40)
        (tree / "scratch.txt").write_text("left by the run")
        review.remove(self.lead)
        self.assertFalse(tree.exists())
        self.assertNotIn(str(tree), git(self.lead, "worktree", "list"))

    def test_a_worktree_left_by_an_earlier_run_is_replaced(self):
        review.make(self.lead, self.lead, self.main)
        tree = review.make(self.lead, self.lead, self.head, 40)
        self.assertEqual(git(tree, "rev-parse", "HEAD"), self.head)

    def test_a_head_that_cannot_be_found_is_unprepared_and_leaves_nothing(self):
        with self.assertRaises(checkout.Unprepared):
            review.make(self.lead, self.lead, "f" * 40)
        self.assertFalse(review.place(self.lead).exists())
