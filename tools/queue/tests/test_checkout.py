import pathlib
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

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


class Fetch(unittest.TestCase):
    def runs(self, *codes):
        return [subprocess.CompletedProcess([], code, "", "cannot lock ref" if code else "")
                for code in codes]

    def test_a_fetch_that_loses_a_ref_lock_is_tried_again(self):
        waits = []
        with mock.patch.object(checkout.subprocess, "run", side_effect=self.runs(1, 0)) as run:
            checkout.fetch("/role", sleep=waits.append)
        self.assertEqual(run.call_count, 2)
        self.assertEqual(waits, [5])

    def test_a_fetch_that_keeps_failing_says_what_git_said(self):
        with mock.patch.object(checkout.subprocess, "run", side_effect=self.runs(1, 1, 1)):
            with self.assertRaises(checkout.Unprepared) as failed:
                checkout.fetch("/role", sleep=lambda _: None)
        self.assertIn("cannot lock ref", str(failed.exception))


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

    def test_a_further_worker_gets_a_worktree_of_the_role_s_checkout_once(self):
        second = self.role.with_name("role-2")
        checkout.ensure(self.role, second)
        checkout.ensure(self.role, second)
        self.assertEqual(git(second, "rev-parse", "HEAD"), git(self.role, "rev-parse", "HEAD"))
        main, _ = checkout.prepare(second, "pm")
        self.assertEqual(git(second, "rev-parse", "HEAD"), main)

    def test_a_further_worker_s_checkout_deleted_by_hand_is_made_again(self):
        second = self.role.with_name("role-2")
        checkout.ensure(self.role, second)
        shutil.rmtree(second)
        checkout.ensure(self.role, second)
        self.assertEqual(git(second, "rev-parse", "HEAD"), git(self.role, "rev-parse", "HEAD"))

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
