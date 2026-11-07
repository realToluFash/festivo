"""Which Shortcut searches a sync makes: no network here."""

import unittest

from soirely_queue import roles, store, sync

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
