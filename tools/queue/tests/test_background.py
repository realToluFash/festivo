"""A worker as a background session, against fakes: nothing here starts claude."""

import json
import subprocess
import unittest

from soirely_queue import background

VALUES = {"model": "claude-opus-5-5", "effort": "medium", "maxRuntime": "90m",
          "memoryMax": "3G", "maxBudgetUsd": None}
SESSION = "1d923fe2-4377-4e69-8f14-303e43032a24"
PRICES = {"claude-opus-5-5": {"usdPerMillion": {"input": 4, "output": 20}}}


def said(stdout="", stderr=""):
    return subprocess.CompletedProcess([], 0, stdout, stderr)


def assistant(message_id, text, **usage):
    return {"type": "assistant", "message": {"id": message_id, "usage": usage,
                                             "content": [{"type": "text", "text": text}]}}


def tools(*names):
    return {"type": "attachment", "attachment": {"type": "deferred_tools_delta",
                                                 "addedNames": list(names)}}


GIVEN = tools("ArtifactComments", "ArtifactData", "WebFetch")


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class Command(unittest.TestCase):
    def test_the_prompt_follows_the_tool_lists_after_a_double_dash(self):
        argv, env = background.command(VALUES, "~/.claude-x", "dev item 7", "Build sc-1.",
                                       ["Artifact"], ["Bash(just agents:*)"],
                                       {"SQ_RUN_DIR": "/tmp/run"})
        self.assertEqual(argv[:3], ["claude", "--bg", "--name"])
        self.assertEqual(argv[-2:], ["--", "Build sc-1."])
        self.assertLess(argv.index("--disallowedTools"), argv.index("--"))
        self.assertEqual(env["SQ_RUN_DIR"], "/tmp/run")
        self.assertNotIn("--session-id", argv)

    def test_a_worker_s_artifact_calls_go_through_the_read_only_hook(self):
        argv, _ = background.command(VALUES, "~/.claude-x", "dev item 7", "Build sc-1.")
        settings = json.loads(argv[argv.index("--settings") + 1])
        [hook] = settings["hooks"]["PreToolUse"]
        self.assertEqual(hook["matcher"], "Artifact.*")
        self.assertIn("artifact_guard.py", hook["hooks"][0]["command"])
        self.assertLess(argv.index("--settings"), argv.index("--"))

    def test_the_drawing_is_not_kept_to_reading(self):
        argv, _ = background.command(VALUES, "~/.claude-x", "draw sc-1", "Draw.",
                                     read_only=False)
        self.assertNotIn("--settings", argv)


class Start(unittest.TestCase):
    def test_the_short_id_is_read_from_what_claude_prints(self):
        run = lambda *_, **__: said("Starting background service…\n"  # noqa: E731
                                    "backgrounded · 1d923fe2 · dev item 7\n")
        self.assertEqual(background.start(["claude"], "/x", {}, run), "1d923fe2")

    def test_an_untrusted_workspace_says_how_to_trust_it_once(self):
        run = lambda *_, **__: said("Workspace not trusted. Run `claude` in /x once.")  # noqa
        with self.assertRaises(background.NotStarted) as raised:
            background.start(["claude"], "/x", {"CLAUDE_CONFIG_DIR": "/c"}, run)
        self.assertIn("the main checkout", str(raised.exception))


class Summary(unittest.TestCase):
    def test_the_report_is_the_last_thing_said_and_usage_counts_each_message_once(self):
        lines = [{"type": "user", "message": {"content": "Build sc-1."}},
                 assistant("m1", "Reading the board.", input_tokens=10, output_tokens=100,
                           cache_read_input_tokens=1000, cache_creation_input_tokens=200,
                           cache_creation={"ephemeral_1h_input_tokens": 200}),
                 assistant("m1", "", input_tokens=10, output_tokens=100,
                           cache_read_input_tokens=1000, cache_creation_input_tokens=200,
                           cache_creation={"ephemeral_1h_input_tokens": 200}),
                 dict(assistant("s1", "a subagent's words", output_tokens=5), isSidechain=True),
                 assistant("m2", "Built sc-1; PR #9 open.", input_tokens=2, output_tokens=50),
                 {"type": "system", "subtype": "turn_duration", "durationMs": 7344}]
        found = background.summary(lines, "claude-opus-5-5", PRICES)
        self.assertEqual(found["result"], "Built sc-1; PR #9 open.")
        self.assertEqual((found["num_turns"], found["duration_ms"]), (2, 7344))
        self.assertEqual(found["usage"]["output_tokens"], 150)
        self.assertFalse(found["is_error"])
        # 12 in, 150 out, 1000 read at a tenth, 200 written for an hour at twice the input.
        self.assertAlmostEqual(found["total_cost_usd"],
                               (12 * 4 + 150 * 20 + 1000 * 0.4 + 200 * 8) / 1e6)

    def test_a_session_that_said_nothing_is_an_error(self):
        found = background.summary([], "claude-opus-5-5", PRICES)
        self.assertEqual((found["result"], found["is_error"]), (None, True))

    def test_a_model_with_no_price_has_no_cost(self):
        self.assertIsNone(background.cost({"output_tokens": 9}, "claude-unknown", PRICES))


