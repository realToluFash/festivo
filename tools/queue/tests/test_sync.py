"""Which Shortcut searches a sync makes: no network here."""

import datetime
import sqlite3
import tempfile
import time
import unittest
from unittest import mock

from soirely_queue import github, roles, store, sync
from soirely_queue.shortcut import ShortcutError

NOW = 1_000_000.0


class FakeShortcut:
    def __init__(self):
        self.searches = []
        self.epic_reads = 0

    def workflows(self):
        return [{"states": [{"id": i, "name": name}
                            for i, name in enumerate(roles.QUEUE_STATES, 1)]}]

    def epics(self):
        self.epic_reads += 1
        return [{"id": 2, "name": "Two", "state": "to do", "epic_state_id": 9}]

    def epic_states(self):
        return [{"id": 9, "name": "Waiting for Owner Approval"}]

    def find(self, **filters):
        if "workflow_state_id" in filters:
            self.searches.append(f'state:"{roles.QUEUE_STATES[filters["workflow_state_id"] - 1]}"')
        else:
            archived = "archived " if filters.get("archived") else ""
            self.searches.append(f"{archived}updated:{filters['updated_at_start']}")
        return []

    def story(self, story_id):
        raise AssertionError(f"no story should be fetched, asked for {story_id}")


class States(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")
        self.shortcut = FakeShortcut()

    def states(self, now):
        self.shortcut.searches.clear()
        sync.sync_shortcut(self.db, self.shortcut, now)
        return [q for q in self.shortcut.searches if q.startswith("state:")]

    def test_the_first_pass_searches_every_queue_state(self):
        self.assertEqual(len(self.states(NOW)), len(roles.QUEUE_STATES))

    def test_ready_for_dev_alone_is_searched_every_five_minutes(self):
        self.states(NOW)
        self.assertEqual(self.states(NOW + 60), [])
        self.assertEqual(self.states(NOW + 5 * 60), ['state:"Ready For Dev"'])
        self.assertEqual(self.states(NOW + 6 * 60), [])

    def test_every_state_again_after_fifteen_minutes(self):
        self.states(NOW)
        self.states(NOW + 5 * 60)
        self.assertEqual(len(self.states(NOW + 15 * 60)), len(roles.QUEUE_STATES))


class Since(unittest.TestCase):
    """A sync asks only for what changed since the last whole one, to the second."""

    def since(self, db, now):
        shortcut = FakeShortcut()
        sync.sync_shortcut(db, shortcut, now)
        return [q for q in shortcut.searches if q.startswith("updated:")]

    def at(self, seconds):
        return "updated:" + datetime.datetime.fromtimestamp(seconds, datetime.UTC).isoformat()

    def test_a_full_sync_reads_fourteen_days_and_the_next_from_the_last_less_overlap(self):
        db = store.connect(":memory:")
        self.assertEqual(self.since(db, NOW), [self.at(NOW - sync.INBOX_DAYS * 86400)])
        self.assertEqual(self.since(db, NOW + 60),
                         [self.at(NOW - sync.OVERLAP_SECONDS)])

    def test_a_cut_sync_leaves_the_next_reading_from_the_last_whole_one(self):
        db = store.connect(":memory:")
        self.since(db, NOW)

        class Late(FakeShortcut):
            def story(self, story_id):
                raise sync.OutOfTime("out of time")

            def find(self, **filters):
                super().find(**filters)
                return [{"id": 5, "updated_at": "t1"}]
        with self.assertRaises(sync.OutOfTime):
            sync.sync_shortcut(db, Late(), NOW + 60)
        self.assertEqual(self.since(db, NOW + 120), [self.at(NOW - sync.OVERLAP_SECONDS)])

    def test_a_story_archived_since_is_asked_for_and_stored_archived(self):
        db = store.connect(":memory:")
        store.put_story(db, {"id": 7, "state": "Done", "done": True, "labels": [],
                             "links": [], "updated_at": "t0", "archived": False})

        class Archived(FakeShortcut):
            def find(self, **filters):
                super().find(**filters)
                return [{"id": 7, "updated_at": "t1"}] if filters.get("archived") else []

            def story(self, story_id):
                return {"id": story_id, "name": "old", "workflow_state_id": 1,
                        "updated_at": "t1", "archived": True}
        shortcut = Archived()
        sync.sync_shortcut(db, shortcut, NOW)
        self.assertIn("archived " + self.at(NOW - sync.INBOX_DAYS * 86400), shortcut.searches)
        self.assertTrue(store.story(db, 7)["archived"])

    def test_never_further_back_than_a_day_between_full_syncs(self):
        db = store.connect(":memory:")
        store.set_meta(db, "full_at", NOW)
        store.set_meta(db, "slim_version", sync.SLIM_VERSION)
        self.assertEqual(self.since(db, NOW + 60), [self.at(NOW + 60 - 86400)])


class DesignBranchMoves(unittest.TestCase):
    """GitHub moves a story to Ready For Dev when a ux/ branch naming it is pushed; the sync
    puts it back in Needs Design, since its demo has not merged."""

    ID = {name: i for i, name in enumerate(roles.QUEUE_STATES, 1)}

    def move(self, old, new, **source):
        return {"actions": [{"changes": {"workflow_state_id": {
            "old": self.ID[old], "new": self.ID[new]}}}], **source}

    def branch(self, name):
        return {"references": [{"entity_type": "branch", "id": 7, "name": name}]}

    def sync(self, history, branch="ux/sc-5-pill", prs=(), failures=0, runs=1, pulls=(),
             pull_requests=()):
        db, test = store.connect(":memory:"), self
        store.put_prs(db, list(prs))
        updates, failing = [], [failures]

        class Pushed(FakeShortcut):
            def find(self, **filters):
                super().find(**filters)
                return [] if filters.get("archived") else [{"id": 5, "updated_at": "t1"}]

            def story(self, story_id):
                return {"id": story_id, "name": "pill", "updated_at": "t1",
                        "workflow_state_id": test.ID["Ready For Dev"],
                        "branches": [{"name": branch, "pull_requests": list(pulls)}],
                        "pull_requests": list(pull_requests)}

            def history(self, story_id):
                if failing[0]:
                    failing[0] -= 1
                    raise ShortcutError("503 Service Unavailable")
                return history

            def update(self, story_id, **fields):
                updates.append((story_id, fields))
                return dict(self.story(story_id), **fields, updated_at="t2")
        for run in range(runs):
            sync.sync_shortcut(db, Pushed(), NOW + run * 60)
        self.synced_at = store.get_meta(db, "shortcut_at")
        return updates, store.story(db, 5)["state"]

    def test_a_ux_branch_push_out_of_needs_design_is_undone(self):
        updates, state = self.sync([self.move("To Do", "Needs Design"),
                                    self.move("Needs Design", "Ready For Dev",
                                              **self.branch("ux/sc-5-pill"))])
        self.assertEqual(updates, [(5, {"workflow_state_id": self.ID["Needs Design"]})])
        self.assertEqual(state, "Needs Design")

    def test_a_ux_pull_request_opened_out_of_needs_design_is_undone(self):
        pr = {"entity_type": "pull-request", "id": 9, "number": 3888}
        updates, _ = self.sync([self.move("Needs Design", "Ready For Dev", references=[pr])],
                               prs=[{"number": 3888, "story_id": 5, "branch": "ux/sc-5-pill"}])
        self.assertEqual(len(updates), 1)

    def test_a_person_moving_it_is_left_alone(self):
        updates, state = self.sync([self.move("Needs Design", "Ready For Dev",
                                              member_id="m-1")])
        self.assertEqual((updates, state), ([], "Ready For Dev"))

    def test_a_feature_branch_is_left_alone(self):
        name = "feature/sc-5/pill"
        updates, _ = self.sync([self.move("Needs Design", "Ready For Dev",
                                          **self.branch(name))], branch=name)
        self.assertEqual(updates, [])

    def test_a_move_from_another_state_is_left_alone(self):
        updates, _ = self.sync([self.move("To Do", "Ready For Dev",
                                          **self.branch("ux/sc-5-pill"))])
        self.assertEqual(updates, [])

    def test_a_history_shortcut_fails_on_is_read_again_next_sync(self):
        moved = [self.move("Needs Design", "Ready For Dev", **self.branch("ux/sc-5-pill"))]
        updates, state = self.sync(moved, failures=1)
        self.assertEqual((updates, state, self.synced_at), ([], "Ready For Dev", NOW))
        updates, state = self.sync(moved, failures=1, runs=2)
        self.assertEqual((len(updates), state), (1, "Needs Design"))

    def test_a_merged_demo_stays_however_the_story_was_fetched(self):
        merged = {"number": 2154, "merged": True, "closed": True}
        updates, state = self.sync(self.pushed(), pulls=[merged])
        self.assertEqual((updates, state), ([], "Ready For Dev"))

    def test_a_closed_demo_pull_request_counts_as_finished(self):
        updates, _ = self.sync(self.pushed(), pulls=[{"number": 2154, "closed": True}])
        self.assertEqual(updates, [])

    def test_the_integrations_move_on_the_merge_stands(self):
        merge = self.move("Needs Design", "Ready For Dev",
                          references=[{"entity_type": "pull-request", "id": 9, "number": 2154}])
        updates, _ = self.sync([*self.pushed(), self.move("Ready For Dev", "Needs Design"),
                                merge], pulls=[{"number": 2154, "merged": True}],
                               prs=[{"number": 2154, "story_id": 5, "branch": "ux/sc-5-pill",
                                     "state": "open"}])
        self.assertEqual(updates, [])

    def test_a_merge_github_has_seen_before_shortcut_stands(self):
        updates, _ = self.sync(self.pushed(), pulls=[{"number": 2154}],
                               prs=[{"number": 2154, "story_id": 5, "branch": "ux/sc-5-pill",
                                     "state": "merged"}])
        self.assertEqual(updates, [])

    def test_an_open_demo_pull_request_is_undone(self):
        updates, state = self.sync(self.pushed(), pulls=[{"number": 3888}])
        self.assertEqual((len(updates), state), (1, "Needs Design"))

    def test_a_second_ux_branch_still_open_is_undone(self):
        updates, _ = self.sync(self.pushed(), pulls=[{"number": 2154, "merged": True}],
                               pull_requests=[{"number": 3888, "branch_name": "ux/sc-5-states"}])
        self.assertEqual(len(updates), 1)

    def test_a_pull_request_only_shortcut_names_resolves_the_move(self):
        merge = self.move("Needs Design", "Ready For Dev",
                          references=[{"entity_type": "pull-request", "id": 9, "number": 3888}])
        updates, _ = self.sync([merge], pulls=[{"number": 3888}])
        self.assertEqual(len(updates), 1)

    def pushed(self):
        return [self.move("Needs Design", "Ready For Dev", **self.branch("ux/sc-5-pill"))]

    def test_only_the_last_move_counts(self):
        updates, _ = self.sync([self.move("Needs Design", "Ready For Dev",
                                          **self.branch("ux/sc-5-pill")),
                                {"changed_at": "later"},
                                self.move("Ready For Dev", "Needs Design"),
                                self.move("Needs Design", "Ready For Dev", member_id="m-1")])
        self.assertEqual(updates, [])


class Epics(unittest.TestCase):
    def test_epics_are_read_every_minute_with_their_state_name(self):
        db, shortcut = store.connect(":memory:"), FakeShortcut()
        sync.sync_shortcut(db, shortcut, NOW)
        sync.sync_shortcut(db, shortcut, NOW + 30)
        sync.sync_shortcut(db, shortcut, NOW + 60)
        self.assertEqual(shortcut.epic_reads, 2)
        self.assertEqual(store.get_meta(db, "epics")["2"]["state_name"],
                         "Waiting for Owner Approval")


class PullRequestStories(unittest.TestCase):
    """An open pull request's story is fetched however old it is, and a missing one once."""

    def test_the_story_of_an_open_pr_is_fetched_and_a_missing_one_remembered(self):
        db, asked = store.connect(":memory:"), []

        class Shortcut(FakeShortcut):
            def story(self, story_id):
                asked.append(story_id)
                if story_id == 404:
                    raise sync.ShortcutError("Shortcut 404 on GET /api/v3/stories/404: gone")
                return {"id": story_id, "name": "old", "workflow_state_id": 1,
                        "completed": True, "archived": story_id == 11}

        store.put_prs(db, [{"number": n, "story_id": s, "state": state, "head_sha": "a"}
                           for n, s, state in ((1, 10, "open"), (2, 11, "open"),
                                               (3, 404, "open"), (4, 12, "merged"),
                                               (5, None, "open"))])
        sync.pr_stories(db, Shortcut(), NOW)
        sync.pr_stories(db, Shortcut(), NOW + 60)
        self.assertEqual(sorted(asked), [10, 11, 404])
        self.assertTrue(store.story(db, 10)["done"])
        self.assertTrue(store.story(db, 11)["archived"])
        self.assertEqual(store.get_meta(db, "missing_stories"), [404])

    def test_a_stored_pr_story_is_not_fetched_again(self):
        db, asked = store.connect(":memory:"), []

        class Shortcut(FakeShortcut):
            def story(self, story_id):
                asked.append(story_id)
                return {"id": story_id, "name": "old", "workflow_state_id": 1}

        store.put_prs(db, [{"number": 1, "story_id": 10, "state": "open", "head_sha": "a"}])
        sync.pr_stories(db, Shortcut(), NOW)
        sync.pr_stories(db, Shortcut(), NOW + sync.FULL_EVERY_SECONDS)
        self.assertEqual(asked, [10])


class DemoPullRequests(unittest.TestCase):
    """A demo-only story whose demo merged before the window of 15 merges still has it."""

    def setUp(self):
        self.db, self.asked = store.connect(":memory:"), []

    def story(self, id_, state="Ready For Dev", labels=("demo only",), **extra):
        store.put_story(self.db, {"id": id_, "name": "demo", "state": state,
                                  "labels": list(labels), "done": False, **extra})

    def merged(self, number, story_id):
        return {"number": number, "story_id": story_id, "state": "merged", "head_sha": "a",
                "branch": f"ux/sc-{story_id}-demo", "merged_at": "2026-11-07T19:00:00Z"}

    def run_at(self, now, found=None):
        def search(story_id):
            self.asked.append(story_id)
            if isinstance(found, Exception):
                raise found
            return [self.merged(40 + story_id, story_id)]
        with mock.patch.object(github, "merged_for_story", side_effect=search):
            sync.demo_prs(self.db, now)
        return sorted(pr["number"] for pr in store.prs(self.db))

    def test_a_stranded_demo_is_found_and_stored_beside_the_window(self):
        self.story(1)
        store.put_prs(self.db, [self.merged(99, 5)])
        self.assertEqual(self.run_at(NOW), [41, 99])
        self.assertEqual(store.prs_for_story(self.db, 1)[0]["number"], 41)
        self.assertEqual(self.asked, [1])

    def test_it_is_searched_once_a_day_and_kept_across_syncs(self):
        self.story(1)
        self.run_at(NOW)
        store.put_prs(self.db, [])
        self.assertEqual(self.run_at(NOW + 60), [41])
        store.put_prs(self.db, [])
        self.run_at(NOW + sync.DEMO_SEARCH_SECONDS)
        self.assertEqual(self.asked, [1, 1])

    def test_a_failed_search_keeps_what_was_found(self):
        self.story(1)
        self.run_at(NOW)
        store.put_prs(self.db, [])
        self.assertEqual(self.run_at(NOW + sync.DEMO_SEARCH_SECONDS,
                                     github.GitHubError("rate")), [41])

    def test_only_a_demo_only_story_waiting_on_its_build_is_searched(self):
        self.story(1, labels=())
        self.story(2, state="Ready For QA")
        self.story(3, done=True, state="Done")
        self.story(4, archived=True)
        self.story(5)
        store.put_prs(self.db, [self.merged(50, 5)])
        self.assertEqual(self.run_at(NOW), [50])
        self.assertEqual(self.asked, [])


class Blockers(unittest.TestCase):
    """A story's blockers are fetched whatever state they are in, so each is judged by it."""

    def test_a_blocker_no_search_found_is_fetched_once(self):
        db, asked = store.connect(":memory:"), []

        class Shortcut(FakeShortcut):
            def story(self, story_id):
                asked.append(story_id)
                if story_id == 404:
                    raise sync.ShortcutError("Shortcut 404 on GET /api/v3/stories/404: gone")
                return {"id": story_id, "name": "blocker", "workflow_state_id": 1}

        links = [{"verb": "blocks", "subject": b, "object": 1} for b in (7, 404)]
        store.put_story(db, {"id": 1, "state": "Ready For Dev", "done": False, "labels": [],
                             "links": links, "updated_at": "t0"})
        sync.sync_blockers(db, Shortcut(), {"1": "In Review"}, {})
        sync.sync_blockers(db, Shortcut(), {"1": "In Review"}, {})
        self.assertEqual(asked, [7, 404])
        self.assertEqual(store.story(db, 7)["state"], "In Review")


class OutOfTimeInAPart(unittest.TestCase):
    """A deadline that passes while one story is fetched cuts the sync; nothing is marked
    rechecked that was not."""

    class Late(FakeShortcut):
        def story(self, story_id):
            raise sync.OutOfTime("out of time: Shortcut timed out")

    def test_a_blocker_fetch_out_of_time_cuts_the_full_sync(self):
        db = store.connect(":memory:")
        store.set_meta(db, "slim_version", sync.SLIM_VERSION)
        links = [{"verb": "blocks", "subject": 7, "object": 1}]
        store.put_story(db, {"id": 1, "state": "Ready For Dev", "done": False, "labels": [],
                             "links": links, "updated_at": "t0"})
        with self.assertRaises(sync.OutOfTime):
            sync.sync_shortcut(db, self.Late(), NOW, full=True)
        self.assertIsNone(store.get_meta(db, "full_at"))
        self.assertIsNone(store.get_meta(db, "missing_stories"))

    def test_a_pr_story_fetch_out_of_time_remembers_nothing_missing(self):
        db = store.connect(":memory:")
        store.put_prs(db, [{"number": 1, "story_id": 10, "state": "open", "head_sha": "a"}])
        with self.assertRaises(sync.OutOfTime):
            sync.pr_stories(db, self.Late(), NOW)
        self.assertIsNone(store.get_meta(db, "missing_stories"))

    def test_github_out_of_time_stops_without_waiting_on_another_writer(self):
        with tempfile.TemporaryDirectory() as folder:
            path = f"{folder}/queue.db"
            db = store.connect(path)
            store.set_meta(db, "repository", ["o", "n"])
            other = sqlite3.connect(path, isolation_level=None)
            other.execute("begin immediate")
            begun = time.monotonic()
            try:
                with github.deadline(begun - 1), self.assertRaises(github.OutOfTime):
                    sync.sync_github(db)
            finally:
                other.execute("rollback")
                other.close()
                db.close()
            self.assertLess(time.monotonic() - begun, 1)

    def test_a_new_slim_version_cut_after_the_delete_leaves_the_next_sync_full(self):
        class LateSearch(FakeShortcut):
            def find(self, **filters):
                raise sync.OutOfTime("out of time: Shortcut timed out")

        db = store.connect(":memory:")
        store.set_meta(db, "full_at", NOW - 5 * 60)
        store.put_story(db, {"id": 1, "state": "In Review", "done": False, "labels": [],
                             "links": [], "updated_at": "t0"})
        with self.assertRaises(sync.OutOfTime):
            sync.sync_shortcut(db, LateSearch(), NOW)
        self.assertIsNone(store.story(db, 1))
        shortcut = FakeShortcut()
        sync.sync_shortcut(db, shortcut, NOW + 60)
        self.assertIn('state:"In Review"', shortcut.searches)

class Budget(unittest.TestCase):
    """A sync that runs out of its budget stops without failing the tick."""

    def setUp(self):
        self.db = store.connect(":memory:")
        self.clock = 0.0
        self.made = []

    def client(self, slow):
        test = self

        class Slow(FakeShortcut):
            def __init__(self, deadline, clock):
                super().__init__()
                self.deadline = deadline
                test.made.append(self)

            def find(self, **filters):
                if slow:
                    test.clock = self.deadline
                    raise sync.OutOfTime("out of time: Shortcut timed out")
                return []
        return Slow

    def run_sync(self, slow=False, github_step=None):
        with mock.patch.object(sync, "sync_github", side_effect=github_step or (lambda db: None)):
            return sync.sync(self.db, NOW, clock=lambda: self.clock, client=self.client(slow))

    def test_a_shortcut_part_out_of_time_is_cut_not_an_error(self):
        store.set_meta(self.db, "synced_ok_at", NOW - 60)
        self.assertEqual(self.run_sync(slow=True), [])
        report = store.get_meta(self.db, "sync_report")
        self.assertEqual((report["at"], report["cut"]), (NOW, ["shortcut"]))
        self.assertEqual(store.get_meta(self.db, "synced_ok_at"), NOW - 60)

    def test_the_deadline_is_the_budget_from_the_start(self):
        self.clock = 100.0
        self.run_sync()
        self.assertEqual(self.made[0].deadline, 100.0 + sync.BUDGET_SECONDS)
        self.assertEqual(store.get_meta(self.db, "synced_ok_at"), NOW)

    def test_github_out_of_time_is_cut_and_pr_stories_and_demos_skipped(self):
        def slow_github(db):
            raise github.OutOfTime("out of time in gh api graphql")

        with mock.patch.object(sync, "pr_stories") as stories, \
                mock.patch.object(sync, "demo_prs") as demos:
            self.assertEqual(self.run_sync(github_step=slow_github), [])
        stories.assert_not_called()
        demos.assert_not_called()
        self.assertEqual(store.get_meta(self.db, "sync_report")["cut"], ["github"])

    def test_each_part_reports_how_long_it_took(self):
        def github_takes_four(db):
            self.clock += 4

        self.run_sync(github_step=github_takes_four)
        self.assertEqual(store.get_meta(self.db, "sync_report")["took"],
                         {"shortcut": 0.0, "github": 4.0, "demo prs": 0.0,
                          "pr stories": 0.0})

    def test_a_manual_sync_has_no_budget(self):
        with mock.patch.object(sync, "sync_github"), mock.patch.object(sync, "pr_stories"):
            sync.sync(self.db, NOW, budget=None, client=self.client(False))
        self.assertIsNone(self.made[0].deadline)
