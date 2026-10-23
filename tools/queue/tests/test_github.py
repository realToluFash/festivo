"""The GitHub calls against a fake gh: nothing here reaches GitHub."""

import json
import subprocess
import unittest
from unittest import mock

from soirely_queue import github

HEAD = "a" * 40
MERGED = "c" * 40
MAIN = "f" * 40
PASS = f"## Review (from lead)\n\nFine.\n\nReview passed at {HEAD}. Ready to merge."


class FakeGh:
    """Answers `gh api <path>` from a table of paths; GraphQL says its limit is spent."""

    def __init__(self, routes):
        self.routes = routes
        self.calls = []

    def __call__(self, *args, stdin=None):
        self.calls.append((args, stdin))
        if args[:2] == ("api", "graphql"):
            raise github.RateLimited("gh api graphql: API rate limit already exceeded")
        path = args[1]
        if path not in self.routes:
            raise AssertionError(f"unexpected call: {args}")
        answer = self.routes[path]
        if "--slurp" in args:
            answer = [answer]
        return json.dumps(answer) if not isinstance(answer, str) else answer

    def paths(self):
        return [args[1] for args, _ in self.calls]


def pull(number=7, state="open", merged_at=None, updated="2026-10-18T21:00:00Z"):
    return {"number": number, "title": f"feat: a thing (sc-{number}0)", "state": state,
            "html_url": f"https://github.com/o/n/pull/{number}", "draft": False,
            "head": {"ref": f"feature/sc-{number}0/thing", "sha": HEAD},
            "base": {"ref": "main"}, "body": "## Risks\n\nNone.", "updated_at": updated,
            "merged_at": merged_at, "merge_commit_sha": MERGED}


def routes(extra=None):
    base = "repos/o/n"
    found = {
        f"{base}/pulls?state=open&sort=updated&direction=desc&per_page=30": [pull()],
        f"{base}/pulls?state=closed&sort=updated&direction=desc&per_page=30": [
            pull(8, "closed", "2026-10-18T20:00:00Z"), pull(9, "closed")],
        f"{base}/pulls/7/reviews?per_page=100": [
            {"id": 11, "body": PASS, "submitted_at": "2026-10-18T20:30:00Z",
             "commit_id": HEAD}],
        f"{base}/pulls/8/reviews?per_page=100": [],
        f"{base}/pulls/7/comments?per_page=100": [
            {"id": 21, "path": "a.py", "line": 3, "body": "should: name it",
             "created_at": "2026-10-18T20:31:00Z"},
            {"id": 22, "in_reply_to_id": 21, "path": "a.py", "line": 3, "body": "done",
             "created_at": "2026-10-18T20:40:00Z"},
            {"id": 23, "path": "b.py", "line": None, "body": "nit: old",
             "created_at": "2026-10-18T20:32:00Z"}],
        f"{base}/commits/{HEAD}/check-runs?per_page=100": {"check_runs": [
            {"name": "test", "status": "completed", "conclusion": "success",
             "html_url": "https://github.com/o/n/actions/runs/5/job/6"}]},
        f"{base}/commits/{HEAD}/status": {"statuses": []},
        f"{base}/pulls/7": {"mergeable": False, "head": {"sha": HEAD, "ref": "feature/x"},
                            "state": "open", "merged": False, "mergeable_state": "dirty",
                            "merge_commit_sha": "d" * 40},
    }
    found[f"{base}/git/ref/heads/main"] = {"object": {"sha": MAIN}}
    found.update(extra or {})
    return found


class RateLimit(unittest.TestCase):
    def test_a_rate_limited_gh_raises_its_own_error(self):
        spent = subprocess.CompletedProcess([], 1, "", "gh: API rate limit already exceeded")
        with mock.patch("subprocess.run", return_value=spent):
            with self.assertRaises(github.RateLimited):
                github.gh("api", "graphql")

    def test_any_other_failure_is_a_plain_error(self):
        failed = subprocess.CompletedProcess([], 1, "", "HTTP 404: Not Found")
        with mock.patch("subprocess.run", return_value=failed):
            with self.assertRaises(github.GitHubError) as raised:
                github.gh("api", "repos/o/n/pulls/1")
        self.assertNotIsInstance(raised.exception, github.RateLimited)

    def test_the_repository_comes_from_the_remote(self):
        for remote in ("https://github.com/o/n.git", "git@github.com:o/n.git",
                       "https://github.com/o/n"):
            self.assertEqual(github.REMOTE.search(remote).groups(), ("o", "n"))


