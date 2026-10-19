import unittest

from soirely_queue import roles, work

HEAD = "a" * 40
OLD = "b" * 40


def story(id_=1, state="In Review", labels=(), comments=(), moved_at="2026-10-18T10:00:00Z"):
    return {"id": id_, "name": "A story", "url": "", "state": state, "labels": list(labels),
            "epic": None, "position": 0, "moved_at": moved_at, "done": False,
            "description": "", "comments": list(comments)}


def comment(id_, text, parent=None, at=None):
    return {"id": id_, "parent": parent, "at": at or f"2026-10-18T10:{id_:02d}:00Z",
            "text": text}


def pr(number=7, story_id=1, head=HEAD, checks="green", lead=(), threads=(), state="open",
       carried=None):
    return {"number": number, "title": "", "url": "", "state": state, "draft": False,
            "branch": f"feature/sc-{story_id}/x", "story_id": story_id, "head_sha": head,
            "checks": checks, "mergeable": "mergeable", "merged_at": None, "merge_sha": None,
            "lead": list(lead), "threads": list(threads), "carried": carried}


def verdict(kind, sha, at="2026-10-18T11:00:00Z"):
    return {"verdict": kind, "sha": sha, "at": at, "id": 1}


def kinds(items, role=None):
    return sorted(i["kind"] for i in items if role is None or role in i["roles"])


class Header(unittest.TestCase):
    def test_reads_addressees_and_author(self):
        self.assertEqual(roles.header("[pm] [ux] (from qa)\nbody"),
                         {"to": ["pm", "ux"], "from": "qa"})

    def test_a_bare_dev_tag_goes_to_the_labelled_developer(self):
        self.assertEqual(roles.addressees("[dev] (from lead)\n", ["dev2"]), ["dev2"])
        self.assertEqual(roles.addressees("[dev] (from lead)\n", []), ["dev"])

    def test_a_former_locale_tag_or_signature_means_the_linguist(self):
        self.assertEqual(roles.addressees("[fr] [pm] (from qa2)\n", []), ["l10n", "pm"])
        self.assertEqual(roles.author("[qa] (from pt)\nDone."), "l10n")

    def test_an_old_locale_thread_is_the_linguists_and_its_reply_answers_it(self):
        asked = comment(1, "[fr] (from qa2)\nThe French label does not fit.")
        self.assertEqual([c["id"] for c in work.open_for("l10n", story(comments=[asked]))], [1])
        answered = comment(2, "[qa2] (from fr)\nShortened.", parent=1)
        self.assertEqual(work.open_for("l10n", story(comments=[asked, answered])), [])

    def test_a_report_with_no_header_is_for_nobody(self):
        self.assertEqual(roles.addressees("A QA report\n[pm] (from qa)", []), [])


class Inbox(unittest.TestCase):
    def test_a_question_stays_open_until_the_role_replies_in_its_thread(self):
        asked = story(comments=[comment(1, "[lead] (from dev)\nre-review please")])
        self.assertEqual([c["id"] for c in work.open_for("lead", asked)], [1])

        answered = story(comments=[comment(1, "[lead] (from dev)\nre-review please"),
                                   comment(2, "[dev] (from lead)\ndone", parent=1)])
        self.assertEqual(work.open_for("lead", answered), [])
        self.assertEqual(work.open_for("dev", answered)[0]["id"], 2)

    def test_a_comment_a_finished_run_dealt_with_is_not_open(self):
        asked = story(comments=[comment(1, "[lead] (from dev)\nre-review please")])
        self.assertEqual(work.open_for("lead", asked, {("lead", 1)}), [])

    def test_one_item_per_role_and_story_naming_every_open_comment(self):
        asked = story(comments=[comment(1, "[pm] (from qa)\none"),
                                comment(2, "[pm] [ux] (from qa)\ntwo")])
        items = work.inbox_items([asked])
        pm = [i for i in items if i["roles"] == ["pm"]]
        self.assertEqual(len(pm), 1)
        self.assertEqual(pm[0]["comments"], [1, 2])
        self.assertEqual([i["comments"] for i in items if i["roles"] == ["ux"]], [[2]])


