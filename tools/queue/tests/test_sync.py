"""Which Shortcut searches a sync makes: no network here."""

import unittest
from unittest import mock

from soirely_queue import github, roles, store, sync

NOW = 1_000_000.0


class FakeShortcut:
    def __init__(self):
        self.searches = []
        self.epic_reads = 0

    def workflows(self):
        return [{"states": [{"id": 1, "name": "Ready For Dev"}]}]

    def epics(self):
        self.epic_reads += 1
        return [{"id": 2, "name": "Two", "state": "to do", "epic_state_id": 9}]

    def epic_states(self):
        return [{"id": 9, "name": "Waiting for Owner Approval"}]

    def search(self, query):
        self.searches.append(query)
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

    def test_the_story_of_an_open_pr_is_fetched_again_to_see_it_archived(self):
        db, asked, archived = store.connect(":memory:"), [], []

        class Shortcut(FakeShortcut):
            def story(self, story_id):
                asked.append(story_id)
                return {"id": story_id, "name": "old", "workflow_state_id": 1,
                        "completed": False, "archived": bool(archived)}

        store.put_prs(db, [{"number": 1, "story_id": 10, "state": "open", "head_sha": "a"}])
        sync.pr_stories(db, Shortcut(), NOW)
        archived.append(True)
        sync.pr_stories(db, Shortcut(), NOW + 60)
        self.assertFalse(store.story(db, 10)["archived"])
        sync.pr_stories(db, Shortcut(), NOW + sync.FULL_EVERY_SECONDS)
        self.assertTrue(store.story(db, 10)["archived"])
        sync.pr_stories(db, Shortcut(), NOW + 2 * sync.FULL_EVERY_SECONDS)
        self.assertEqual(asked, [10, 10])


class Blockers(unittest.TestCase):
    """A story's blockers are fetched whatever state they are in, so each is judged by it."""

    def test_a_blocker_no_search_found_is_fetched_and_one_still_holding_again_in_full(self):
        db, asked, archived = store.connect(":memory:"), [], []

        class Shortcut(FakeShortcut):
            def story(self, story_id):
                asked.append(story_id)
                if story_id == 404:
                    raise sync.ShortcutError("Shortcut 404 on GET /api/v3/stories/404: gone")
                return {"id": story_id, "name": "blocker", "workflow_state_id": 1,
                        "archived": bool(archived)}

        links = [{"verb": "blocks", "subject": b, "object": 1} for b in (7, 404)]
        store.put_story(db, {"id": 1, "state": "Ready For Dev", "done": False, "labels": [],
                             "links": links, "updated_at": "t0"})
        sync.sync_blockers(db, Shortcut(), {"1": "In Review"}, {})
        sync.sync_blockers(db, Shortcut(), {"1": "In Review"}, {})
        self.assertEqual(asked, [7, 404])
        self.assertEqual(store.story(db, 7)["state"], "In Review")
        archived.append(True)
        sync.sync_blockers(db, Shortcut(), {"1": "In Review"}, {}, full=True)
        self.assertEqual(asked, [7, 404, 7])
        self.assertTrue(store.story(db, 7)["archived"])
        sync.sync_blockers(db, Shortcut(), {"1": "In Review"}, {}, full=True)
        self.assertEqual(asked, [7, 404, 7])


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

    def test_a_pr_story_fetch_out_of_time_leaves_pr_stories_at_unset(self):
        db = store.connect(":memory:")
        store.put_prs(db, [{"number": 1, "story_id": 10, "state": "open", "head_sha": "a"}])
        with self.assertRaises(sync.OutOfTime):
            sync.pr_stories(db, self.Late(), NOW)
        self.assertIsNone(store.get_meta(db, "pr_stories_at"))

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

            def search(self, query):
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

    def test_github_out_of_time_is_cut_and_pr_stories_skipped(self):
        def slow_github(db):
            raise github.OutOfTime("out of time in gh api graphql")

        with mock.patch.object(sync, "pr_stories") as stories:
            self.assertEqual(self.run_sync(github_step=slow_github), [])
        stories.assert_not_called()
        self.assertEqual(store.get_meta(self.db, "sync_report")["cut"], ["github"])

    def test_each_part_reports_how_long_it_took(self):
        def github_takes_four(db):
            self.clock += 4

        self.run_sync(github_step=github_takes_four)
        self.assertEqual(store.get_meta(self.db, "sync_report")["took"],
                         {"shortcut": 0.0, "github": 4.0, "pr stories": 0.0})

    def test_a_manual_sync_has_no_budget(self):
        with mock.patch.object(sync, "sync_github"), mock.patch.object(sync, "pr_stories"):
            sync.sync(self.db, NOW, budget=None, client=self.client(False))
        self.assertIsNone(self.made[0].deadline)
