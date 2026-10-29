"""`sq web`: the snapshot it serves, and the page and JSON it answers with."""

import http.client
import io
import socket
import json
import pathlib
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from contextlib import redirect_stdout
from unittest import mock

from soirely_queue import dashboard, remote, runlog, runner, sessions, store

from tests.test_runner import FakePlatform, config, work

NOW = 1_000_000


class Snapshot(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        for name in ("festivo", "soirely-ops", "soirely-dev2"):
            (self.root / name).mkdir()
        self.home = self.root / "home"
        self.db = store.connect(":memory:")
        self.platform = FakePlatform()
        self.platform.timer_active = lambda: True
        self.settings = config(self.root, roles={"ops": {}, "dev2": {"wakeEvery": "1m"}})
        for patch in (mock.patch("soirely_queue.machine.free_gb", return_value=40),
                      mock.patch("soirely_queue.permissions.pending", return_value=[])):
            patch.start()
            self.addCleanup(patch.stop)

    def tearDown(self):
        self.folder.cleanup()

    def snap(self):
        return dashboard.snapshot(self.db, self.platform, NOW, self.home,
                                  load=lambda: self.settings)

    def test_each_role_shows_its_state_last_run_and_next_items(self):
        store.record(self.db, [work("ops"), work("dev2")], NOW)
        store.claim(self.db, "dev2", NOW)
        self.platform.active.add("ops")
        runlog.append(self.home, "ops", {"at": NOW - 60, "role": "ops", "item": 9,
                                         "cost_usd": 0.25, "exit": 0, "duration_ms": 42000,
                                         "report": "Fixed the cache step.\nMore."})
        view = self.snap()
        roles = {r["role"]: r for r in view["roles"]}
        self.assertEqual(roles["ops"]["state"], "running")
        self.assertEqual(roles["ops"]["last"]["report"], "Fixed the cache step.")
        self.assertEqual(roles["ops"]["last"]["seconds"], 42)
        self.assertEqual(roles["ops"]["next"][0]["reason"], "[ops] on sc-1")
        self.assertEqual(roles["dev2"]["state"], "busy")
        self.assertEqual(roles["dev2"]["wake_every"], "1m")
        self.assertEqual(view["recent"][0]["role"], "ops")
        self.assertEqual((view["machine"], view["free_gb"], view["manager"]), ("here", 40, True))

    def test_each_role_and_its_runs_name_the_account_it_runs_on(self):
        runlog.append(self.home, "ops", {"at": NOW, "role": "ops", "exit": 0, "report": "done"})
        with mock.patch("soirely_queue.machine.account",
                        side_effect=lambda folder: "ops@example.com"):
            view = self.snap()
        self.assertEqual({r["account"] for r in view["roles"]}, {"ops@example.com"})
        self.assertEqual(view["recent"][0]["account"], "ops@example.com")

    def test_the_stories_to_draw_are_listed_with_their_prompts(self):
        store.add_drawing(self.db, 7, "Calendar", "/soirely-designer Draw sc-7", NOW)
        self.assertEqual(self.snap()["drawings"],
                         [{"story_id": 7, "name": "Calendar",
                           "prompt": "/soirely-designer Draw sc-7", "at": NOW}])

    def test_the_story_being_drawn_shows_its_session_and_tries(self):
        store.set_meta(self.db, "drawing", {"story_id": 7, "session": "ab12cd34", "at": NOW,
                                            "state": "blocked"})
        store.set_meta(self.db, "draw_tries", {"9": 1})
        self.assertEqual(self.snap()["drawing"],
                         {"current": {"story_id": 7, "session": "ab12cd34", "at": NOW,
                                      "state": "blocked"},
                          "tries": {"9": 1}, "max_tries": 2})

    def test_a_role_with_several_workers_shows_what_each_works_on(self):
        (self.root / "soirely-pm").mkdir()
        self.settings["roles"]["pm"] = {"workers": 3}
        store.record(self.db, [dict(work("pm", f), story_id=n) for n, f in enumerate("abc")],
                     NOW)
        store.claim(self.db, "pm", NOW, worker="pm", workers=3)
        store.claim(self.db, "pm", NOW, worker="pm-3", workers=3)
        pm = next(r for r in self.snap()["roles"] if r["role"] == "pm")
        self.assertEqual([h["worker"] for h in pm["holding"]], ["pm", "pm-3"])
        ops = next(r for r in self.snap()["roles"] if r["role"] == "ops")
        self.assertEqual(ops["holding"], [])

    def test_a_run_names_the_worker_that_made_it(self):
        runlog.append(self.home, "ux", {"at": NOW, "role": "ux", "worker": "ux-draw",
                                        "exit": 0, "report": "drew sc-7"})
        self.assertEqual(self.snap()["recent"][0]["worker"], "ux-draw")

    def test_a_role_this_machine_does_not_run_is_listed_with_its_queue(self):
        store.record(self.db, [work("qa")], NOW)
        view = self.snap()
        self.assertEqual([(r["role"], r["waiting"]) for r in view["elsewhere"]], [("qa", 1)])

    def test_other_machines_their_roles_and_what_they_hold_are_shown(self):
        store.set_meta(self.db, "shared_view", {
            "elsewhere": {"dev2": ["tolu-mac", 40]}, "conflicts": [["dev2", "tolu-mac"]],
            "paused": {"machine": "tolu-mac"},
            "machines": {"tolu-mac": {"seen": 40, "started": ["dev2", "ops"]}}})
        runner.set_started(self.db, ["ops", "dev2"], True)
        view = self.snap()
        roles = {r["role"]: r for r in view["roles"]}
        self.assertEqual((roles["dev2"]["state"], roles["dev2"]["detail"]),
                         ("elsewhere", {"machine": "tolu-mac", "seen": 40}))
        self.assertEqual(view["machines"],
                         [{"name": "tolu-mac", "seen": 40, "started": ["dev2", "ops"]}])
        self.assertIn("paused everywhere by tolu-mac: sq resume --everywhere", view["warnings"])
        self.assertIn("dev2 is listed here and on tolu-mac, and neither marks it standby; only "
                      "one runs it", view["warnings"])

    def test_status_says_which_machine_runs_a_role_and_when_it_was_seen(self):
        from soirely_queue import cli
        store.set_meta(self.db, "shared_view", {"elsewhere": {"dev2": ["tolu-mac", 40]}})
        runner.set_started(self.db, ["ops", "dev2"], True)
        view, out = self.snap(), io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=view), \
                mock.patch.object(cli, "home", return_value=self.home), redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        self.assertIn("  dev2  on tolu-mac, seen 40s ago", out.getvalue())

    def test_status_prints_other_machines_each_warning_and_the_ops_refusal(self):
        from soirely_queue import cli
        self.settings["roles"] = {"dev2": {}}
        store.set_meta(self.db, "shared_view", {
            "conflicts": [["dev2", "tolu-mac"]], "paused": {"machine": "tolu-mac"},
            "machines": {"tolu-mac": {"seen": 40, "started": ["dev2", "ops"]}}})
        with mock.patch("soirely_queue.permissions.pending", return_value=["+ a", "- b"]):
            view = self.snap()
        out = io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=view), \
                mock.patch.object(cli, "home", return_value=self.home), \
                mock.patch.object(cli.shutil, "get_terminal_size",
                                  return_value=cli.os.terminal_size((1000, 50))), \
                redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        lines = out.getvalue().splitlines()
        for line in ("warning: paused everywhere by tolu-mac: sq resume --everywhere",
                     "warning: dev2 is listed here and on tolu-mac, and neither marks it "
                     "standby; only one runs it",
                     "warning: permissions: main grants 2 change(s) this machine has not "
                     "applied: just agents permissions apply",
                     "other machines",
                     "  tolu-mac  seen 40s ago   dev2, ops"):
            self.assertIn(line, lines)
        self.assertIn(f"  ops   refused: not listed in {cli.machine.path()}: every machine runs "
                      "ops, for its own disk, Docker, stacks and manager (ops@here)", lines)

    def test_status_names_the_host_in_the_ops_refusal_of_an_unnamed_machine(self):
        from soirely_queue import cli
        self.settings["roles"] = {"dev2": {}}
        del self.settings["machine"]
        with mock.patch("socket.gethostname", return_value="tolu-linux"):
            view = self.snap()
        out = io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=view), \
                mock.patch.object(cli, "home", return_value=self.home), \
                mock.patch.object(cli.shutil, "get_terminal_size",
                                  return_value=cli.os.terminal_size((1000, 50))), \
                redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        self.assertIn(f"  ops   refused: not listed in {cli.machine.path()}: every machine runs "
                      "ops, for its own disk, Docker, stacks and manager (ops@tolu-linux)",
                      out.getvalue().splitlines())

    def test_rules_main_grants_and_this_machine_has_not_applied_are_a_warning(self):
        with mock.patch("soirely_queue.permissions.pending", return_value=["+ a", "- b"]):
            warnings = self.snap()["warnings"]
        self.assertIn("permissions: main grants 2 change(s) this machine has not applied: "
                      "just agents permissions apply", warnings)

    def test_a_running_worker_and_each_recent_run_link_to_their_session(self):
        session = "0b6f1e2a-3c4d-4e5f-8a9b-0c1d2e3f4a5b"
        sessions.begin(self.db, "ops", {"session": session, "at": NOW, "item": 1})
        sessions.begin(self.db, "dev2", {"session": "left-from-before", "at": NOW - 600})
        self.platform.active.add("ops")
        runlog.append(self.home, "ops", {"at": NOW, "role": "ops", "session": session,
                                         "exit": 0, "report": "done"})
        view = self.snap()
        roles = {r["role"]: r for r in view["roles"]}
        self.assertEqual(roles["ops"]["sessions"],
                         [{"worker": "ops", "session": session, "at": NOW}])
        self.assertEqual(roles["dev2"]["sessions"], [])
        self.assertEqual(view["recent"][0]["session"], session)

    def test_a_machine_whose_workers_have_no_node_says_so_once(self):
        self.platform.search_path = lambda: "/nowhere"
        with mock.patch("shutil.which", return_value=None):
            warned = [w for w in self.snap()["warnings"] if "no node" in w]
        self.assertEqual(len(warned), 1)
        with mock.patch("shutil.which", return_value="/nvm/v22/bin/node"):
            self.assertFalse([w for w in self.snap()["warnings"] if "no node" in w])

    def node(self, version):
        node = pathlib.Path(self.root) / "bin" / version / "node"
        node.parent.mkdir(parents=True)
        node.write_text(f"#!/bin/sh\necho v{version}\n")
        node.chmod(0o755)
        return str(node)

    def nvmrc(self, version):
        main = pathlib.Path(self.root) / "festivo"
        main.mkdir(exist_ok=True)
        (main / ".nvmrc").write_text(version + "\n")

    def node_warnings(self, node):
        self.platform.search_path = lambda: "/nowhere"
        with mock.patch("shutil.which", return_value=node):
            return [w for w in self.snap()["warnings"] if "node" in w]

    def test_a_worker_node_older_than_the_nvmrc_is_named_with_both_versions(self):
        self.nvmrc("22.18")
        self.assertEqual(self.node_warnings(self.node("20.19.0")),
                         ["workers run node 20.19.0, older than the 22.18 that .nvmrc asks for: "
                          "nvm install 22.18 && nvm alias default 22.18"])
        self.assertEqual(self.node_warnings(None),
                         ["workers have no node: install nvm with a default alias "
                          "(nvm alias default 22.18), or node on the PATH"])

    def test_a_node_at_or_above_the_nvmrc_or_no_nvmrc_gives_no_version_warning(self):
        old = self.node("20.19.0")
        self.assertEqual(self.node_warnings(old), [])
        self.nvmrc("22.18")
        self.assertEqual(self.node_warnings(self.node("22.18.0")), [])
        self.assertEqual(self.node_warnings(self.node("24.1.0")), [])
        self.nvmrc("lts/jod")
        self.assertEqual(self.node_warnings(old), [])

    def test_the_other_machines_page_names_are_listed_and_a_missing_token_is_a_warning(self):
        self.settings["peers"] = {"tolu-linux": "http://10.0.0.5:8765"}
        with mock.patch.dict("os.environ", {remote.TOKEN: ""}):
            view = self.snap()
        self.assertEqual(view["peers"], ["tolu-linux"])
        self.assertIn(f"peers are listed but {remote.TOKEN} is not set, so they cannot be read",
                      view["warnings"])

    def test_a_failed_run_is_marked(self):
        runlog.append(self.home, "ops", {"at": NOW, "role": "ops", "exit": "1",
                                         "stopped": "exit-code", "report": "ended"})
        self.assertTrue(self.snap()["recent"][0]["failed"])

    def test_seven_days_of_spend_end_today(self):
        days = dashboard.spend(self.home, 7)
        self.assertEqual(len(days), 7)
        self.assertEqual(days[-1]["day"], time.strftime("%Y-%m-%d"))


