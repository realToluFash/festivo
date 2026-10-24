"""The guarded writes, against fakes: nothing here reaches Shortcut or GitHub."""

import argparse
import unittest
from unittest import mock

from soirely_queue import actions, cli, github, roles, store, sync

STATES = {"1": "To Do", "2": "In Progress", "3": "In Review", "4": "Ready For QA",
          "5": "In QA", "6": "Passsed QA", "7": "Failed QA", "8": "Backlog", "9": "Done",
          "10": "Ready For Dev", "11": "Needs Design", "12": "Passed Code Review",
          "13": "Failed Code Review", "14": "Waiting On Owner"}
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
        if "description" in fields:
            self.raw[story_id]["description"] = fields["description"]
        self.raw[story_id]["updated_at"] = self.raw[story_id].get("updated_at", 0) + 1
        return self.raw[story_id]

    def relate(self, subject_id, object_id, verb="relates to"):
        links = self.raw[subject_id].setdefault("story_links", [])
        if any(x == {"subject_id": subject_id, "object_id": object_id, "verb": verb}
               for x in links):
            raise RuntimeError("Shortcut 422 on POST /api/v3/story-links")
        links.append({"subject_id": subject_id, "object_id": object_id, "verb": verb})
        self.raw.setdefault(object_id, {}).setdefault("story_links", []).append(links[-1])

    def comment(self, story_id, text, parent_id=None):
        self.comments.append((story_id, text))
        made = {"id": len(self.comments), "parent_id": parent_id, "text": text,
                "created_at": f"2026-10-18T10:{len(self.comments):02d}:00Z"}
        self.raw[story_id]["comments"].append(made)
        return made

    def upload(self, story_id, paths):
        pass


