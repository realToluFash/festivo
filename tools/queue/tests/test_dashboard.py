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

from soirely_queue import dashboard, logins, remote, runlog, runner, sessions, store

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
        self.login = {"email": "ops@example.com", "logged_in": True,
                      "expires_at": NOW + 20 * 86400, "plan": "max_5x"}
        logins.forget()
        self.addCleanup(logins.forget)
        for patch in (mock.patch("soirely_queue.machine.free_gb", return_value=40),
                      mock.patch("soirely_queue.permissions.pending", return_value=[]),
                      mock.patch("soirely_queue.dashboard.peer_views", return_value={}),
                      mock.patch("soirely_queue.logins.status",
                                 side_effect=lambda folder, run=None: dict(self.login))):
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

    def test_a_role_another_machine_runs_is_counted_as_that_machine_counts_it(self):
        store.record(self.db, [work("qa", f"qa:{n}") for n in range(3)]
                     + [work("pm"), work("bm"), work("dev2")], NOW)
        store.set_meta(self.db, "shared_view", {"elsewhere": {"dev2": ["tolu-mac", 40]}})
        runner.set_started(self.db, ["dev2"], True)
        nxt = [{"id": 9, "reason": "comments for you on sc-7: #70"}]
        mac = {"roles": [{"role": "qa", "state": "running", "waiting": 1, "next": nxt,
                          "held": None},
                         {"role": "pm", "state": "started", "waiting": 0, "next": [],
                          "held": None},
                         {"role": "dev2", "state": "started", "waiting": 0, "next": [],
                          "held": None},
                         {"role": "ops", "state": "elsewhere", "waiting": 8, "next": [],
                          "held": None}]}
        view = dashboard.settle(self.snap(), {"tolu-mac": mac})
        self.assertEqual({r["role"]: (r["waiting"], r.get("counted_on"))
                          for r in view["elsewhere"]},
                         {"qa": (1, "tolu-mac"), "bm": (1, None)})
        self.assertEqual(next(r for r in view["elsewhere"] if r["role"] == "qa")["next"], nxt)
        roles = {r["role"]: r for r in view["roles"]}
        self.assertEqual((roles["dev2"]["waiting"], roles["dev2"]["counted_on"]),
                         (0, "tolu-mac"))
        self.assertNotIn("counted_on", roles["ops"])

    def test_a_machine_that_does_not_answer_leaves_its_roles_uncounted(self):
        from soirely_queue import cli
        store.record(self.db, [work("qa"), work("pm"), work("dev2")], NOW)
        store.set_meta(self.db, "shared_view", {
            "elsewhere": {"dev2": ["tolu-mac", 40]},
            "machines": {"tolu-mac": {"seen": 40, "started": ["qa", "dev2"]}}})
        runner.set_started(self.db, ["dev2"], True)
        view = dashboard.settle(self.snap(), {})
        self.assertEqual({r["role"]: (r["waiting"], r.get("counted_on"))
                          for r in view["elsewhere"]},
                         {"qa": (None, "tolu-mac"), "pm": (1, None)})
        self.assertIsNone({r["role"]: r for r in view["roles"]}["dev2"]["waiting"])
        out = io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=self.snap()), \
                mock.patch.object(cli, "home", return_value=self.home), redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        self.assertIn("  qa    ? waiting  on tolu-mac  it did not answer", out.getvalue())

    def test_status_names_the_machine_a_count_came_from(self):
        from soirely_queue import cli
        store.record(self.db, [work("qa"), work("qa", "qa:2")], NOW)
        mac = {"roles": [{"role": "qa", "state": "started", "waiting": 1, "held": None,
                          "next": [{"id": 9, "reason": "sc-7 is ready"}]}]}
        out = io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=self.snap()), \
                mock.patch.object(cli.dashboard, "peer_views", return_value={"tolu-mac": mac}), \
                mock.patch.object(cli, "home", return_value=self.home), redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        self.assertIn("  qa    1 waiting  on tolu-mac  next: sc-7 is ready", out.getvalue())

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

    def test_status_names_a_role_whose_sessions_cannot_read_the_board(self):
        from soirely_queue import cli
        runner.set_started(self.db, ["ops", "dev2"], True)
        store.set_meta(self.db, "artifact:dev2", {
            "at": NOW, "worker": "dev2", "account": "ops@soirely.com", "folder": "/c",
            "why": runner.NO_TOOL, "seen": "1d923fe2"})
        view, out = self.snap(), io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=view), \
                mock.patch.object(cli, "home", return_value=self.home), \
                mock.patch.object(cli.shutil, "get_terminal_size",
                                  return_value=cli.os.terminal_size((1000, 50))), \
                redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        self.assertIn("no board: dev2 on ops@soirely.com, its sessions have no Artifact tool",
                      out.getvalue())
        self.assertNotIn("Share menu", out.getvalue())

    def test_status_shows_a_role_stopped_on_a_prompt_and_what_it_wanted(self):
        from soirely_queue import cli
        runner.set_started(self.db, ["ops", "dev2"], True)
        store.set_meta(self.db, "prompt:dev2", {
            "at": NOW, "worker": "dev2", "item": 7, "story": 42, "wanted": "rm node_modules",
            "told": [42]})
        view, out = self.snap(), io.StringIO()
        dev2, = [r for r in view["roles"] if r["role"] == "dev2"]
        self.assertEqual(dev2["state"], "prompt")
        with mock.patch.object(cli.dashboard, "snapshot", return_value=view), \
                mock.patch.object(cli, "home", return_value=self.home), \
                mock.patch.object(cli.shutil, "get_terminal_size",
                                  return_value=cli.os.terminal_size((1000, 50))), \
                redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        self.assertIn("stopped on a prompt", out.getvalue())
        self.assertIn("stopped on a prompt: dev2 item 7 (sc-42) wanted rm node_modules",
                      out.getvalue())

    def test_a_prompt_already_cleared_leaves_the_state_alone(self):
        runner.set_started(self.db, ["ops", "dev2"], True)
        store.set_meta(self.db, "prompt:dev2", {"told": [42]})
        dev2, = [r for r in self.snap()["roles"] if r["role"] == "dev2"]
        self.assertEqual((dev2["state"], dev2["prompt"]), ("started", None))

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

    def test_each_claude_login_is_listed_and_one_running_out_is_a_warning(self):
        view = self.snap()
        self.assertEqual([(row["folder"], row["roles"], row["email"]) for row in view["logins"]],
                         [(str(self.root / "claude"), ["ops", "dev2"], "ops@example.com")])
        self.assertFalse([w for w in view["warnings"] if "Claude login" in w])
        logins.forget()
        self.login["expires_at"] = NOW + 3600
        self.assertIn("the Claude login of ops@example.com (ops, dev2) runs out in 1 h: log in "
                      "again from Claude logins on sq web", self.snap()["warnings"])

    def test_the_peers_logins_are_listed_beside_this_machines(self):
        view = dashboard.settle({"logins": [{"folder": "~/.a"}], "roles": []},
                                {"tolu-linux": {"logins": [{"folder": "~/.b"}]}})
        self.assertEqual(view["peer_logins"], {"tolu-linux": [{"folder": "~/.b"}]})
        self.assertNotIn("peer_logins", dashboard.settle({"roles": []}, {}))

    def test_status_lists_every_machines_logins_soonest_first(self):
        from soirely_queue import cli
        view = dict(self.snap(), peer_logins={"tolu-linux": [
            {"folder": "~/.claude-b", "roles": ["dev"], "email": "dev@example.com",
             "logged_in": True, "expires_at": NOW + 7200},
            {"folder": "~/.claude-c", "roles": ["lead"], "email": None, "logged_in": False},
            {"folder": "~/.claude-d", "roles": ["l10n"], "token": "T"}]})
        out = io.StringIO()
        with mock.patch.object(cli.dashboard, "snapshot", return_value=view), \
                mock.patch.object(cli.dashboard, "settle", side_effect=lambda v, o: v), \
                mock.patch.object(cli, "home", return_value=self.home), \
                mock.patch.object(cli.shutil, "get_terminal_size",
                                  return_value=cli.os.terminal_size((1000, 50))), \
                redirect_stdout(out):
            cli.status(self.db, self.platform, NOW)
        lines = out.getvalue().splitlines()
        start = lines.index("claude logins")
        self.assertEqual(lines[start + 1:start + 5], [
            "  tolu-linux  logged out  ~/.claude-c  lead",
            "  tolu-linux  2 h left  dev@example.com  dev",
            "  here  20 days left  ops@example.com  ops, dev2",
            "  tolu-linux  setup-token  ~/.claude-d  l10n"])

    def test_a_failed_run_is_marked(self):
        runlog.append(self.home, "ops", {"at": NOW, "role": "ops", "exit": "1",
                                         "stopped": "exit-code", "report": "ended"})
        self.assertTrue(self.snap()["recent"][0]["failed"])

    def test_seven_days_of_spend_end_today(self):
        days = dashboard.spend(self.home, 7)
        self.assertEqual(len(days), 7)
        self.assertEqual(days[-1]["day"], time.strftime("%Y-%m-%d"))


