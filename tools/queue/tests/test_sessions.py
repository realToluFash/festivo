"""`sq web`'s session view: finding a worker's recorded session and reading its transcript."""

import json
import pathlib
import tempfile
import unittest

from soirely_queue import runlog, sessions, store

from tests.test_runner import FakePlatform, work

NOW = 1_000_000
SESSION = "0b6d7c1e-2f43-4a51-9c3d-8e5f6a7b8c9d"


def line(kind, content, at="2026-10-27T19:22:04.000Z", **more):
    message = dict({"role": kind, "content": content}, **more.pop("message", {}))
    return json.dumps(dict({"type": kind, "timestamp": at, "message": message}, **more))


TRANSCRIPT = [
    line("user", "Run /soirely-ops"),
    json.dumps({"type": "attachment", "attachment": {}}),
    line("user", [{"type": "text", "text": "Base directory for this skill"}], isMeta=True),
    line("assistant", [{"type": "thinking", "thinking": "Read the queue first."}],
         message={"id": "msg_1", "usage": {"input_tokens": 2, "output_tokens": 30,
                                           "cache_read_input_tokens": 100}}),
    line("assistant", [{"type": "tool_use", "id": "t1", "name": "Bash",
                        "input": {"command": "sq ops next", "description": "x"}}],
         message={"id": "msg_1", "usage": {"input_tokens": 2, "output_tokens": 30,
                                           "cache_read_input_tokens": 100}}),
    line("user", [{"type": "tool_result", "tool_use_id": "t1", "content": "x" * 5000}],
         at="2026-10-27T19:22:09.000Z"),
    line("assistant", [{"type": "tool_use", "id": "t2", "name": "Read",
                        "input": {"file_path": "/repo/a.py"}},
                       {"type": "tool_use", "id": "t3", "name": "Grep",
                        "input": {"pattern": "def"}}],
         message={"id": "msg_2", "usage": {"input_tokens": 5, "output_tokens": 10}}),
    line("user", [{"type": "tool_result", "tool_use_id": "t2", "is_error": True,
                   "content": [{"type": "text", "text": "no such file"}]}]),
    line("assistant", [{"type": "text", "text": "Done."}]),
    "not json",
]


class Steps(unittest.TestCase):
    def setUp(self):
        self.steps, self.tokens = sessions.steps(TRANSCRIPT, "Run /soirely-ops")

    def test_each_step_is_shown_in_order_without_the_prompt_sq_gave(self):
        self.assertEqual([s["kind"] for s in self.steps],
                         ["context", "thinking", "tool", "tool", "tool", "text"])
        self.assertEqual(self.steps[1]["text"], "Read the queue first.")
        self.assertEqual(self.steps[-1]["text"], "Done.")

    def test_a_tool_call_shows_its_command_path_or_input_and_its_output(self):
        bash, read, grep = self.steps[2:5]
        self.assertEqual((bash["name"], bash["input"]), ("Bash", "sq ops next"))
        self.assertEqual(read["input"], "/repo/a.py")
        self.assertIn('"pattern": "def"', grep["input"])
        self.assertEqual((read["output"], read["error"]), ("no such file", True))
        self.assertIsNone(grep["output"])
        self.assertEqual(bash["done_at"], "2026-10-27T19:22:09.000Z")

    def test_a_long_output_is_cut_saying_how_much(self):
        bash = self.steps[2]
        self.assertEqual((len(bash["output"]), bash["cut"]), (sessions.CUT, 5000 - sessions.CUT))
        self.assertFalse(bash["error"])

    def test_tokens_count_each_message_once(self):
        self.assertEqual(self.tokens, {"input_tokens": 7, "output_tokens": 40,
                                       "cache_read_input_tokens": 100,
                                       "cache_creation_input_tokens": 0})


class View(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        self.home = self.root / "home"
        self.account = self.root / "claude"
        self.db = store.connect(":memory:")
        store.record(self.db, [dict(work("ops"), story_id=16906)], NOW)
        store.put_story(self.db, {"id": 16906, "name": "Session view", "state": "In Progress",
                                  "url": "https://app.shortcut.com/soirely/story/16906"})
        store.put_pr(self.db, {"number": 770, "story_id": 16906, "head_sha": "e" * 40,
                               "url": "https://github.com/o/r/pull/770", "title": "Sessions"})
        self.platform = FakePlatform()
        self.record = {"session": SESSION, "role": "ops", "item": 1, "story": 16906,
                       "at": NOW - 120, "model": "claude-opus-5-5", "effort": "medium",
                       "checkout": "/w/soirely-ops", "config_dir": str(self.account),
                       "max_runtime_minutes": 90, "prompt": "Run /soirely-ops",
                       "reason": "sc-16906 moved to In Progress", "main": "c" * 40}

    def tearDown(self):
        self.folder.cleanup()

    def write_transcript(self):
        path = self.account / "projects" / "-w-soirely-ops" / f"{SESSION}.jsonl"
        path.parent.mkdir(parents=True)
        path.write_text("\n".join(TRANSCRIPT) + "\n")

    def view(self, session=SESSION):
        return sessions.view(self.db, self.home, self.platform, session, NOW)

    def test_a_running_session_shows_its_story_pull_request_and_steps(self):
        sessions.start(self.home, "ops", self.record)
        self.platform.active.add("ops")
        self.write_transcript()
        page = self.view()
        self.assertTrue(page["live"])
        self.assertEqual(page["elapsed"], 120)
        self.assertEqual(page["story"], {"id": 16906, "name": "Session view",
                                         "state": "In Progress",
                                         "url": "https://app.shortcut.com/soirely/story/16906"})
        self.assertEqual(page["pr"]["number"], 770)
        self.assertEqual(page["resume"], f"cd /w/soirely-ops && CLAUDE_CONFIG_DIR={self.account} "
                                         f"claude --resume {SESSION}")
        self.assertEqual(len(page["steps"]), 6)
        self.assertIsNone(page["report"])

    def test_an_ended_session_is_read_from_the_run_log_with_its_cost_and_report(self):
        runlog.append(self.home, "ops", dict(self.record, cost_usd=1.5, report="Opened #770.",
                                             duration_ms=90000))
        self.write_transcript()
        page = self.view()
        self.assertFalse(page["live"])
        self.assertEqual((page["cost"], page["report"], page["elapsed"]),
                         (1.5, "Opened #770.", 90))

    def test_a_session_whose_transcript_is_gone_says_so(self):
        runlog.append(self.home, "ops", self.record)
        page = self.view()
        self.assertEqual((page["transcript"], page["steps"]), ("missing", []))

    def test_an_unknown_or_malformed_session_is_not_found(self):
        runlog.append(self.home, "ops", self.record)
        self.assertIsNone(self.view("1b6d7c1e-2f43-4a51-9c3d-8e5f6a7b8c9d"))
        self.assertIsNone(self.view("../../etc/passwd"))
        self.assertIsNone(self.view(SESSION.upper()))

    def test_a_drawing_session_with_no_account_folder_is_not_found(self):
        runlog.append(self.home, "ux", {"at": NOW, "role": "ux", "worker": "ux-draw",
                                        "session": SESSION})
        self.assertIsNone(self.view())