def slim(raw):
    return {"id": raw["id"], "name": raw["name"], "url": "", "epic": None,
            "epic_id": raw.get("epic_id"),
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
        # No test reads a pull request's files from GitHub; one that needs them patches this.
        files = mock.patch("soirely_queue.github.files", return_value=[])
        files.start()
        self.addCleanup(files.stop)
        # Nor does any reach a tester's Docker stack; one that needs it down patches this.
        stack = mock.patch("soirely_queue.local.stack_problem", return_value=None)
        stack.start()
        self.addCleanup(stack.stop)

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
        self.fake.add(1, "Ready For Dev", ["backend"])
        actions.claim(self.as_("dev2"), args(story="sc-1"))
        self.assertEqual(self.labels(1), {"backend", "dev2"})
        self.assertEqual(self.state(1), "In Progress")

    def test_a_story_in_an_epic_awaiting_the_owner_is_refused(self):
        self.fake.add(1, "Ready For Dev")
        self.fake.raw[1]["epic_id"] = 2
        store.set_meta(self.db, "epics", {"2": {"name": "Events", "state": "to do",
                                                "state_name": "Waiting for Owner Approval"}})
        with self.assertRaisesRegex(actions.Refused, "Events, which is Waiting for Owner"):
            actions.claim(self.as_("dev"), args(story="sc-1"))
        self.assertEqual(self.state(1), "Ready For Dev")

    def test_the_second_developer_to_claim_is_refused(self):
        self.fake.add(1, "Ready For Dev")
        story = slim(self.fake.raw[1])
        store.take_story(self.db, story, "dev")
        with self.assertRaisesRegex(actions.Refused, "dev claimed sc-1 first"):
            actions.claim(self.as_("dev2"), args(story="sc-1"))
        self.assertEqual(self.state(1), "Ready For Dev")

    def test_a_developer_never_claims_a_story_still_in_to_do(self):
        self.fake.add(1, "To Do")
        with self.assertRaisesRegex(actions.Refused, "not in your queue"):
            actions.claim(self.as_("dev"), args(story="sc-1"))

    def test_a_tester_claim_moves_it_to_in_qa_and_says_who(self):
        self.fake.add(1, "Ready For QA")
        actions.claim(self.as_("qa2"), args(story="sc-1"))
        self.assertEqual(self.state(1), "In QA")
        self.assertEqual(self.fake.comments, [(1, "QA claim: qa2")])
        self.assertIn("qa2", self.labels(1))

    def test_a_failed_story_back_for_qa_is_its_first_tester_s_to_retest(self):
        import datetime
        self.fake.add(1, "Ready For QA", ["qa failed"])
        self.fake.raw[1]["moved_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.fake.comment(1, "QA claim: qa2")
        with self.assertRaisesRegex(actions.Refused, "qa2's to retest"):
            actions.claim(self.as_("qa"), args(story="sc-1"))
        actions.claim(self.as_("qa2"), args(story="sc-1"))
        self.assertEqual(self.state(1), "In QA")

    def test_a_tester_whose_stack_is_down_claims_nothing(self):
        self.fake.add(1, "Ready For QA")
        with mock.patch("soirely_queue.local.stack_problem",
                        return_value="Docker did not answer within 30 seconds"), \
                self.assertRaisesRegex(actions.Refused, "Docker did not answer"):
            actions.claim(self.as_("qa2"), args(story="sc-1"))
        self.assertEqual(self.state(1), "Ready For QA")
        self.assertEqual(self.fake.comments, [])

    def test_a_tester_gives_back_a_story_it_cannot_test_to_any_tester(self):
        self.fake.add(1, "Ready For QA", ["qa failed"])
        actions.claim(self.as_("qa2"), args(story="sc-1"))
        actions.unclaim(self.as_("qa2"), args(story="sc-1", text="Docker is down"))
        self.assertEqual(self.state(1), "Ready For QA")
        self.assertNotIn("qa2", self.labels(1))
        self.assertEqual(self.fake.comments[-1], (1, "QA claim released: qa2, Docker is down"))
        actions.claim(self.as_("qa3"), args(story="sc-1"))
        self.assertEqual(self.state(1), "In QA")

    def test_only_the_claiming_tester_gives_a_story_back(self):
        self.fake.add(1, "Ready For QA")
        actions.claim(self.as_("qa3"), args(story="sc-1"))
        with self.assertRaisesRegex(actions.Refused, "not under your QA claim"):
            actions.unclaim(self.as_("qa2"), args(story="sc-1", text="no stack"))
        self.assertEqual(self.state(1), "In QA")

    def test_a_tester_takes_up_its_own_held_story_again(self):
        self.fake.add(1, "Ready For QA")
        actions.claim(self.as_("qa2"), args(story="sc-1"))
        actions.claim(self.as_("qa2"), args(story="sc-1"))
        self.assertEqual(self.fake.comments, [(1, "QA claim: qa2")])
        self.assertEqual(self.state(1), "In QA")

    def test_the_lead_never_hands_a_story_to_qa(self):
        self.fake.add(1, "Ready For QA")
        with self.assertRaisesRegex(actions.Refused, "never moves a story to Ready For QA"):
            actions.move(self.as_("lead"), args(story="sc-1", state="Ready For QA"))

    def test_a_role_without_the_command_is_refused(self):
        self.fake.add(1, "To Do")
        with self.assertRaisesRegex(actions.Refused, "bm may not move"):
            actions.move(self.as_("bm"), args(story="sc-1", state="In Progress"))

    def test_the_designer_hands_a_designed_story_to_the_developers(self):
        self.fake.add(1, "Needs Design")
        actions.move(self.as_("ux"), args(story="sc-1", state="Ready For Dev"))
        self.assertEqual(self.state(1), "Ready For Dev")
        with self.assertRaisesRegex(actions.Refused, "only from Needs Design"):
            self.fake.add(2, "To Do")
            actions.move(self.as_("ux"), args(story="sc-2", state="Ready For Dev"))

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
        self.fake.add(1, "To Do")
        actions.move(self.as_("pm"), args(story="sc-1", state="Needs Design"))
        self.assertEqual(self.queue_wakes("pm"), [])
        self.assertEqual(self.queue_wakes("ux"), ["sc-1 moved to Needs Design"])

    def test_the_same_move_wakes_the_role_when_another_makes_it(self):
        self.fake.add(1, "In Review", ["dev2"])
        actions.move(self.as_("dev2"), args(story="sc-1", state="In Progress"))
        self.assertEqual(self.queue_wakes("dev2"), [])

        self.fake.add(2, "In Review", ["dev2"])
        actions.move(self.as_("lead"), args(story="sc-2", state="Failed Code Review"))
        self.assertEqual(self.queue_wakes("dev2"), ["sc-2 moved to Failed Code Review"])

    def test_a_developer_s_claim_does_not_wake_it_again(self):
        self.fake.add(1, "Ready For Dev")
        actions.claim(self.as_("dev2"), args(story="sc-1"))
        self.assertEqual(self.queue_wakes("dev2"), [])

    def test_the_designer_writes_only_the_design_section(self):
        with self.assertRaisesRegex(actions.Refused, "only the Design"):
            actions.edit(self.as_("ux"), args(targets=["sc-1"], section="AC", dated=None,
                                              replace=None, with_=None, dry=False, text="x"))
        with self.assertRaisesRegex(actions.Refused, "only the Design"):
            actions.edit(self.as_("ux"), line_edit(["sc-1"], "a", "b"))


class LanguageTags(Base):
    def test_a_language_tag_heads_the_comment_and_reaches_the_linguist(self):
        self.fake.add(1, "To Do", ["translation"])
        actions.comment(self.as_("pm"), args(story="sc-1", to="en", reply_to=None,
                                             untagged=False, text="Word this, please."))
        posted = self.fake.raw[1]["comments"][-1]
        self.assertTrue(posted["text"].startswith("[en] (from pm)\n"))
        cli.refresh_work(self.db, 10_000_000)
        self.assertEqual([w["reason"] for w in store.waiting(self.db, "l10n")
                          if w["kind"] == "inbox"], [f"comments for you on sc-1: #{posted['id']}"])

    def test_an_unknown_tag_is_still_refused(self):
        self.fake.add(1, "To Do")
        with self.assertRaisesRegex(actions.Refused, "no role de"):
            actions.comment(self.as_("pm"), args(story="sc-1", to="de", reply_to=None,
                                                 untagged=False, text="x"))


class PmMoves(Base):
    def test_pm_moves_any_story_from_any_state_to_any_other(self):
        self.fake.add(1, "In Progress", ["dev2"])
        actions.move(self.as_("pm"), args(story="sc-1", state="Ready For QA"))
        self.assertEqual(self.state(1), "Ready For QA")
        actions.move(self.as_("pm"), args(story="sc-1", state="Backlog"))
        self.assertEqual(self.state(1), "Backlog")

    def test_other_roles_are_still_held_to_their_moves(self):
        self.fake.add(1, "In Progress")
        with self.assertRaisesRegex(actions.Refused, "dev never moves a story to Backlog"):
            actions.move(self.as_("dev"), args(story="sc-1", state="Backlog"))


def line_edit(targets, old, new, dry=False):
    return args(targets=targets, replace=old, with_=new, dry=dry, section=None, dated=None,
                text=None)


class LineEdits(Base):
    def setUp(self):
        super().setUp()
        for story_id in (1, 2):
            self.fake.add(story_id, "To Do")
            self.fake.raw[story_id]["description"] = "# AC\n- works\n- shows a total"

    def body(self, story_id):
        return self.fake.raw[story_id]["description"]

    def test_one_occurrence_changes_on_every_story(self):
        said = actions.edit(self.as_("pm"), line_edit(["sc-1", "sc-2"], "- works",
                                                      "- works offline"))
        self.assertEqual(said, "changed sc-1, sc-2")
        self.assertEqual(self.body(2), "# AC\n- works offline\n- shows a total")

    def test_a_missing_or_repeated_text_changes_nothing_anywhere(self):
        self.fake.raw[2]["description"] = "- works\n- works"
        with self.assertRaisesRegex(actions.Refused, "sc-2 has it 2 times; nothing changed"):
            actions.edit(self.as_("pm"), line_edit(["sc-1", "sc-2"], "- works", "- x"))
        with self.assertRaisesRegex(actions.Refused, "sc-1 does not have it"):
            actions.edit(self.as_("pm"), line_edit(["sc-1"], "- absent", "- x"))
        self.assertEqual(self.body(1), "# AC\n- works\n- shows a total")

    def test_dry_says_what_would_change_and_changes_nothing(self):
        said = actions.edit(self.as_("pm"), line_edit(["sc-1", "sc-2"], "a total", "the sum",
                                                      dry=True))
        self.assertEqual(said, "would change sc-1, sc-2")
        self.assertEqual(self.body(1), "# AC\n- works\n- shows a total")

    def test_a_failed_save_says_what_changed_and_what_did_not(self):
        self.fake.add(3, "To Do")
        self.fake.raw[3]["description"] = "- works"
        real = self.fake.update

        def update(story_id, **fields):
            if story_id == 2:
                raise actions.ShortcutError("Shortcut 500 on PUT /api/v3/stories/2")
            return real(story_id, **fields)
        self.fake.update = update
        with self.assertRaisesRegex(actions.Refused,
                                    "changed sc-1; sc-2 failed: Shortcut 500.*not tried: sc-3"):
            actions.edit(self.as_("pm"), line_edit(["sc-1", "sc-2", "sc-3"], "- works", "- x"))
        self.assertEqual(self.body(3), "- works")

    def test_a_section_edit_still_names_one_story(self):
        with self.assertRaisesRegex(actions.Refused, "edit one story"):
            actions.edit(self.as_("pm"), args(targets=["sc-1", "sc-2"], replace=None,
                                              with_=None, dry=False, section="AC", dated=None,
                                              text="- x"))
        actions.edit(self.as_("pm"), args(targets=["sc-1"], replace=None, with_=None,
                                          dry=False, section="AC", dated=None, text="- x"))
        self.assertEqual(self.body(1), "# AC\n\n- x\n")

    def test_a_body_with_its_own_heading_is_refused_and_nothing_changes(self):
        for section, dated in (("AC", None), (None, "Notes")):
            with self.assertRaisesRegex(actions.Refused, 'heading \\(Mobile\\).*--section "Mobile"'):
                actions.edit(self.as_("pm"), args(targets=["sc-1"], replace=None, with_=None,
                                                  dry=False, section=section, dated=dated,
                                                  text="- x\n\n## Mobile\n\n- y"))
        self.assertEqual(self.body(1), "# AC\n- works\n- shows a total")
        actions.edit(self.as_("pm"), args(targets=["sc-1"], replace=None, with_=None,
                                          dry=False, section="AC", dated=None,
                                          text="- x\n```\n# not a heading\n```"))
        self.assertIn("# not a heading", self.body(1))

    def test_a_save_made_meanwhile_is_kept_and_the_edit_redone_over_it(self):
        real = self.fake.story
        reads = []

        def story(story_id):
            reads.append(story_id)
            if len(reads) == 2:
                self.fake.update(story_id, description=self.body(1) + "\n\n## Copy\n\nhi")
            return real(story_id)
        self.fake.story = story
        actions.edit(self.as_("pm"), args(targets=["sc-1"], replace=None, with_=None,
                                          dry=False, section="AC", dated=None, text="- x"))
        self.assertEqual(self.body(1), "# AC\n\n- x\n\n## Copy\n\nhi\n")

    def test_a_story_that_keeps_changing_is_left_as_it_is(self):
        real = self.fake.story

        def story(story_id):
            self.fake.update(story_id, description=self.body(1) + "!")
            return real(story_id)
        self.fake.story = story
        with self.assertRaisesRegex(actions.Refused, "kept changing.*nothing saved"):
            actions.edit(self.as_("pm"), args(targets=["sc-1"], replace=None, with_=None,
                                              dry=False, section="AC", dated=None, text="- x"))
        self.assertNotIn("- x", self.body(1))
        with self.assertRaisesRegex(actions.Refused, "changed nothing; sc-1 failed: .*kept"):
            actions.edit(self.as_("pm"), line_edit(["sc-1"], "- works", "- y"))

class NewStories(Base):
    def file(self, epic):
        return actions.new_story(self.as_("dev"), args(name="x", text="y", type=None,
                                                        state=None, label=None, epic=epic,
                                                        estimate=None))

    def test_a_story_with_no_epic_is_refused(self):
        with self.assertRaisesRegex(actions.Refused, "belongs to an epic.*new-epic"):
            self.file(None)

    def test_a_story_in_a_done_or_unknown_epic_is_refused(self):
        store.set_meta(self.db, "epics", {"26": {"name": "Foundation", "state": "done"}})
        with self.assertRaisesRegex(actions.Refused, "epic 26 is done"):
            self.file(26)
        with self.assertRaisesRegex(actions.Refused, "epic 99 is not an open epic"):
            self.file(99)

    def test_every_role_that_files_a_story_may_make_its_epic(self):
        for role in roles.ROLES:
            if roles.may(role, "new-story"):
                self.assertTrue(roles.may(role, "new-epic"), role)


class NewEpics(Base):
    def setUp(self):
        super().setUp()
        self.fake.epic_states = lambda: [{"id": 1, "name": "to do"},
                                         {"id": 9, "name": "Waiting for Owner Approval"}]
        self.made = []
        self.fake.create_epic = lambda **fields: self.made.append(fields) or {"id": 77}
        refresh = mock.patch("soirely_queue.sync.refresh_lookups")
        refresh.start()
        self.addCleanup(refresh.stop)

    def test_an_epic_a_role_creates_waits_for_the_owner(self):
        said = actions.new_epic(self.as_("pm"), args(name="Gifts", text="Why."))
        self.assertEqual(self.made[0]["epic_state_id"], 9)
        self.assertIn("Waiting for Owner Approval", said)

    def test_with_no_approval_state_no_epic_is_created(self):
        self.fake.epic_states = lambda: [{"id": 1, "name": "to do"}]
        with self.assertRaisesRegex(actions.Refused, "no Waiting for Owner Approval"):
            actions.new_epic(self.as_("pm"), args(name="Gifts", text="Why."))
        self.assertEqual(self.made, [])


class Relating(Base):
    def test_relating_twice_says_already_linked(self):
        self.fake.add(1, "To Do")
        self.fake.add(2, "To Do")
        a = args(story="sc-1", other="sc-2", verb="blocks")
        self.assertEqual(actions.relate(self.as_("pm"), a), "sc-1 blocks sc-2")
        self.assertEqual(actions.relate(self.as_("pm"), a), "already linked: sc-1 blocks sc-2")

    def test_relates_to_stored_the_other_way_round_is_already_linked(self):
        self.fake.add(1, "To Do")
        self.fake.add(2, "To Do")
        self.fake.relate(2, 1, "relates to")
        a = args(story="sc-1", other="sc-2", verb="relates to")
        self.assertEqual(actions.relate(self.as_("pm"), a),
                         "already linked: sc-1 relates to sc-2")


class Drawing(Base):
    def test_a_story_listed_to_draw_carries_a_prompt_for_the_designer(self):
        self.fake.add(1, "Needs Design")
        said = actions.to_draw(self.as_("ux"), args(story="sc-1", text="Draw the empty state."))
        self.assertIn("list to draw", said)
        [drawing] = store.drawings(self.db)
        self.assertEqual(drawing["prompt"],
                         "/soirely-designer Draw sc-1 (story 1). Draw the empty state.")

    def test_listing_a_story_again_replaces_its_prompt(self):
        self.fake.add(1, "Needs Design")
        actions.to_draw(self.as_("ux"), args(story="sc-1", text="first"))
        actions.to_draw(self.as_("ux"), args(story="sc-1", text="/soirely-designer second"))
        self.assertEqual([d["prompt"] for d in store.drawings(self.db)],
                         ["/soirely-designer second"])

    def test_drawn_takes_it_off_the_list(self):
        self.fake.add(1, "Needs Design")
        actions.to_draw(self.as_("ux"), args(story="sc-1", text="x"))
        self.assertIn("off the list", actions.drawn(self.as_("ux"), args(story="sc-1")))
        self.assertEqual(store.drawings(self.db), [])
        self.assertIn("was not on", actions.drawn(self.as_("ux"), args(story="sc-1")))

    def test_the_list_prints_oldest_first_with_each_prompt(self):
        store.add_drawing(self.db, 2, "Later", "/soirely-designer two", 20)
        store.add_drawing(self.db, 1, "Sooner", "/soirely-designer one\nStates: empty", 10)
        session = mock.Mock(db=self.db)
        with mock.patch("builtins.print") as said:
            cli.cmd_drawings(session, args())
        self.assertEqual([c.args[0] for c in said.call_args_list],
                         ["sc-1  Sooner", "    /soirely-designer one\n    States: empty",
                          "sc-2  Later", "    /soirely-designer two"])

    def test_only_the_designer_lists_drawings(self):
        self.fake.add(1, "Needs Design")
        with self.assertRaises(actions.Refused):
            actions.to_draw(self.as_("pm"), args(story="sc-1", text="x"))


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


class Unblocked(Base):
    MERGED_AT = 1_790_000_000

    def setUp(self):
        super().setUp()
        self.fake.add(4, "Done")
        self.fake.add(9, "To Do", ["translation"])
        store.put_story(self.db, slim(self.fake.raw[4]))
        store.put_story(self.db, dict(slim(self.fake.raw[9]),
                                      links=[{"verb": "relates to", "subject": 9, "object": 4}]))
        merged = dict(pr(), number=40, story_id=4, state="merged", branch="dev/sc-4/build",
                      merged_at="2026-09-21T14:13:20Z")
        store.put_prs(self.db, [merged])

    def wakes(self):
        return [(w["story_id"], w["pr"], w["status"]) for w in self.db.execute(
            "select * from work where kind = 'unblocked'")]

    def test_a_raised_wake_stays_open_after_its_pr_leaves_the_synced_merges(self):
        cli.refresh_work(self.db, self.MERGED_AT + 30)
        self.assertEqual(self.wakes(), [(9, 40, "open")])
        store.put_prs(self.db, [])
        cli.refresh_work(self.db, self.MERGED_AT + 60)
        self.assertEqual(self.wakes(), [(9, 40, "open")])

    def test_baseline_closes_a_wake_already_waiting(self):
        cli.baseline(self.db)
        self.assertEqual(self.wakes(), [(9, 40, "done")])


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

    def test_a_branch_behind_main_still_merges(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        with mock.patch("soirely_queue.github.live", return_value=self.live(state="BEHIND")), \
                mock.patch("soirely_queue.github.merge") as merge, \
                mock.patch("soirely_queue.sync.sync_github"):
            actions.merge(self.as_("dev2"), args(pr=9, text=None))
        merge.assert_called_once_with(9, HEAD)

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

    def test_a_story_in_passed_code_review_merges_and_goes_to_qa(self):
        self.fake.add(1, "Passed Code Review", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge") as merge, \
                mock.patch("soirely_queue.sync.sync_github"):
            actions.merge(self.as_("dev2"), args(pr=9, text=None))
        merge.assert_called_once_with(9, HEAD)
        self.assertEqual(self.state(1), "Ready For QA")

    def test_a_pass_moves_the_story_to_passed_code_review(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr())
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.post_review", return_value={}) as post, \
                mock.patch("soirely_queue.sync.sync_github"):
            actions.review(self.as_("lead"), args(pr=9, verdict="pass", findings=None,
                                                  qa=None, text="summary"))
        self.assertEqual(self.state(1), "Passed Code Review")
        body = post.call_args.args[4]
        self.assertEqual(github.verdict({"body": body}), {"verdict": "pass", "sha": HEAD})

    def test_a_push_after_the_pass_reviewed_again_can_fail(self):
        self.fake.add(1, "Passed Code Review", ["dev2"])
        store.put_pr(self.db, pr())
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.post_review", return_value={}), \
                mock.patch("soirely_queue.sync.sync_github"), \
                mock.patch("soirely_queue.actions.findings",
                           return_value=[{"path": "a", "line": 1, "blocking": True,
                                          "body": "b"}]):
            actions.review(self.as_("lead"), args(pr=9, verdict="back", findings="f",
                                                  qa=None, text="summary"))
        self.assertEqual(self.state(1), "Failed Code Review")

    def test_a_push_after_the_pass_sends_the_story_back_to_in_review(self):
        self.fake.add(1, "Passed Code Review", ["dev2"])
        self.as_("lead").story("sc-1")
        store.put_pr(self.db, pr("pass", at=OLD))
        self.assertEqual(actions.void_passes(self.as_("runner")), [1])
        self.assertEqual(self.state(1), "In Review")
        self.assertIn("after its pass", self.fake.comments[-1][1])
        self.assertEqual(actions.void_passes(self.as_("runner")), [])

    def test_a_pass_still_at_the_head_stays_passed(self):
        self.fake.add(1, "Passed Code Review", ["dev2"])
        self.as_("lead").story("sc-1")
        store.put_pr(self.db, pr("pass"))
        self.assertEqual(actions.void_passes(self.as_("runner")), [])
        self.assertEqual(self.state(1), "Passed Code Review")

    def test_the_linguist_merges_every_locale_with_a_merge_commit(self):
        store.put_pr(self.db, pr())
        mine = [(path, 1, 0) for path in sorted(roles.linguist_files())]
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.files", return_value=mine), \
                mock.patch("soirely_queue.github.merge") as merge:
            actions.merge(self.as_("l10n"), args(pr=9, text=None))
        merge.assert_called_once_with(9, HEAD, delete_branch=True)

    def test_the_linguist_merges_the_apis_icu_catalogues(self):
        store.put_pr(self.db, pr())
        files = [(f"services/api/translations/{name}+intl-icu.pt.json", 1, 0)
                 for name in ("messages", "errors", "emails")]
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.files", return_value=files), \
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

    def test_a_developers_pr_on_a_translation_ticket_merges_and_leaves_the_ticket(self):
        for state in ("In Progress", "Passed Code Review"):
            self.fake.add(1, state, ["translation"])
            store.put_pr(self.db, dict(pr("pass"), branch="fix/sc-1/test-wording"))
            told = len(self.fake.comments)
            with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                    mock.patch("soirely_queue.github.merge") as merge, \
                    mock.patch("soirely_queue.sync.sync_github"):
                said = actions.merge(self.as_("dev"), args(pr=9, text=None))
            merge.assert_called_once_with(9, HEAD)
            self.assertEqual(self.state(1), state)
            self.assertIn(f"stays {state}", said)
            self.assertEqual(len(self.fake.comments), told)

    def test_the_linguists_own_pr_is_not_a_developers_to_merge(self):
        self.fake.add(1, "In Progress", ["translation"])
        store.put_pr(self.db, dict(pr("pass"), branch="l10n/sc-1"))
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge") as merge:
            with self.assertRaisesRegex(actions.Refused, "In Progress, not Passed Code Review"):
                actions.merge(self.as_("dev"), args(pr=9, text=None))
            merge.assert_not_called()

    def test_a_pass_on_a_developers_pr_on_a_translation_ticket_tags_no_qa(self):
        for state in ("In Progress", "In Review"):
            self.fake.add(1, state, ["translation"])
            store.put_pr(self.db, dict(pr(), branch="fix/sc-1/test-wording"))
            with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                    mock.patch("soirely_queue.github.post_review", return_value={}), \
                    mock.patch("soirely_queue.sync.sync_github"):
                actions.review(self.as_("lead"), args(pr=9, verdict="pass", findings=None,
                                                      qa=None, text="summary"))
            self.assertEqual(self.state(1), state)
            self.assertFalse(any("[qa]" in text for _, text, *_ in self.fake.comments))

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
        self.assertTrue(body.endswith("Failed code review: 1 blocking."))
        self.assertEqual(github.verdict({"body": body, "commit": {"oid": HEAD}}),
                         {"verdict": "back", "sha": HEAD, "blocking": 1})
        self.assertEqual(self.state(1), "Failed Code Review")
        self.assertIn("[dev2] (from lead)", self.fake.comments[-1][1])


    def test_a_refresh_failing_after_the_post_still_says_it_posted(self):
        self.fake.add(1, "In Review")
        store.put_pr(self.db, pr())
        limited = github.GitHubError("gh api graphql: API rate limit exceeded")
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.post_review", return_value={}), \
                mock.patch("soirely_queue.sync.sync_github", side_effect=limited):
            said = actions.review(self.as_("lead"), args(pr=9, verdict="pass", findings=None,
                                                         qa=None, text="summary"))
        self.assertTrue(said.startswith("posted the review on PR #9"))
        self.assertIn("refresh after it failed", said)
        self.assertEqual(self.state(1), "Passed Code Review")
        self.assertIn("[qa] (from lead)", self.fake.comments[-1][1])

    def test_a_merge_tells_qa_even_when_the_refresh_after_it_fails(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        limited = github.GitHubError("gh api graphql: API rate limit exceeded")
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge"), \
                mock.patch("soirely_queue.sync.sync_github", side_effect=limited):
            said = actions.merge(self.as_("dev2"), args(pr=9, text=None))
        self.assertIn("refresh after it failed", said)
        self.assertEqual(self.state(1), "Ready For QA")

    def test_a_merge_whose_handover_fails_says_how_to_finish_it(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        refused = actions.ShortcutError("Shortcut 409 on PUT /api/v3/stories/1: conflict")
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge") as merge, \
                mock.patch("soirely_queue.sync.sync_github"), \
                mock.patch.object(self.fake, "update", side_effect=refused):
            with self.assertRaisesRegex(actions.Refused,
                                        f"merged PR #9 as {'m' * 40}.*409.*to-qa sc-1"):
                actions.merge(self.as_("dev2"), args(pr=9, text=None))
        merge.assert_called_once_with(9, HEAD)

    def test_merging_a_merged_pr_whose_story_is_in_review_finishes_the_handover(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, {**pr("pass"), "state": "merged", "merge_sha": "m" * 40})
        with mock.patch("soirely_queue.github.merge") as merge:
            said = actions.merge(self.as_("dev2"), args(pr=9, text=None))
        merge.assert_not_called()
        self.assertIn("already merged", said)
        self.assertEqual(self.state(1), "Ready For QA")
        self.assertIn("m" * 40, self.fake.comments[-1][1])

    def test_a_follow_up_pr_on_a_story_in_qa_merges_and_leaves_the_story(self):
        for state in ("Ready For QA", "In QA", "Failed QA"):
            self.fake.add(1, state, ["dev2"])
            store.put_pr(self.db, pr("pass"))
            told = len(self.fake.comments)
            with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                    mock.patch("soirely_queue.github.merge") as merge, \
                    mock.patch("soirely_queue.sync.sync_github"):
                said = actions.merge(self.as_("dev2"), args(pr=9, text=None))
            merge.assert_called_once_with(9, HEAD)
            self.assertEqual(self.state(1), state)
            self.assertIn(f"stays {state}", said)
            self.assertEqual(len(self.fake.comments), told)

    def test_a_follow_up_pr_still_needs_a_pass_at_the_head(self):
        self.fake.add(1, "Ready For QA", ["dev2"])
        store.put_pr(self.db, pr("pass", at=OLD))
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge") as merge:
            with self.assertRaisesRegex(actions.Refused, "no lead pass"):
                actions.merge(self.as_("dev2"), args(pr=9, text=None))
            merge.assert_not_called()

    def test_a_follow_up_pr_is_still_its_builders_and_held_by_open_threads(self):
        self.fake.add(1, "Ready For QA", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        with mock.patch("soirely_queue.github.live", return_value=self.live()), \
                mock.patch("soirely_queue.github.merge") as merge:
            with self.assertRaisesRegex(actions.Refused, "dev2's to merge"):
                actions.merge(self.as_("ops"), args(pr=9, text=None))
            self.fake.add(1, "In QA", ["ops"])
            with self.assertRaisesRegex(actions.Refused, "ops's to merge"):
                actions.merge(self.as_("dev2"), args(pr=9, text=None))
            self.fake.add(1, "Ready For QA", ["dev2"])
            store.put_pr(self.db, pr("pass", threads=[{"resolved": False, "comments": []}]))
            with self.assertRaisesRegex(actions.Refused, "1 review threads are open"):
                actions.merge(self.as_("dev2"), args(pr=9, text=None))
            merge.assert_not_called()

    def test_merging_a_merged_pr_whose_story_moved_on_is_refused(self):
        self.fake.add(1, "Ready For QA", ["dev2"])
        store.put_pr(self.db, {**pr("pass"), "state": "merged", "merge_sha": "m" * 40})
        with self.assertRaisesRegex(actions.Refused, "PR #9 is merged"):
            actions.merge(self.as_("dev2"), args(pr=9, text=None))
        self.assertEqual(self.fake.comments, [])


class Findings(unittest.TestCase):
    def test_each_finding_opens_with_its_severity(self):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as f:
            f.write("## a.ts:3 blocking\nThe guard is missing.\n## b.ts:9 nit\nnit: a word.\n")
        found = actions.findings(f.name)
        self.assertEqual([x["body"] for x in found],
                         ["blocking: The guard is missing.", "nit: a word."])
        self.assertEqual([x["blocking"] for x in found], [True, False])


class OpsOwnsItsTickets(Base):
    """Ops files, builds and merges its own infra work; the lead still reviews every one."""

    def live(self, draft=False):
        return {"headRefOid": HEAD, "mergeable": "MERGEABLE", "mergeStateStatus": "CLEAN",
                "draft": draft, "mergeCommit": "m" * 40}

    def merge(self, role="ops", draft=False):
        with mock.patch("soirely_queue.github.live", return_value=self.live(draft)), \
                mock.patch("soirely_queue.github.merge") as merged, \
                mock.patch("soirely_queue.github.ready") as ready, \
                mock.patch("soirely_queue.sync.sync_github"):
            said = actions.merge(self.as_(role), args(pr=9, text=None))
        return said, merged, ready

    def test_ops_files_its_own_story_labelled_ops(self):
        self.fake.create_story = lambda **f: self.fake.raw.setdefault(
            50, {"id": 50, "name": f["name"], "workflow_state_id": f["workflow_state_id"],
                 "moved_at": "t0", "labels": f["labels"], "comments": [], "description": ""})
        store.set_meta(self.db, "epics", {"26": {"name": "Foundation", "state": "in progress"}})
        actions.new_story(self.as_("ops"), args(name="Pin the base images", text="why",
                                                 type="chore", state="In Progress", label=None,
                                                 epic=26, estimate=None))
        self.assertEqual(self.state(50), "In Progress")
        self.assertEqual(self.labels(50), {"ops"})

    def test_ops_cannot_file_straight_into_review_or_qa(self):
        with self.assertRaisesRegex(actions.Refused, "Backlog"):
            store.set_meta(self.db, "epics", {"26": {"name": "F", "state": "in progress"}})
            actions.new_story(self.as_("ops"), args(name="x", text="y", type=None,
                                                     state="Ready For QA", label=None,
                                                     epic=26, estimate=None))

    def test_a_passed_ops_pr_merges_and_its_story_is_done_without_qa(self):
        self.fake.add(1, "In Review", ["ops"])
        store.put_pr(self.db, pr("pass"))
        said, merged, _ = self.merge()
        merged.assert_called_once_with(9, HEAD)
        self.assertEqual(self.state(1), "Done")
        self.assertIn("sc-1 is Done", said)
        self.assertNotIn("[qa]", self.fake.comments[-1][1])

    def test_an_ops_story_that_needs_qa_goes_to_qa(self):
        self.fake.add(1, "In Review", ["ops", "needs qa"])
        store.put_pr(self.db, pr("pass"))
        self.merge()
        self.assertEqual(self.state(1), "Ready For QA")
        self.assertIn("[qa] (from ops)", self.fake.comments[-1][1])

    def test_ops_never_merges_without_the_leads_pass(self):
        self.fake.add(1, "In Review", ["ops"])
        store.put_pr(self.db, pr("back"))
        with self.assertRaisesRegex(actions.Refused, "no lead pass"):
            self.merge()

    def test_a_draft_is_marked_ready_before_it_merges(self):
        self.fake.add(1, "In Review", ["ops"])
        store.put_pr(self.db, pr("pass"))
        _, merged, ready = self.merge(draft=True)
        ready.assert_called_once_with(9)
        merged.assert_called_once()

    def test_the_story_waits_for_its_last_pull_request(self):
        self.fake.add(1, "In Review", ["ops"])
        store.put_pr(self.db, pr("pass"))
        store.put_pr(self.db, dict(pr("pass"), number=10))
        said, _, _ = self.merge()
        self.assertEqual(self.state(1), "In Review")
        self.assertIn("waiting on #10", said)

    def test_each_builder_merges_only_its_own_stories(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr("pass"))
        with self.assertRaisesRegex(actions.Refused, "dev2's to merge"):
            self.merge("ops")
        self.fake.add(1, "In Review", ["ops"])
        with self.assertRaisesRegex(actions.Refused, "ops's to merge"):
            self.merge("dev")

    def test_ops_moves_only_its_own_stories(self):
        self.fake.add(1, "Ready For Dev", ["backend"])
        with self.assertRaisesRegex(actions.Refused, "only its own stories"):
            actions.move(self.as_("ops"), args(story="sc-1", state="In Progress"))
        self.fake.add(2, "Ready For Dev", ["ops"])
        actions.move(self.as_("ops"), args(story="sc-2", state="In Progress"))
        self.assertEqual(self.state(2), "In Progress")

    def test_ops_never_moves_a_story_to_done_by_hand(self):
        self.fake.add(1, "In Review", ["ops"])
        with self.assertRaisesRegex(actions.Refused, "never moves a story to Done"):
            actions.move(self.as_("ops"), args(story="sc-1", state="Done"))

    def test_ops_takes_no_story_a_developer_holds(self):
        self.fake.add(1, "In Progress", ["dev1"])
        with self.assertRaisesRegex(actions.Refused, "another role's to build"):
            actions.label(self.as_("ops"), args(story="sc-1", add=["ops"], remove=None))
        self.fake.add(2, "Ready For Dev", [])
        actions.label(self.as_("ops"), args(story="sc-2", add=["ops"], remove=None))
        self.assertEqual(self.labels(2), {"ops"})
        self.assertIn("[pm] (from ops)", self.fake.comments[-1][1])
        self.assertIn("left your queue", self.fake.comments[-1][1])

    def test_ops_takes_no_story_further_along_than_in_progress(self):
        for n, state in enumerate(("To Do", "In Review", "Ready For QA", "Failed QA"), 1):
            self.fake.add(n, state, [])
            with self.assertRaisesRegex(actions.Refused, "takes over only"):
                actions.label(self.as_("ops"), args(story=f"sc-{n}", add=["ops"], remove=None))

    def test_ops_takes_no_in_progress_story_someone_holds(self):
        self.fake.add(1, "In Progress", [])
        store.put_prs(self.db, [dict(pr("pass"), branch="feat/sc-1-thing")])
        with mock.patch("soirely_queue.sync.sync_github"), \
                self.assertRaisesRegex(actions.Refused, "held"):
            actions.label(self.as_("ops"), args(story="sc-1", add=["ops"], remove=None))

    def test_ops_changes_needs_qa_only_on_its_own_stories(self):
        self.fake.add(1, "Ready For QA", ["backend", "needs qa"])
        for change in ({"add": ["needs qa"], "remove": None},
                       {"add": None, "remove": ["needs qa"]}):
            with self.assertRaisesRegex(actions.Refused, "only its own stories"):
                actions.label(self.as_("ops"), args(story="sc-1", **change))
        self.fake.add(2, "In Progress", ["ops"])
        actions.label(self.as_("ops"), args(story="sc-2", add=["needs qa"], remove=None))
        self.assertEqual(self.labels(2), {"ops", "needs qa"})

    def test_no_role_opens_a_draft(self):
        with self.assertRaisesRegex(actions.Refused, "ready for review"):
            actions.pr_create(self.as_("ops"), args(head="b", title="t", text="x", draft=True))

    def test_an_ops_story_wakes_ops_and_no_one_else(self):
        self.fake.add(1, "To Do", ["ops"])
        self.as_("ops").story("sc-1")
        for role in ("pm", "ux", "dev", "dev2", "bm"):
            self.assertEqual(self.queue_wakes(role), [], role)
        self.assertEqual(self.queue_wakes("ops"), ["sc-1 moved to To Do"])

    def test_a_passed_ops_pr_wakes_ops_to_merge_it(self):
        self.fake.add(1, "In Review", ["ops"])
        self.as_("ops").story("sc-1")
        store.put_prs(self.db, [pr("pass")])
        cli.refresh_work(self.db, 10_000_000)
        kinds = {(w["roles"], w["kind"]) for w in store.waiting(self.db, "ops")}
        self.assertIn(("ops", "merge"), kinds)
        self.assertFalse([w for w in store.waiting(self.db, "dev") if w["kind"] == "merge"])


class Closing(Base):
    def close(self, role, text="#346 landed the same change"):
        with mock.patch("soirely_queue.github.close") as closed, \
                mock.patch("soirely_queue.sync.sync_github"):
            said = actions.pr_close(self.as_(role), args(pr=9, text=text))
        return said, closed

    def test_ops_closes_a_developer_s_pr_and_says_why_on_it(self):
        self.fake.add(1, "Ready For QA", ["dev2"])
        store.put_pr(self.db, pr())
        said, closed = self.close("ops")
        closed.assert_called_once_with(9, "#346 landed the same change (from ops)")
        self.assertIn("closed PR #9 unmerged", said)

    def test_the_developers_close_each_other_s_but_not_another_builder_s(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, pr())
        self.close("dev")
        self.fake.add(1, "In Review", ["ops"])
        with self.assertRaisesRegex(actions.Refused, "ops's to close"):
            self.close("dev")

    def test_the_linguist_closes_a_translation_ticket_s_pr_and_a_developer_does_not(self):
        self.fake.add(1, "In Review", ["translation"])
        store.put_pr(self.db, pr())
        with self.assertRaisesRegex(actions.Refused, "l10n's to close"):
            self.close("dev")
        said, _ = self.close("l10n")
        self.assertIn("closed PR #9 unmerged", said)

    def test_no_close_without_a_reason_or_of_a_merged_pr(self):
        self.fake.add(1, "In Review", ["ops"])
        store.put_pr(self.db, pr())
        with self.assertRaisesRegex(actions.Refused, "say why"):
            self.close("ops", text=" ")
        store.put_pr(self.db, dict(pr(), state="merged"))
        with self.assertRaisesRegex(actions.Refused, "is merged"):
            self.close("ops")

    def test_a_role_that_builds_nothing_closes_nothing(self):
        store.put_pr(self.db, pr())
        with self.assertRaisesRegex(actions.Refused, "lead may not pr-close"):
            self.close("lead")


BODY = ("## Description\n\nWhat it did.\n\n## Risks\n\n- the old one\n\n## References\n\n"
        "sc-1\n\n## Evidence of work\n\nTests.\n\n## Next Steps\n\nNone.\n")


class EditingABody(Base):
    def setUp(self):
        super().setUp()
        edited = mock.patch("soirely_queue.github.edit_body")
        self.edited = edited.start()
        self.addCleanup(edited.stop)

    def live(self, state="OPEN"):
        return {"headRefOid": HEAD, "state": state, "body": BODY, "story_id": 1,
                "mergeCommit": None}

    def edit(self, role, section="Risks", text="- the new one", state="OPEN"):
        with mock.patch("soirely_queue.github.live", return_value=self.live(state)), \
                mock.patch("soirely_queue.sync.sync_github") as synced, \
                mock.patch("soirely_queue.github.merge") as merged:
            said = actions.pr_edit(self.as_(role), args(pr=9, section=section, text=text))
        merged.assert_not_called()
        synced.assert_not_called()
        return said

    def refused(self, why, role="ops", **kw):
        with self.assertRaisesRegex(actions.Refused, why):
            self.edit(role, **kw)
        self.edited.assert_not_called()

    def test_one_section_changes_and_reads_back_at_once(self):
        self.fake.add(1, "In Review", ["dev2"])
        store.put_pr(self.db, dict(pr("pass"), body=BODY))
        said = self.edit("dev2", section="risks")
        new = BODY.replace("- the old one", "- the new one")
        self.edited.assert_called_once_with(9, new)
        self.assertIn("PR #9: replaced Risks", said)
        self.assertEqual(store.pr(self.db, 9)["body"], new)
        self.assertEqual(store.pr(self.db, 9)["lead"], pr("pass")["lead"])
        self.assertEqual(self.state(1), "In Review")

    def test_a_closed_body_is_not_corrected(self):
        self.fake.add(1, "Done", ["ops"])
        self.refused("closed unmerged", state="CLOSED")

    def test_a_merged_body_is_corrected(self):
        self.fake.add(1, "Done", ["ops"])
        self.edit("ops", state="MERGED")
        self.edited.assert_called_once_with(9, BODY.replace("- the old one", "- the new one"))

    def test_an_unknown_name_changes_nothing(self):
        self.fake.add(1, "In Review", ["ops"])
        self.refused("no heading matches Design; the body has: Description; Risks; References; "
                     "Evidence of work; Next Steps", section="Design")

    def test_a_name_matching_two_headings_changes_nothing(self):
        self.fake.add(1, "In Review", ["ops"])
        self.refused("2 headings match R", section="R")

    def test_empty_text_changes_nothing(self):
        self.fake.add(1, "In Review", ["ops"])
        self.refused("the new text is empty", text=" \n")

    def test_text_with_its_own_heading_changes_nothing(self):
        self.fake.add(1, "In Review", ["ops"])
        self.refused("brings its own heading", text="## Risks\n- x")

    def test_another_builder_s_pr_is_refused_with_whose_it_is(self):
        self.fake.add(1, "In Review", ["translation"])
        self.refused("l10n's to edit", role="dev")

    def test_a_role_that_builds_nothing_edits_nothing(self):
        self.fake.add(1, "In Review", ["dev3"])
        for role in ("lead", "pm", "qa"):
            self.refused(f"{role} may not pr-edit", role=role)

    def test_whoever_may_close_it_may_edit_it(self):
        self.fake.add(1, "In Review", ["translation"])
        self.edit("l10n")
        self.edit("ops")
        self.fake.add(1, "In Review", ["dev3"])
        self.edit("dev")
        self.assertEqual(self.edited.call_count, 3)


class PermissionAsks(Base):
    def setUp(self):
        super().setUp()
        self.fake.add(4992, "Backlog", [])
        patch = mock.patch("soirely_queue.actions.this_machine", return_value="tolu-mac")
        patch.start()
        self.addCleanup(patch.stop)

    def ask(self, role="qa2", rule="Bash(xcrun simctl boot:*)"):
        return actions.permission_ask(self.as_(role), args(
            rule=rule, for_="booting the simulator for sc-3132", without="no iOS QA here"))

    def test_an_ask_posts_the_five_parts_with_no_tag(self):
        said = self.ask()
        self.assertEqual(self.fake.comments[-1], (4992, "\n".join([
            "Permission ask (from qa2)", "Machine: tolu-mac", "Rule: Bash(xcrun simctl boot:*)",
            "For: booting the simulator for sc-3132", "Without it: no iOS QA here"])))
        self.assertIn("Don't wait", said)
        cli.refresh_work(self.db, 10_000_000)
        self.assertEqual([w for w in store.waiting(self.db, "pm") if w["kind"] == "inbox"], [])

    def test_the_same_rule_is_not_asked_twice_and_the_answer_is_given(self):
        self.ask()
        self.fake.comment(4992, "No: use the Android emulator instead.", parent_id=1)
        with self.assertRaisesRegex(actions.Refused, "owner answered: No: use the Android"):
            self.ask(role="qa3")

    def test_a_rule_must_be_a_rule(self):
        with self.assertRaisesRegex(actions.Refused, "not a permission rule"):
            self.ask(rule="sudo everything")

    def test_nobody_merges_a_change_to_the_granted_rules(self):
        self.fake.add(1, "In Review", ["ops"])
        store.put_pr(self.db, pr("pass"))
        with mock.patch("soirely_queue.github.live", return_value={
                "headRefOid": HEAD, "mergeable": "MERGEABLE", "draft": False}), \
                mock.patch("soirely_queue.github.files",
                           return_value=[("tools/queue/permissions.json", 1, 0)]), \
                mock.patch("soirely_queue.github.merge") as merged, \
                mock.patch("soirely_queue.sync.sync_github"), \
                self.assertRaisesRegex(actions.Refused, "only the owner merges it"):
            actions.merge(self.as_("ops"), args(pr=9, text=None))
        merged.assert_not_called()

