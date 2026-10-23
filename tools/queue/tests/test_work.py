import unittest

from soirely_queue import roles, work
from soirely_queue import text as T

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
        for label in ("dev3", "dev4"):
            self.assertEqual(roles.addressees("[dev] (from lead)\n", [label]), [label])

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

    def test_a_push_after_the_pass_in_passed_code_review_needs_another_review(self):
        passed = story(state="Passed Code Review")
        items = work.review_items([passed], [pr(lead=[verdict("pass", OLD[:7])])])
        self.assertEqual([i["kind"] for i in items], ["review"])
        self.assertEqual(work.review_items([passed], [pr(lead=[verdict("pass", HEAD[:7])])]), [])

    def test_passed_code_review_with_no_pull_request_is_not_flagged(self):
        self.assertEqual(work.review_items([story(state="Passed Code Review")], []), [])

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


class SidePullRequests(unittest.TestCase):
    """A developer's pull request on a linguist's ticket, such as a test taking new wording."""

    def ticket(self, state="In Progress", labels=("translation",)):
        return story(9, state, labels=labels)

    def side(self, branch="fix/sc-9/test-wording", **kw):
        return dict(pr(40, 9, **kw), branch=branch)

    def test_it_wakes_the_lead_whatever_state_the_ticket_is_in(self):
        for state in ("To Do", "In Progress", "In Review", "Passed Code Review"):
            items = work.review_items([self.ticket(state)], [self.side()])
            self.assertEqual([(i["kind"], i["pr"]) for i in items], [("review", 40)], state)

    def test_the_linguists_own_pr_on_an_in_progress_ticket_wakes_no_lead(self):
        self.assertEqual(work.review_items([self.ticket()], [self.side("l10n/sc-9")]), [])

    def test_once_passed_and_green_it_wakes_its_developer_to_merge(self):
        passed = self.side(lead=[verdict("pass", HEAD[:7])])
        for state in ("To Do", "In Progress", "In Review", "Passed Code Review"):
            items = work.developer_items([self.ticket(state)], [passed])
            self.assertEqual([(i["kind"], i["roles"]) for i in items], [("merge", ["dev"])], state)

    def test_no_developer_is_told_to_move_the_ticket_to_review(self):
        for branch in ("fix/sc-9/test-wording", "l10n/sc-9"):
            self.assertEqual(work.developer_items([self.ticket()], [self.side(branch)]), [])

    def test_a_merged_pr_on_the_ticket_hands_nothing_to_qa(self):
        for branch in ("fix/sc-9/test-wording", "l10n/sc-9"):
            merged = self.side(branch, state="merged", lead=[verdict("pass", HEAD[:7])])
            for state in ("In Progress", "In Review", "Passed Code Review"):
                self.assertEqual(work.developer_items([self.ticket(state)], [merged]), [])

    def test_a_push_after_the_pass_leaves_the_ticket_in_its_state(self):
        pushed = self.side(head="b" * 40, lead=[verdict("pass", HEAD[:7])])
        self.assertEqual(work.voided_passes([self.ticket("Passed Code Review")], [pushed]), [])
        built = self.ticket("Passed Code Review", labels=())
        self.assertEqual(work.voided_passes([built], [pushed]), [(built, pushed)])

    def test_a_story_that_is_not_a_linguists_ticket_reviews_and_merges_as_before(self):
        for labels in ((), ("translation", "ops")):
            built = self.ticket(labels=labels)
            self.assertEqual(work.review_items([built], [self.side()]), [])
            self.assertEqual(kinds(work.developer_items([built], [self.side()])), ["to-review"])
            merged = self.side(state="merged", lead=[verdict("pass", HEAD[:7])])
            self.assertEqual(kinds(work.developer_items([self.ticket("Passed Code Review", labels)],
                                                        [merged])), ["to-qa"])


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

    def test_an_answered_thread_with_no_severity_wakes_the_lead_too(self):
        for first in ("Why this? (from qa)", "Can this wait? (from lead)", "Why this?"):
            t = thread(first, "Because. (from dev)")
            items = work.review_items([story()], [pr(lead=self.passed, threads=[t])])
            self.assertEqual([(i["kind"], i["roles"]) for i in items], [("threads", ["lead"])])

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

    def test_a_pass_and_red_checks_wake_only_the_labelled_developer(self):
        for label in ("dev3", "dev4"):
            passed = work.developer_items([story(labels=[label])],
                                          [pr(lead=[verdict("pass", HEAD[:7])])])
            red = work.developer_items([story(labels=[label])], [pr(checks="red")])
            self.assertEqual([i["roles"] for i in passed + red], [[label], [label]])

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

    def test_a_thread_with_no_severity_the_developer_answered_still_wakes_someone(self):
        t = thread("Why this? (from qa)", "Because. (from dev2)")
        passed = pr(lead=[verdict("pass", HEAD[:7])], threads=[t])
        self.assertEqual(work.developer_items([story(labels=["dev2"])], [passed]), [])
        self.assertEqual(kinds(work.review_items([story(labels=["dev2"])], [passed])),
                         ["threads"])

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
    def test_an_unlabelled_ready_story_is_one_item_every_developer_can_claim(self):
        items = [i for i in work.queue_items([story(state="Ready For Dev")]) if i["pool"] == "dev"]
        self.assertEqual(len(items), 1)
        self.assertEqual(sorted(items[0]["roles"]), ["dev", "dev2", "dev3", "dev4"])

    def test_beyond_ready_for_dev_a_developer_sees_only_its_own_label(self):
        for state in ("Failed Code Review", "Failed QA", "In Progress", "Ready For Dev"):
            for label in ("dev1", "dev2", "dev3", "dev4"):
                items = work.queue_items([story(state=state, labels=[label])])
                self.assertEqual(sorted(r for i in items for r in i["roles"]),
                                 [roles.developer_of([label])], (state, label))

    def test_developer_one_also_keeps_unlabelled_work_beyond_ready_for_dev(self):
        for state in ("Failed Code Review", "Failed QA", "In Progress"):
            items = work.queue_items([story(state=state)])
            self.assertEqual(sorted(r for i in items for r in i["roles"]), ["dev"], state)

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
        self.assertEqual(woken, [])

    def test_each_state_wakes_its_roles(self):
        for state, woken in (("Backlog", ["bm", "pm"]), ("To Do", ["pm"]),
                             ("Needs Design", ["ux"]), ("Failed Code Review", ["dev2"]),
                             ("Failed QA", ["dev2"]), ("In Progress", ["dev2"])):
            items = work.queue_items([story(state=state, labels=["dev2"])])
            self.assertEqual(sorted(r for i in items for r in i["roles"]), woken, state)
        for state in ("Passed Code Review", "Waiting On Owner", "Passsed QA"):
            self.assertEqual(work.queue_items([story(state=state, labels=["dev2"])]), [], state)

    def test_rework_comes_before_new_work(self):
        stories = [story(id_=n, state=s, labels=["dev2"]) for n, s in
                   enumerate(("Ready For Dev", "In Progress", "Failed QA", "Failed Code Review"))]
        items = sorted(work.queue_items(stories), key=lambda i: i["priority"])
        self.assertEqual([i["reason"].split(" moved to ")[1] for i in items],
                         ["Failed Code Review", "Failed QA", "In Progress", "Ready For Dev"])

    def test_a_failed_story_back_for_qa_waits_for_the_tester_who_failed_it(self):
        import calendar, time
        moved = "2026-10-18T10:00:00Z"
        at = calendar.timegm(time.strptime(moved, "%Y-%m-%dT%H:%M:%SZ"))
        back = story(state="Ready For QA", labels=["qa failed"], moved_at=moved,
                     comments=[comment(1, "QA claim: qa2")])
        soon = work.queue_items([back], now=at + 10 * 60)
        self.assertEqual([i["roles"] for i in soon], [["qa2"]])
        later = work.queue_items([back], now=at + (roles.RETEST_MINUTES + 1) * 60)
        self.assertEqual([sorted(i["roles"]) for i in later], [["qa", "qa2", "qa3"]])

    def test_a_story_never_failed_is_for_any_tester(self):
        fresh = story(state="Ready For QA", comments=[comment(1, "QA claim: qa2")])
        self.assertIsNone(work.retester(fresh))

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
        self.assertNotIn(("story", "pm"), found)
        self.assertNotIn(("story", "ux"), found)

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


