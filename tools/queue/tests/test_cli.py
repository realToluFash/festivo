import io
import json
import os
import pathlib
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

from soirely_queue import cli, ledger, permissions, shared, store

from .fakes import FakeRefs


class FormerLinguists(unittest.TestCase):
    def test_a_locale_routine_is_told_to_stop(self):
        out = io.StringIO()
        with redirect_stdout(out), self.assertRaises(SystemExit) as stopped:
            cli.main(["fr", "tick"])
        self.assertTrue(out.getvalue().startswith("error: the fr linguist is now l10n."))
        self.assertEqual(stopped.exception.code, 2)


class RoleCommandsReadTheEnvFile(unittest.TestCase):
    def test_a_role_command_loads_sq_s_env_file(self):
        with tempfile.TemporaryDirectory() as folder, \
                mock.patch.dict("os.environ", {"SOIRELY_CONFIG": folder}, clear=False):
            pathlib.Path(folder, "env").write_text("SQ_TEST_ONLY_TOKEN=from-the-file\n")
            with redirect_stdout(io.StringIO()):
                cli.main(["dev", "help"])
            self.assertEqual(os.environ.pop("SQ_TEST_ONLY_TOKEN"), "from-the-file")


class States(unittest.TestCase):
    def test_one_line_per_id_and_a_missing_one_does_not_stop_the_rest(self):
        def refresh(db, shortcut, story_id):
            if story_id == 2:
                raise RuntimeError("Shortcut 404 on GET /api/v3/stories/2: gone")
            return {"id": story_id, "state": "To Do", "epic": "Billing", "name": f"s{story_id}",
                    "description": "d"}
        out = io.StringIO()
        with redirect_stdout(out), mock.patch("soirely_queue.sync.refresh_story", refresh), \
                mock.patch("soirely_queue.cli.Shortcut"), \
                mock.patch("soirely_queue.cli.Session"):
            cli.cmd_states(mock.Mock(), mock.Mock(stories=["sc-1", "sc-2", "x", "3"], body=None))
        self.assertEqual(out.getvalue().splitlines(), [
            "sc-1 [To Do] Billing · s1",
            "sc-2: not found (Shortcut 404 on GET /api/v3/stories/2: gone)",
            "x: x is not a story: write sc-<n>",
            "sc-3 [To Do] Billing · s3",
        ])


class HelpTopic(unittest.TestCase):
    def test_help_names_one_command(self):
        out = io.StringIO()
        with redirect_stdout(out):
            cli.main(["pm", "help", "move"])
        self.assertIn("any story from any state", out.getvalue())


