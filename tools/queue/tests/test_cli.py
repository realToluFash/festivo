import io
import unittest
from contextlib import redirect_stdout
from unittest import mock

from soirely_queue import cli, store


class FormerLinguists(unittest.TestCase):
    def test_a_locale_routine_is_told_to_stop(self):
        out = io.StringIO()
        with redirect_stdout(out), self.assertRaises(SystemExit) as stopped:
            cli.main(["fr", "tick"])
        self.assertTrue(out.getvalue().startswith("error: the fr linguist is now l10n."))
        self.assertEqual(stopped.exception.code, 2)


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
                mock.patch("soirely_queue.cli.render", lambda s, row: print(row["id"])), \
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


def check(name, bucket):
    return {"name": name, "bucket": bucket, "workflow": "Pull request", "link": f"https://x/{name}"}


class Checks(unittest.TestCase):
    def run_checks(self, *answers, wait=True, timeout=20, clock=(0,)):
        answers = list(answers)
        ticks = iter(clock)
        last = [0]

        def monotonic():
            last[0] = next(ticks, last[0])
            return last[0]
        out = io.StringIO()
        code = 0
        with redirect_stdout(out), \
                mock.patch("soirely_queue.github.pr_checks", lambda n: answers.pop(0)), \
                mock.patch("soirely_queue.github.failed_log", lambda link, tail: "boom"), \
                mock.patch("time.monotonic", monotonic), mock.patch("time.sleep") as slept:
            try:
                cli.cmd_checks(mock.Mock(), mock.Mock(pr=7, names=False, tail=40, wait=wait,
                                                      timeout=timeout))
            except SystemExit as stopped:
                code = stopped.code
        return out.getvalue(), code, slept.call_count

    def test_nothing_pending_leaves_pending_out_of_the_summary(self):
        out, code, _ = self.run_checks([check("api", "pass")], wait=False)
        self.assertEqual(out.splitlines(), ["PR #7: 1 checks, 0 failed"])
        self.assertNotIn("pending", out)
        self.assertEqual(code, 0)

    def test_a_wait_ends_green_once_nothing_is_pending(self):
        out, code, slept = self.run_checks([], [check("api", "pending")],
                                           [check("api", "pass"), check("web", "pass")])
        self.assertEqual(out.splitlines(), ["PR #7: 2 checks, 0 failed"])
        self.assertEqual((code, slept), (0, 2))

    def test_a_wait_that_ends_with_a_failure_exits_non_zero(self):
        out, code, _ = self.run_checks([check("api", "pending"), check("web", "pending")],
                                       [check("api", "fail"), check("web", "pass")])
        self.assertTrue(out.startswith("PR #7: 2 checks, 1 failed\n"))
        self.assertIn("  boom", out)
        self.assertEqual(code, 1)

    def test_a_wait_gives_up_at_its_timeout(self):
        pending = [check("api", "pending")]
        out, code, slept = self.run_checks(pending, pending, pending, timeout=1,
                                           clock=(0, 0, 30, 61))
        self.assertEqual(out.splitlines(), [
            "PR #7: timed out after 1 minutes with checks still pending",
            "PR #7: 1 checks, 0 failed, 1 pending",
            "  pending: Pull request / api",
        ])
        self.assertEqual((code, slept), (1, 2))