class RestSync(unittest.TestCase):
    def sync(self, fake, known=None):
        with mock.patch("soirely_queue.github.gh", fake):
            return {pr["number"]: pr for pr in github.pull_requests("o", "n", known)}

    def test_graphql_spent_reads_the_same_shape_over_rest(self):
        prs = self.sync(FakeGh(routes()))
        self.assertEqual(sorted(prs), [7, 8], "a closed pull request that never merged is left out")
        pr = prs[7]
        self.assertEqual((pr["state"], pr["story_id"], pr["head_sha"], pr["checks"],
                          pr["mergeable"]), ("open", 70, HEAD, "green", "conflicting"))
        self.assertEqual([(v["verdict"], v["sha"], v["id"]) for v in pr["lead"]],
                         [("pass", HEAD, 11)])
        first, second = pr["threads"]
        self.assertEqual([c["id"] for c in first["comments"]], [21, 22])
        self.assertEqual((first["resolved"], first["outdated"]), (False, False))
        self.assertTrue(second["outdated"])
        merged = prs[8]
        self.assertEqual((merged["state"], merged["merge_sha"], merged["threads"]),
                         ("merged", MERGED, []))

    def test_a_known_thread_keeps_its_id_and_whether_it_is_resolved(self):
        known = {7: {"number": 7, "updated_at": "earlier", "head_sha": HEAD, "threads": [
            {"id": "PRRT_1", "resolved": True, "comments": [{"id": 21}]}]}}
        first, second = self.sync(FakeGh(routes()), known)[7]["threads"]
        self.assertEqual((first["id"], first["resolved"]), ("PRRT_1", True))
        self.assertEqual((second["id"], second["resolved"]), ("rest:23", False))

    def test_an_unchanged_pull_request_costs_no_more_calls(self):
        fake = FakeGh(routes())
        first = self.sync(fake)
        fake.calls.clear()
        again = self.sync(fake, first)
        self.assertEqual(again, first)
        self.assertEqual(len(fake.paths()), 4, "the two lists, main's head, and GraphQL refusing")

    def test_an_unchanged_pull_request_is_asked_again_once_main_moves(self):
        fake = FakeGh(routes())
        first = self.sync(fake)
        fake.calls.clear()
        fake.routes["repos/o/n/git/ref/heads/main"] = {"object": {"sha": "e" * 40}}
        fake.routes["repos/o/n/pulls/7"] = dict(fake.routes["repos/o/n/pulls/7"], mergeable=True)
        again = self.sync(fake, first)[7]
        self.assertEqual((again["mergeable"], again["main_sha"]), ("mergeable", "e" * 40))
        self.assertIn("repos/o/n/pulls/7", fake.paths())
        self.assertNotIn("repos/o/n/pulls/7/reviews?per_page=100", fake.paths())

    def test_an_unknown_answer_is_asked_again_on_the_next_sync(self):
        fake = FakeGh(routes({"repos/o/n/pulls/7": {"mergeable": None}}))
        first = self.sync(fake)
        self.assertEqual(first[7]["mergeable"], "unknown")
        fake.routes["repos/o/n/pulls/7"] = {"mergeable": False}
        self.assertEqual(self.sync(fake, first)[7]["mergeable"], "conflicting")

    def test_pending_checks_are_read_again(self):
        fake = FakeGh(routes())
        first = self.sync(fake)
        first[7]["checks"] = "pending"
        fake.calls.clear()
        self.assertEqual(self.sync(fake, first)[7]["checks"], "green")

    def test_a_failed_run_makes_the_checks_red(self):
        runs = {"check_runs": [
            {"name": "test", "status": "completed", "conclusion": "success", "html_url": ""},
            {"name": "lint", "status": "completed", "conclusion": "failure", "html_url": ""}]}
        fake = FakeGh(routes({f"repos/o/n/commits/{HEAD}/check-runs?per_page=100": runs}))
        self.assertEqual(self.sync(fake)[7]["checks"], "red")