SECRET = "t" * remote.TOKEN_MIN


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

    def test_requests_close_together_share_one_reading(self):
        said, reads, server_ready = [], [], threading.Event()

        def say(line):
            said.append(line)
            server_ready.set()

        threading.Thread(target=dashboard.serve, daemon=True,
                         args=(lambda now: reads.append(now) or {"machine": "here"}, 0),
                         kwargs={"open_page": False, "say": say}).start()
        self.assertTrue(server_ready.wait(5))
        url = said[0].split()[2]
        for path in ("status.json", "status.json?own=1", "status.json"):
            with urllib.request.urlopen(url + path) as answer:
                self.assertEqual(json.load(answer), {"machine": "here"})
        self.assertEqual(len(reads), 1)
        with mock.patch.object(dashboard, "SHARED_SECONDS", 0):
            urllib.request.urlopen(url + "status.json").close()
        self.assertEqual(len(reads), 2)

    def test_a_peer_is_asked_again_only_after_a_while_and_its_last_answer_is_kept(self):
        asked, answers = [], [(200, b'{"roles": []}'), (502, b"{}")]

        def fetch(base, path, secret):
            asked.append(base)
            return answers[min(len(asked), 2) - 1]

        def settled(views, want):
            until = time.monotonic() + 5
            while len(asked) < want and time.monotonic() < until:
                time.sleep(0.01)
            time.sleep(0.05)
            return views.views()

        views = dashboard.PeerViews(lambda: {"tolu-mac": "http://10.0.0.6:8765"}, SECRET, fetch)
        views.views()
        self.assertEqual(settled(views, 1), {"tolu-mac": {"roles": []}})
        self.assertEqual(len(asked), 1)
        with mock.patch.object(dashboard, "ASK_SECONDS", 0):
            views.views()
            self.assertEqual(settled(views, 2), {"tolu-mac": {"roles": []}})
        with mock.patch.object(dashboard, "KEPT_SECONDS", 0):
            self.assertEqual(views.views(), {})

    def test_the_json_is_settled_with_the_peers_unless_a_peer_is_asking(self):
        said, asked, server_ready = [], [], threading.Event()

        def say(line):
            said.append(line)
            server_ready.set()

        def fetch(base, path, secret):
            asked.append((base, path))
            if base != "http://10.0.0.6:8765":
                return 502, b'{"error": "it did not answer"}'
            return 200, json.dumps({"roles": [{"role": "qa", "state": "started", "waiting": 2,
                                               "next": [], "held": None}]}).encode()

        def read(now):
            return {"roles": [], "elsewhere": [{"role": "qa", "waiting": 90, "held": None,
                                                "next": []}]}

        peers = {"tolu-mac": "http://10.0.0.6:8765", "down": "http://10.0.0.7:8765"}
        threading.Thread(target=dashboard.serve, daemon=True, args=(read, 0),
                         kwargs={"open_page": False, "say": say, "peers": lambda: peers,
                                 "fetch": fetch}).start()
        self.assertTrue(server_ready.wait(5))
        url = said[0].split()[2]
        until = time.monotonic() + 5
        while True:
            with urllib.request.urlopen(url + "status.json") as answer:
                found = [(r["waiting"], r.get("counted_on"))
                         for r in json.load(answer)["elsewhere"]]
            if found != [(90, None)] or time.monotonic() > until:
                break
            time.sleep(0.01)
        self.assertEqual(found, [(2, "tolu-mac")])
        self.assertEqual({path for _, path in asked}, {"status.json?own=1"})
        self.assertEqual({base for base, _ in asked}, set(peers.values()))
        with urllib.request.urlopen(url + "status.json?own=1") as answer:
            self.assertEqual(json.load(answer)["elsewhere"][0]["waiting"], 90)

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


