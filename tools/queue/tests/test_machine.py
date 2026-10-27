import json
import pathlib
import tempfile
import unittest
from unittest import mock

from soirely_queue import machine


def login(folder, email="owner@example.test"):
    """A Claude config folder that looks logged in, as `account` reads it: no real token."""
    folder = pathlib.Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / ".claude.json").write_text(json.dumps({"oauthAccount": {"emailAddress": email}}))
    (folder / ".credentials.json").write_text("{}")
    return folder


def config(root, **changes):
    login(pathlib.Path(root) / "claude")
    base = {"machine": "here", "workspace": str(root), "mainCheckout": "festivo",
            "claudeConfigDir": str(pathlib.Path(root) / "claude"),
            "roles": {"ops": {}, "dev2": {}},
            "defaults": {"model": "claude-opus-5-5", "effort": "medium", "memoryMax": "3G",
                         "maxRuntime": "90m", "maxBudgetUsd": None}}
    base.update(changes)
    return base


class Checked(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.folder.name)
        for name in ("festivo", "soirely-ops", "soirely-dev2"):
            (self.root / name).mkdir()

    def tearDown(self):
        self.folder.cleanup()

    def test_the_default_comes_from_the_file(self):
        errors, refused, ready = machine.check(config(self.root))
        self.assertEqual((errors, refused), ([], {}))
        self.assertEqual(ready["ops"]["model"], "claude-opus-5-5")
        self.assertEqual(ready["ops"]["effort"], "medium")

    def test_a_role_overrides_only_what_it_names(self):
        changed = config(self.root, roles={"ops": {"effort": "high"}, "dev2": {}})
        ready = machine.check(changed)[2]
        self.assertEqual((ready["ops"]["model"], ready["ops"]["effort"]),
                         ("claude-opus-5-5", "high"))
        self.assertEqual(ready["dev2"]["effort"], "medium")

    def test_an_alias_or_unknown_model_refuses_that_role_only(self):
        changed = config(self.root, roles={"ops": {"model": "opus"}, "dev2": {}})
        errors, refused, ready = machine.check(changed)
        self.assertEqual(errors, [])
        self.assertIn("model 'opus' is not one sq accepts", refused["ops"])
        self.assertIn("claude-opus-5-5", refused["ops"])
        self.assertIn("dev2", ready)

    def test_comment_runs_take_medium_unless_a_role_or_the_defaults_say_otherwise(self):
        ready = machine.check(config(self.root, roles={"ops": {"effort": "xhigh"}}))[2]
        self.assertEqual(ready["ops"]["inboxEffort"], "medium")
        set_by_default = config(self.root, roles={"ops": {}, "dev2": {"inboxEffort": "low"}})
        set_by_default["defaults"]["inboxEffort"] = "high"
        ready = machine.check(set_by_default)[2]
        self.assertEqual((ready["ops"]["inboxEffort"], ready["dev2"]["inboxEffort"]),
                         ("high", "low"))
        self.assertEqual(machine.effort_for({"effort": "xhigh", "inboxEffort": "medium"},
                                            "inbox"), "medium")
        self.assertEqual(machine.effort_for({"effort": "xhigh", "inboxEffort": "medium"},
                                            "story"), "xhigh")

    def test_an_inbox_effort_the_model_does_not_take_is_refused(self):
        refused = machine.check(config(self.root, roles={"ops": {"inboxEffort": "lots"}}))[1]
        self.assertIn("inboxEffort 'lots' is not one claude-opus-5-5 takes", refused["ops"])

    def test_an_effort_the_model_does_not_take_is_refused(self):
        changed = config(self.root, roles={"ops": {"effort": "extreme"}})
        refused = machine.check(changed)[1]
        self.assertIn("effort 'extreme' is not one claude-opus-5-5 takes", refused["ops"])

    def test_a_missing_default_stops_every_role(self):
        changed = config(self.root, defaults={"memoryMax": "3G", "maxRuntime": "90m"})
        errors = machine.check(changed)[0]
        self.assertIn("no default model or effort", errors[0])

    def test_no_claude_folder_stops_every_role(self):
        changed = config(self.root)
        changed.pop("claudeConfigDir")
        errors = machine.check(changed)[0]
        self.assertIn("no claudeConfigDir", errors[0])

    def test_claudes_own_folder_keeps_its_account_beside_it(self):
        own = self.root / "home" / ".claude"
        own.mkdir(parents=True)
        (own / ".credentials.json").write_text("{}")
        (own.parent / ".claude.json").write_text(
            json.dumps({"oauthAccount": {"emailAddress": "owner@example.test"}}))
        with mock.patch.object(machine, "CLAUDE_DEFAULT", own), \
                mock.patch.object(machine.sys, "platform", "linux"):
            self.assertEqual(machine.account(own), "owner@example.test")
            changed = config(self.root, claudeConfigDir=str(own))
            self.assertIn("ops", machine.check(changed)[2])

    def test_no_workspace_is_an_error(self):
        errors = machine.check(config(self.root, workspace=None))[0]
        self.assertIn("no workspace", errors[0])

    def test_an_unknown_role_is_an_error(self):
        errors = machine.check(config(self.root, roles={"dev9": {}}))[0]
        self.assertIn("unknown role dev9", errors[0])

    def test_every_machine_runs_ops_but_a_file_without_it_stops_only_ops(self):
        errors, refused, _ = machine.check(config(self.root, roles={"lead": {}}))
        self.assertEqual(errors, [])
        self.assertTrue(refused["ops"].startswith("not listed in"))

    def test_the_ops_refusal_ends_with_the_machine_or_the_host_name(self):
        named = machine.check(config(self.root, machine="tolu-mac", roles={"lead": {}}))[1]
        self.assertEqual(named["ops"], f"not listed in {machine.path()}: every machine runs ops, "
                         "for its own disk, Docker, stacks and manager (ops@tolu-mac)")
        with mock.patch("socket.gethostname", return_value="tolu-linux"):
            unnamed = machine.check(config(self.root, machine=None, roles={"lead": {}}))[1]
        self.assertTrue(unnamed["ops"].endswith("(ops@tolu-linux)"), unnamed["ops"])

    def test_a_missing_checkout_is_refused_by_its_path(self):
        refused = machine.check(config(self.root, roles={"lead": {}}))[1]
        self.assertEqual(refused["lead"], f"no checkout at {self.root / 'soirely-lead'}")

    def test_developer_1_works_in_the_main_checkout(self):
        self.assertEqual(machine.checkout(config(self.root), "dev"), self.root / "festivo")
        own = config(self.root, roles={"ux": {"checkout": "~/design/ux"}})
        self.assertEqual(machine.checkout(own, "ux"), pathlib.Path("~/design/ux").expanduser())

    def test_no_runtime_anywhere_still_stops_a_worker_at_90_minutes(self):
        changed = config(self.root)
        changed["defaults"].pop("maxRuntime")
        self.assertEqual(machine.check(changed)[2]["ops"]["maxRuntime"], "90m")

    def test_a_role_wakes_every_three_minutes_unless_told_otherwise(self):
        changed = config(self.root, roles={"ops": {}, "bm": {"wakeEvery": "1h"}})
        self.assertEqual(machine.settings(changed, "ops")["wakeEvery"], "3m")
        self.assertEqual(machine.settings(changed, "bm")["wakeEvery"], "1h")

    def test_the_testers_start_with_more_memory(self):
        changed = config(self.root, roles={"qa2": {}, "qa3": {"memoryMax": "12G"}})
        self.assertEqual(machine.settings(changed, "qa2")["memoryMax"], "8G")
        self.assertEqual(machine.settings(changed, "qa3")["memoryMax"], "12G")
        self.assertEqual(machine.settings(changed, "ops")["memoryMax"], "3G")

    def test_a_role_runs_under_its_own_account(self):
        other = login(self.root / "claude-b", "second@example.test")
        changed = config(self.root, roles={"ops": {}, "dev2": {"claudeConfigDir": str(other)}})
        self.assertEqual(machine.claude_dir(changed, "dev2"), other)
        self.assertEqual(machine.claude_dir(changed, "ops"), self.root / "claude")
        self.assertEqual(machine.account(other), "second@example.test")
        self.assertIn("dev2", machine.check(changed)[2])

    def test_a_folder_with_no_login_refuses_only_its_roles(self):
        changed = config(self.root, roles={"ops": {}, "dev2": {
            "claudeConfigDir": str(self.root / "claude-empty")}})
        errors, refused, ready = machine.check(changed)
        self.assertIn(f"no Claude login in {self.root / 'claude-empty'}", refused["dev2"])
        self.assertIn("ops", ready)

    def test_without_its_credentials_file_a_linux_folder_is_not_logged_in(self):
        folder = login(self.root / "half")
        (folder / ".credentials.json").unlink()
        with mock.patch.object(machine.sys, "platform", "linux"):
            self.assertIsNone(machine.account(folder))
        with mock.patch.object(machine.sys, "platform", "darwin"):
            self.assertEqual(machine.account(folder), "owner@example.test")

    def test_bad_limits_are_refused(self):
        changed = config(self.root, roles={"ops": {"memoryMax": "lots", "maxRuntime": "soon",
                                                   "maxBudgetUsd": -1, "wakeEvery": "0m"}})
        refused = machine.check(changed)[1]["ops"]
        for field in ("memoryMax", "maxRuntime", "maxBudgetUsd", "wakeEvery"):
            self.assertIn(field, refused)

    def test_machine_wide_limits_are_checked(self):
        changed = config(self.root, onVersionDrift="halt", dailyBudgetUsd="ten", minFreeGb=-1,
                         sliceMemoryMax="plenty")
        errors = " ".join(machine.check(changed)[0])
        for field in ("onVersionDrift", "dailyBudgetUsd", "minFreeGb", "sliceMemoryMax"):
            self.assertIn(field, errors)

    def test_the_workers_share_16G_unless_the_file_says_otherwise(self):
        self.assertEqual(machine.slice_memory(config(self.root)), "16G")
        self.assertEqual(machine.slice_memory(config(self.root, sliceMemoryMax="28G")), "28G")
        self.assertEqual(machine.slice_memory(config(self.root, sliceMemoryMax="plenty")), "16G")

    def test_a_dearer_model_is_pointed_out(self):
        note = machine.price_note("lead", "claude-fable-5-1", config(self.root))
        self.assertEqual(note, "lead runs claude-fable-5-1, 2.5× the default per token")
        self.assertIsNone(machine.price_note("lead", "claude-sonnet-5-5", config(self.root)))


class Workspace(unittest.TestCase):
    def test_the_answer_is_checked_and_saved(self):
        with tempfile.TemporaryDirectory() as folder, \
                mock.patch.dict("os.environ", {"SOIRELY_CONFIG": folder}):
            answers = iter([folder, "y"])
            said = []
            saved = machine.ask_workspace({"roles": {"ops": {}}}, lambda _: next(answers),
                                          said.append)
            self.assertEqual(saved["workspace"], folder)
            self.assertEqual(machine.load()["workspace"], folder)
            self.assertIn("for the 1 roles", said[0])

    def test_a_path_that_is_not_there_is_offered_for_creation(self):
        with tempfile.TemporaryDirectory() as folder, \
                mock.patch.dict("os.environ", {"SOIRELY_CONFIG": folder}):
            wanted = pathlib.Path(folder) / "agents"
            answers = iter([str(wanted), "y", "y"])
            machine.ask_workspace({"roles": {}}, lambda _: next(answers), lambda _: None)
            self.assertTrue(wanted.is_dir())