class InsideAWorker(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")
        store.record(self.db, [{"fingerprint": f"inbox:{n}", "pool": "pm", "roles": ["pm"],
                                "kind": "inbox", "reason": f"[pm] on sc-{n}", "priority": 1}
                               for n in (1, 2)], 1000)
        self.session = mock.Mock(db=self.db, role="pm")

    def run_command(self, command):
        out = io.StringIO()
        with redirect_stdout(out), mock.patch.dict("os.environ", {"SOIRELY_WORKER": "pm"}), \
                mock.patch("soirely_queue.cli.synced"), \
                mock.patch("soirely_queue.cli.render",
                           lambda s, rows: print(*(row["id"] for row in rows))), \
                mock.patch("time.time", return_value=1000):
            command(self.session, mock.Mock())
        return out.getvalue().strip()

    def test_next_and_tick_never_claim_once_the_workers_item_is_finished(self):
        store.claim(self.db, "pm", 1000, worker="pm")
        store.finish(self.db, 1, now=1000)
        for command in (cli.cmd_next, cli.cmd_tick):
            self.assertEqual(self.run_command(command), "pm's item is finished: end this run")
        self.assertFalse(store.held_by(self.db, "pm", 1000))

    def test_next_prints_the_workers_own_item(self):
        store.claim(self.db, "pm", 1000, worker="pm")
        self.assertEqual(self.run_command(cli.cmd_next), "1")
        self.assertEqual(self.run_command(cli.cmd_tick), "busy")


    def test_next_prints_each_item_of_a_batch_once_and_release_gives_them_all_back(self):
        store.claim(self.db, "pm", 1000, worker="pm", batch=3)
        session = cli.Session.__new__(cli.Session)
        session.role, session.db, session.cache = "pm", self.db, None
        session.printer = ledger.Printer(self.db, "pm", now=1000)
        out = io.StringIO()
        with redirect_stdout(out), mock.patch.dict("os.environ", {"SOIRELY_WORKER": "pm"}), \
                mock.patch("soirely_queue.cli.synced"), \
                mock.patch("soirely_queue.payloads.render",
                           lambda p, db, row, cache: p.add(f"item {row['id']}")), \
                mock.patch("time.time", return_value=1000):
            cli.cmd_next(session, mock.Mock())
        self.assertEqual(out.getvalue().splitlines(), ["item 1", "item 2"])
        self.run_command(cli.cmd_release)
        self.assertEqual(store.held(self.db, "pm", 1000, "pm"), [])

    def solo(self, work_id):
        out = io.StringIO()
        with redirect_stdout(out), mock.patch.dict("os.environ", {"SOIRELY_WORKER": "pm"}), \
                mock.patch("time.time", return_value=1000):
            cli.cmd_solo(self.session, mock.Mock(id=str(work_id)))
        return out.getvalue().strip()

    def test_solo_hands_one_comment_of_a_batch_back_to_run_by_itself(self):
        store.claim(self.db, "pm", 1000, worker="pm", batch=2)
        self.assertEqual(self.solo(2), "item 2 goes back to the queue, to run by itself")
        self.assertEqual([row["id"] for row in store.held(self.db, "pm", 1000, "pm")], [1])
        self.assertEqual(store.item(self.db, 2)["solo"], 1)

    def test_solo_refuses_in_a_run_holding_only_that_item_or_one_it_does_not_hold(self):
        store.claim(self.db, "pm", 1000, worker="pm")
        with self.assertRaises(SystemExit) as refused:
            self.solo(1)
        self.assertEqual(refused.exception.code, "this run holds only 1: do it now")
        with self.assertRaises(SystemExit) as refused:
            self.solo(2)
        self.assertEqual(refused.exception.code, "item 2 is not one this run holds")
        self.assertEqual(store.item(self.db, 1)["status"], "claimed")


class BatchBrief(unittest.TestCase):
    def test_a_batch_lists_each_item_with_its_comments_and_how_to_hand_one_back(self):
        rows = [{"id": 4, "pool": "qa", "kind": "inbox", "reason": "[qa] on sc-1",
                 "comments": "17122,17136"},
                {"id": 7, "pool": "qa", "kind": "inbox", "reason": "[qa] on sc-2",
                 "comments": None}]
        text = cli.brief(rows, "qa")
        self.assertIn("Your work is 2 comment items, in queue order:\n"
                      "- item 4: [qa] on sc-1 (comments #17122, #17136)\n"
                      "- item 7: [qa] on sc-2\n", text)
        self.assertIn("`sq qa solo <item>`", text)
        self.assertIn("`sq qa done <item> --note", text)

def check(name, bucket):
    return {"name": name, "bucket": bucket, "workflow": "Pull request", "link": f"https://x/{name}"}


class Checks(unittest.TestCase):
    def run_checks(self, *answers, wait=True, timeout=20, clock=(0,), heads=("abc1234f",),
                   head=None, mergeable="CONFLICTING"):
        answers = list(answers)
        heads = list(heads)
        ticks = iter(clock)
        last = [0]

        def monotonic():
            last[0] = next(ticks, last[0])
            return last[0]

        def live(number):
            sha = heads.pop(0) if len(heads) > 1 else heads[0]
            return {"headRefOid": sha, "mergeable": mergeable}
        out = io.StringIO()
        code = 0
        with redirect_stdout(out), \
                mock.patch("soirely_queue.github.pr_checks", lambda n: answers.pop(0)), \
                mock.patch("soirely_queue.github.live", live), \
                mock.patch("soirely_queue.github.failed_log", lambda link, tail: "boom"), \
                mock.patch("time.monotonic", monotonic), mock.patch("time.sleep") as slept:
            try:
                cli.cmd_checks(mock.Mock(), mock.Mock(pr=7, names=False, tail=40, wait=wait,
                                                      timeout=timeout, head=head))
            except SystemExit as stopped:
                code = stopped.code
        return out.getvalue(), code, slept.call_count

    def test_nothing_pending_leaves_pending_out_of_the_summary(self):
        out, code, _ = self.run_checks([check("api", "pass")], wait=False)
        self.assertEqual(out.splitlines(), ["PR #7 at abc1234: 1 checks, 0 failed"])
        self.assertNotIn("pending", out)
        self.assertEqual(code, 0)

    def test_a_wait_ends_green_once_nothing_is_pending(self):
        out, code, slept = self.run_checks([], [check("api", "pending")],
                                           [check("api", "pass"), check("web", "skipping")])
        self.assertEqual(out.splitlines(), ["PR #7 at abc1234: 2 checks, 0 failed"])
        self.assertEqual((code, slept), (0, 2))

    def test_a_wait_that_ends_with_a_failure_exits_non_zero(self):
        out, code, _ = self.run_checks([check("api", "pending"), check("web", "pending")],
                                       [check("api", "fail"), check("web", "pass")])
        self.assertTrue(out.startswith("PR #7 at abc1234: 2 checks, 1 failed\n"))
        self.assertIn("  boom", out)
        self.assertEqual(code, 1)

    def test_a_cancelled_check_is_listed_and_is_not_green(self):
        out, code, _ = self.run_checks([check("api", "cancel"), check("web", "pass")])
        self.assertEqual(out.splitlines(), [
            "PR #7 at abc1234: 2 checks, 0 failed, 1 cancelled",
            "  cancelled: Pull request / api https://x/api",
        ])
        self.assertEqual(code, 1)

    def test_a_head_with_no_checks_stops_early_and_says_why(self):
        out, code, slept = self.run_checks(*[[]] * 10)
        self.assertEqual(out.splitlines(), [
            "PR #7: no checks on head abc1234, which conflicts with main; a conflicting head "
            "runs none, so merge origin/main and push",
        ])
        self.assertEqual((code, slept), (1, cli.NO_CHECKS_POLLS))

    def test_a_head_slow_to_get_checks_is_not_told_to_merge_main(self):
        out, code, _ = self.run_checks(*[[]] * 10, mergeable="MERGEABLE")
        self.assertEqual(out.splitlines(), ["PR #7: no checks appeared on head abc1234 after 2 minutes"])
        self.assertEqual(code, 1)

    def test_a_look_before_checks_are_queued_says_none_yet(self):
        out, code, _ = self.run_checks([], wait=False, mergeable="UNKNOWN")
        self.assertEqual(out.splitlines(), ["PR #7: no checks on head abc1234 yet"])
        self.assertEqual(code, 0)

    def test_a_wait_for_a_head_ignores_the_previous_heads_checks(self):
        out, code, slept = self.run_checks([check("api", "pending")], [check("api", "pass")],
                                           heads=("old0000", "old0000", "new1111"),
                                           head="new1111")
        self.assertEqual(out.splitlines(), ["PR #7 at new1111: 1 checks, 0 failed"])
        self.assertEqual((code, slept), (0, 3))

    def test_a_wait_gives_up_at_its_timeout(self):
        pending = [check("api", "pending")]
        out, code, slept = self.run_checks(pending, pending, pending, timeout=1,
                                           clock=(0, 0, 30, 61))
        self.assertEqual(out.splitlines(), [
            "PR #7: timed out after 1 minutes with checks still pending",
            "PR #7 at abc1234: 1 checks, 0 failed, 1 pending",
            "  pending: Pull request / api",
        ])
        self.assertEqual((code, slept), (1, 2))


class PauseEverywhere(unittest.TestCase):
    def setUp(self):
        self.db = store.connect(":memory:")
        self.remote = FakeRefs()
        for patch in (mock.patch("soirely_queue.cli.open_db", return_value=self.db),
                      mock.patch("soirely_queue.cli.this_platform"),
                      mock.patch("soirely_queue.machine.load_env"),
                      mock.patch("soirely_queue.machine.load",
                                 return_value={"machine": "tolu-mac"}),
                      mock.patch("soirely_queue.shared.GitHubRefs", return_value=self.remote),
                      mock.patch.dict("os.environ", {"SOIRELY_WORKER": ""})):
            patch.start()
            self.addCleanup(patch.stop)

    def sq(self, *argv):
        out = io.StringIO()
        with redirect_stdout(out):
            cli.main(list(argv))
        return out.getvalue().strip()

    def test_pause_and_resume_everywhere_say_what_they_did(self):
        self.assertEqual(self.sq("pause", "--everywhere"),
                         "paused every machine: no role ticks anywhere, running workers finish "
                         "their item")
        self.assertEqual(self.remote.data(shared.PAUSE)["machine"], "tolu-mac")
        self.assertEqual(self.sq("pause", "--everywhere"), "every machine was already paused")
        self.assertEqual(self.sq("resume", "--everywhere"),
                         "resumed every machine; a machine paused on its own stays paused")
        self.assertNotIn(shared.PAUSE, self.remote.refs)

    def test_a_local_resume_leaves_the_pause_everywhere(self):
        store.set_meta(self.db, "shared_view", {"paused": {"machine": "tolu-linux"}})
        self.assertEqual(self.sq("resume"), "resumed; every machine is still paused by "
                                            "tolu-linux: sq resume --everywhere")


class PermissionsPending(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.home = pathlib.Path(folder.name) / "roles"
        (self.home / "sq").mkdir(parents=True)
        for patch in (mock.patch("soirely_queue.cli.open_db",
                                 return_value=store.connect(":memory:")),
                      mock.patch("soirely_queue.cli.this_platform"),
                      mock.patch("soirely_queue.cli.home", return_value=self.home),
                      mock.patch("soirely_queue.machine.load_env"),
                      mock.patch.dict("os.environ", {"SOIRELY_WORKER": "",
                                                     "SOIRELY_CONFIG": folder.name})):
            patch.start()
            self.addCleanup(patch.stop)

    def sq(self):
        out = io.StringIO()
        with redirect_stdout(out):
            cli.main(["agents", "permissions"])
        return out.getvalue().strip().splitlines()

    def test_permissions_alone_lists_what_main_grants_and_this_machine_has_not_applied(self):
        self.assertEqual(self.sq(), ["this machine has applied everything main grants"])
        (self.home / "sq" / "permissions.json").write_text(json.dumps({"rules": [
            {"rule": "Bash(maestro test:*)", "roles": ["qa", "qa2"], "ask": 5124}]}))
        self.assertEqual(self.sq(), ["main grants what this machine has not applied; run "
                                     "just agents permissions apply:",
                                     "+ Bash(maestro test:*) for qa, qa2"])
        permissions.applied_path().write_text(json.dumps({"rules": [
            {"rule": "Bash(xcrun simctl boot:*)", "roles": ["all"], "ask": 5123}]}))
        self.assertEqual(self.sq()[1:], ["+ Bash(maestro test:*) for qa, qa2",
                                         "- Bash(xcrun simctl boot:*) for all"])


class Brief(unittest.TestCase):
    def test_machine_work_opens_by_keeping_ops_to_this_machine(self):
        row = {"id": 4, "pool": "ops@tolu-mac", "kind": "machine", "reason": "the daily sweep"}
        self.assertTrue(cli.brief([row], "ops").startswith(
            "This is ops@tolu-mac: work only on this machine (disk, Docker, the role stacks, "
            "the manager). Shared duties belong to whichever machine holds the ops lease."))
        self.assertFalse(cli.brief([dict(row, kind="main", pool="ops")], "ops").startswith("This is"))
