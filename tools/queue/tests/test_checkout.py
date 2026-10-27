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

    def test_an_untracked_copy_of_a_file_main_now_tracks_gives_way_to_main(self):
        flow = "checks/sign-in.yaml"
        (self.origin / "checks").mkdir()
        self.commit(self.origin, flow, "the flow")
        (self.role / "checks").mkdir()
        (self.role / flow).write_text("the flow")
        main, note = checkout.prepare(self.role, "qa")
        self.assertIsNone(note)
        self.assertEqual(git(self.role, "rev-parse", "HEAD"), main)
        self.assertFalse((self.role / checkout.SET_ASIDE).exists())

    def test_an_untracked_file_main_tracks_with_other_content_is_set_aside_and_named(self):
        flow = "checks/delete.yaml"
        (self.origin / "checks").mkdir()
        self.commit(self.origin, flow, "main's")
        (self.role / "checks").mkdir()
        (self.role / flow).write_text("the tester's")
        main, note = checkout.prepare(self.role, "qa3")
        self.assertEqual(git(self.role, "rev-parse", "HEAD"), main)
        self.assertEqual((self.role / flow).read_text(), "main's")
        kept = list((self.role / checkout.SET_ASIDE).glob(f"*/{flow}"))
        self.assertEqual([path.read_text() for path in kept], ["the tester's"])
        self.assertIn(f"{flow} -> {kept[0].relative_to(self.role)}", note)

    def test_an_untracked_copy_with_a_name_git_would_quote_still_gives_way(self):
        self.commit(self.origin, "café.yaml", "the flow")
        (self.role / "café.yaml").write_text("the flow")
        main, note = checkout.prepare(self.role, "qa")
        self.assertIsNone(note)
        self.assertEqual(git(self.role, "rev-parse", "HEAD"), main)

    def test_a_file_set_aside_before_a_merge_that_is_undone_is_not_said_to_be_replaced(self):
        git(self.role, "checkout", "-q", "-b", "feature/sc-7/x")
        self.commit(self.role, "a.txt", "branch")
        self.commit(self.origin, "a.txt", "main")
        self.commit(self.origin, "flow.yaml", "main's")
        (self.role / "flow.yaml").write_text("the developer's")
        _, note = checkout.prepare(self.role, "dev2", story("In Progress"))
        self.assertIn("conflicts, so it was undone", note)
        self.assertIn("the checkout stayed where it was", note)
        self.assertNotIn("main's took their place", note)

    def test_a_file_that_cannot_be_read_is_explained_rather_than_stopping_the_worker(self):
        self.commit(self.origin, "flow.yaml", "main's")
        (self.role / "flow.yaml").symlink_to(self.role / "nowhere")
        _, note = checkout.prepare(self.role, "qa")
        self.assertIn("Clearing untracked files out of main's way stopped", note)
        self.assertIn("Git said:", note)

    def test_a_checkout_git_refuses_is_explained_rather_than_stopping_the_worker(self):
        self.commit(self.origin, "b.txt", "two")
        refused = subprocess.CompletedProcess([], 1, "", "fatal: something else")
        real = checkout.git

        def git_refusing_checkout(path, *args, check=True):
            return refused if args[0] == "checkout" else real(path, *args, check=check)

        with mock.patch.object(checkout, "git", side_effect=git_refusing_checkout):
            main, note = checkout.prepare(self.role, "qa")
        self.assertIn("Git said: fatal: something else", note)
        self.assertNotEqual(git(self.role, "rev-parse", "HEAD"), main)

    def test_a_conflicting_merge_is_undone_and_explained(self):
        git(self.role, "checkout", "-q", "-b", "feature/sc-7/x")
        self.commit(self.role, "a.txt", "branch")
        self.commit(self.origin, "a.txt", "main")
        main, note = checkout.prepare(self.role, "dev2", story("In Progress"))
        self.assertIn("conflicts, so it was undone", note)
        self.assertEqual(git(self.role, "status", "--porcelain"), "")
