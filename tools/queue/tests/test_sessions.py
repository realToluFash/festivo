"""A worker's session as `sq web` shows it: found by its id, read from Claude's transcript."""

import json
import pathlib
import tempfile
import unittest

from soirely_queue import runlog, sessions, store

from tests.test_runner import FakePlatform, config, work

SESSION = "0b6f1e2a-3c4d-4e5f-8a9b-0c1d2e3f4a5b"
NOW = 1_000_000


def user(content, **extra):
    return dict({"type": "user", "timestamp": "2026-10-27T18:57:29.848Z",
                 "message": {"role": "user", "content": content}}, **extra)


def assistant(message_id, *blocks, output=10, context=100):
    return {"type": "assistant", "timestamp": "2026-10-27T18:57:31.000Z",
            "message": {"id": message_id, "role": "assistant", "content": list(blocks),
                        "usage": {"input_tokens": 2, "cache_read_input_tokens": context - 2,
                                  "output_tokens": output}}}


def bash(call_id, command):
    return {"type": "tool_use", "id": call_id, "name": "Bash",
            "input": {"command": command, "description": "look"}}


def result(call_id, content, error=False):
    return user([{"type": "tool_result", "tool_use_id": call_id, "content": content,
                  "is_error": error}])


class Steps(unittest.TestCase):
    def test_the_prompt_what_it_wrote_and_each_call_with_its_output_come_in_order(self):
        found, _ = sessions.steps([
            user("Your checkout was brought up to origin/main"),
            user([{"type": "text", "text": "the skill's own text"}], isMeta=True),
            assistant("m1", {"type": "thinking", "thinking": ""}),
            assistant("m1", {"type": "text", "text": "Setting up the stack."}),
            assistant("m2", bash("t1", "just qa-env up")),
            result("t1", [{"type": "text", "text": "stack up"}]),
            assistant("m3", {"type": "tool_use", "id": "t2", "name": "Read",
                             "input": {"file_path": "/repo/a.md"}}),
            result("t2", "no such file", error=True),
        ])
        self.assertEqual([(s["kind"], s.get("text") or s.get("shown")) for s in found],
                         [("prompt", "Your checkout was brought up to origin/main"),
                          ("text", "Setting up the stack."),
                          ("tool", "just qa-env up"), ("tool", "/repo/a.md")])
        self.assertEqual((found[2]["output"], found[2]["error"]), ("stack up", False))
        self.assertTrue(found[3]["error"])
        self.assertEqual(found[0]["at"], 1793127449.848)

    def test_a_call_still_running_has_no_output_yet(self):
        found, _ = sessions.steps([assistant("m1", bash("t1", "sleep 60"))])
        self.assertIsNone(found[0]["output"])

    def test_a_long_output_is_cut_and_says_by_how_much(self):
        found, _ = sessions.steps([assistant("m1", bash("t1", "cat big")),
                                   result("t1", "x" * (sessions.OUTPUT_CHARS + 250))])
        self.assertEqual(len(found[0]["output"]), sessions.OUTPUT_CHARS)
        self.assertEqual(found[0]["output_cut"], 250)

    def test_a_subagents_lines_are_left_to_it(self):
        found, _ = sessions.steps([assistant("m1", {"type": "text", "text": "inside"}) |
                                   {"isSidechain": True}])
        self.assertEqual(found, [])

    def test_tokens_count_each_message_once_and_the_context_is_the_latest_turns(self):
        _, tokens = sessions.steps([
            assistant("m1", {"type": "text", "text": "a"}, output=10, context=100),
            assistant("m1", bash("t1", "ls"), output=10, context=100),
            assistant("m2", {"type": "text", "text": "b"}, output=5, context=300)])
        self.assertEqual(tokens, {"output": 15, "context": 300})


