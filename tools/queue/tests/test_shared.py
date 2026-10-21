"""Leases, claims, heartbeats and the everywhere pause, between two pretend machines."""

import os
import subprocess
import unittest
from unittest import mock

from soirely_queue import shared, store

from .fakes import FakeRefs

NOW = 1_000_000


def config(machine, roles=("ops", "dev"), standby=()):
    return {"machine": machine,
            "roles": {role: ({"standby": True} if role in standby else {}) for role in roles}}


class Machine:
    """One machine's side: its own queue file, and the shared references."""

    def __init__(self, remote, name, roles=("ops", "dev"), standby=(), busy=()):
        self.remote, self.db = remote, store.connect(":memory:")
        self.config = config(name, roles, standby)
        self.busy = set(busy)

    def minute(self, now=NOW, started=None, holding=()):
        started = set(self.config["roles"]) if started is None else set(started)
        return shared.reconcile(self.remote, self.db, self.config, started,
                                lambda role: role in self.busy, set(holding), now)


class Leases(unittest.TestCase):
    def setUp(self):
        self.remote = FakeRefs()
        self.linux = Machine(self.remote, "tolu-linux")
        self.mac = Machine(self.remote, "tolu-mac")

    def test_the_first_machine_takes_a_role_and_the_second_is_told_where_it_runs(self):
        _, mine, _ = self.linux.minute()
        self.assertEqual(mine, {"ops", "dev"})
        _, mine, elsewhere = self.mac.minute(NOW + 20)
        self.assertEqual(mine, set())
        self.assertEqual(elsewhere["dev"], ("tolu-linux", 20))

    def test_a_machine_that_stops_beating_loses_its_roles_after_five_minutes(self):
        self.linux.minute()
        _, mine, _ = self.mac.minute(NOW + 4 * 60)
        self.assertEqual(mine, set())
        _, mine, _ = self.mac.minute(NOW + 6 * 60)
        self.assertEqual(mine, {"ops", "dev"})
        self.assertEqual(self.remote.data(shared.role_ref("dev"))["machine"], "tolu-mac")

    def test_two_machines_taking_one_lapsed_role_cannot_both_win(self):
        self.remote.create(shared.role_ref("dev"), shared.record(
            "role", role="dev", machine="gone", at=NOW - 3600))
        view = shared.read(self.remote, self.mac.db, "tolu-mac", NOW)
        rival = shared.read(self.remote, self.linux.db, "tolu-linux", NOW)
        mine, _ = shared.leases(self.remote, view, self.mac.config, {"dev"}, lambda r: False)
        theirs, elsewhere = shared.leases(self.remote, rival, self.linux.config, {"dev"},
                                          lambda r: False)
        self.assertEqual((mine, theirs), ({"dev"}, set()))
        self.assertIn("dev", elsewhere)

    def test_a_stopped_role_is_given_back(self):
        self.linux.minute()
        self.linux.minute(NOW + 60, started={"ops"})
        self.assertNotIn(shared.role_ref("dev"), self.remote.refs)
        _, mine, _ = self.mac.minute(NOW + 70)
        self.assertEqual(mine, {"dev"})

    def test_a_standby_machine_hands_a_role_back_once_its_worker_is_done(self):
        standby = Machine(self.remote, "tolu-mac", standby=("dev",), busy={"dev"})
        _, mine, _ = standby.minute()
        self.assertIn("dev", mine)
        self.linux.minute(NOW + 60)
        _, mine, _ = standby.minute(NOW + 70)
        self.assertIn("dev", mine)
        standby.busy.clear()
        _, mine, elsewhere = standby.minute(NOW + 130)
        self.assertNotIn("dev", mine)
        self.assertEqual(elsewhere["dev"][0], "tolu-linux")
        _, mine, _ = self.linux.minute(NOW + 140)
        self.assertIn("dev", mine)

    def test_a_standby_never_takes_a_role_its_first_choice_machine_wants(self):
        self.linux.minute(started={"ops"})
        self.remote.beat("tolu-linux", NOW, started={"ops", "dev"})
        standby = Machine(self.remote, "tolu-mac", standby=("dev",))
        _, mine, _ = standby.minute(NOW + 10)
        self.assertNotIn("dev", mine)

    def test_a_role_listed_on_two_machines_without_standby_is_a_conflict(self):
        self.linux.minute()
        self.mac.minute(NOW + 10)
        self.assertIn(["dev", "tolu-linux"],
                      [list(c) for c in store.get_meta(self.mac.db, "shared_view")["conflicts"]])

    def test_records_are_read_once(self):
        self.linux.minute()
        before = self.remote.calls
        self.mac.minute(NOW + 10)
        first = self.remote.calls - before
        before = self.remote.calls
        self.mac.minute(NOW + 20)
        self.assertLess(self.remote.calls - before, first)


