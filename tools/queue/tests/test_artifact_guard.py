"""The hook that keeps a worker's Artifact calls to reading (sc-25203)."""

import io
import json
import subprocess
import sys
import unittest

from soirely_queue import artifact_guard, background


def call(tool, **tool_input):
    return {"tool_name": tool, "tool_input": tool_input}


class Refusal(unittest.TestCase):
    def test_a_read_and_a_list_pass(self):
        self.assertIsNone(artifact_guard.refusal(call("Artifact", action="read")))
        self.assertIsNone(artifact_guard.refusal(call("Artifact", action="list")))

    def test_a_publish_is_refused(self):
        self.assertIn("'publish' is refused", artifact_guard.refusal(call("Artifact",
                                                                          action="publish")))

    def test_a_call_with_no_action_is_refused(self):
        self.assertIsNotNone(artifact_guard.refusal(call("Artifact")))

    def test_the_artifact_family_is_held_to_reading_too(self):
        self.assertIsNotNone(artifact_guard.refusal(call("ArtifactComments", action="create")))

    def test_other_tools_are_not_its_business(self):
        self.assertIsNone(artifact_guard.refusal(call("Bash", command="ls")))


class Hook(unittest.TestCase):
    def run_hook(self, payload):
        return subprocess.run([sys.executable, str(background.GUARD)], input=payload,
                              capture_output=True, text=True)

    def test_a_publish_exits_2_with_the_reason_on_stderr(self):
        done = self.run_hook(json.dumps(call("Artifact", action="publish")))
        self.assertEqual(done.returncode, 2)
        self.assertIn("only reads the design", done.stderr)

    def test_a_read_exits_0(self):
        self.assertEqual(self.run_hook(json.dumps(call("Artifact", action="read"))).returncode, 0)

    def test_input_it_cannot_read_is_refused(self):
        self.assertEqual(artifact_guard.main(io.StringIO("{"), io.StringIO()), 2)