class Watch(unittest.TestCase):
    def watch(self, states, finished=lambda: False, rss=0, values=None, lines=()):
        clock, listed = Clock(), iter(states)
        last = {}

        def ls(_env):
            nonlocal last
            state = next(listed, last.get("state"))
            last = {} if state is None else {"state": state, "pid": 4, "sessionId": SESSION}
            return {"1d923fe2": last} if last else {}

        return background.watch("1d923fe2", {}, "/c", finished, values or VALUES, clock=clock,
                                sleep=clock.sleep, ls=ls, rss=lambda _: rss,
                                lines_of=lambda _: list(lines))[0]

    def test_the_turn_ending_ends_the_run(self):
        self.assertEqual(self.watch(["working", "working", "done"]), "ended")

    def test_an_item_done_while_the_session_lingers_settles_after_the_grace(self):
        self.assertEqual(self.watch(["working"] * 100, finished=lambda: True), "settled")

    def test_the_run_is_stopped_at_its_time_limit(self):
        self.assertEqual(self.watch(["working"] * 2000, values=dict(VALUES, maxRuntime="1m")),
                         "timeout")

    def test_the_run_is_stopped_over_its_memory(self):
        self.assertEqual(self.watch(["working"] * 3, rss=4 * 1024 ** 3), "oom-kill")

    def test_the_run_is_stopped_at_its_budget(self):
        spent = [assistant("m1", "x", output_tokens=1_000_000)]
        self.assertEqual(self.watch(["working"] * 3, values=dict(VALUES, maxBudgetUsd=5),
                                    lines=spent), "budget")

    def test_a_session_the_daemon_forgets_is_gone(self):
        self.assertEqual(self.watch([None]), "gone")

    def test_a_session_not_listed_yet_is_waited_for(self):
        self.assertEqual(self.watch([None, None, "working", "done"]), "ended")

    def test_a_listing_that_fails_is_not_the_session_gone(self):
        clock, answers = Clock(), iter([None, None, {"1d923fe2": {"state": "done"}}])
        why, _ = background.watch("1d923fe2", {}, "/c", lambda: False, VALUES, clock=clock,
                                  sleep=clock.sleep, ls=lambda _: next(answers),
                                  rss=lambda _: 0, lines_of=lambda _: [])
        self.assertEqual(why, "ended")

    def test_the_session_id_is_told_from_the_first_listing_that_has_it(self):
        clock, told = Clock(), []
        answers = iter([{"1d923fe2": {"state": "working"}},
                        {"1d923fe2": {"state": "working", "sessionId": SESSION}},
                        {"1d923fe2": {"state": "done", "sessionId": SESSION}}])
        background.watch("1d923fe2", {}, "/c", lambda: False, VALUES, clock=clock,
                         sleep=clock.sleep, ls=lambda _: next(answers), rss=lambda _: 0,
                         lines_of=lambda _: [], on_session=told.append)
        self.assertEqual(told, [SESSION])

    def test_a_failed_listing_reads_as_none(self):
        self.assertIsNone(background.listed({}, lambda *_, **__: said("not json")))


