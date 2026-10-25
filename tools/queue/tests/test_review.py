import os
import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock

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
                           "services/api/composer.json": "{}",
                           "CLAUDE.md": "main's",
                           ".claude/settings.json": "{}",
                           ".claude/skills/soirely-tech-lead/SKILL.md": "main's lead",
                           "apps/web/.claude/skills/web/SKILL.md": "main's web"}.items():
            (self.lead / name).parent.mkdir(parents=True, exist_ok=True)
            (self.lead / name).write_text(text)
        git(self.lead, "add", ".")
        git(self.lead, "commit", "-qm", "main")
        self.main = git(self.lead, "rev-parse", "HEAD")
        git(self.lead, "checkout", "-qb", "feature")
        (self.lead / "packages/domain/index.js").write_text("pr")
        (self.lead / ".claude/skills/soirely-tech-lead/SKILL.md").write_text("the pr's lead")
        (self.lead / "CLAUDE.md").write_text("the pr's")
        git(self.lead, "rm", "-q", "apps/web/.claude/skills/web/SKILL.md")
        (self.lead / ".claude/settings.local.json").write_text('{"allow": ["*"]}')
        (self.lead / "services/api/CLAUDE.md").write_text("the pr's api")
        git(self.lead, "add", ".")
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
        (self.lead / "services/api/vendor/composer/autoload_real.php").write_text("<?php")
        (self.lead / "services/api/vendor/psl").mkdir()
        (self.lead / "services/api/vendor/psl/Str.php").write_text("<?php")
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

    def test_the_review_runs_under_mains_claude_rules_not_the_heads(self):
        tree = review.make(self.lead, self.lead, self.head, 40, rules=self.main)
        self.assertEqual((tree / ".claude/skills/soirely-tech-lead/SKILL.md").read_text(),
                         "main's lead")
        self.assertEqual((tree / "CLAUDE.md").read_text(), "main's")
        self.assertEqual((tree / "apps/web/.claude/skills/web/SKILL.md").read_text(),
                         "main's web")
        self.assertFalse((tree / ".claude/settings.local.json").exists())
        self.assertFalse((tree / "services/api/CLAUDE.md").exists())
        self.assertEqual((tree / "packages/domain/index.js").read_text(), "pr")
        self.assertEqual(git(tree, "rev-parse", "HEAD"), self.head)

    def test_what_composer_rewrites_in_place_is_copied_not_shared(self):
        tree = review.make(self.lead, self.lead, self.head, 40)
        vendor, base = tree / "services/api/vendor", self.lead / "services/api/vendor"
        for name in ("autoload.php", "composer/autoload_real.php"):
            (vendor / name).write_text("<?php // the pr's packages")
            self.assertEqual((base / name).read_text(), "<?php")
        self.assertEqual(os.stat(vendor / "psl/Str.php").st_ino,
                         os.stat(base / "psl/Str.php").st_ino)

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

    def test_rules_that_cannot_be_archived_are_unprepared_and_leave_nothing(self):
        run = subprocess.run

        def failing_archive(args, **kwargs):
            if "archive" in args:
                raise subprocess.CalledProcessError(128, args, stderr=b"No space left")
            return run(args, **kwargs)

        with mock.patch.object(review.subprocess, "run", failing_archive), \
                self.assertRaises(checkout.Unprepared):
            review.make(self.lead, self.lead, self.head, 40, rules=self.main)
        self.assertFalse(review.place(self.lead).exists())
