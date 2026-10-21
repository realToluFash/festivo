import io
import unittest
from contextlib import redirect_stdout
from unittest import mock

from soirely_queue import cli


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
