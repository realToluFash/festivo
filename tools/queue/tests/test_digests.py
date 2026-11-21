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
    def pick(self, role, stories, prs=()):
        p = Digest(role)
        with mock.patch.object(digests, "untaken", side_effect=lambda db, role, s: s), \
                mock.patch.object(digests.store, "stories", return_value=stories), \
                mock.patch.object(digests.store, "prs", return_value=list(prs)), \
                mock.patch.object(digests.store, "get_meta", return_value=None):
            digests.developer(p, None, stories)
        return p.lines[-1].split()[-1]

    def test_developers_reaching_ready_for_dev_together_pick_different_stories(self):
        stories = [ready(n) for n in range(1, 6)]
        picks = [self.pick(role, stories) for role in ("dev", "dev2", "dev3", "dev4")]
        self.assertEqual(picks, ["sc-1", "sc-2", "sc-3", "sc-4"])

    def test_a_demo_only_story_is_not_picked(self):
        demo = {"number": 40, "story_id": 1, "state": "merged", "branch": "ux/sc-1-x",
                "merged_at": "t1", "head_sha": "a" * 40, "lead": []}
        only = dict(ready(1), labels=ready(1)["labels"] + ["demo only"])
        self.assertEqual(self.pick("dev", [only, ready(2)], [demo]), "sc-2")
        self.assertEqual(self.pick("dev", [ready(1), ready(2)], [demo]), "sc-1")

    def test_with_fewer_stories_than_its_number_a_developer_takes_the_first(self):
        self.assertEqual(self.pick("dev4", [ready(1), ready(2)]), "sc-1")

    def test_a_story_labelled_for_a_developer_comes_before_the_shared_ones(self):
        own = dict(ready(9), labels=["dev4"])
        self.assertEqual(self.pick("dev4", [ready(n) for n in range(1, 6)] + [own]),
                         "sc-9")


def blocks(subject, object_):
    return {"verb": "blocks", "subject": subject, "object": object_}


class HeldByBlockers(unittest.TestCase):
    pick = Developers.pick

    def test_a_developer_s_next_skips_a_story_whose_blocker_has_not_merged(self):
        held = dict(ready(1), links=[blocks(7, 1)])
        blocker = dict(ready(7), state="In Review")
        self.assertEqual(self.pick("dev", [held, ready(2), blocker]), "sc-2")

    def test_a_blocker_that_is_done_holds_nothing(self):
        held = dict(ready(1), links=[blocks(7, 1)])
        blocker = dict(ready(7), state="Done", done=True)
        self.assertEqual(self.pick("dev", [held, ready(2), blocker]), "sc-1")

    def test_the_product_manager_s_to_do_list_says_what_holds_a_story(self):
        todo = dict(ready(1), state="To Do", description="# AC\n- x", comments=[],
                    links=[blocks(7, 1), blocks(8, 1)])
        every = [todo, dict(ready(7), state="Ready For Dev"), dict(ready(8), state="To Do")]
        p = Digest("pm")
        with mock.patch.object(digests.store, "stories", return_value=every), \
                mock.patch.object(digests.store, "get_meta", return_value=None):
            digests.product_manager(p, None, [todo])
        self.assertIn("held by sc-7 (Ready For Dev), sc-8 (To Do)",
                      [line for line in p.lines if line.startswith("  sc-1 ")][0])


def epic(id_, state="in progress"):
    return {str(id_): {"name": f"epic {id_}", "state": state}}