class Claims(unittest.TestCase):
    def setUp(self):
        self.remote = FakeRefs()
        self.linux = Machine(self.remote, "tolu-linux", roles=("ops", "qa"))
        self.mac = Machine(self.remote, "tolu-mac", roles=("ops", "qa2"))

    def test_a_shared_story_goes_to_one_machine(self):
        view, _, _ = self.linux.minute()
        self.assertTrue(shared.claim_item(self.remote, view, "qa", "sc-5", "qa"))
        view, _, _ = self.mac.minute(NOW + 10, holding=())
        self.assertIn(("qa", "sc-5"), view.taken_elsewhere())
        self.assertFalse(shared.claim_item(self.remote, view, "qa", "sc-5", "qa2"))
        self.assertTrue(shared.claim_item(self.remote, view, "dev", "sc-5", "qa2"))

    def test_a_claim_outlives_its_quiet_machine_and_lapses_only_after_ninety_minutes(self):
        view, _, _ = self.linux.minute()
        shared.claim_item(self.remote, view, "qa", "sc-5", "qa")
        view, _, _ = self.mac.minute(NOW + 6 * 60)
        self.assertIn(("qa", "sc-5"), view.taken_elsewhere())
        self.assertFalse(shared.claim_item(self.remote, view, "qa", "sc-5", "qa2"))
        view, _, _ = self.mac.minute(NOW + 91 * 60)
        self.assertTrue(shared.claim_item(self.remote, view, "qa", "sc-5", "qa2"))

    def test_a_finished_story_is_given_back(self):
        view, _, _ = self.linux.minute()
        shared.claim_item(self.remote, view, "qa", "sc-5", "qa")
        self.linux.minute(NOW + 60, holding={("qa", "sc-5")})
        self.assertIn(shared.claim_ref("qa", "sc-5"), self.remote.refs)
        self.linux.minute(NOW + 120, holding=())
        self.assertNotIn(shared.claim_ref("qa", "sc-5"), self.remote.refs)


class Offline(unittest.TestCase):
    """The lead's case on #279: the Linux box loses GitHub for six minutes while its
    developer builds a story, and the Mac takes the developer's lease."""

    def test_a_role_taken_over_never_runs_the_story_twice(self):
        remote = FakeRefs()
        linux = Machine(remote, "tolu-linux", roles=("ops", "dev2"), busy={"dev2"})
        mac = Machine(remote, "tolu-mac", roles=("ops", "dev2"), standby=("dev2",))
        view, mine, _ = linux.minute()
        self.assertIn("dev2", mine)
        self.assertTrue(shared.claim_item(remote, view, "dev2", "sc-9", "dev2"))
        # Linux is offline from here, its worker still building sc-9.
        view, mine, _ = mac.minute(NOW + 6 * 60)
        self.assertIn("dev2", mine)
        self.assertFalse(shared.claim_item(remote, view, "dev2", "sc-9", "dev2"))
        self.assertTrue(shared.claim_item(remote, view, "dev2", "sc-10", "dev2"))
        # Back online with the worker still running: its claim is kept, the lease is not.
        view, mine, elsewhere = linux.minute(NOW + 7 * 60, holding={("dev2", "sc-9")})
        self.assertNotIn("dev2", mine)
        self.assertEqual(elsewhere["dev2"][0], "tolu-mac")
        self.assertEqual(remote.data(shared.claim_ref("dev2", "sc-9"))["machine"], "tolu-linux")


class Pause(unittest.TestCase):
    def test_a_pause_everywhere_is_seen_by_every_machine_and_lifted_once(self):
        remote = FakeRefs()
        self.assertTrue(shared.pause_everywhere(remote, "tolu-mac", NOW))
        self.assertFalse(shared.pause_everywhere(remote, "tolu-linux", NOW))
        view, _, _ = Machine(remote, "tolu-linux").minute()
        self.assertEqual(view.paused()["machine"], "tolu-mac")
        shared.resume_everywhere(remote)
        view, _, _ = Machine(remote, "tolu-linux").minute(NOW + 60)
        self.assertIsNone(view.paused())

    def test_the_tree_is_read_from_sqs_repository_wherever_the_tick_starts(self):
        found = subprocess.CompletedProcess([], 0, stdout="5a86d09\n")
        with mock.patch.object(shared.subprocess, "run", return_value=found) as run:
            self.assertEqual(shared.GitHubRefs().tree(), "5a86d09")
        argv = run.call_args.args[0]
        self.assertEqual(argv[:2], ["git", "-C"])
        self.assertEqual(argv[2], os.path.dirname(os.path.abspath(shared.__file__)))

    def test_a_machine_name_becomes_a_safe_reference(self):
        self.assertEqual(shared.machine_ref("Tolu's MacBook Pro"),
                         "refs/soirely/machines/Tolu-s-MacBook-Pro")
