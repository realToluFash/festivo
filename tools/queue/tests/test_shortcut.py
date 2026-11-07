"""The Shortcut client's retries, against a stubbed urlopen."""

import io
import unittest
import urllib.error
from unittest import mock

from soirely_queue.shortcut import Shortcut, ShortcutError


def refusal(code):
    return urllib.error.HTTPError("u", code, "x", {}, io.BytesIO(b"conflict"))


class Ok:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return b'{"id": 1}'


class Retries(unittest.TestCase):
    def call(self, method, outcomes):
        with mock.patch("urllib.request.urlopen", side_effect=outcomes) as opened, \
                mock.patch("time.sleep"):
            try:
                return Shortcut("t").call(method, "/api/v3/stories/1", {}), opened.call_count
            except ShortcutError as error:
                return error, opened.call_count

    def test_a_put_retries_a_conflict(self):
        said, calls = self.call("PUT", [refusal(409), Ok()])
        self.assertEqual((said, calls), ({"id": 1}, 2))

    def test_a_post_is_never_repeated(self):
        said, calls = self.call("POST", [refusal(409), Ok()])
        self.assertIsInstance(said, ShortcutError)
        self.assertEqual(calls, 1)

    def test_a_refusal_other_than_a_conflict_is_final(self):
        said, calls = self.call("PUT", [refusal(422), Ok()])
        self.assertIn("422", str(said))
        self.assertEqual(calls, 1)