class StuckBlockers(unittest.TestCase):
    EPICS = {**epic(1), **epic(2, "to do")}

    def sweep(self, every, epics=EPICS):
        p = Digest("pm")
        with mock.patch.object(digests.store, "stories", return_value=every), \
                mock.patch.object(digests.store, "get_meta",
                                  side_effect=lambda db, key: epics if key == "epics" else None):
            digests.product_manager(p, None, [s for s in every if not s["done"]])
        return p.lines

    def held(self, id_, *blockers, state="Ready For Dev", epic_id=1):
        return dict(ready(id_), state=state, epic_id=epic_id, epic="epic", description="",
                    comments=[], links=[blocks(b, id_) for b in blockers])

    def blocker(self, id_, state, **extra):
        return dict(ready(id_), **{"state": state, "epic_id": 1, "epic": "epic",
                                   "description": "", "comments": [], **extra})

    def section(self, lines):
        if "Stuck: held by a story nobody is working on" not in lines:
            return None
        start = lines.index("Stuck: held by a story nobody is working on")
        return lines[start + 1:lines.index("", start)]

    def test_a_backlog_blocker_holding_a_ready_story_is_listed_with_its_next(self):
        lines = self.sweep([self.held(1, 7), self.blocker(7, "Backlog")])
        self.assertEqual(self.section(lines), [
            "  sc-7 [Backlog] story 7 · epic · holds sc-1 (Ready For Dev)",
            f'    Next: {digests.SQ} pm move sc-7 "To Do"'])
        self.assertLess(lines.index("Stuck: held by a story nobody is working on"),
                        next(i for i, x in enumerate(lines) if x.startswith("To Do (")))

    def test_a_to_do_blocker_s_next_opens_the_story(self):
        lines = self.sweep([self.held(1, 7), self.blocker(7, "To Do")])
        self.assertEqual(self.section(lines)[1], f"    Next: {digests.SQ} pm story sc-7")

    def test_a_blocker_waiting_on_the_owner_has_no_next(self):
        lines = self.sweep([self.held(1, 7), self.blocker(7, "Waiting On Owner")])
        self.assertEqual(self.section(lines), [
            "  sc-7 [Waiting On Owner] story 7 · epic · holds sc-1 (Ready For Dev)"
            " · waits on the owner"])

    def test_a_blocker_someone_is_working_on_is_not_listed(self):
        for state in ("Needs Design", "In Progress", "Ready For QA"):
            with self.subTest(state=state):
                self.assertIsNone(self.section(
                    self.sweep([self.held(1, 7), self.blocker(7, state)])))

    def test_an_archived_or_translation_blocker_is_not_listed(self):
        archived = self.blocker(7, "Backlog", archived=True)
        translation = self.blocker(8, "Backlog", labels=["translation"])
        self.assertIsNone(self.section(
            self.sweep([self.held(1, 7), self.held(2, 8), archived, translation])))

    def test_a_held_story_in_an_epic_not_in_progress_is_left_out(self):
        lines = self.sweep([self.held(1, 7, epic_id=2), self.held(2, 8),
                            self.held(3, 8, epic_id=2),
                            self.blocker(7, "Backlog"), self.blocker(8, "Backlog")])
        self.assertEqual(self.section(lines)[0],
                         "  sc-8 [Backlog] story 8 · epic · holds sc-2 (Ready For Dev)")
        self.assertEqual(len(self.section(lines)), 2)

    def test_one_blocker_holding_two_stories_is_one_line_in_id_order(self):
        lines = self.sweep([self.held(5, 7, state="To Do"), self.held(3, 7),
                            self.blocker(7, "Backlog")])
        self.assertEqual(self.section(lines)[0],
                         "  sc-7 [Backlog] story 7 · epic · holds sc-3 (Ready For Dev),"
                         " sc-5 (To Do)")

    def test_blockers_holding_more_come_first_then_by_id(self):
        lines = self.sweep([self.held(1, 9), self.held(2, 8), self.held(3, 9),
                            self.held(4, 7), self.blocker(7, "Waiting On Owner"),
                            self.blocker(8, "Waiting On Owner"),
                            self.blocker(9, "Waiting On Owner")])
        self.assertEqual([x.split()[0] for x in self.section(lines)],
                         ["sc-9", "sc-7", "sc-8"])

    def test_nothing_stuck_leaves_the_section_out(self):
        lines = self.sweep([self.held(1), self.blocker(7, "Backlog")])
        self.assertFalse(any("Stuck" in x for x in lines))
        self.assertTrue(lines[0].startswith("To Do ("))


class Testers(unittest.TestCase):
    def test_a_stuck_story_that_needs_ios_is_not_listed_without_xcode(self):
        stuck = [dict(ready(1), state="In QA", labels=["needs ios"], comments=[]),
                 dict(ready(2), state="In QA", comments=[])]
        p = Digest("qa2")
        with mock.patch.object(digests, "untaken", side_effect=lambda db, role, s: s), \
                mock.patch.object(digests.machine, "has_xcode", return_value=False):
            digests.tester(p, None, stuck)
        listed = [line for line in p.lines if "story " in line]
        self.assertEqual(len(listed), 1)
        self.assertIn("story 2", listed[0])

    def test_in_qa_names_an_agent_s_claim_and_leaves_out_a_person_s_plan(self):
        plan = "[@tester-one] (from qa2)\nAccounts: host@example.com\n1. Sign in\nQA claim: @tester-one"
        stuck = [dict(ready(1), state="In QA", comments=[{"text": plan, "at": "2026-10-29T10:00"}]),
                 dict(ready(2), state="In QA",
                      comments=[{"text": "QA claim: qa3", "at": "2026-10-29T11:05"}])]
        p = Digest("qa2")
        with mock.patch.object(digests, "untaken", side_effect=lambda db, role, s: s), \
                mock.patch.object(digests.machine, "manual_testers", return_value={}):
            digests.tester(p, None, stuck)
        listed = [line for line in p.lines if "story " in line]
        self.assertEqual(len(listed), 1)
        self.assertIn("story 2", listed[0])
        self.assertIn("QA claim: qa3 at 11:05", listed[0])

    def test_a_story_a_person_owns_is_not_offered_to_an_agent_tester(self):
        owned = dict(ready(1), state="Ready For QA", owners=["member-1"], comments=[],
                     updated_at="t0")
        free = dict(ready(2), state="Ready For QA", comments=[], updated_at="t1")
        people = {"@tester-one": {"machine": "stack-mac", "member": "member-1"}}
        p = Digest("qa")
        with mock.patch.object(digests, "untaken", side_effect=lambda db, role, s: s), \
                mock.patch.object(digests.machine, "manual_testers", return_value=people):
            digests.tester(p, None, [owned, free])
        self.assertNotIn("story 1", " ".join(p.lines))
        self.assertEqual(p.lines[-1].split()[-1], "sc-2")