class Serve(unittest.TestCase):
    def test_the_page_and_its_json_are_served_on_this_machine_only(self):
        said = []
        reads = []
        server_ready = threading.Event()

        def say(line):
            said.append(line)
            server_ready.set()

        thread = threading.Thread(target=dashboard.serve, daemon=True,
                                  args=(lambda now: reads.append(now) or {"machine": "here"}, 0),
                                  kwargs={"open_page": False, "say": say})
        thread.start()
        self.assertTrue(server_ready.wait(5))
        url = said[0].split()[2]
        self.assertTrue(url.startswith("http://127.0.0.1:"))
        with urllib.request.urlopen(url + "status.json") as answer:
            self.assertEqual(json.load(answer), {"machine": "here"})
        with urllib.request.urlopen(url) as answer:
            self.assertIn("<title>Soirely agents</title>", answer.read().decode())
        self.assertEqual(len(reads), 1)

    def test_a_session_is_served_by_its_id_and_an_unknown_one_is_not_found(self):
        said, asked = [], []
        server_ready = threading.Event()

        def say(line):
            said.append(line)
            server_ready.set()

        def session(found):
            asked.append(found)
            return {"session": found} if found == "known" else None

        thread = threading.Thread(target=dashboard.serve, daemon=True,
                                  args=(lambda now: {}, 0),
                                  kwargs={"open_page": False, "say": say, "session": session})
        thread.start()
        self.assertTrue(server_ready.wait(5))
        url = said[0].split()[2]
        with urllib.request.urlopen(url + "session.json?id=known") as answer:
            self.assertEqual(json.load(answer), {"session": "known"})
        with self.assertRaises(urllib.error.HTTPError) as refused:
            urllib.request.urlopen(url + "session.json?id=other")
        self.assertEqual(refused.exception.code, 404)
        self.assertEqual(asked, ["known", "other"])