class ServeElsewhere(unittest.TestCase):
    """As another machine on the network sees it: every client is treated as remote."""

    def start(self, near=False, **kwargs):
        said, ready = [], threading.Event()

        def say(line):
            said.append(line)
            ready.set()

        patch = mock.patch.object(remote, "loopback", return_value=near)
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

    def post_login(self, said, path, body, headers):
        port = int(said[0].split()[2].rsplit(":", 1)[1].strip("/"))
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        self.addCleanup(connection.close)
        connection.request("POST", path, body=body, headers=headers)
        answer = connection.getresponse()
        return answer.status, answer.read()

    def test_a_login_step_is_taken_only_as_json_from_this_pages_own_address(self):
        desk = FakeDesk()
        said = self.start(desk=desk, opener=lambda *a: False)
        bearer = {"Authorization": f"Bearer {SECRET}"}
        body = json.dumps({"folder": "~/.claude-qa"})
        self.assertEqual(self.post_login(said, "/login/start", body,
                                         {"Content-Type": "application/json"})[0], 401)
        self.assertEqual(self.post_login(said, "/login/start", body,
                                         dict(bearer, **{"Content-Type": "text/plain"}))[0], 415)
        json_bearer = dict(bearer, **{"Content-Type": "application/json"})
        self.assertEqual(self.post_login(said, "/login/start", body, dict(
            json_bearer, Origin="https://elsewhere.example"))[0], 403)
        self.assertEqual(self.post_login(said, "/login/start", "[1]", json_bearer)[0], 400)
        status, answer = self.post_login(said, "/login/start", body, json_bearer)
        self.assertEqual((status, json.loads(answer)["id"]), (200, "L1"))
        self.assertEqual(desk.steps[0], ("start", pathlib.Path("/home/q/.claude-qa")))
        answer = self.get(said, "/login/state?id=L1", bearer)
        self.assertEqual((answer.status, json.loads(answer.read())["id"]), (200, "L1"))
        self.assertEqual(self.get(said, "/login/state?id=gone", bearer).status, 404)

    def test_a_login_step_from_this_machine_must_name_loopback_as_its_host(self):
        desk = FakeDesk()
        said = self.start(near=True, desk=desk, opener=lambda *a: False)
        port = said[0].split()[2].rsplit(":", 1)[1].strip("/")
        body = json.dumps({"folder": "~/.claude-qa"})
        rebound = {"Content-Type": "application/json", "Host": f"evil.example:{port}",
                   "Origin": f"http://evil.example:{port}"}
        self.assertEqual(self.post_login(said, "/login/start", body, rebound)[0], 403)
        self.assertEqual(desk.steps, [])
        for name in ("localhost", "127.0.0.1", "[::1]"):
            here = {"Content-Type": "application/json", "Host": f"{name}:{port}",
                    "Origin": f"http://{name}:{port}"}
            self.assertEqual(self.post_login(said, "/login/start", body, here)[0], 200)

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
            if path != dashboard.OWN:
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

    def post(self, said, path, body, headers=None):
        port = int(said[0].split()[2].rsplit(":", 1)[1].strip("/"))
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        self.addCleanup(connection.close)
        connection.request("POST", path, body=body, headers=headers or {})
        answer = connection.getresponse()
        answer.read()
        return answer.status

    def test_a_peer_tells_its_reading_and_the_counts_use_it_though_it_cannot_be_asked(self):
        told = {"roles": [{"role": "qa", "state": "started", "waiting": 2, "next": [],
                           "held": None}]}
        own = {"roles": [], "elsewhere": [{"role": "qa", "waiting": 90, "held": None,
                                           "next": []}]}
        said, ready = [], threading.Event()
        patch = mock.patch.object(remote, "loopback", return_value=False)
        patch.start()
        self.addCleanup(patch.stop)
        threading.Thread(target=dashboard.serve, daemon=True, args=(lambda now: own, 0),
                         kwargs={"open_page": False, "secret": SECRET,
                                 "say": lambda line: said.append(line) or ready.set(),
                                 "peers": lambda: {"tolu-linux": "http://10.0.0.5:8765"},
                                 "fetch": lambda base, path, secret: (502, b"{}")}).start()
        self.assertTrue(ready.wait(5))
        bearer = {"Authorization": f"Bearer {SECRET}"}
        body = json.dumps(told)
        self.assertEqual(self.post(said, "/peer.json?from=tolu-linux", body), 401)
        self.assertEqual(self.post(said, "/peer.json?from=stranger", body, bearer), 404)
        self.assertEqual(self.post(said, "/other.json?from=tolu-linux", body, bearer), 404)
        self.assertEqual(self.post(said, "/peer.json?from=tolu-linux", "[1]", bearer), 400)
        self.assertEqual(self.post(said, "/peer.json?from=tolu-linux", "{", bearer), 400)
        with mock.patch.object(dashboard, "TOLD_MOST_BYTES", 4):
            self.assertEqual(self.post(said, "/peer.json?from=tolu-linux", body, bearer), 413)
        self.assertEqual(json.loads(self.get(said, "/status.json", bearer).read())
                         ["elsewhere"][0]["waiting"], 90)
        self.assertEqual(self.post(said, "/peer.json?from=tolu-linux", body, bearer), 204)
        self.assertEqual([(r["waiting"], r["counted_on"]) for r in json.loads(
            self.get(said, "/status.json", bearer).read())["elsewhere"]], [(2, "tolu-linux")])

    def test_a_machine_tells_every_peer_its_reading_under_its_own_name(self):
        sent = []
        dashboard.tell({"machine": "tolu linux", "roles": []},
                       {"tolu-mac": "http://10.0.0.6:8765", "other": "http://10.0.0.7:8765"},
                       SECRET, send=lambda *args: sent.append(args))
        self.assertEqual(sorted(sent), [
            (base, "peer.json?from=tolu%20linux", SECRET,
             b'{"machine": "tolu linux", "roles": []}')
            for base in ("http://10.0.0.6:8765", "http://10.0.0.7:8765")])

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