class Review(unittest.TestCase):
    def test_a_push_after_the_pass_needs_another_review(self):
        items = work.review_items([story()], [pr(lead=[verdict("pass", OLD[:7])])])
        self.assertEqual(len(items), 1)
        self.assertIn("pushed after the pass", items[0]["reason"])

    def test_a_pass_at_the_head_needs_nothing(self):
        self.assertEqual(work.review_items([story()], [pr(lead=[verdict("pass", HEAD[:7])])]), [])

    def test_a_pass_carried_over_a_merge_of_main_needs_nothing(self):
        carried = pr(lead=[verdict("pass", OLD[:7])], carried=OLD[:7])
        self.assertEqual(work.review_items([story()], [carried]), [])

    def test_findings_at_the_head_wait_until_the_story_comes_back(self):
        found = [verdict("back", HEAD, at="2026-10-18T11:00:00Z")]
        waiting = story(moved_at="2026-10-18T10:00:00Z")
        returned = story(moved_at="2026-10-18T12:00:00Z")
        self.assertEqual(work.review_items([waiting], [pr(lead=found)]), [])
        self.assertEqual(len(work.review_items([returned], [pr(lead=found)])), 1)

    def test_checks_still_running_are_not_ready(self):
        self.assertEqual(work.review_items([story()], [pr(checks="pending")]), [])

    def test_in_review_with_no_pull_request_is_flagged_unless_one_merged(self):
        self.assertEqual(len(work.review_items([story()], [])), 1)
        self.assertEqual(work.review_items([story()], [pr(state="merged")]), [])


def thread(*texts, resolved=False):
    return {"id": "T", "resolved": resolved, "outdated": False, "path": "x", "line": 1,
            "comments": [{"id": 100 + i, "at": "", "text": t} for i, t in enumerate(texts)]}


class Threads(unittest.TestCase):
    passed = [verdict("pass", HEAD[:7])]

    def test_a_reply_on_a_finding_wakes_the_lead_in_any_state(self):
        for state in ("In Review", "In Progress", "Ready For QA"):
            items = work.review_items([story(state=state)], [pr(
                lead=self.passed, threads=[thread("should: x", "Kept as is. (from dev)")])])
            self.assertEqual([(i["kind"], i["roles"]) for i in items], [("threads", ["lead"])])

    def test_a_finding_with_no_reply_or_the_lead_last_waits(self):
        for t in (thread("nit: x"), thread("nit: x", "Fixed. (from dev)", "Not yet. (from lead)"),
                  thread("nit: x", "Fixed. (from dev)", resolved=True)):
            self.assertEqual(work.review_items([story()], [pr(lead=self.passed, threads=[t])]), [])

    def test_a_thread_the_lead_did_not_start_is_not_its_work(self):
        t = thread("Why this? (from qa)", "Because. (from dev)")
        self.assertEqual(work.review_items([story()], [pr(lead=self.passed, threads=[t])]), [])

    def test_a_review_item_already_carries_the_threads(self):
        items = work.review_items([story()], [pr(threads=[thread("blocking: x", "Done.")])])
        self.assertEqual([i["kind"] for i in items], ["review"])

    def test_each_new_reply_is_new_work(self):
        one = work.review_items([story()], [pr(lead=self.passed,
                                               threads=[thread("nit: x", "a (from dev)")])])
        two = work.review_items([story()], [pr(lead=self.passed, threads=[
            thread("nit: x", "a (from dev)", "b (from lead)", "c (from dev)")])])
        self.assertNotEqual(one[0]["fingerprint"], two[0]["fingerprint"])


