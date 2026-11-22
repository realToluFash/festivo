"""The Claude logins `sq web` shows, and a login started from it."""

import http.client
import http.server
import io
import json
import pathlib
import socket
import subprocess
import tempfile
import threading
import unittest
from unittest import mock

from soirely_queue import logins, machine

NOW = 1_800_000_000
DIRECT = ("https://claude.com/cai/oauth/authorize?code=true&client_id=c&response_type=code"
          "&redirect_uri=http%3A%2F%2Flocalhost%3A{port}%2Fcallback&state=s")
SHORT = "https://claude.ai/oauth/authorize?z-abc"
PRINTED = ("Opening browser to sign in…\nIf the browser didn't open, visit:\n"
           f"\x1b]8;;{SHORT}\x07{SHORT}\x1b]8;;\x07\nPaste code here if prompted > ")


def said(**fields):
    answer = {"loggedIn": True, "email": "qa@example.com",
              "loginExpiresAt": "2027-01-15T08:00:00.000Z", "planTier": "max_5x"}
    answer.update(fields)
    return subprocess.CompletedProcess([], 0, json.dumps(answer), "")


class FakeProcess:
    def __init__(self, output=PRINTED, code=None):
        self.stdout = io.BytesIO(output.encode())
        self.stdin = io.BytesIO()
        self.pid = 2 ** 30
        self.returncode = code
        self.terminated = False

    def poll(self):
        return self.returncode

    def terminate(self):
        self.terminated = True
        self.returncode = -15