class FinishingFirst(unittest.TestCase):
    def order(self, stories, prs=()):
        items = work.derive(stories, list(prs))
        return [(i["story_id"], i["kind"]) for i in sorted(items, key=lambda i: i["priority"])
                if "dev" in i["roles"] and i["story_id"]]

    def test_a_failed_or_passed_story_goes_ahead_of_other_comments(self):
        asked = [comment(1, "[dev] (from pm)\nA question.")]
        stories = [story(1, "Backlog", comments=asked),
                   story(2, "Failed QA", labels=["dev1"]),
                   story(3, "Passed Code Review", labels=["dev1"]),
                   story(4, "Failed Code Review", labels=["dev1"])]
        lead = [verdict("pass", HEAD)]
        found = self.order(stories, [pr(9, 3, lead=lead)])
        self.assertEqual(found[-1], (1, "inbox"))
        self.assertEqual({k for k in found[:-1]}, {(2, "story"), (3, "merge"), (4, "story")})

    def test_the_lead_reviews_before_it_answers_comments(self):
        asked = [comment(1, "[lead] (from pm)\nA question.")]
        stories = [story(1, "Backlog", comments=asked), story(2, "In Review", labels=["dev1"])]
        items = [i for i in work.derive(stories, [pr(9, 2)]) if i["roles"] == ["lead"]]
        first = min(items, key=lambda i: i["priority"])
        self.assertEqual((first["kind"], first["priority"]), ("review", work.FINISHING))

    def test_a_merged_story_moves_to_qa_first(self):
        merged = pr(9, 1, lead=[verdict("pass", HEAD)], state="merged")
        items = work.derive([story(1, "In Review", labels=["dev1"])], [merged])
        [to_qa] = [i for i in items if i["kind"] == "to-qa"]
        self.assertEqual(to_qa["priority"], work.FINISHING)