SECRET = "t" * remote.TOKEN_MIN


class ServeElsewhere(unittest.TestCase):
    """As another machine on the network sees it: every client is treated as remote."""

    def start(self, **kwargs):
        said, ready = [], threading.Event()

        def say(line):
            said.append(line)
            ready.set()

        patch = mock.patch.object(remote, "loopback", return_value=False)
        patch.start()
        self.addCleanup(patch.stop)
        threading.Thread(target=dashboard.serve, daemon=True, args=(lambda now: {"m": 1}, 0),
                         kwargs=dict({"open_page": False, "say": say, "secret": SECRET},
                                     **kwargs)).start()
        self.assertTrue(ready.wait(5))
        return said

    def get(self, said, path, headers=None):
        port = int(said[0].split()[2].rsplit(":", 1)[1].strip("/"))
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        self.addCleanup(connection.close)
        connection.request("GET", path, headers=headers or {})
        return connection.getresponse()

    def test_without_a_token_it_will_not_listen_beyond_this_machine(self):
        said = []
        dashboard.serve(lambda now: {}, 0, open_page=False, say=said.append, host="0.0.0.0",
                        secret="short")
        self.assertIn("will not listen on 0.0.0.0", said[0])

    def test_another_machine_is_refused_without_the_token_and_served_with_it(self):
        said = self.start()
        self.assertEqual(self.get(said, "/status.json").status, 401)
        answer = self.get(said, "/status.json", {"Authorization": f"Bearer {SECRET}"})
        self.assertEqual(json.loads(answer.read()), {"m": 1})

    def test_the_token_in_the_address_becomes_a_cookie_and_leaves_the_address(self):
        said = self.start()
        answer = self.get(said, f"/?token={SECRET}")
        self.assertEqual((answer.status, answer.getheader("Location")), (303, "/"))
        cookie = answer.getheader("Set-Cookie")
        self.assertIn("HttpOnly", cookie)
        self.assertEqual(self.get(said, "/", {"Cookie": cookie.split(";")[0]}).status, 200)

    def test_a_peers_json_is_read_through_this_machine_and_an_unknown_peer_is_not_found(self):
        asked = []

        def fetch(base, path, secret):
            asked.append((base, path, secret))
            return 502, b'{"error": "it did not answer"}'

        said = self.start(peers=lambda: {"tolu-linux": "http://10.0.0.5:8765"}, fetch=fetch)
        bearer = {"Authorization": f"Bearer {SECRET}"}
        answer = self.get(said, "/m/tolu-linux/session.json?id=abc", bearer)
        self.assertEqual((answer.status, json.loads(answer.read())),
                         (502, {"error": "it did not answer"}))
        self.assertEqual(asked, [("http://10.0.0.5:8765", "session.json?id=abc", SECRET)])
        self.assertEqual(self.get(said, "/m/other/status.json", bearer).status, 404)
        said = self.start(peers=lambda: {"tolu mac": "http://10.0.0.6:8765"}, fetch=fetch)
        self.assertEqual(self.get(said, "/m/tolu%20mac/status.json", bearer).status, 502)
        self.assertEqual(asked[-1][0], "http://10.0.0.6:8765")

    def test_a_slow_peer_or_an_idle_connection_holds_up_no_one_else(self):
        answering = threading.Event()

        def fetch(base, path, secret):
            answering.wait(5)
            return 200, b"{}"

        said = self.start(peers=lambda: {"slow": "http://10.0.0.5:8765"}, fetch=fetch)
        port = int(said[0].split()[2].rsplit(":", 1)[1].strip("/"))
        idle = socket.create_connection(("127.0.0.1", port))
        self.addCleanup(idle.close)
        bearer = {"Authorization": f"Bearer {SECRET}"}
        slow = threading.Thread(target=self.get, args=(said, "/m/slow/status.json", bearer))
        slow.start()
        started = time.monotonic()
        self.assertEqual(self.get(said, "/status.json", bearer).status, 200)
        self.assertLess(time.monotonic() - started, 2)
        answering.set()
        slow.join(5)
        self.assertEqual(self.get(said, "/m/tolu-linux/../status.json", bearer).status, 404)
