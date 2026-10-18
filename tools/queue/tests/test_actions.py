"""The guarded writes, against fakes: nothing here reaches Shortcut or GitHub."""

import argparse
import unittest
from unittest import mock

from soirely_queue import actions, store

STATES = {"1": "To Do", "2": "In Progress", "3": "In Review", "4": "Ready For QA",
          "5": "In QA", "6": "Passsed QA", "7": "Failed QA"}
IDS = {name: int(i) for i, name in STATES.items()}
HEAD = "a" * 40


class FakeShortcut:
    def __init__(self):
        self.raw = {}
        self.comments = []

    def add(self, story_id, state, labels=()):
        self.raw[story_id] = {"id": story_id, "name": f"story {story_id}",
                              "workflow_state_id": IDS[state], "moved_at": "t0",
                              "labels": [{"name": n} for n in labels], "comments": [],
                              "description": "# AC\n- works"}

    def story(self, story_id):
        return self.raw[story_id]

    def update(self, story_id, **fields):
        if "workflow_state_id" in fields:
            self.raw[story_id]["workflow_state_id"] = fields["workflow_state_id"]
            self.raw[story_id]["moved_at"] = "t1"
        if "labels" in fields:
            self.raw[story_id]["labels"] = fields["labels"]

    def comment(self, story_id, text, parent_id=None):
        self.comments.append((story_id, text))
        return {"id": len(self.comments)}

    def upload(self, story_id, paths):
        pass


def slim(raw):
    return {"id": raw["id"], "name": raw["name"], "url": "", "epic": None, "epic_id": None,
            "state": STATES[str(raw["workflow_state_id"])], "moved_at": raw["moved_at"],
            "labels": sorted(label["name"] for label in raw["labels"]), "comments": [],
            "description": raw["description"], "tasks": [], "links": [], "done": False,
            "position": 1, "updated_at": raw["moved_at"], "type": "feature"}


class FakeContext(actions.Context):
    def __init__(self, db, role, fake):
        super().__init__(db, role, None)
        self._shortcut = fake

    def story(self, ref, fresh=True):
        story = slim(self._shortcut.story(actions.story_number(ref)))
        store.put_story(self.db, story)
        return story

    def refresh(self, story_id):
        return self.story(story_id)

    def repository(self):
        return ["owner", "repo"]

    def pr(self, number):
        return store.pr(self.db, number)

    def state_id(self, name):
        for state_id, state in STATES.items():
            if state.lower() == name.lower():
                return int(state_id), state
        raise actions.Refused(name)


def args(**kw):
    return argparse.Namespace(**kw)