class Rows(unittest.TestCase):
    def setUp(self):
        logins.forget()
        self.addCleanup(logins.forget)
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        self.addCleanup(self.folder.cleanup)

    def config(self):
        return {"claudeConfigDir": str(self.root / "a"),
                "roles": {"qa": {}, "qa3": {}, "pm": {"claudeConfigDir": str(self.root / "b")}}}

    def test_status_reads_who_is_logged_in_and_when_the_login_runs_out(self):
        self.assertEqual(logins.status(self.root, run=lambda *a, **k: said()),
                         {"email": "qa@example.com", "logged_in": True,
                          "expires_at": 1_800_000_000, "plan": "max_5x"})

    def test_a_logged_out_folder_and_an_unreadable_answer_say_so(self):
        out = logins.status(self.root, run=lambda *a, **k: said(loggedIn=False, email=None,
                                                                loginExpiresAt=None))
        self.assertEqual((out["logged_in"], out["expires_at"]), (False, None))
        broken = subprocess.CompletedProcess([], 1, "", "error: no such command\n")
        self.assertEqual(logins.status(self.root, run=lambda *a, **k: broken),
                         {"error": "error: no such command"})

        def missing(*a, **k):
            raise FileNotFoundError("claude")

        self.assertIn("claude auth status failed", logins.status(self.root, run=missing)["error"])

    def test_status_reads_the_folders_own_login_and_never_a_token(self):
        seen = []
        environ = {machine.TOKEN: "t", f"{machine.TOKEN}_X": "u", "CLAUDE_CONFIG_DIR": "/x",
                   "HOME": "/h"}
        with mock.patch.dict(logins.os.environ, environ, clear=True):
            logins.status(self.root / "a", run=lambda argv, **k: seen.append((argv, k["env"]))
                          or said())
            logins.status(machine.CLAUDE_DEFAULT, run=lambda argv, **k: seen.append(
                (argv, k["env"])) or said())
        self.assertEqual(seen[0], (["claude", "auth", "status"],
                                   {"HOME": "/h", "CLAUDE_CONFIG_DIR": str(self.root / "a")}))
        self.assertEqual(seen[1][1], {"HOME": "/h"})

    def test_each_folder_is_one_row_with_its_roles_read_again_only_after_a_while(self):
        asked, clock = [], [100.0]
        run = lambda argv, **k: asked.append(k["env"].get("CLAUDE_CONFIG_DIR")) or said()
        rows = logins.read(self.config(), run=run, clock=lambda: clock[0])
        self.assertEqual([(row["folder"], row["roles"], row["email"]) for row in rows],
                         [(str(self.root / "a"), ["qa", "qa3"], "qa@example.com"),
                          (str(self.root / "b"), ["pm"], "qa@example.com")])
        logins.read(self.config(), run=run, clock=lambda: clock[0])
        self.assertEqual(len(asked), 2)
        clock[0] += logins.FRESH_SECONDS
        logins.read(self.config(), run=run, clock=lambda: clock[0])
        self.assertEqual(len(asked), 4)
        logins.forget(self.root / "a")
        logins.read(self.config(), run=run, clock=lambda: clock[0])
        self.assertEqual(asked[-1], str(self.root / "a"))

    def test_a_folder_under_home_is_shown_from_home_and_its_token_is_named(self):
        folder = pathlib.Path.home() / ".claude-abudu"
        self.assertEqual(logins.shown(folder), "~/.claude-abudu")
        with mock.patch.dict(logins.os.environ, {f"{machine.TOKEN}_CLAUDE_ABUDU": "t"}):
            rows = logins.read({"roles": {"qa": {"claudeConfigDir": str(folder)}}},
                               run=lambda *a, **k: said())
        self.assertEqual(rows[0]["token"], f"{machine.TOKEN}_CLAUDE_ABUDU")

    def test_a_login_that_runs_out_soon_has_run_out_or_is_gone_is_a_warning(self):
        rows = [{"folder": "~/.a", "roles": ["qa"], "email": "a@x", "logged_in": True,
                 "expires_at": NOW + 2 * 86400 + 60},
                {"folder": "~/.b", "roles": ["pm", "ux"], "email": "b@x", "logged_in": True,
                 "expires_at": NOW - 1},
                {"folder": "~/.c", "roles": ["bm"], "email": None, "logged_in": False},
                {"folder": "~/.d", "roles": ["cd"], "email": "d@x", "logged_in": True,
                 "expires_at": NOW + 20 * 86400},
                {"folder": "~/.e", "roles": ["dev"], "logged_in": False, "token": "T"},
                {"folder": "~/.f", "roles": ["lead"], "error": "claude auth status failed"}]
        self.assertEqual(logins.warnings(rows, NOW), [
            "the Claude login of a@x (qa) runs out in 2 days: log in again from Claude "
            "logins on sq web",
            "the Claude login of b@x (pm, ux) has run out: log in again from Claude logins "
            "on sq web",
            "~/.c has no Claude login for bm: log in from Claude logins on sq web",
            "the Claude login of ~/.f (lead) could not be read: claude auth status failed"])

    def test_time_left_reads_in_minutes_hours_then_days(self):
        self.assertEqual([logins.left(s) for s in (59, 3599, 3600, 2 * 86400 - 1, 2 * 86400)],
                         ["0 min", "59 min", "1 h", "47 h", "2 days"])


class Chrome(unittest.TestCase):
    def test_a_mac_opens_the_profile_signed_in_as_the_account_or_the_one_named(self):
        self.assertEqual(logins.chrome_argv("a@x", "https://u", {}, "darwin"),
                         ["open", "-na", "Google Chrome", "--args", "--profile-email=a@x",
                          "https://u"])
        named = {"chromeProfiles": {"a@x": "Profile 3"}}
        self.assertEqual(logins.chrome_argv("a@x", "https://u", named, "darwin")[4],
                         "--profile-directory=Profile 3")
        self.assertIsNone(logins.chrome_argv(None, "https://u", {}, "darwin"))

    def test_linux_opens_the_first_chrome_it_finds_or_none(self):
        which = {"chromium": "/usr/bin/chromium"}.get
        self.assertEqual(logins.chrome_argv("a@x", "https://u", {}, "linux", which),
                         ["/usr/bin/chromium", "--profile-email=a@x", "https://u"])
        self.assertIsNone(logins.chrome_argv("a@x", "https://u", {}, "linux", lambda n: None))

    def test_a_service_without_a_display_takes_the_desktop_sessions(self):
        shown = subprocess.CompletedProcess([], 0, "DISPLAY=:0\nPATH=/bin\nXAUTHORITY=/x\n", "")
        env = logins.desktop_env({"HOME": "/h"}, run=lambda *a, **k: shown)
        self.assertEqual(env, {"HOME": "/h", "DISPLAY": ":0", "XAUTHORITY": "/x"})
        self.assertEqual(logins.desktop_env({"WAYLAND_DISPLAY": "w"}, run=None),
                         {"WAYLAND_DISPLAY": "w"})

    def test_linux_without_a_desktop_opens_nothing(self):
        nothing = subprocess.CompletedProcess([], 0, "PATH=/bin\n", "")
        popen = mock.Mock()
        self.assertFalse(logins.open_chrome("a@x", "https://u", {}, "linux",
                                            which=lambda n: "/usr/bin/" + n, popen=popen,
                                            environ={}, run=lambda *a, **k: nothing))
        popen.assert_not_called()

    def test_open_says_whether_chrome_took_the_link(self):
        for code, opened in ((0, True), (1, False)):
            process = mock.Mock(returncode=code, poll=mock.Mock(return_value=code))
            popen = mock.Mock(return_value=process)
            self.assertEqual(logins.open_chrome("a@x", "https://u", {}, "darwin", popen=popen,
                                                environ={}, wait=lambda s: None), opened)
        self.assertEqual(popen.call_args.args[0][-1], "https://u")
        failing = mock.Mock(side_effect=OSError("no open"))
        self.assertFalse(logins.open_chrome("a@x", "https://u", {}, "darwin", popen=failing,
                                            environ={}))


