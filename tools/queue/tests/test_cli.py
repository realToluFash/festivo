import argparse
import io
import pathlib
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

from soirely_queue import cli
from soirely_queue.shortcut import ShortcutError


class FormerLinguists(unittest.TestCase):
    def test_a_locale_routine_is_told_to_stop(self):
        out = io.StringIO()
        with redirect_stdout(out), self.assertRaises(SystemExit) as stopped:
            cli.main(["fr", "tick"])
        self.assertTrue(out.getvalue().startswith("error: the fr linguist is now l10n."))
        self.assertEqual(stopped.exception.code, 2)


class Help(unittest.TestCase):
    def test_help_move_writes_the_rule_for_in_progress(self):
        out = io.StringIO()
        with redirect_stdout(out), self.assertRaises(SystemExit):
            cli.main(["pm", "help", "move"])
        self.assertIn("In Progress to Backlog only while nobody holds the story",
                      out.getvalue())


class States(unittest.TestCase):
    def test_an_id_that_does_not_exist_does_not_stop_the_rest(self):
        def refresh(db, shortcut, story_id):
            if story_id == 2:
                raise ShortcutError("Shortcut 404 on GET /api/v3/stories/2: not found")
            return {"id": story_id, "state": "To Do", "epic": "Foundation",
                    "name": f"story {story_id}", "description": f"body {story_id}"}

        out = io.StringIO()
        with tempfile.TemporaryDirectory() as folder, redirect_stdout(out), \
                mock.patch("soirely_queue.cli.Shortcut"), \
                mock.patch("soirely_queue.sync.refresh_story", side_effect=refresh):
            cli.cmd_states(argparse.Namespace(db=None),
                           argparse.Namespace(stories=["sc-1", "sc-2", "3"], body=folder))
            saved = sorted(p.name for p in pathlib.Path(folder).iterdir())
        lines = out.getvalue().splitlines()
        self.assertEqual(lines[0], "sc-1 [To Do] Foundation · story 1")
        self.assertTrue(lines[1].startswith("sc-2: not read (Shortcut 404"))
        self.assertEqual(lines[2], "sc-3 [To Do] Foundation · story 3")
        self.assertEqual(saved, ["sc-1.md", "sc-3.md"])