class Developer(unittest.TestCase):
    def test_a_pass_at_the_head_with_no_open_thread_is_a_merge(self):
        items = work.developer_items([story(labels=["dev2"])],
                                     [pr(lead=[verdict("pass", HEAD[:7])])])
        self.assertEqual([(i["kind"], i["roles"]) for i in items], [("merge", ["dev2"])])

    def test_a_pass_carried_over_a_merge_of_main_is_a_merge(self):
        carried = pr(lead=[verdict("pass", OLD[:7])], carried=OLD[:7])
        self.assertEqual(kinds(work.developer_items([story()], [carried])), ["merge"])

    def test_an_open_thread_holds_the_merge(self):
        thread = {"id": "T", "resolved": False, "outdated": False, "path": "x", "line": 1,
                  "comments": []}
        items = work.developer_items([story()], [pr(lead=[verdict("pass", HEAD[:7])],
                                                    threads=[thread])])
        self.assertEqual(items, [])

    def test_a_pass_with_an_unanswered_thread_wakes_the_developer(self):
        for t in (thread("should: x"), thread("should: x", "a (from dev2)", "b (from lead)")):
            items = work.developer_items([story(labels=["dev2"])],
                                         [pr(lead=[verdict("pass", HEAD[:7])], threads=[t])])
            self.assertEqual([(i["kind"], i["roles"]) for i in items],
                             [("answer-threads", ["dev2"])])

    def test_a_thread_the_developer_answered_last_waits_on_the_lead(self):
        t = thread("should: x", "Kept as is. (from dev2)")
        items = work.developer_items([story(labels=["dev2"])],
                                     [pr(lead=[verdict("pass", HEAD[:7])], threads=[t])])
        self.assertEqual(items, [])

    def test_each_new_lead_reply_is_new_work_for_the_developer(self):
        def one(*texts):
            return work.developer_items([story(labels=["dev2"])], [pr(
                lead=[verdict("pass", HEAD[:7])], threads=[thread(*texts)])])[0]["fingerprint"]
        self.assertNotEqual(one("nit: x"), one("nit: x", "a (from dev2)", "b (from lead)"))

    def test_merged_at_the_passed_sha_goes_to_qa(self):
        merged = pr(state="merged", lead=[verdict("pass", HEAD[:7])])
        self.assertEqual(kinds(work.developer_items([story()], [merged])), ["to-qa"])

    def test_red_checks_and_green_in_progress(self):
        self.assertEqual(kinds(work.developer_items([story()], [pr(checks="red")])),
                         ["checks-red"])
        self.assertEqual(kinds(work.developer_items([story(state="In Progress")], [pr()])),
                         ["to-review"])


