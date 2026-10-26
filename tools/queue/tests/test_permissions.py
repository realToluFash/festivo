"""Granted rules reach a worker only through the owner, at a keyboard."""

import json
import pathlib
import tempfile
import unittest
from unittest import mock

from soirely_queue import permissions

RULES = {"rules": [{"rule": "Bash(xcrun simctl boot:*)", "roles": ["qa", "qa2"], "ask": 5123},
                   {"rule": "Bash(maestro test:*)", "roles": ["all"], "ask": 5124}]}


class Permissions(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        self.home = self.root / "roles"
        (self.home / "sq").mkdir(parents=True)
        patch = mock.patch.dict("os.environ", {"SOIRELY_CONFIG": str(self.root / "config")})
        patch.start()
        self.addCleanup(patch.stop)
        self.addCleanup(self.folder.cleanup)
        self.said = []

    def apply(self, answer="yes", interactive=True, text=json.dumps(RULES)):
        return permissions.apply(self.home, self.said.append, lambda _: answer, interactive,
                                 show=lambda: ("a" * 40, text))

    def test_a_yes_at_the_keyboard_applies_what_main_grants(self):
        self.assertEqual(self.apply(), 0)
        self.assertEqual(permissions.for_role(permissions.applied(), "qa2"),
                         ["Bash(xcrun simctl boot:*)", "Bash(maestro test:*)"])
        self.assertEqual(permissions.for_role(permissions.applied(), "dev"),
                         ["Bash(maestro test:*)"])
        self.assertEqual(permissions.applied_path().stat().st_mode & 0o777, 0o600)

    def test_anything_but_yes_applies_nothing(self):
        self.assertEqual(self.apply("y"), 1)
        self.assertEqual(permissions.applied(), [])

    def test_a_worker_or_a_script_cannot_apply(self):
        with mock.patch.dict("os.environ", {"SOIRELY_WORKER": "dev2"}):
            self.assertEqual(self.apply(), 1)
        self.assertEqual(self.apply(interactive=False), 1)
        self.assertEqual(permissions.applied(), [])
        self.assertIn("own terminal", self.said[-1])

    def test_a_rule_that_is_not_one_is_refused(self):
        bad = json.dumps({"rules": [{"rule": "rm -rf /", "roles": ["all"], "ask": 1}]})
        self.assertEqual(self.apply(text=bad), 1)
        unknown = json.dumps({"rules": [{"rule": "Bash(x:*)", "roles": ["qa9"], "ask": 1}]})
        self.assertEqual(self.apply(text=unknown), 1)
        unasked = json.dumps({"rules": [{"rule": "Bash(x:*)", "roles": ["qa"]}]})
        self.assertEqual(self.apply(text=unasked), 1)

    def test_a_rule_granting_a_whole_tool_is_refused(self):
        for rule in ("Bash", "Bash(*)", "Bash(:*)", "Edit(**)", "Write(~/**)", "*",
                     "WebFetch(domain:*)", "WebFetch(domain:)", "WebFetch(domain:*.com)"):
            broad = json.dumps({"rules": [{"rule": rule, "roles": ["all"], "ask": 1}]})
            self.assertEqual(self.apply(text=broad), 1, rule)
        self.assertEqual(permissions.applied(), [])
        self.assertIn("name the host, such as WebFetch(domain:docs.example.com)", self.said[-2])
        narrow = [{"rule": "WebFetch(domain:docs.example.com)", "roles": ["all"], "ask": 1},
                  {"rule": "WebFetch(domain:*.example.com)", "roles": ["all"], "ask": 1}]
        self.assertEqual(permissions.parse(json.dumps({"rules": narrow}), "x"), narrow)

    def test_a_file_deleted_from_main_revokes_what_it_granted(self):
        self.apply()
        self.assertEqual(self.apply(text=""), 0)
        self.assertEqual(permissions.applied(), [])
        self.assertTrue(any(line.startswith("  - Bash(maestro test:*)") for line in self.said))

    def test_apply_lists_each_change_and_asks_only_when_there_is_one(self):
        asked = []
        permissions.apply(self.home, self.said.append, lambda q: asked.append(q) or "YES", True,
                          show=lambda: ("a" * 40, json.dumps(RULES)))
        self.assertIn(f"main at {'a' * 7} changes what this machine's workers may run:",
                      self.said)
        self.assertIn("  + Bash(xcrun simctl boot:*)  for qa, qa2", self.said)
        self.assertEqual(permissions.applied_path().stat().st_mode & 0o777, 0o600)
        self.assertEqual(permissions.apply(self.home, self.said.append, asked.append, True,
                                           show=lambda: ("a" * 40, json.dumps(RULES))), 0)
        self.assertEqual(len(asked), 1)
        self.assertIn(f"this machine already has every rule main grants at {'a' * 7}",
                      self.said[-1])

    def test_status_names_what_main_has_that_this_machine_has_not_applied(self):
        (self.home / "sq" / "permissions.json").write_text(json.dumps(RULES))
        self.assertEqual(len(permissions.pending(self.home)), 2)
        self.apply()
        self.assertEqual(permissions.pending(self.home), [])

    def test_no_worker_may_run_the_admin_commands_or_edit_its_config(self):
        denied = permissions.denied(self.home / "sq" / "sq", pathlib.Path("~/.claude-b"))
        self.assertIn(f"Bash(python3 {self.home / 'sq' / 'sq'} stop:*)", denied)
        self.assertIn("Bash(just agents:*)", denied)
        self.assertIn("Edit(~/.claude-b/**)", denied)
        self.assertTrue(any(rule.startswith("Write(") and "config" in rule for rule in denied))
