import io
import unittest
from contextlib import redirect_stdout

from soirely_queue import cli


class FormerLinguists(unittest.TestCase):
    def test_a_locale_routine_is_told_to_stop(self):
        out = io.StringIO()
        with redirect_stdout(out), self.assertRaises(SystemExit) as stopped:
            cli.main(["fr", "tick"])
        self.assertTrue(out.getvalue().startswith("error: the fr linguist is now l10n."))
        self.assertEqual(stopped.exception.code, 2)
