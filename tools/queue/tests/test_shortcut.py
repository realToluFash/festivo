"""The Shortcut client's retries, against a stubbed urlopen."""

import io
import unittest
import urllib.error
from unittest import mock

from soirely_queue.shortcut import OutOfTime, Shortcut, ShortcutError


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


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


class Deadline(unittest.TestCase):
    """A sync's Shortcut stops at its deadline rather than retrying past it."""

    def test_each_wait_is_cut_to_the_time_left(self):
        clock = Clock()
        clock.now = 15.0
        with mock.patch("urllib.request.urlopen", return_value=Ok()) as opened:
            Shortcut("t", deadline=25.0, clock=clock).call("GET", "/api/v3/stories/1")
        self.assertEqual(opened.call_args.kwargs["timeout"], 10.0)

    def test_a_read_timed_out_at_the_deadline_is_out_of_time_not_retried(self):
        clock = Clock()

        def times_out(*_, timeout):
            clock.now += timeout
            raise TimeoutError("The read operation timed out")

        with mock.patch("urllib.request.urlopen", side_effect=times_out) as opened, \
                mock.patch("time.sleep"):
            with self.assertRaises(OutOfTime):
                Shortcut("t", deadline=25.0, clock=clock).call("GET", "/api/v3/stories/1")
        self.assertEqual(opened.call_count, 1)

    def test_a_call_after_the_deadline_never_starts(self):
        clock = Clock()
        clock.now = 30.0
        with mock.patch("urllib.request.urlopen") as opened:
            with self.assertRaises(OutOfTime):
                Shortcut("t", deadline=25.0, clock=clock).call("GET", "/api/v3/stories/1")
        opened.assert_not_called()

    def test_without_a_deadline_a_read_timeout_is_retried(self):
        with mock.patch("urllib.request.urlopen",
                        side_effect=[TimeoutError("timed out"), Ok()]) as opened, \
                mock.patch("time.sleep"):
            said = Shortcut("t").call("GET", "/api/v3/stories/1")
        self.assertEqual((said, opened.call_count), ({"id": 1}, 2))
