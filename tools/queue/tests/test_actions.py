"""The guarded writes, against fakes: nothing here reaches Shortcut or GitHub."""

import argparse
import unittest
from unittest import mock

from soirely_queue import actions, cli, roles, store, sync

STATES = {"1": "To Do", "2": "In Progress", "3": "In Review", "4": "Ready For QA",
          "5": "In QA", "6": "Passsed QA", "7": "Failed QA", "8": "Backlog"}
IDS = {name: int(i) for i, name in STATES.items()}
HEAD = "a" * 40
OLD = "b" * 40


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
        return self.raw[story_id]

    def comment(self, story_id, text, parent_id=None):
        self.comments.append((story_id, text))
        made = {"id": len(self.comments), "parent_id": parent_id, "text": text,
                "created_at": f"2026-10-18T10:{len(self.comments):02d}:00Z"}
        self.raw[story_id]["comments"].append(made)
        return made

    def upload(self, story_id, paths):
        pass


def slim(raw):
    return {"id": raw["id"], "name": raw["name"], "url": "", "epic": None, "epic_id": None,
            "state": STATES[str(raw["workflow_state_id"])], "moved_at": raw["moved_at"],
            "labels": sorted(label["name"] for label in raw["labels"]),
            "comments": [{"id": c["id"], "parent": c["parent_id"], "at": c["created_at"],
                          "text": c["text"]} for c in raw["comments"]],
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

    def queue_wakes(self, role):
        cli.refresh_work(self.db, 10_000_000)
        return [w["reason"] for w in store.waiting(self.db, role) if w["kind"] == "story"]


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

    def test_a_role_s_own_move_wakes_only_the_others(self):
        self.fake.add(1, "Backlog")
        actions.move(self.as_("pm"), args(story="sc-1", state="To Do"))
        self.assertEqual(self.queue_wakes("pm"), [])
        self.assertEqual(self.queue_wakes("ux"), ["sc-1 moved to To Do"])

    def test_the_same_move_wakes_the_role_when_another_makes_it(self):
        self.fake.add(1, "In Review", ["dev2"])
        actions.move(self.as_("dev2"), args(story="sc-1", state="In Progress"))
        self.assertEqual(self.queue_wakes("dev2"), [])

        self.fake.add(2, "In Review", ["dev2"])
        actions.move(self.as_("lead"), args(story="sc-2", state="In Progress"))
        self.assertEqual(self.queue_wakes("dev2"), ["sc-2 moved to In Progress"])

    def test_a_developer_s_claim_does_not_wake_it_again(self):
        self.fake.add(1, "To Do")
        actions.claim(self.as_("dev2"), args(story="sc-1"))
        self.assertEqual(self.queue_wakes("dev2"), [])

    def test_the_designer_writes_only_the_design_section(self):
        with self.assertRaisesRegex(actions.Refused, "only the Design"):
            actions.edit(self.as_("ux"), args(target="sc-1", section="AC", dated=None,
                                              text="x"))


class Replies(Base):
    def setUp(self):
        super().setUp()
        self.fake.add(1, "In Progress", ["dev2"])
        self.asked = self.fake.comment(1, "[dev2] (from pm)\nFor your awareness: AC 3 moved.")

    def reply(self, untagged, text, to=None):
        actions.comment(self.as_("dev2"), args(story="sc-1", to=to, reply_to=self.asked["id"],
                                               untagged=untagged, text=text))
        return self.fake.raw[1]["comments"][-1]

    def inbox(self):
        cli.refresh_work(self.db, 10_000_000)
        return [(role, w["reason"]) for role in roles.ROLES
                for w in store.waiting(self.db, role) if w["kind"] == "inbox"]

    def test_a_reply_that_only_confirms_opens_nothing_for_anyone(self):
        posted = self.reply(True, "Read, no questions.")
        self.assertEqual(posted["text"], "(from dev2)\nRead, no questions.")
        self.assertEqual(posted["parent_id"], self.asked["id"])
        self.assertEqual(self.inbox(), [])

    def test_a_reply_that_answers_still_reaches_the_asker(self):
        posted = self.reply(False, "Built to the new AC 3.")
        self.assertTrue(posted["text"].startswith("[pm] (from dev2)\n"))
        self.assertEqual(self.inbox(), [("pm", f"comments for you on sc-1: #{posted['id']}")])

    def test_a_confirmation_with_an_addressee_is_refused(self):
        with self.assertRaisesRegex(actions.Refused, "--untagged posts no tag"):
            self.reply(True, "Read.", to="pm")
        self.assertEqual(len(self.fake.raw[1]["comments"]), 1)


def pr(verdict=None, mergeable="mergeable", threads=(), at=HEAD, carried=None):
    lead = [{"verdict": verdict, "sha": at, "at": "t"}] if verdict else []
    return {"number": 9, "story_id": 1, "state": "open", "head_sha": HEAD, "checks": "green",
            "mergeable": mergeable, "lead": lead, "threads": list(threads), "url": "u",
            "draft": False, "body": "", "title": "t", "merge_sha": None, "carried": carried}


class Merging(Base):
    def live(self, mergeable="MERGEABLE", head=HEAD, state="CLEAN"):
        return {"headRefOid": head, "mergeable": mergeable, "mergeStateStatus": state,
                "mergeCommit": "m" * 40}

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

    def test_a_branch_behind_main_says_to_bring_main_in(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        with mock.patch("soirely_queue.github.live", return_value=self.live(state="BEHIND")), \
                mock.patch("soirely_queue.github.merge") as merge:
            with self.assertRaisesRegex(actions.Refused, "main has moved on"):
                actions.merge(self.as_("dev2"), args(pr=9, text=None))
            merge.assert_not_called()

    def test_a_pass_carried_over_a_merge_of_main_merges(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass", at=OLD[:7], carried=OLD[:7]))
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge") as merge, \
                mock.patch("soirely_queue.sync.sync_github"):
            actions.merge(self.as_("dev2"), args(pr=9, text=None))
        merge.assert_called_once_with(9, HEAD)

    def test_a_carried_pass_is_for_the_synced_head_only(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass", at=OLD[:7], carried=OLD[:7]))
        with mock.patch("soirely_queue.github.live", return_value=self.live(head="d" * 40)), \
                mock.patch("soirely_queue.github.merge") as merge:
            with self.assertRaisesRegex(actions.Refused, "no lead pass"):
                actions.merge(self.as_("dev2"), args(pr=9, text=None))
            merge.assert_not_called()

    def test_to_qa_refuses_a_merge_at_a_head_the_pass_never_saw(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, {**pr("pass", at=OLD[:7]), "state": "merged", "merge_sha": "m"})
        with self.assertRaisesRegex(actions.Refused, "no lead pass covers"):
            actions.to_qa(self.as_("dev2"), args(story="sc-1", text=None))

    def test_to_qa_takes_a_merge_at_the_head_a_pass_carried_to(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.set_meta(self.db, "repository", ["o", "n"])
        store.put_pr(self.db, pr("pass", at=OLD[:7], carried=OLD[:7]))
        merged = {**pr("pass", at=OLD[:7]), "state": "merged", "merge_sha": "m" * 40}
        del merged["carried"]
        with mock.patch("soirely_queue.github.pull_requests", return_value=[merged]), \
                mock.patch("soirely_queue.github.main_runs", return_value=[]), \
                mock.patch("soirely_queue.github.same_change") as same:
            sync.sync_github(self.db)
        same.assert_not_called()
        actions.to_qa(self.as_("dev2"), args(story="sc-1", text=None))
        self.assertEqual(self.state(1), "Ready For QA")
        self.assertIn("m" * 40, self.fake.comments[-1][1])

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

    def test_the_linguist_merges_every_locale_with_a_merge_commit(self):
        store.put_pr(self.db, pr())
        mine = [(path, 1, 0) for path in sorted(roles.linguist_files())]
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.files", return_value=mine), \
                mock.patch("soirely_queue.github.merge") as merge:
            actions.merge(self.as_("l10n"), args(pr=9, text=None))
        merge.assert_called_once_with(9, HEAD, delete_branch=True)

    def test_the_linguist_merges_no_code(self):
        store.put_pr(self.db, pr())
        files = [("apps/web/src/i18n/locales/fr.json", 1, 0), ("apps/web/src/App.tsx", 1, 0)]
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.files", return_value=files), \
                mock.patch("soirely_queue.github.merge") as merge:
            with self.assertRaisesRegex(actions.Refused, "only locale files.*App.tsx"):
                actions.merge(self.as_("l10n"), args(pr=9, text=None))
            merge.assert_not_called()

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


class Findings(unittest.TestCase):
    def test_each_finding_opens_with_its_severity(self):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as f:
            f.write("## a.ts:3 blocking\nThe guard is missing.\n## b.ts:9 nit\nnit: a word.\n")
        found = actions.findings(f.name)
        self.assertEqual([x["body"] for x in found],
                         ["blocking: The guard is missing.", "nit: a word."])
        self.assertEqual([x["blocking"] for x in found], [True, False])
