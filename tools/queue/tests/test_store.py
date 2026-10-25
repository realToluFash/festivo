import os
import tempfile
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

    def test_a_role_with_several_workers_holds_one_item_each(self):
        store.record(self.db, [dict(item(f, ["pm"]), story_id=n)
                               for n, f in enumerate("abc")], NOW)
        first = store.claim(self.db, "pm", NOW, worker="pm", workers=2)
        second = store.claim(self.db, "pm", NOW, worker="pm-2", workers=2)
        self.assertNotEqual(first["id"], second["id"])
        self.assertIsNone(store.claim(self.db, "pm", NOW, worker="pm-3", workers=2))
        self.assertIsNone(store.claim(self.db, "pm", NOW, worker="pm", workers=3))
        self.assertEqual(store.held_by(self.db, "pm", NOW, "pm-2")["id"], second["id"])

    def test_two_workers_never_hold_the_same_story(self):
        store.record(self.db, [dict(item("a", ["pm"]), story_id=7),
                               dict(item("b", ["pm"]), story_id=7),
                               dict(item("c", ["pm"]), story_id=8)], NOW)
        store.claim(self.db, "pm", NOW, worker="pm", workers=2)
        self.assertEqual(store.claim(self.db, "pm", NOW, worker="pm-2", workers=2)["story_id"], 8)

    def test_two_lead_workers_never_hold_the_same_pull_request(self):
        store.record(self.db, [dict(item("review", ["lead"]), story_id=None, pr=40),
                               dict(item("threads", ["lead"]), story_id=None, pr=40),
                               dict(item("other", ["lead"]), story_id=None, pr=41)], NOW)
        self.assertEqual(store.claim(self.db, "lead", NOW, worker="lead", workers=2)["pr"], 40)
        self.assertEqual(store.claim(self.db, "lead", NOW, worker="lead-2", workers=2)["pr"], 41)

    def test_a_claim_made_by_hand_counts_as_the_first_worker_s(self):
        store.record(self.db, [item("a", ["pm"]), item("b", ["pm"])], NOW)
        store.claim(self.db, "pm", NOW)
        self.assertIsNotNone(store.held_by(self.db, "pm", NOW, "pm"))
        self.assertIsNone(store.held_by(self.db, "pm", NOW, "pm-2"))

    def test_a_lapsed_lease_puts_the_item_back(self):
        store.record(self.db, [item("a", ["dev"])], NOW)
        store.claim(self.db, "dev", NOW)
        later = NOW + (store.LEASE_MINUTES + 1) * 60
        store.record(self.db, [item("a", ["dev"])], later)
        self.assertIsNone(store.held_by(self.db, "dev", later))
        self.assertIsNotNone(store.claim(self.db, "dev", later))

    def test_an_open_item_takes_its_new_priority(self):
        store.record(self.db, [item("a", ["dev"]), item("b", ["dev"])], NOW)
        store.record(self.db, [item("a", ["dev"]), dict(item("b", ["dev"]), priority=5)],
                     NOW + 60)
        self.assertEqual(store.claim(self.db, "dev", NOW + 60)["fingerprint"], "b")

    def test_an_open_item_follows_the_roles_it_is_now_derived_for(self):
        store.record(self.db, [item("dev:story:sc-1", ["dev", "dev2"])], NOW)
        store.record(self.db, [item("dev:story:sc-1", ["dev", "dev2", "dev3"])], NOW + 60)
        self.assertEqual(store.waiting(self.db, "dev3")[0]["fingerprint"], "dev:story:sc-1")
        self.assertIsNotNone(store.claim(self.db, "dev3", NOW + 60))

    def test_a_role_dropped_from_an_open_item_is_no_longer_offered_it(self):
        store.record(self.db, [item("a", ["qa", "qa2"])], NOW)
        store.record(self.db, [item("a", ["qa"])], NOW + 60)
        self.assertEqual(store.waiting(self.db, "qa2"), [])

    def test_a_claimed_item_keeps_its_roles(self):
        store.record(self.db, [item("a", ["dev", "dev2"])], NOW)
        store.claim(self.db, "dev", NOW)
        store.record(self.db, [item("a", ["dev2", "dev3"])], NOW + 60)
        row = store.held_by(self.db, "dev", NOW + 60)
        self.assertEqual(row["roles"], "dev,dev2")

    def test_a_gone_item_reopens_for_its_new_roles(self):
        store.record(self.db, [item("a", ["dev"])], NOW)
        store.record(self.db, [], NOW + 60)
        store.record(self.db, [item("a", ["dev", "dev2"])], NOW + 120)
        self.assertEqual(store.waiting(self.db, "dev2")[0]["status"], "open")

    def test_within_a_priority_the_lower_rank_is_claimed_first(self):
        store.record(self.db, [dict(item("a", ["dev"]), rank=4),
                               dict(item("b", ["dev"]), rank=1)], NOW)
        self.assertEqual(store.claim(self.db, "dev", NOW)["fingerprint"], "b")

    def test_a_queue_from_before_ranks_gains_the_column(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "queue.db")
            old = store.connect(path)
            old.execute("drop table work")
            old.execute("create table work (id integer primary key, fingerprint text unique, "
                        "pool text, roles text, kind text, story_id integer, pr integer, "
                        "reason text, priority integer, comments text, status text default "
                        "'open', claimed_by text, lease_until real, first_seen real, "
                        "done_at real, note text)")
            old.close()
            db = store.connect(path)
            store.record(db, [item("a", ["dev"])], NOW)
            self.assertEqual(store.claim(db, "dev", NOW)["rank"], 0)
            db.close()

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

    def test_worked_on_is_when_the_role_last_finished_an_item_on_each_story(self):
        story = lambda fp, story_id: dict(item(fp, ["l10n", "pm"]), story_id=story_id)
        store.record(self.db, [story("a", 1), story("b", 1), story("c", 2), story("d", 3)], NOW)
        for role, at in (("l10n", NOW + 10), ("l10n", NOW + 20), ("pm", NOW + 30)):
            store.finish(self.db, store.claim(self.db, role, NOW)["id"], None, at)
        store.claim(self.db, "l10n", NOW + 40)
        self.assertEqual(store.worked_on(self.db, "l10n"), {1: NOW + 20})
        self.assertEqual(store.worked_on(self.db, "pm"), {2: NOW + 30})



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

    def test_the_copy_runs_on_the_first_connect_only(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "queue.db")
            store.connect(path).close()
            db = store.connect(path)
            store.mark_handled(db, "fr", [51])
            db.close()
            db = store.connect(path)
            self.assertNotIn(("l10n", 51), store.handled(db))
            db.close()


if __name__ == "__main__":
    unittest.main()
