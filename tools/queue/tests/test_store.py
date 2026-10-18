import unittest

from soirely_queue import store

NOW = 1_000_000.0


def item(fingerprint, roles, kind="story", comments=None):
    return {"fingerprint": fingerprint, "pool": roles[0], "roles": roles, "kind": kind,
            "reason": fingerprint, "priority": 40, "story_id": 1, "pr": None,
            "comments": comments}


class Claims(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")

    def test_a_pooled_item_goes_to_one_role_only(self):
        store.record(self.db, [item("qa:story:sc-1", ["qa", "qa2"])], NOW)
        self.assertIsNotNone(store.claim(self.db, "qa", NOW))
        self.assertIsNone(store.claim(self.db, "qa2", NOW))

    def test_a_role_holds_one_item_at_a_time(self):
        store.record(self.db, [item("a", ["dev"]), item("b", ["dev"])], NOW)
        store.claim(self.db, "dev", NOW)
        self.assertIsNone(store.claim(self.db, "dev", NOW))
        self.assertIsNotNone(store.held_by(self.db, "dev", NOW))

    def test_a_lapsed_lease_puts_the_item_back(self):
        store.record(self.db, [item("a", ["dev"])], NOW)
        store.claim(self.db, "dev", NOW)
        later = NOW + (store.LEASE_MINUTES + 1) * 60
        store.record(self.db, [item("a", ["dev"])], later)
        self.assertIsNone(store.held_by(self.db, "dev", later))
        self.assertIsNotNone(store.claim(self.db, "dev", later))

    def test_finished_work_does_not_come_back(self):
        store.record(self.db, [item("a", ["dev"])], NOW)
        row = store.claim(self.db, "dev", NOW)
        store.finish(self.db, row["id"], "built", NOW)
        store.record(self.db, [item("a", ["dev"])], NOW + 60)
        self.assertIsNone(store.claim(self.db, "dev", NOW + 60))

    def test_work_that_no_longer_applies_is_retired(self):
        store.record(self.db, [item("a", ["dev"])], NOW)
        store.record(self.db, [], NOW + 60)
        self.assertEqual(store.waiting(self.db, "dev"), [])

    def test_finishing_an_inbox_item_marks_its_comments_handled(self):
        store.record(self.db, [item("lead:inbox", ["lead"], "inbox", [11, 12])], NOW)
        row = store.claim(self.db, "lead", NOW)
        store.finish(self.db, row["id"], None, NOW)
        self.assertEqual(store.handled(self.db), {("lead", 11), ("lead", 12)})
        self.assertEqual(store.last_run(self.db, "lead"), NOW)


if __name__ == "__main__":
    unittest.main()


class FormerLinguists(unittest.TestCase):
    def test_what_the_locale_roles_dealt_with_and_noted_is_the_linguists(self):
        db = store.connect(":memory:")
        store.mark_handled(db, "fr", [41, 42])
        store.mark_handled(db, "pm", [43])
        store.add_note(db, "pt", 7, "pt merged at abc1234", NOW)
        store.merge_linguists(db)
        store.merge_linguists(db)
        self.assertLessEqual({("l10n", 41), ("l10n", 42)}, store.handled(db))
        self.assertNotIn(("l10n", 43), store.handled(db))
        self.assertEqual([row["note"] for row in store.notes(db, "l10n", 7)],
                         ["pt merged at abc1234"])