class Carried(unittest.TestCase):
    def setUp(self):
        self.asked = []

    def same(self, answer):
        def same_change(before, after):
            self.asked.append((before, after))
            return answer
        return same_change

    def test_a_head_making_the_passed_change_carries_the_pass(self):
        cache = {}
        passed = pr(lead=[verdict("pass", OLD[:7])])
        self.assertEqual(work.carried(passed, cache, self.same(True)), OLD[:7])
        self.assertEqual(self.asked, [(OLD[:7], HEAD)])
        self.assertEqual(cache, {f"{OLD[:7]}..{HEAD}": True})

    def test_an_answer_is_asked_once_per_pair(self):
        cache = {f"{OLD[:7]}..{HEAD}": False}
        passed = pr(lead=[verdict("pass", OLD[:7])])
        self.assertIsNone(work.carried(passed, cache, self.same(True)))
        self.assertEqual(self.asked, [])

    def test_a_merged_pull_request_carries_nothing(self):
        merged = pr(state="merged", lead=[verdict("pass", OLD[:7])])
        self.assertIsNone(work.carried(merged, {}, self.same(True)))
        self.assertEqual(self.asked, [])
        self.assertEqual(kinds(work.developer_items([story()], [merged])), ["merged-unpassed"])

    def test_a_merged_pull_request_keeps_the_carry_made_while_open(self):
        before = pr(lead=[verdict("pass", OLD[:7])], carried=OLD[:7])
        merged = pr(state="merged", lead=[verdict("pass", OLD[:7])])
        kept = work.carried(merged, {}, self.same(False), before)
        self.assertEqual(kept, OLD[:7])
        self.assertEqual(self.asked, [])
        merged["carried"] = kept
        self.assertEqual(kinds(work.developer_items([story()], [merged])), ["to-qa"])

    def test_a_merged_head_keeps_no_carry_made_at_another_head_or_pass(self):
        merged = pr(state="merged", lead=[verdict("pass", OLD[:7])])
        for before in (pr(head="c" * 40, lead=[verdict("pass", OLD[:7])], carried=OLD[:7]),
                       pr(lead=[verdict("pass", "d" * 7)], carried="d" * 7),
                       pr(lead=[verdict("pass", OLD[:7])])):
            self.assertIsNone(work.carried(merged, {}, self.same(True), before))
        self.assertEqual(self.asked, [])

    def test_nothing_to_carry_without_a_pass_or_with_one_at_the_head(self):
        for lead in ([], [verdict("back", OLD)], [verdict("pass", HEAD[:7])]):
            self.assertIsNone(work.carried(pr(lead=lead), {}, self.same(True)))
        self.assertEqual(self.asked, [])

    def test_only_the_carried_sha_covers(self):
        passed = verdict("pass", OLD[:7])
        self.assertTrue(work.covers(passed, HEAD, carried=OLD[:7]))
        self.assertFalse(work.covers(passed, HEAD, carried="c" * 7))
        self.assertFalse(work.covers(passed, HEAD))


class Queue(unittest.TestCase):
    def test_an_unlabelled_to_do_story_is_one_item_both_developers_can_claim(self):
        items = [i for i in work.queue_items([story(state="To Do")]) if i["pool"] == "dev"]
        self.assertEqual(len(items), 1)
        self.assertEqual(sorted(items[0]["roles"]), ["dev", "dev2"])

    def test_ready_for_qa_is_one_item_for_the_three_testers(self):
        items = work.queue_items([story(state="Ready For QA")])
        self.assertEqual([sorted(i["roles"]) for i in items], [["qa", "qa2", "qa3"]])

    def test_a_translation_ticket_is_only_the_linguists(self):
        items = work.queue_items([story(state="To Do", labels=["translation"])])
        self.assertEqual(sorted(r for i in items for r in i["roles"]), ["l10n"])

    def test_a_role_s_own_move_is_no_wake_for_it(self):
        moved = story(state="To Do", moved_at="t1")
        items = work.queue_items([moved], {(1, "To Do", "t1"): "pm"})
        woken = sorted(r for i in items for r in i["roles"])
        self.assertNotIn("pm", woken)
        self.assertEqual(woken, ["bm", "dev", "dev2", "ux"])

    def test_the_same_move_by_another_role_still_wakes_it(self):
        moved = story(state="In Progress", labels=["dev2"], moved_at="t1")
        by_lead = work.queue_items([moved], {(1, "In Progress", "t1"): "lead"})
        self.assertEqual([i["roles"] for i in by_lead], [["dev2"]])
        by_itself = work.queue_items([moved], {(1, "In Progress", "t1"): "dev2"})
        self.assertEqual(by_itself, [])

    def test_a_move_recorded_earlier_does_not_hide_the_next_one(self):
        moved_again = story(state="To Do", moved_at="t2")
        items = work.queue_items([moved_again], {(1, "To Do", "t1"): "pm"})
        self.assertIn("pm", [r for i in items for r in i["roles"]])