class View(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        self.home = self.root / "home"
        self.claude = self.root / "claude"
        self.db = store.connect(":memory:")
        store.put_story(self.db, {"id": 5, "name": "Sign in", "state": "In QA",
                                  "url": "https://app.shortcut.com/x/story/5"})
        store.put_pr(self.db, {"number": 40, "story_id": 5, "title": "Sign in", "state": "OPEN",
                               "url": "https://github.com/x/pull/40"})
        store.record(self.db, [dict(work("qa"), story_id=5)], NOW)
        self.platform = FakePlatform()
        self.run = {"at": NOW, "item": 1, "role": "qa", "session": SESSION, "story": 5,
                    "folder": str(self.claude), "cwd": str(self.root / "soirely-qa"),
                    "model": "claude-opus-5-5", "effort": "medium", "main": "c" * 40}

    def tearDown(self):
        self.folder.cleanup()

    def see(self, session_id=SESSION):
        return sessions.view(self.db, self.home, self.platform, session_id,
                             load=lambda: config(self.root, roles={"qa": {}}))

    def transcript(self, *lines):
        path = self.claude / "projects" / "-x-soirely-qa" / f"{SESSION}.jsonl"
        path.parent.mkdir(parents=True)
        path.write_text("".join(json.dumps(line) + "\n" for line in lines) + "not json\n")
        return path

    def test_a_running_workers_session_shows_its_run_story_pull_request_and_steps(self):
        sessions.begin(self.db, "qa", self.run)
        self.platform.active.add("qa")
        path = self.transcript(user("Brief"), assistant("m1", bash("t1", "ls")))
        shown = self.see()
        self.assertTrue(shown["live"])
        self.assertEqual((shown["worker"], shown["max_minutes"], shown["reason"]),
                         ("qa", 90, "[qa] on sc-1"))
        self.assertEqual(shown["story"]["name"], "Sign in")
        self.assertEqual([pr["number"] for pr in shown["prs"]], [40])
        self.assertEqual([s["kind"] for s in shown["steps"]], ["prompt", "tool"])
        self.assertEqual(shown["transcript"], str(path))
        self.assertIsNone(shown["ended"])

    def test_an_ended_run_is_found_in_the_run_log_with_its_cost_and_report(self):
        runlog.append(self.home, "qa", dict(self.run, cost_usd=1.5, exit=0,
                                            duration_ms=61000, report="Passed."))
        self.transcript(user("Brief"))
        shown = self.see()
        self.assertFalse(shown["live"])
        self.assertEqual(shown["ended"]["cost"], 1.5)
        self.assertEqual(shown["ended"]["report"], "Passed.")
        self.assertEqual(shown["ended"]["seconds"], 61)

    def test_a_worker_whose_session_was_replaced_is_not_shown_as_running_it(self):
        sessions.begin(self.db, "qa", self.run)
        runlog.append(self.home, "qa", self.run)
        sessions.begin(self.db, "qa", dict(self.run, session="another"))
        self.platform.active.add("qa")
        self.assertFalse(self.see()["live"])

    def test_a_session_whose_transcript_is_gone_says_so(self):
        sessions.begin(self.db, "qa", self.run)
        shown = self.see()
        self.assertEqual(shown["steps"], [])
        self.assertIn("not on this machine", shown["missing"])

    def test_an_id_no_run_here_recorded_or_that_is_not_a_uuid_finds_nothing(self):
        sessions.begin(self.db, "qa", self.run)
        self.assertIsNone(self.see("1d5c1d1e-0000-4000-8000-000000000000"))
        self.assertIsNone(self.see("../../etc/passwd"))
        self.assertIsNone(self.see(""))

    def test_the_command_to_continue_it_names_its_account_folder_and_checkout(self):
        sessions.begin(self.db, "qa", self.run)
        self.assertEqual(self.see()["resume"],
                         f"cd {self.root / 'soirely-qa'} && CLAUDE_CONFIG_DIR={self.claude} "
                         f"claude --resume {SESSION}")


if __name__ == "__main__":
    unittest.main()