class EpicByEpic(unittest.TestCase):
    EPICS = {"2": {"name": "Two", "position": 2, "state": "in progress"},
             "5": {"name": "Five", "position": 5, "state": "in progress"}}

    def build(self, id_, epic, position, state="Ready For Dev"):
        return dict(story(id_, state), epic_id=epic, position=position)

    def order(self, stories, epics=EPICS):
        items = [i for i in work.queue_items(stories, epics=epics) if "dev" in i["roles"]]
        return [i["story_id"] for i in sorted(items, key=lambda i: (i["priority"], i["rank"]))]

    def test_an_earlier_epic_comes_first_whatever_the_story_order(self):
        stories = [self.build(1, 5, 1), self.build(2, 2, 9), self.build(3, 2, 4)]
        self.assertEqual(self.order(stories), [3, 2, 1])

    def test_the_epic_list_order_wins_over_the_epic_number(self):
        epics = {"2": {"name": "Two", "position": 7, "state": "in progress"},
                 "5": {"name": "Five", "position": 1, "state": "in progress"}}
        self.assertEqual(self.order([self.build(1, 2, 1), self.build(2, 5, 2)], epics), [2, 1])

    def test_a_story_in_no_epic_comes_last(self):
        self.assertEqual(self.order([self.build(1, None, 1), self.build(2, 5, 9)]), [2, 1])

    def test_without_positions_the_epic_number_orders_them(self):
        self.assertEqual(self.order([self.build(1, 5, 1), self.build(2, 2, 9)], {}), [2, 1])


