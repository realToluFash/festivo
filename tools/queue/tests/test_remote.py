"""Other machines' `sq web`: who may read this one, and how a peer that cannot be read says so."""

import json
import unittest
import urllib.error
from unittest import mock

from soirely_queue import remote

SECRET = "s" * remote.TOKEN_MIN


class Allowed(unittest.TestCase):
    def test_this_machine_needs_no_token(self):
        self.assertEqual(remote.allowed("127.0.0.1", {}, "", None), (True, None))
        self.assertEqual(remote.allowed("::1", {}, "", None), (True, None))

    def test_another_machine_needs_the_token_as_a_header_or_cookie(self):
        self.assertEqual(remote.allowed("192.168.1.9", {}, "", SECRET), (False, None))
        self.assertEqual(remote.allowed("192.168.1.9", {"Authorization": f"Bearer {SECRET}"},
                                        "", SECRET), (True, None))
        self.assertEqual(remote.allowed("192.168.1.9", {"Cookie": f"sq_token={SECRET}"},
                                        "", SECRET), (True, None))
        self.assertEqual(remote.allowed("192.168.1.9", {"Authorization": "Bearer wrong"},
                                        "", SECRET), (False, None))

    def test_the_token_in_the_address_is_turned_into_a_cookie(self):
        self.assertEqual(remote.allowed("192.168.1.9", {}, f"token={SECRET}", SECRET),
                         (True, SECRET))
        self.assertEqual(remote.allowed("192.168.1.9", {}, "token=wrong", SECRET), (False, None))

    def test_a_base64_token_in_the_address_is_read_as_typed_or_as_encoded(self):
        secret = "ab+cd/" + "x" * 40
        self.assertEqual(remote.allowed("192.168.1.9", {}, f"token={secret}", secret),
                         (True, secret))
        self.assertEqual(remote.allowed("192.168.1.9", {}, "token=ab%2Bcd%2F" + "x" * 40,
                                        secret), (True, secret))

    def test_a_short_token_lets_nobody_else_in(self):
        self.assertEqual(remote.allowed("192.168.1.9", {"Authorization": "Bearer short"},
                                        "", "short"), (False, None))


class Problems(unittest.TestCase):
    def test_listening_on_the_network_without_a_token_is_named(self):
        found = remote.problems({"web": {"listen": "0.0.0.0"}}, secret="")
        self.assertIn("web listens on 0.0.0.0", found[0])
        self.assertEqual(remote.problems({"web": {"listen": "0.0.0.0"}}, secret=SECRET), [])
        self.assertEqual(remote.problems({"web": {}}, secret=""), [])

    def test_a_peer_needs_an_http_address_and_the_token(self):
        found = remote.problems({"peers": {"tolu-linux": "tolu-linux:8765"}}, secret="")
        self.assertEqual(len(found), 2)
        self.assertEqual(remote.problems({"peers": {"tolu-linux": "http://10.0.0.5:8765"}},
                                         secret=SECRET), [])

    def test_web_and_peers_read_their_defaults(self):
        self.assertIsNone(remote.web({}))
        self.assertEqual(remote.web({"web": {}}), ("127.0.0.1", 8765))
        self.assertEqual(remote.peers({"peers": ["x"]}), {})


class Fetch(unittest.TestCase):
    def test_the_peer_is_asked_with_the_token(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value.__enter__.return_value.status = 200
            urlopen.return_value.__enter__.return_value.read.return_value = b"{}"
            self.assertEqual(remote.fetch("http://10.0.0.5:8765", "status.json", SECRET),
                             (200, b"{}"))
        request = urlopen.call_args.args[0]
        self.assertEqual(urlopen.call_args.kwargs["timeout"], remote.PEER_SECONDS)
        self.assertEqual(request.full_url, "http://10.0.0.5:8765/status.json")
        self.assertEqual(request.get_header("Authorization"), f"Bearer {SECRET}")

    def test_a_peer_that_refuses_or_does_not_answer_is_a_502_saying_why(self):
        refused = urllib.error.HTTPError("u", 401, "no", {}, None)
        with mock.patch("urllib.request.urlopen", side_effect=refused):
            status, body = remote.fetch("http://x", "status.json", SECRET)
        self.assertEqual((status, json.loads(body)["error"]),
                         (502, "it refused this machine's token"))
        with mock.patch("urllib.request.urlopen",
                        side_effect=urllib.error.URLError("timed out")):
            status, body = remote.fetch("http://x", "status.json", SECRET)
        self.assertEqual((status, json.loads(body)["error"]), (502, "it did not answer (timed out)"))


if __name__ == "__main__":
    unittest.main()