class Base(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")
        self.fake = FakeShortcut()

    def as_(self, role):
        return FakeContext(self.db, role, self.fake)

    def state(self, story_id):
        return STATES[str(self.fake.raw[story_id]["workflow_state_id"])]

    def labels(self, story_id):
        return {label["name"] for label in self.fake.raw[story_id]["labels"]}


class Writes(Base):
    def test_a_developer_claim_adds_its_label_and_starts_the_story(self):
        self.fake.add(1, "To Do", ["backend"])
        actions.claim(self.as_("dev2"), args(story="sc-1"))
        self.assertEqual(self.labels(1), {"backend", "dev2"})
        self.assertEqual(self.state(1), "In Progress")

    def test_the_second_developer_to_claim_is_refused(self):
        self.fake.add(1, "To Do")
        story = slim(self.fake.raw[1])
        store.take_story(self.db, story, "dev")
        with self.assertRaisesRegex(actions.Refused, "dev claimed sc-1 first"):
            actions.claim(self.as_("dev2"), args(story="sc-1"))
        self.assertEqual(self.state(1), "To Do")

    def test_a_tester_claim_moves_it_to_in_qa_and_says_who(self):
        self.fake.add(1, "Ready For QA")
        actions.claim(self.as_("qa2"), args(story="sc-1"))
        self.assertEqual(self.state(1), "In QA")
        self.assertEqual(self.fake.comments, [(1, "QA claim: qa2")])

    def test_the_lead_never_hands_a_story_to_qa(self):
        self.fake.add(1, "Ready For QA")
        with self.assertRaisesRegex(actions.Refused, "never moves a story to Ready For QA"):
            actions.move(self.as_("lead"), args(story="sc-1", state="Ready For QA"))

    def test_a_role_without_the_command_is_refused(self):
        self.fake.add(1, "To Do")
        with self.assertRaisesRegex(actions.Refused, "ux may not move"):
            actions.move(self.as_("ux"), args(story="sc-1", state="In Progress"))

    def test_a_label_change_keeps_the_other_labels(self):
        self.fake.add(1, "To Do", ["dev2", "backend"])
        actions.label(self.as_("pm"), args(story="sc-1", add=["idea"], remove=["backend"]))
        self.assertEqual(self.labels(1), {"dev2", "idea"})

    def test_a_role_touches_only_its_own_labels(self):
        self.fake.add(1, "To Do", ["dev2"])
        with self.assertRaisesRegex(actions.Refused, "only touch"):
            actions.label(self.as_("dev"), args(story="sc-1", add=None, remove=["dev2"]))

    def test_a_passed_report_moves_and_relabels(self):
        self.fake.add(1, "In QA", ["needs qa", "qa failed", "dev1"])
        actions.report(self.as_("qa"), args(story="sc-1", result="passed", files=None,
                                            text="Tested on main\nAll good."))
        self.assertEqual(self.state(1), "Passsed QA")
        self.assertEqual(self.labels(1), {"qa passed", "dev1"})

    def test_the_designer_writes_only_the_design_section(self):
        with self.assertRaisesRegex(actions.Refused, "only the Design"):
            actions.edit(self.as_("ux"), args(target="sc-1", section="AC", dated=None,
                                              text="x"))


def pr(verdict=None, mergeable="mergeable", threads=()):
    lead = [{"verdict": verdict, "sha": HEAD, "at": "t"}] if verdict else []
    return {"number": 9, "story_id": 1, "state": "open", "head_sha": HEAD, "checks": "green",
            "mergeable": mergeable, "lead": lead, "threads": list(threads), "url": "u",
            "draft": False, "body": "", "title": "t", "merge_sha": None}


class Merging(Base):
    def live(self, mergeable="MERGEABLE"):
        return {"headRefOid": HEAD, "mergeable": mergeable, "mergeCommit": "m" * 40}

    def test_no_merge_without_a_pass_at_the_head(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("back"))
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge") as merge:
            with self.assertRaisesRegex(actions.Refused, "no lead pass"):
                actions.merge(self.as_("dev2"), args(pr=9, text=None))
            merge.assert_not_called()

    def test_a_conflict_says_to_bring_main_in(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        with mock.patch("soirely_queue.github.live", return_value=self.live("CONFLICTING")), \
                mock.patch("soirely_queue.github.merge") as merge:
            with self.assertRaisesRegex(actions.Refused, "Merge origin/main"):
                actions.merge(self.as_("dev2"), args(pr=9, text=None))
            merge.assert_not_called()

    def test_a_passed_merge_lands_at_the_head_and_tells_qa(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge") as merge, \
                mock.patch("soirely_queue.sync.sync_github"):
            actions.merge(self.as_("dev2"), args(pr=9, text=None))
        merge.assert_called_once_with(9, HEAD)
        self.assertEqual(self.state(1), "Ready For QA")
        self.assertIn("[qa] (from dev2)", self.fake.comments[-1][1])
        self.assertIn("m" * 40, self.fake.comments[-1][1])

    def test_a_pass_with_a_blocking_finding_is_refused_before_posting(self):
        self.fake.add(1, "In Review")
        store.put_pr(self.db, pr())
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.post_review") as post, \
                mock.patch("soirely_queue.actions.findings",
                           return_value=[{"path": "a", "line": 1, "blocking": True,
                                          "body": "b"}]):
            with self.assertRaisesRegex(actions.Refused, "blocking"):
                actions.review(self.as_("lead"), args(pr=9, verdict="pass", findings="f",
                                                      qa=None, text="s"))
            post.assert_not_called()

    def test_back_returns_the_story_to_its_developer(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr())
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.post_review", return_value={}) as post, \
                mock.patch("soirely_queue.sync.sync_github"), \
                mock.patch("soirely_queue.actions.findings",
                           return_value=[{"path": "a", "line": 1, "blocking": True,
                                          "body": "b"}]):
            actions.review(self.as_("lead"), args(pr=9, verdict="back", findings="f",
                                                  qa=None, text="summary"))
        body = post.call_args.args[4]
        self.assertTrue(body.startswith("## Review (from lead)"))
        self.assertTrue(body.endswith("Back to In Progress: 1 blocking."))
        self.assertEqual(self.state(1), "In Progress")
        self.assertIn("[dev2] (from lead)", self.fake.comments[-1][1])
