"""The unit text and the worker command, with systemd itself never called."""

import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock

from soirely_queue import systemd

VALUES = {"maxRuntimeMinutes": 90, "memoryMax": "3G"}


class Units(unittest.TestCase):
    def test_the_timer_fires_every_minute_and_runs_sq(self):
        made = systemd.units("/q/sq/sq", "/c/env", "/usr/bin/python3")
        self.assertIn("OnCalendar=minutely", made["soirely-routine.timer"])
        service = made["soirely-routine.service"]
        self.assertIn("Type=oneshot", service)
        self.assertIn("EnvironmentFile=-/c/env", service)
        self.assertIn("ExecStart=/usr/bin/python3 /q/sq/sq run", service)
        self.assertIn("MemoryMax=16G", made["soirely.slice"])

    def test_workers_find_nvms_node_ahead_of_every_other(self):
        with mock.patch.object(systemd.machine, "tool_folders", return_value=["/nvm/v22/bin"]), \
                mock.patch("shutil.which", side_effect=lambda tool, **_: f"/usr/bin/{tool}"):
            self.assertEqual(systemd.search_path(), "/nvm/v22/bin:/usr/bin:/usr/local/bin:/bin")

    def test_the_slice_takes_the_machines_cap(self):
        made = systemd.units("/q/sq/sq", "/c/env", slice_memory="28G")
        self.assertIn("MemoryMax=28G", made["soirely.slice"])

    def test_the_token_is_read_from_the_file_never_written_into_a_unit(self):
        with mock.patch.dict("os.environ", {"SHORTCUT_API_TOKEN": "secret-value"}):
            made = systemd.units("/q/sq/sq", "/c/env")
        self.assertFalse(any("secret-value" in text for text in made.values()))


class Install(unittest.TestCase):
    def installed_slice(self, config=None):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            if config is not None:
                (root / "agents.json").write_text(json.dumps(config))
            with mock.patch.dict("os.environ", {"SOIRELY_CONFIG": folder,
                                                "XDG_CONFIG_HOME": folder}), \
                    mock.patch.object(systemd, "systemctl"):
                systemd.Linux().install("/q/sq/sq", "/c/env", "python3")
            return (root / "systemd" / "user" / "soirely.slice").read_text()

    def test_the_slice_is_capped_by_sliceMemoryMax(self):
        self.assertIn("MemoryMax=28G", self.installed_slice({"sliceMemoryMax": "28G"}))

    def test_without_the_setting_or_the_file_the_cap_is_16G(self):
        self.assertIn("MemoryMax=16G", self.installed_slice({}))
        self.assertIn("MemoryMax=16G", self.installed_slice())


class Launch(unittest.TestCase):
    def launched(self, values=VALUES):
        with mock.patch("subprocess.run") as run:
            systemd.Linux().launch("dev2", 41, values, "/q/sq/sq", "python3", "/w/dev2",
                                   "/c/env")
        return run.call_args.args[0]

    def test_a_worker_is_its_own_capped_unit_in_the_slice(self):
        argv = self.launched()
        self.assertEqual(argv[:2], ["systemd-run", "--user"])
        for part in ("--unit=soirely-worker-dev2", "--slice=soirely.slice",
                     "--working-directory=/w/dev2", "--property=RuntimeMaxSec=90min",
                     "--property=MemoryMax=3G", "--setenv=SOIRELY_WORKER=dev2",
                     "--property=ExecStopPost=python3 /q/sq/sq worker-ended dev2 41"):
            self.assertIn(part, argv)
        self.assertEqual(argv[argv.index("--"):], ["--", "python3", "/q/sq/sq", "worker",
                                                   "dev2", "41"])

    def test_no_memory_cap_when_none_is_set(self):
        argv = self.launched({"maxRuntimeMinutes": 30, "memoryMax": None})
        self.assertFalse([a for a in argv if a.startswith("--property=MemoryMax")])

    def test_a_failed_start_raises_so_the_item_goes_back(self):
        with mock.patch("subprocess.run",
                        side_effect=subprocess.CalledProcessError(1, "systemd-run")):
            with self.assertRaises(subprocess.CalledProcessError):
                systemd.Linux().launch("ops", 1, VALUES, "sq", "python3", "/w", "/c/env")