class Logins(unittest.TestCase):
    def setUp(self):
        logins.forget()
        self.addCleanup(logins.forget)
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        self.addCleanup(self.folder.cleanup)
        self.started, self.answers = [], [said()]
        self.clock = [0.0]

    def desk(self, process=None, direct=DIRECT.format(port=54321)):
        def popen(argv, env, **kwargs):
            self.started.append((argv, env, kwargs))
            if direct:
                subprocess.run([env["BROWSER"], direct], check=True)
            return process or FakeProcess()

        def run(*a, **k):
            return self.answers.pop(0) if len(self.answers) > 1 else self.answers[0]

        config = {"roles": {"qa": {"claudeConfigDir": str(self.root / "qa")}}}
        return logins.Desk(lambda: config, popen=popen, run=run, clock=lambda: self.clock[0],
                           wait=lambda s: self.clock.__setitem__(0, self.clock[0] + s))

    def test_only_a_folder_a_role_here_runs_under_can_be_logged_in(self):
        desk = self.desk()
        self.assertEqual(desk.folder(str(self.root / "qa")), self.root / "qa")
        self.assertIsNone(desk.folder("/etc"))

    def test_a_login_runs_claude_for_the_folders_account_and_holds_both_links(self):
        desk = self.desk()
        login = desk.start(self.root / "qa")
        argv, env, kwargs = self.started[0]
        self.assertEqual(argv, ["claude", "auth", "login", "--email", "qa@example.com"])
        self.assertEqual(env["CLAUDE_CONFIG_DIR"], str(self.root / "qa"))
        self.assertTrue(kwargs["start_new_session"])
        answer = login.answer()
        self.assertEqual((answer["link"], answer["direct"], answer["said"], answer["ended"]),
                         ("https://claude.ai/oauth/authorize?z-abc", DIRECT.format(port=54321),
                          "", None))
        self.assertIs(desk.get(login.id), login)
        self.assertEqual(logins.callback_of(answer["direct"]), (54321, "/callback"))

    def test_a_login_that_prints_no_link_ends_with_what_claude_said(self):
        login = self.desk(FakeProcess("error: not a terminal\n", code=1), direct=None) \
            .start(self.root / "qa")
        self.assertEqual(login.ended, {"state": "failed", "message": "error: not a terminal"})
        self.assertFalse(login.workdir.exists())

    def test_a_pasted_code_reaches_claude_and_a_refusal_is_shown(self):
        process = FakeProcess(PRINTED + "That doesn't look like the full code.\n")
        desk = self.desk(process)
        login = desk.start(self.root / "qa")
        self.assertTrue(desk.paste(login, "  abc#def \n"))
        self.assertEqual(process.stdin.getvalue(), b"abc#def\n")
        self.assertEqual(login.said(), "That doesn't look like the full code.")

    def test_a_finished_login_is_read_again_and_a_different_account_is_named(self):
        process = FakeProcess()
        desk = self.desk(process)
        login = desk.start(self.root / "qa")
        process.returncode = 0
        self.answers = [said(email="other@example.com")]
        desk.check(login)
        self.assertEqual(login.ended["state"], "wrong account")
        self.assertEqual(login.ended["email"], "other@example.com")
        self.assertFalse(desk.paste(login, "late"))

    def test_a_login_as_the_same_account_is_done_with_its_new_end(self):
        process = FakeProcess()
        desk = self.desk(process)
        login = desk.start(self.root / "qa")
        process.returncode = 0
        self.answers = [said(email="QA@example.com", loginExpiresAt="2027-02-01T00:00:00Z")]
        self.assertEqual(desk.get(login.id).ended,
                         {"state": "done", "email": "QA@example.com",
                          "expires_at": logins.when("2027-02-01T00:00:00Z")})

    def test_a_login_claude_refused_ends_with_its_words(self):
        process = FakeProcess(PRINTED + "Couldn't log in: Invalid state parameter\n")
        desk = self.desk(process)
        login = desk.start(self.root / "qa")
        process.returncode = 1
        desk.check(login)
        self.assertEqual(login.ended, {"state": "failed",
                                       "message": "Couldn't log in: Invalid state parameter"})

    def test_a_new_login_for_a_folder_cancels_the_one_before_and_an_old_one_expires(self):
        first, second = FakeProcess(), FakeProcess()
        processes = [first, second]
        desk = self.desk()
        desk.popen = lambda argv, env, **k: processes.pop(0)
        login = desk.start(self.root / "qa")
        replaced = desk.start(self.root / "qa")
        self.assertEqual(login.ended["state"], "cancelled")
        self.assertTrue(first.terminated)
        self.clock[0] += logins.OPEN_SECONDS
        desk.tidy()
        self.assertEqual(replaced.ended["message"], "nobody signed in in time")
        self.clock[0] += logins.KEPT_SECONDS
        self.assertIsNone(desk.get(replaced.id))

    def test_a_callback_from_elsewhere_is_handed_to_claudes_own_listener(self):
        heard = []

        class Claude(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                heard.append(self.path)
                self.send_response(302)
                self.send_header("Location", "https://platform.claude.com/oauth/code/success")
                self.send_header("Content-Length", "0")
                self.end_headers()

            def log_message(self, *_):
                pass

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Claude)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        desk = self.desk(direct=DIRECT.format(port=server.server_port))
        login = desk.start(self.root / "qa")
        self.assertEqual(desk.callback(login, "code=c&state=s"),
                         (302, "https://platform.claude.com/oauth/code/success", b""))
        self.assertEqual(heard, ["/callback?code=c&state=s"])
        desk.cancel(login)
        self.assertEqual(desk.callback(login, "code=c")[0], 409)


class Bridges(unittest.TestCase):
    def free_port(self):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            return probe.getsockname()[1]

    def test_the_browsers_callback_here_is_passed_to_the_machine_holding_the_login(self):
        port, asked = self.free_port(), []
        made = logins.bridge(DIRECT.format(port=port),
                             lambda query: asked.append(query) or (302, "https://done", b""))
        self.assertIsNotNone(made)
        self.addCleanup(made.close)
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        connection.request("GET", "/other")
        self.assertEqual(connection.getresponse().status, 404)
        connection.close()
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        connection.request("GET", "/callback?code=c&state=s")
        answer = connection.getresponse()
        self.assertEqual((answer.status, answer.getheader("Location")), (302, "https://done"))
        connection.close()
        self.assertEqual(asked, ["code=c&state=s"])

    def test_no_bridge_without_a_localhost_callback_or_with_its_port_taken(self):
        self.assertIsNone(logins.bridge("https://claude.ai/oauth/authorize?z-abc", None))
        with socket.socket() as taken:
            taken.bind(("127.0.0.1", 0))
            taken.listen()
            self.assertIsNone(logins.bridge(DIRECT.format(port=taken.getsockname()[1]), None))


if __name__ == "__main__":
    unittest.main()