def ticket(id_, state, moved_at="t1"):
    return dict(ready(id_), state=state, labels=["translation"], moved_at=moved_at, tasks=[],
                links=[])


class LinguistPick(unittest.TestCase):
    TICKETS = [ticket(1, "In QA", "t0"), ticket(2, "Backlog", "t0"), ticket(3, "To Do", "t2"),
               ticket(4, "Ready For Dev", "t1"), ticket(5, "Failed QA", "t3")]

    def render(self, kind):
        p = Digest("l10n")
        with mock.patch.object(digests, "open_stories", return_value=self.TICKETS), \
                mock.patch.object(digests.store, "prs", return_value=[]), \
                mock.patch.object(digests.store, "get_meta", return_value=None):
            digests.render(p, None, {"id": 5, "kind": kind})
        return p.lines

    def offered(self, lines):
        return [entry.split()[0] for entry in lines if entry.startswith("  sc-")]

    def test_a_pick_offers_only_the_queue_failed_qa_first_then_oldest(self):
        lines = self.render("pick")
        self.assertEqual(self.offered(lines), ["sc-5", "sc-4", "sc-3"])
        self.assertIn("This is a pick, not a sweep", " ".join(lines))

    def test_a_sweep_still_lists_every_open_ticket(self):
        lines = self.render("sweep")
        self.assertEqual(sorted(self.offered(lines)), ["sc-1", "sc-2", "sc-3", "sc-4", "sc-5"])
        self.assertNotIn("This is a pick", " ".join(lines))


class Ideas(unittest.TestCase):
    STORIES = [{**ready(n), "labels": ["idea"], "state": state, "description": "", "links": []}
               for n, state in enumerate(["Backlog", "To Do", "Waiting On Owner",
                                          "Ready For Dev", "Backlog"], start=1)]

    def render(self, role):
        p = Digest(role)
        with mock.patch.object(digests, "qa_outstanding", return_value=[]), \
                mock.patch.object(digests.store, "stories", return_value=self.STORIES), \
                mock.patch.object(digests.store, "get_meta", return_value=None):
            digests.DIGESTS[role](p, None, self.STORIES)
        return p.lines

    def test_the_creative_director_counts_the_ideas_the_cap_counts(self):
        lines = self.render("cd")
        self.assertEqual(lines[0], "Your open ideas (2, at most 3):")
        self.assertEqual([entry.split()[0] for entry in lines[1:]], ["sc-1", "sc-5"])
        self.assertEqual(digests.W.open_ideas(self.STORIES), [self.STORIES[0], self.STORIES[4]])

    def test_the_product_manager_is_asked_about_the_ideas_still_in_backlog(self):
        lines = self.render("pm")
        start = lines.index("Ideas waiting on a decision:") + 1
        listed = lines[start:lines.index("", start)]
        self.assertEqual([entry.split()[0] for entry in listed], ["sc-1", "sc-5"])


class AcceptedIdeas(Ideas):
    STORIES = [{**ready(n), "labels": labels, "state": "Backlog", "description": "",
                "links": []}
               for n, labels in [(37133, ["idea", "idea accepted"]),
                                 (42749, ["idea", "idea accepted"]), (33457, ["idea"])]]

    def test_the_creative_director_counts_the_ideas_the_cap_counts(self):
        lines = self.render("cd")
        self.assertEqual(lines[0], "Your open ideas (1, at most 3):")
        self.assertEqual([entry.split()[0] for entry in lines[1:]], ["sc-33457"])
        self.assertEqual(digests.W.open_ideas(self.STORIES), [self.STORIES[2]])

    def test_the_product_manager_is_asked_about_the_ideas_still_in_backlog(self):
        lines = self.render("pm")
        start = lines.index("Ideas waiting on a decision:") + 1
        listed = lines[start:lines.index("", start)]
        self.assertEqual([entry.split()[0] for entry in listed], ["sc-33457"])

    def test_an_accepted_idea_waits_in_the_backlog_list_with_its_epic(self):
        lines = self.render("pm")
        start = next(i for i, x in enumerate(lines) if x.startswith("Backlog (")) + 1
        listed = [x.split()[0] for x in lines[start:] if x.strip().startswith("sc-")]
        self.assertEqual(sorted(listed), ["sc-37133", "sc-42749"])