class Run(unittest.TestCase):
    def test_a_session_stopped_at_a_limit_is_stopped_and_fails(self):
        commands, started = [], []

        def run_command(argv, **_):
            commands.append(argv[:3])
            return said("backgrounded · 1d923fe2 · dev item 7\n")

        clock = Clock()
        listing = {"1d923fe2": {"state": "working", "pid": 4, "sessionId": SESSION}}
        result, code, why, session = background.run(
            dict(VALUES, maxRuntime="1m"), "/c", "dev item 7", "Build.", "/x", lambda: False,
            on_start=lambda short, full: started.append((short, full)),
            daemon=lambda env: commands.append(["daemon"]), run_command=run_command,
            clock=clock, sleep=clock.sleep, ls=lambda _: listing, rss=lambda _: 0,
            lines_of=lambda _: [GIVEN, assistant("m1", "Half built.", output_tokens=10)])
        self.assertEqual(commands[0], ["daemon"])
        self.assertEqual(started, [("1d923fe2", SESSION)])
        self.assertEqual((why, code, session), ("timeout", 1, SESSION))
        self.assertEqual(commands[-1], ["claude", "stop", "1d923fe2"])
        self.assertEqual(result["result"], "Half built.")


class ArtifactTools(unittest.TestCase):
    def test_the_tools_are_known_only_once_the_session_has_replied(self):
        self.assertIsNone(background.has_artifact_tools([GIVEN]))
        self.assertTrue(background.has_artifact_tools([GIVEN, assistant("m1", "x")]))
        self.assertFalse(background.has_artifact_tools(
            [tools("WebFetch"), assistant("m1", "x"), GIVEN]))

    def run_with(self, transcripts):
        commands, started, given = [], [], iter(transcripts)
        shorts = iter(["aaaa1111", "bbbb2222"])
        listing = {}

        def run_command(argv, **_):
            commands.append(argv[:3])
            if argv[:2] == ["claude", "--bg"]:
                short = next(shorts)
                listing.clear()
                listing[short] = {"state": "working", "pid": 4, "sessionId": short + "-full",
                                  "lines": next(given)}
                return said(f"backgrounded · {short} · dev item 7\n")
            if argv[:2] == ["claude", "stop"]:
                listing[argv[2]]["state"] = "stopped"
            return said()

        def lines_of(session):
            return next(s["lines"] for s in listing.values() if s["sessionId"] == session)

        clock = Clock()
        outcome = background.run(
            dict(VALUES, maxRuntime="1m"), "/c", "dev item 7", "Build.", "/x", lambda: False,
            on_start=lambda short, full: started.append(short), run_command=run_command,
            clock=clock, sleep=clock.sleep, ls=lambda _: listing, rss=lambda _: 0,
            lines_of=lines_of)
        return outcome, started, commands

    def test_a_session_without_the_tools_is_stopped_and_started_once_more(self):
        bare = [tools("WebFetch"), assistant("m1", "No Artifact tool here.")]
        (_, _, why, session), started, commands = self.run_with(
            [bare, [GIVEN, assistant("m2", "Built.")]])
        self.assertEqual(started, ["aaaa1111", "bbbb2222"])
        self.assertIn(["claude", "stop", "aaaa1111"], commands)
        self.assertEqual(session, "bbbb2222-full")

    def test_twice_without_the_tools_is_reported_as_not_started(self):
        bare = [tools("WebFetch"), assistant("m1", "No Artifact tool here.")]
        with self.assertRaises(background.NoArtifactTools) as raised:
            self.run_with([bare, bare])
        self.assertIn("without the Artifact tools", str(raised.exception))
        self.assertEqual(raised.exception.short, "bbbb2222")

    def test_a_refused_artifact_read_is_found_in_the_transcript(self):
        def turn(*content):
            return {"type": "assistant", "message": {"content": list(content)}}
        read = {"type": "tool_use", "id": "t1", "name": "Artifact",
                "input": {"action": "read", "url": "https://claude.ai/artifact/x"}}
        refused = {"type": "tool_result", "tool_use_id": "t1", "is_error": True,
                   "content": "You do not have access to this artifact."}
        answered = dict(refused, is_error=False)
        self.assertEqual(background.board_read([turn(read), turn(refused)]),
                         (False, "You do not have access to this artifact."))
        self.assertEqual(background.board_read([turn(read), turn(answered)]), (True, None))
        again = dict(read, id="t2")
        self.assertEqual(
            background.board_read([turn(read), turn(answered), turn(again),
                                   turn(dict(refused, tool_use_id="t2"))]),
            (True, "You do not have access to this artifact."))
        other = dict(read, input={"action": "publish"})
        self.assertEqual(background.board_read([turn(other), turn(refused)]), (False, None))
        self.assertEqual(background.board_read([]), (False, None))

    def test_a_session_quiet_through_the_wait_is_left_to_work(self):
        (_, _, why, session), started, _ = self.run_with([[GIVEN]])
        self.assertEqual((started, why), (["aaaa1111"], "timeout"))
