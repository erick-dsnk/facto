import tempfile
import unittest
from pathlib import Path

from generalized_run import REDDIT_SAMPLES, REPO_ROOT, samples


class GeneralizedRunnerPortabilityTests(unittest.TestCase):
    def test_sample_paths_come_from_explicit_input_and_cache_roots(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            original = root / 'original photos'
            reddit = root / 'reddit photos'
            baseline = root / 'raw cache'
            reddit_baseline = root / 'reddit cache'

            cases = samples(original, reddit, baseline, reddit_baseline)

            self.assertEqual(len(cases), 11)
            self.assertEqual(cases[0][0], original / 'WhatsApp Image 2026-11-15 at 01.14.07.jpeg')
            self.assertEqual(cases[0][2], baseline / '01' / 'result.json')
            self.assertEqual(cases[9][0], reddit / REDDIT_SAMPLES[0][0])
            self.assertEqual(cases[9][2], reddit_baseline / '01' / 'result.json')
            self.assertTrue(cases[9][1]['targets'][0]['ambiguous'] is False)
            self.assertTrue(cases[10][1]['targets'][0]['ambiguous'])

    def test_repository_metadata_is_resolved_from_script_location(self):
        self.assertEqual(REPO_ROOT, Path(__file__).resolve().parents[2])
        self.assertTrue((REPO_ROOT / 'tools/ocr_experiment/ground_truth.json').is_file())


if __name__ == '__main__':
    unittest.main()