class RestCalls(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch("soirely_queue.github.repository", return_value=("o", "n"))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_live_maps_rest_to_what_the_merge_decision_reads(self):
        with mock.patch("soirely_queue.github.gh", FakeGh(routes())):
            found = github.live(7)
        self.assertEqual(found, {"headRefOid": HEAD, "mergeable": "CONFLICTING",
                                 "mergeStateStatus": "DIRTY", "state": "OPEN",
                                 "draft": False, "mergeCommit": None})

    def test_a_merged_pull_request_gives_its_merge_commit(self):
        merged = {"mergeable": None, "head": {"sha": HEAD, "ref": "x"}, "state": "closed",
                  "merged": True, "mergeable_state": "unknown", "merge_commit_sha": MERGED}
        with mock.patch("soirely_queue.github.gh", FakeGh(routes({"repos/o/n/pulls/7": merged}))):
            found = github.live(7)
        self.assertEqual((found["state"], found["mergeCommit"], found["mergeable"]),
                         ("MERGED", MERGED, "UNKNOWN"))

    def compare(self, before, after):
        old, new = "b" * 40, HEAD
        fake = FakeGh(routes({f"repos/o/n/compare/main...{old}": {"files": before},
                              f"repos/o/n/compare/main...{new}": {"files": after}}))
        with mock.patch("soirely_queue.github.gh", fake):
            return github.same_change(old, new)

    def test_a_merge_of_main_that_only_moves_the_hunks_is_the_same_change(self):
        passed = [{"filename": "a.json", "status": "modified", "patch": "@@ -1,2 +1,2 @@\n-x\n+y"}]
        merged = [{"filename": "a.json", "status": "modified", "patch": "@@ -9,2 +9,2 @@\n-x\n+y"}]
        self.assertTrue(self.compare(passed, merged))

    def test_an_edit_a_file_or_a_missing_patch_is_another_change(self):
        passed = [{"filename": "a.json", "status": "modified", "patch": "@@ -1 +1 @@\n-x\n+y"}]
        edited = [{**passed[0], "patch": "@@ -1 +1 @@\n-x\n+z"}]
        extra = passed + [{"filename": "b.ts", "status": "modified", "patch": "@@ -1 +1 @@"}]
        binary = [{"filename": "a.json", "status": "modified"}]
        for after in (edited, extra, binary, []):
            self.assertFalse(self.compare(passed, after))
        self.assertFalse(self.compare(binary, binary))

    def test_no_change_is_never_the_same_change(self):
        self.assertFalse(self.compare([], []))

    def test_a_sha_github_cannot_compare_is_a_no_and_a_spent_limit_is_raised(self):
        for error, outcome in ((github.GitHubError("gh api x: Not Found (HTTP 404)"), False),
                               (github.GitHubError("gh api x: No common ancestor (HTTP 422)"),
                                False)):
            with mock.patch("soirely_queue.github.api", side_effect=error):
                self.assertIs(github.same_change("b" * 40, HEAD), outcome)
        for error in (github.RateLimited("gh api x: rate limit"),
                      github.GitHubError("gh api x: Server Error (HTTP 502)")):
            with mock.patch("soirely_queue.github.api", side_effect=error), \
                    self.assertRaises(type(error)):
                github.same_change("b" * 40, HEAD)

    def test_merge_sends_the_head_it_was_passed_at_and_deletes_the_branch(self):
        fake = FakeGh(routes({"repos/o/n/pulls/7/merge": {"merged": True},
                              "repos/o/n/git/refs/heads/feature/x": ""}))
        with mock.patch("soirely_queue.github.gh", fake):
            github.merge(7, HEAD, delete_branch=True)
        (put, body), _, (delete, _) = fake.calls
        self.assertEqual(put[1:4], ("repos/o/n/pulls/7/merge", "--method", "PUT"))
        self.assertEqual(json.loads(body), {"sha": HEAD, "merge_method": "merge"})
        self.assertEqual(delete[1:], ("repos/o/n/git/refs/heads/feature/x", "--method", "DELETE"))

    def test_checks_fall_back_to_rest_with_the_workflow_name(self):
        spent = subprocess.CompletedProcess([], 1, "", "GraphQL: API rate limit exceeded")
        fake = FakeGh(routes({"repos/o/n/actions/runs/5": {"name": "CI"}}))
        with mock.patch("subprocess.run", return_value=spent), \
                mock.patch("soirely_queue.github.gh", fake):
            found = github.pr_checks(7)
        self.assertEqual(found, [{"name": "test", "state": "SUCCESS", "bucket": "pass",
                                  "link": "https://github.com/o/n/actions/runs/5/job/6",
                                  "workflow": "CI"}])

    def test_a_thread_read_over_rest_refuses_to_resolve_without_calling(self):
        fake = FakeGh({})
        with mock.patch("soirely_queue.github.gh", fake):
            with self.assertRaises(github.RateLimited):
                github.resolve("rest:23")
        self.assertEqual(fake.calls, [])


if __name__ == "__main__":
    unittest.main()


class Verdicts(unittest.TestCase):
    def test_a_back_review_reads_in_its_new_wording_and_its_old_one(self):
        for line in ("Failed code review: 2 blocking.", "Back to In Progress: 2 blocking."):
            review = {"body": f"## Review (from lead)\n\nNo.\n\n{line}",
                      "commit": {"oid": HEAD}}
            self.assertEqual(github.verdict(review),
                             {"verdict": "back", "sha": HEAD, "blocking": 2}, line)
