import unittest
from unittest import mock

from soirely_queue import digests


class Digest:
    def __init__(self, role):
        self.role = role
        self.lines = []

    def add(self, *lines):
        self.lines.extend(lines)


def ready(id_):
    return {"id": id_, "name": f"story {id_}", "state": "Ready For Dev", "labels": [],
            "epic": None, "epic_id": None, "position": id_, "moved_at": "t0", "done": False}


class Developers(unittest.TestCase):
    def pick(self, role, stories):
        p = Digest(role)
        with mock.patch.object(digests, "untaken", side_effect=lambda db, role, s: s), \
                mock.patch.object(digests.store, "get_meta", return_value=None):
            digests.developer(p, None, stories)
        return p.lines[-1].split()[-1]

    def test_developers_reaching_ready_for_dev_together_pick_different_stories(self):
        stories = [ready(n) for n in range(1, 6)]
        picks = [self.pick(role, stories) for role in ("dev", "dev2", "dev3", "dev4")]
        self.assertEqual(picks, ["sc-1", "sc-2", "sc-3", "sc-4"])

    def test_with_fewer_stories_than_its_number_a_developer_takes_the_first(self):
        self.assertEqual(self.pick("dev4", [ready(1), ready(2)]), "sc-1")

    def test_a_story_labelled_for_a_developer_comes_before_the_shared_ones(self):
        own = dict(ready(9), labels=["dev4"])
        self.assertEqual(self.pick("dev4", [ready(n) for n in range(1, 6)] + [own]),
                         "sc-9")

