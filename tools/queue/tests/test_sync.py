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