class HeldEpics(unittest.TestCase):
    def epics(self, state):
        return {"2": {"name": "Two", "state": state, "state_name": "Waiting for Owner Approval"}}

    def dev_stories(self, stories, epics):
        return [i["story_id"] for i in work.queue_items(stories, epics=epics)
                if "dev" in i["roles"]]

    def test_an_epic_not_in_progress_holds_its_ready_for_dev_stories(self):
        ready = dict(story(1, "Ready For Dev"), epic_id=2)
        self.assertEqual(self.dev_stories([ready], self.epics("to do")), [])
        self.assertEqual(self.dev_stories([ready], self.epics("in progress")), [1])

    def test_started_work_and_rework_in_a_held_epic_carry_on(self):
        started = dict(story(1, "In Progress", labels=["dev1"]), epic_id=2)
        failed = dict(story(2, "Failed QA", labels=["dev1"]), epic_id=2)
        self.assertEqual(sorted(self.dev_stories([started, failed], self.epics("to do"))),
                         [1, 2])

    def test_a_story_in_no_epic_is_never_held(self):
        self.assertEqual(self.dev_stories([story(1, "Ready For Dev")], self.epics("to do")), [1])

    def test_a_held_epic_wakes_nobody_to_pick(self):
        ready = dict(story(1, "Ready For Dev"), epic_id=2)
        picks = [i for i in work.heartbeat_items([ready], {}, set(), 10_000, self.epics("to do"))
                 if i["roles"] == ["dev"]]
        self.assertEqual(picks, [])