DIRECT = "https://claude.com/x?redirect_uri=http%3A%2F%2Flocalhost%3A5%2Fcallback"


class FakeLogin:
    def __init__(self, login_id="L1", direct=DIRECT):
        self.id = login_id
        self.said = {"id": login_id, "folder": "~/.claude-qa", "email": "qa@example.com",
                     "link": "https://claude.ai/oauth/authorize?z-1", "direct": direct,
                     "said": "", "ended": None}

    def answer(self):
        return dict(self.said)


class FakeDesk:
    def __init__(self):
        self.logins, self.steps = {"L1": FakeLogin()}, []

    def folder(self, asked):
        return pathlib.Path("/home/q/.claude-qa") if asked == "~/.claude-qa" else None

    def start(self, folder):
        self.steps.append(("start", folder))
        return self.logins["L1"]

    def get(self, login_id):
        return self.logins.get(login_id)

    def check(self, login):
        self.steps.append(("check", login.id))

    def paste(self, login, code):
        self.steps.append(("paste", code))

    def cancel(self, login):
        self.steps.append(("cancel", login.id))
        login.said["ended"] = {"state": "cancelled"}

    def callback(self, login, query):
        self.steps.append(("callback", query))
        return 302, "https://done", b"ok"


class Door(unittest.TestCase):
    """`LoginDoor`: a login here, or on a peer, and where its sign-in is opened."""

    def setUp(self):
        self.desk, self.opened, self.posted, self.bridges = FakeDesk(), [], [], []
        self.opens, self.peer_answer = True, (200, json.dumps(FakeLogin("P1").said).encode())

    def door(self):
        def post(base, path, secret, body, timeout=5):
            self.posted.append((base, path, json.loads(body), timeout))
            return self.peer_answer

        def bridge(link, forward):
            made = mock.Mock(link=link, forward=forward)
            self.bridges.append(made)
            return made if self.bridge_works else None

        self.bridge_works = getattr(self, "bridge_works", True)
        return dashboard.LoginDoor(
            self.desk, lambda: {"machine": "here"}, lambda: {"tolu-linux": "http://10.0.0.5:8765"},
            SECRET, fetch=lambda base, path, secret: (200, b'{"id": "P1", "ended": null}'),
            post=post, opener=lambda email, url, config: self.opened.append((email, url))
            or self.opens, bridge=bridge)

    def test_a_login_here_opens_claudes_own_link_for_a_page_on_this_machine(self):
        status, said = self.door().act("/login/start", {"folder": "~/.claude-qa"}, True)
        self.assertEqual((status, said["opened"]), (200, "direct"))
        self.assertEqual(self.opened, [("qa@example.com", FakeLogin().said["direct"])])

    def test_a_page_elsewhere_or_a_peer_asking_opens_nothing_here(self):
        for asked, here in (({"folder": "~/.claude-qa"}, False),
                            ({"folder": "~/.claude-qa", "for_peer": True}, True)):
            status, said = self.door().act("/login/start", asked, here)
            self.assertEqual((status, "opened" in said), (200, False))
        self.assertEqual(self.opened, [])

    def test_a_folder_no_role_here_runs_under_is_refused(self):
        self.assertEqual(self.door().act("/login/start", {"folder": "/etc"}, True)[0], 404)

    def test_a_peers_login_is_bridged_here_and_opened_in_this_machines_chrome(self):
        door = self.door()
        status, said = door.act("/login/start",
                                {"machine": "tolu-linux", "folder": "~/.claude-qa"}, True)
        self.assertEqual((status, said["opened"]), (200, "direct"))
        self.assertEqual(self.posted, [("http://10.0.0.5:8765", "login/start",
                                        {"folder": "~/.claude-qa", "for_peer": True},
                                        logins.LINK_SECONDS + 10)])
        self.assertEqual(self.bridges[0].link, FakeLogin().said["direct"])
        self.peer_answer = (200, b'{"status": 302, "location": "https://done", "body": "ok"}')
        self.assertEqual(self.bridges[0].forward("code=c&state=s"), (302, "https://done", b"ok"))
        self.assertEqual(self.posted[-1][1:3], ("login/callback", {"id": "P1",
                                                                   "query": "code=c&state=s"}))
        self.peer_answer = (502, b'{"error": "it did not answer (timed out)"}')
        self.assertEqual(self.bridges[0].forward("code=c")[0], 502)
        door.act("/login/cancel", {"machine": "tolu-linux", "id": "P1"}, True)
        self.bridges[0].close.assert_called_once()

    def test_without_a_bridge_the_peers_login_opens_the_link_that_shows_a_code(self):
        self.bridge_works = False
        said = self.door().act("/login/start", {"machine": "tolu-linux",
                                                "folder": "~/.claude-qa"}, True)[1]
        self.assertEqual((said["opened"], self.opened[0][1]),
                         ("link", "https://claude.ai/oauth/authorize?z-1"))

    def test_a_bridge_is_closed_when_chrome_could_not_be_opened(self):
        self.opens = False
        said = self.door().act("/login/start", {"machine": "tolu-linux",
                                                "folder": "~/.claude-qa"}, True)[1]
        self.assertIsNone(said["opened"])
        self.bridges[0].close.assert_called_once()

    def test_a_code_a_cancel_and_a_callback_reach_the_login_they_name(self):
        door = self.door()
        self.assertEqual(door.act("/login/code", {"id": "L1", "code": "a#b"}, True)[0], 200)
        door.act("/login/cancel", {"id": "L1"}, True)
        status, said = door.act("/login/callback", {"id": "L1", "query": "code=c"}, False)
        self.assertEqual(said, {"status": 302, "location": "https://done", "body": "ok"})
        self.assertEqual([step for step in self.desk.steps if step[0] != "check"],
                         [("paste", "a#b"), ("cancel", "L1"), ("callback", "code=c")])
        self.assertEqual(door.act("/login/code", {"id": "other"}, True)[0], 404)
        self.assertEqual(door.act("/login/other", {"id": "L1"}, True)[0], 404)

    def test_a_peers_code_and_state_are_asked_of_it(self):
        door = self.door()
        door.act("/login/code", {"machine": "tolu-linux", "id": "P1", "code": "a#b"}, True)
        self.assertEqual(self.posted[-1][1:3], ("login/code", {"id": "P1", "code": "a#b"}))
        self.assertEqual(door.state("tolu-linux", "P1"), (200, {"id": "P1", "ended": None}))
        self.assertEqual(door.state("nowhere", "P1")[0], 404)
        self.assertEqual(door.state("", "L1")[1]["id"], "L1")
        self.assertEqual(door.state("", "gone")[0], 404)

