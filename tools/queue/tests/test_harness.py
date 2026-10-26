"""A tester's copy of the QA harness follows `main` at each start, only on a green `main`."""

import pathlib
import subprocess
import tempfile
import unittest

from soirely_queue import harness, store

MAIN_HARNESS = "console.log('main');\n"


def git(path, *args):
    return subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True,
                          check=True).stdout.strip()


class Refresh(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.folder.name)
        git(self.path, "init", "--quiet", "-b", "main")
        (self.path / "scripts").mkdir()
        (self.path / "scripts" / "qa-env.mjs").write_text(MAIN_HARNESS)
        git(self.path, "add", ".")
        git(self.path, "-c", "user.name=t", "-c", "user.email=t@example.test", "-c",
            "commit.gpgsign=false", "commit",
            "--quiet", "-m", "main")
        self.main = git(self.path, "rev-parse", "HEAD")
        self.copy = self.path / ".qa" / "bin" / "qa-env.mjs"
        self.copy.parent.mkdir(parents=True)
        self.copy.write_text(MAIN_HARNESS + "// stale\n")
        self.copy.chmod(0o755)
        self.db = store.connect(":memory:")

    def tearDown(self):
        self.folder.cleanup()

    def runs(self, conclusion):
        store.set_meta(self.db, "main_runs", [{"headSha": self.main, "conclusion": conclusion}])

    def test_a_stale_copy_on_a_green_main_is_replaced(self):
        self.runs("success")
        line = harness.refresh(self.db, self.path, self.main)
        self.assertEqual(line, "Your QA harness (.qa/bin/qa-env.mjs) was updated to main at "
                               f"{self.main[:7]}.")
        self.assertEqual(self.copy.read_text(), MAIN_HARNESS)
        self.assertEqual(self.copy.stat().st_mode & 0o777, 0o755)
        self.assertFalse(self.copy.with_name("qa-env.mjs.new").exists())

    def test_the_copy_comes_from_main_not_the_checked_out_files(self):
        (self.path / "scripts" / "qa-env.mjs").write_text("console.log('old commit');\n")
        self.runs("success")
        harness.refresh(self.db, self.path, self.main)
        self.assertEqual(self.copy.read_text(), MAIN_HARNESS)

    def test_a_red_main_keeps_the_copy_and_says_why(self):
        self.runs("failure")
        line = harness.refresh(self.db, self.path, self.main)
        self.assertIn(f"main at {self.main[:7]} changes it, but CI has not passed it", line)
        self.assertTrue(self.copy.read_text().endswith("// stale\n"))

    def test_a_main_ci_has_not_finished_keeps_the_copy(self):
        line = harness.refresh(self.db, self.path, self.main)
        self.assertIn("CI has no result for it yet", line)
        self.assertTrue(self.copy.read_text().endswith("// stale\n"))

    def test_a_copy_already_on_main_is_left_alone_without_a_line(self):
        self.copy.write_text(MAIN_HARNESS)
        self.assertIsNone(harness.refresh(self.db, self.path, self.main))

    def test_no_copy_means_no_install(self):
        self.copy.unlink()
        self.runs("success")
        self.assertIsNone(harness.refresh(self.db, self.path, self.main))
        self.assertFalse(self.copy.exists())

    def test_a_main_that_cannot_be_read_keeps_the_copy(self):
        self.runs("success")
        line = harness.refresh(self.db, self.path, "f" * 40)
        self.assertIn("was kept: main at fffffff could not be read", line)
        self.assertTrue(self.copy.read_text().endswith("// stale\n"))

    def test_a_copy_that_cannot_be_replaced_stays_whole(self):
        self.runs("success")
        self.copy.parent.chmod(0o555)
        try:
            line = harness.refresh(self.db, self.path, self.main)
        finally:
            self.copy.parent.chmod(0o755)
        self.assertIn("was kept: it could not be replaced", line)
        self.assertTrue(self.copy.read_text().endswith("// stale\n"))


if __name__ == "__main__":
    unittest.main()