class EveryWakeStillHappens(unittest.TestCase):
    """Each wake from before a role's own moves stopped waking it, with such a move on record."""

    now = 10_000_000

    def woken(self, stories=(), prs=(), main_run=None, moves=None, last_runs=None):
        runs = last_runs if last_runs is not None else {r: self.now for r in roles.ROLES}
        items = work.derive(list(stories), list(prs), main_run, runs, set(), self.now,
                            frozenset(), moves or {})
        return {(i["kind"], r) for i in items for r in i["roles"]}

    def test_a_tagged_question(self):
        asked = story(state="In Progress", labels=["dev2"], moved_at="t1",
                      comments=[comment(1, "[pm] (from dev2)\nWhich limit?")])
        found = self.woken([asked], moves={(1, "In Progress", "t1"): "dev2"})
        self.assertIn(("inbox", "pm"), found)

    def test_a_story_new_in_the_role_s_queue(self):
        failed = story(state="Failed QA", labels=["dev2"], moved_at="t1")
        found = self.woken([failed], moves={(1, "Failed QA", "t1"): "qa2"})
        self.assertIn(("story", "dev2"), found)
        self.assertIn(("story", "pm"), found)

    def test_a_pull_request_s_checks_and_review_steps(self):
        moves = {(1, "In Progress", "t1"): "dev2", (1, "In Review", "t1"): "dev2"}
        building = story(state="In Progress", labels=["dev2"], moved_at="t1")
        self.assertIn(("checks-red", "dev2"),
                      self.woken([building], [pr(checks="red")], moves=moves))
        self.assertIn(("to-review", "dev2"), self.woken([building], [pr()], moves=moves))
        reviewing = story(state="In Review", labels=["dev2"], moved_at="t1")
        self.assertIn(("review", "lead"), self.woken([reviewing], [pr()], moves=moves))
        passed = pr(lead=[verdict("pass", HEAD[:7])])
        self.assertIn(("merge", "dev2"), self.woken([reviewing], [passed], moves=moves))
        merged = pr(state="merged", lead=[verdict("pass", HEAD[:7])])
        self.assertIn(("to-qa", "dev2"), self.woken([reviewing], [merged], moves=moves))

    def test_main_going_red_for_ops(self):
        red = {"conclusion": "failure", "headSha": HEAD, "url": "u"}
        self.assertIn(("main", "ops"), self.woken(main_run=red))

    def test_each_role_s_heartbeat(self):
        waiting = story(state="Ready For QA", moved_at="t1")
        found = self.woken([waiting], moves={(1, "Ready For QA", "t1"): "dev2"}, last_runs={})
        for role in ("pm", "ux", "bm", "ops", "l10n", "cd"):
            self.assertIn(("sweep", role), found)
        for role in ("qa", "qa2", "qa3"):
            self.assertIn(("pick", role), found)

    def test_a_developer_s_heartbeat_after_moving_its_own_story(self):
        building = [story(1, state="In Progress", labels=["dev2"], moved_at="t1"),
                    story(2, state="In Progress", labels=["dev1"], moved_at="t1")]
        moves = {(1, "In Progress", "t1"): "dev2", (2, "In Progress", "t1"): "dev"}
        found = self.woken(building, moves=moves, last_runs={})
        self.assertIn(("pick", "dev2"), found)
        self.assertIn(("pick", "dev"), found)
        self.assertNotIn("lead", {r for _, r in found})


class Heartbeat(unittest.TestCase):
    def test_a_role_with_a_queue_picks_after_its_heartbeat(self):
        now = 10_000_000
        stories = [story(state="Ready For QA")]
        due = work.heartbeat_items(stories, {"qa": now - 31 * 60}, set(), now)
        self.assertIn("qa", [r for i in due if i["kind"] == "pick" for r in i["roles"]])
        quiet = work.heartbeat_items(stories, {"qa": now - 5 * 60}, set(), now)
        self.assertNotIn("qa", [r for i in quiet for r in i["roles"]])

    def test_a_role_with_no_queue_and_no_sweep_stays_asleep(self):
        items = work.heartbeat_items([], {}, set(), 10_000_000)
        self.assertNotIn("dev", [r for i in items for r in i["roles"]])
        self.assertIn("pm", [r for i in items for r in i["roles"]])


if __name__ == "__main__":
    unittest.main()
