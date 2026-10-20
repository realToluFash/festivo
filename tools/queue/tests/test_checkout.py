import pathlib
import subprocess
import tempfile
import unittest

from soirely_queue import checkout


def story(state, id_=7):
    return {"id": id_, "state": state}


class Decide(unittest.TestCase):
    def test_changes_nobody_committed_are_never_touched(self):
        self.assertEqual(checkout.decide("lead", None, True), "leave-dirty")

    def test_a_detached_checkout_moves_to_main(self):
        self.assertEqual(checkout.decide("lead", None, False), "move-to-main")

    def test_main_only_fast_forwards(self):
        self.assertEqual(checkout.decide("dev", "main", False), "fast-forward")

    def test_a_developer_building_its_story_gets_main_merged_in(self):
        self.assertEqual(checkout.decide("dev2", "feature/sc-7/x", False, story("In Progress")),
                         "merge-main")
        self.assertEqual(checkout.decide("dev", "fix/sc-7-y", False, story("Failed QA")),
                         "merge-main")

    def test_a_branch_in_review_is_left_alone_so_the_pass_holds(self):
        for state in ("In Review", "Passed Code Review"):
            self.assertEqual(checkout.decide("dev2", "feature/sc-7/x", False, story(state)),
                             "fetch-only")

    def test_a_branch_for_another_story_is_left_alone(self):
        self.assertEqual(checkout.decide("dev2", "feature/sc-70/x", False, story("In Progress")),
                         "fetch-only")


def git(path, *args):
    return subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True,
                          check=True).stdout.strip()


class Prepare(unittest.TestCase):
    """Against real repositories in a temporary folder: an origin and a role's clone."""

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.folder.name)
        self.origin, self.role = root / "origin", root / "role"
        subprocess.run(["git", "init", "-q", "-b", "main", str(self.origin)], check=True)
        self.commit(self.origin, "a.txt", "one")
        subprocess.run(["git", "clone", "-q", str(self.origin), str(self.role)], check=True)
        git(self.role, "checkout", "-q", "--detach")

    def tearDown(self):
        self.folder.cleanup()

    def commit(self, path, name, text):
        (path / name).write_text(text)
        git(path, "add", name)
        git(path, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", name)

    def test_a_detached_checkout_lands_on_the_new_main(self):
        self.commit(self.origin, "b.txt", "two")
        main, note = checkout.prepare(self.role, "lead")
        self.assertIsNone(note)
        self.assertEqual(git(self.role, "rev-parse", "HEAD"), main)

    def test_uncommitted_work_stays_and_the_worker_is_told(self):
        before = git(self.role, "rev-parse", "HEAD")
        self.commit(self.origin, "b.txt", "two")
        (self.role / "a.txt").write_text("mine")
        main, note = checkout.prepare(self.role, "lead")
        self.assertIn("changes nobody committed", note)
        self.assertEqual(git(self.role, "rev-parse", "HEAD"), before)
        self.assertEqual((self.role / "a.txt").read_text(), "mine")

    def test_an_untracked_file_does_not_hold_the_checkout_back(self):
        self.commit(self.origin, "b.txt", "two")
        (self.role / "stray.yaml").write_text("left by a flow")
        main, note = checkout.prepare(self.role, "lead")
        self.assertIsNone(note)
        self.assertEqual(git(self.role, "rev-parse", "HEAD"), main)
        self.assertTrue((self.role / "stray.yaml").exists())

    def test_a_conflicting_merge_is_undone_and_explained(self):
        git(self.role, "checkout", "-q", "-b", "feature/sc-7/x")
        self.commit(self.role, "a.txt", "branch")
        self.commit(self.origin, "a.txt", "main")
        main, note = checkout.prepare(self.role, "dev2", story("In Progress"))
        self.assertIn("conflicts, so it was undone", note)
        self.assertEqual(git(self.role, "status", "--porcelain"), "")