class Unblocked(unittest.TestCase):
    MERGED = "2026-10-20T09:00:00Z"

    def ticket(self, state="To Do", labels=("translation",), covers=(4,), comments=()):
        return dict(story(9, state, labels=labels, comments=comments),
                    links=[{"verb": "relates to", "subject": 9, "object": c} for c in covers])

    def merged(self, number=40, story_id=4, at=MERGED, branch="dev/sc-4/build"):
        return dict(pr(number, story_id, state="merged"), merged_at=at, branch=branch)

    def wakes(self, stories, prs, runs=None, raised=()):
        return [(i["roles"], i["story_id"], i["pr"], i["reason"])
                for i in work.unblocked_items(stories, prs, runs, raised)]

    def test_a_merged_pr_of_a_linked_story_wakes_the_linguist_on_the_ticket(self):
        for state in ("To Do", "In Progress"):
            self.assertEqual(self.wakes([self.ticket(state)], [self.merged()]),
                             [(["l10n"], 9, 40, "PR #40 (sc-4) merged: sc-9 can start")])

    def test_a_story_linking_to_the_ticket_is_not_one_it_covers(self):
        ticket = dict(story(9, "To Do", labels=["translation"]),
                      links=[{"verb": "relates to", "subject": 4, "object": 9}])
        self.assertEqual(work.covered(ticket), [])
        self.assertEqual(self.wakes([ticket], [self.merged()]), [])

    def test_the_linguists_own_translation_pr_wakes_nobody(self):
        self.assertEqual(self.wakes([self.ticket()], [self.merged(branch="l10n/sc-4")]), [])

    def test_a_developers_pr_on_the_ticket_itself_wakes_the_linguist_to_go_on(self):
        merged = self.merged(41, 9, branch="fix/sc-9/test-wording")
        self.assertEqual(self.wakes([self.ticket("In Progress")], [merged]),
                         [(["l10n"], 9, 41, "PR #41 (sc-9) merged: sc-9 can go on")])

    def test_its_own_merged_pr_wakes_the_linguist_on_a_ticket_left_in_review(self):
        merged = self.merged(41, 9, branch="fix/sc-9/test-wording")
        for state in ("In Review", "Passed Code Review", "Ready For QA"):
            self.assertEqual(self.wakes([self.ticket(state)], [merged, self.merged()]),
                             [(["l10n"], 9, 41, "PR #41 (sc-9) merged: sc-9 can go on")], state)

    def test_a_raised_wake_stays_after_its_pr_leaves_the_synced_merges(self):
        row = {"fingerprint": "l10n:unblocked:sc-9:#40", "story_id": 9, "pr": 40,
               "reason": "PR #40 (sc-4) merged: sc-9 can start",
               "first_seen": T.epoch(self.MERGED) + 30}
        self.assertEqual(self.wakes([self.ticket()], [], raised=[row]),
                         [(["l10n"], 9, 40, "PR #40 (sc-4) merged: sc-9 can start")])
        self.assertEqual(self.wakes([self.ticket()], [self.merged()], raised=[row]),
                         [(["l10n"], 9, 40, "PR #40 (sc-4) merged: sc-9 can start")])
        later = {9: row["first_seen"] + 60}
        self.assertEqual(self.wakes([self.ticket()], [], later, raised=[row]), [])
        self.assertEqual(self.wakes([self.ticket("Ready For QA")], [], raised=[row]), [])

    def test_a_raised_wake_to_go_on_stays_on_a_ticket_left_in_review(self):
        start = {"fingerprint": "l10n:unblocked:sc-9:#40", "story_id": 9, "pr": 40,
                 "reason": "PR #40 (sc-4) merged: sc-9 can start",
                 "first_seen": T.epoch(self.MERGED) + 30}
        go_on = dict(start, fingerprint="l10n:unblocked:sc-9:#41", pr=41,
                     reason="PR #41 (sc-9) merged: sc-9 can go on")
        self.assertEqual(self.wakes([self.ticket("In Review")], [], raised=[start, go_on]),
                         [(["l10n"], 9, 41, "PR #41 (sc-9) merged: sc-9 can go on")])

    def test_an_open_pr_wakes_nobody(self):
        self.assertEqual(self.wakes([self.ticket()], [pr(40, 4)]), [])

    def test_each_covered_story_wakes_it_as_its_pr_merges(self):
        ticket = self.ticket(covers=(4, 5))
        self.assertEqual([w[2] for w in self.wakes([ticket], [self.merged(), pr(41, 5)])], [40])
        both = [self.merged(), self.merged(41, 5, "2026-10-20T10:00:00Z")]
        self.assertEqual([w[2] for w in self.wakes([ticket], both)], [40, 41])

    def test_a_merge_before_the_linguists_last_run_on_the_ticket_raises_nothing(self):
        after = T.epoch(self.MERGED) + 60
        self.assertEqual(self.wakes([self.ticket()], [self.merged()], {9: after}), [])
        self.assertEqual(len(self.wakes([self.ticket()], [self.merged()], {9: after - 120})), 1)

    def test_a_comment_the_linguist_signed_after_the_merge_counts_as_a_run(self):
        signed = comment(1, "[pm] (from l10n)\nStarted.", at="2026-10-20T09:30:00Z")
        self.assertEqual(self.wakes([self.ticket(comments=[signed])], [self.merged()]), [])
        earlier = comment(1, "[pm] (from l10n)\nWaiting.", at="2026-10-19T09:00:00Z")
        self.assertEqual(len(self.wakes([self.ticket(comments=[earlier])], [self.merged()])), 1)

    def test_a_ticket_in_another_state_or_without_the_label_raises_nothing(self):
        for ticket in (self.ticket("Ready For QA"), self.ticket("Failed QA"),
                       self.ticket(labels=()), dict(self.ticket(), done=True)):
            self.assertEqual(self.wakes([ticket], [self.merged()]), [])

    def test_derive_raises_it_once_per_ticket_and_pr(self):
        items = work.derive([self.ticket()], [self.merged()], translated={})
        self.assertEqual([i["fingerprint"] for i in items if i["kind"] == "unblocked"],
                         ["l10n:unblocked:sc-9:#40"])


class PmQueue(unittest.TestCase):
    def test_pm_takes_the_backlog_after_every_to_do_story(self):
        stories = [story(1, "Backlog"), story(2, "To Do"), story(3, "Backlog", ["translation"])]
        items = {i["story_id"]: i["priority"] for i in work.queue_items(stories)
                 if i["roles"] == ["pm"]}
        self.assertEqual(set(items), {1, 2})
        self.assertLess(items[2], items[1])

    def test_the_backlog_comes_epic_by_epic(self):
        early, late = story(1, "Backlog"), story(2, "Backlog")
        early["epic_id"], late["epic_id"] = 2, 5
        epics = {"2": {"position": 1, "state": "to do"}, "5": {"position": 2, "state": "to do"}}
        ranks = {i["story_id"]: i["rank"] for i in work.queue_items([late, early], epics=epics)
                 if i["roles"] == ["pm"]}
        self.assertLess(ranks[1], ranks[2])
