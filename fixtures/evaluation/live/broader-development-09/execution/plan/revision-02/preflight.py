"""Read-only prospective guards. This script never imports/runs the pipeline or uses keys/network."""
from pathlib import Path
import argparse, hashlib, json, os, re, subprocess

BASE = Path(__file__).resolve().parent.parent
PLAN = json.loads((BASE / 'plan.json').read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
read = lambda path: json.loads(Path(path).read_text())
exists = lambda path: os.path.lexists(str(path))

def verify_inputs():
    assert sha(Path(PLAN['fullManifestPath'])) == PLAN['fullManifestSHA256']
    assert sha(Path(PLAN['wrapperPath'])) == PLAN['wrapperSHA256']
    assert Path(PLAN['tsxPath']).is_file()
    full = read(PLAN['fullManifestPath'])
    assert full['kind'] == 'open_development' and len(full['cases']) == 16
    actual = []
    for batch in PLAN['batches']:
        path = Path(batch['manifestPath'])
        assert sha(path) == batch['manifestSHA256']
        data = read(path)
        assert data['kind'] == 'open_development' and len(data['cases']) == 4
        assert [case['label'] for case in data['cases']] == batch['labels']
        assert sum(len(case['expected']['claims']) for case in data['cases']) == batch['eligiblePublicOccurrences']
        actual.extend(data['cases'])
    assert actual == full['cases'][:3] + [full['cases'][12]] + full['cases'][3:6] + [full['cases'][13]] + full['cases'][6:9] + [full['cases'][14]] + full['cases'][9:12] + [full['cases'][15]]
    assert len({case['label'] for case in actual}) == 16
    assert sum(len(case['expected']['claims']) for case in actual) == 13
    for root in map(Path, PLAN['protectedPackages']):
        for line in (root / 'SHA256SUMS').read_text().splitlines():
            expected, relative = line.split('  ', 1)
            assert sha(root / relative) == expected, f'Protected artifact changed: {relative}'
    return full

def verify_freeze():
    path = Path(PLAN['candidateFreezeArtifact'])
    assert path.is_file(), 'No candidate09 freeze artifact; do not freeze before the #20 fix is ready.'
    assert sha(path) == PLAN['sourceFreezeArtifactSHA256'], 'Frozen declaration bytes differ from finalized plan.'
    freeze = read(path)
    assert freeze['commit'] == PLAN['candidateCommit']
    assert freeze['sourceSHA256'] == PLAN['candidateSourceSHA256']
    assert freeze['status'] == 'ready_for_open_development'
    assert freeze['targetFailureFixReady'] is True
    assert freeze['richerContainedHighlightFixReady'] is True
    assert freeze['sourceTreeClean'] is True and freeze['checkedExecutableCodeMatchesFreeze'] is True
    assert re.fullmatch('[a-f0-9]{40}', freeze['commit'])
    assert re.fullmatch('[a-f0-9]{64}', freeze['sourceSHA256'])
    assert freeze['wrapperSHA256'] == PLAN['wrapperSHA256']
    assert freeze['manifestSHA256'] == PLAN['fullManifestSHA256']
    assert isinstance(freeze['check']['tests'], int) and freeze['check']['tests'] > 0
    assert sha(Path(PLAN['requiredFutureLogs']['install'])) == freeze['freshInstallLogSHA256']
    assert sha(Path(PLAN['requiredFutureLogs']['check'])) == freeze['check']['logSHA256']
    assert sha(Path(PLAN['requiredFutureLogs']['evaluate'])) == freeze['evaluate']['logSHA256']
    counts = freeze['evaluate']['counts']
    assert counts['selected'] == counts['passed'] == 36
    assert counts['failed'] == counts['notRun'] == 0 and counts['heldoutReserved'] == 12
    assert freeze['evaluate']['presentation'] == {'passed': 21, 'total': 21}
    source = Path(PLAN['candidateFreezePath'])
    git = lambda args: subprocess.check_output(['git', *args], cwd=source).decode()
    assert git(['rev-parse', 'HEAD']).strip() == freeze['commit']
    assert not git(['status', '--porcelain', '--untracked-files=normal']).strip()
    paths = sorted(p for p in git(['ls-files', '-z', '--', 'apps/console', 'services/api', 'packages/contracts', 'package.json', 'package-lock.json']).split('\0') if p)
    digest = hashlib.sha256()
    for name in paths:
        digest.update(name.encode()); digest.update(b'\0'); digest.update((source / name).read_bytes()); digest.update(b'\0')
    assert digest.hexdigest() == freeze['sourceSHA256']
    return freeze

def verify_preview(batch, freeze):
    preview_path = Path(batch['previewPath'])
    if not exists(preview_path):
        return False
    preview = read(preview_path)
    assert preview['kind'] == 'open_development_batch_plan'
    assert preview['commit'] == freeze['commit'] and preview['sourceSHA256'] == freeze['sourceSHA256']
    assert preview['manifestSHA256'] == batch['manifestSHA256']
    assert preview['limits'] == PLAN['limitsPerBatch']
    source_cases = read(batch['manifestPath'])['cases']
    assert [case['label'] for case in preview['cases']] == batch['labels']
    for declared, original in zip(preview['cases'], source_cases):
        assert declared['allowedPublic'] == original['allowedPublic']
        assert declared['automatic'] == original['automatic'] and declared['final'] == original['final']
        assert 'text' not in declared and 'expected' not in declared
    return True

def verify_completed_batch(batch, freeze):
    report = read(batch['outputPath'])
    assert report['completed'] is True
    assert report['metadata']['commit'] == freeze['commit']
    assert report['metadata']['sourceSHA256'] == freeze['sourceSHA256']
    assert report['metadata']['dirty'] is False
    assert report['wrapperSHA256'] == PLAN['wrapperSHA256']
    assert report['batchManifestSHA256'] == batch['manifestSHA256']
    assert report['limits'] == PLAN['limitsPerBatch']
    assert report['counts']['declared'] == report['counts']['observed'] == report['counts']['terminalReceipts'] == 4
    assert [case['label'] for case in report['cases']] == batch['labels']
    assert report['counts']['localStops'] == report['counts']['transportFailures'] == 0
    assert not report.get('transportFailure')
    assert report['totals']['unknownInputTokenReservations'] == report['totals']['pendingDispatchReservations'] == 0
    for kind, cap in PLAN['limitsPerBatch']['calls'].items():
        assert report['totals']['calls'][kind] <= cap
    for key in ['unauthorizedJoinStatus', 'unauthorizedCheckStatus', 'unauthorizedWebsocketStatus']:
        assert report['auth'][key] == 401, 'Negative authorization probe must reject.'
    assert report['totals']['chargedInputTokens'] <= PLAN['limitsPerBatch']['inputTokens']
    assert report['totals']['requestBytes'] <= PLAN['limitsPerBatch']['totalRequestBytes']
    assert report['totals']['elapsedMs'] <= PLAN['limitsPerBatch']['wallMs']
    assert Path(batch['journalPath']).is_file() and not exists(batch['checkpointPath'])
    for case in report['cases']:
        assert case['localStops'] == []
        assert not case.get('mismatch') and not case.get('deterministicPublicIssues')
        for attempt in case['attempts']:
            assert attempt.get('status') != 401, 'Provider authentication failure: stop remaining dispatch.'
        for event in case['events']:
            if event['type'].endswith('.error'):
                reason = event.get('reasonCode', '').lower()
                assert 'auth' not in reason and '401' not in reason
    # A completed, accounted ordinary operational error is preserved and does not
    # become an abstention or replacement case. Factual success is not a continuation guard.
    return report

def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--inputs-only', action='store_true')
    group.add_argument('--before-batch', type=int, choices=range(1, 5))
    parser.add_argument('--require-preview', action='store_true')
    args = parser.parse_args()
    verify_inputs()
    freeze = None if args.inputs_only else verify_freeze()
    current = args.before_batch or 1
    for batch in PLAN['batches']:
        if batch['batch'] < current:
            verify_completed_batch(batch, freeze)
        else:
            assert os.access(Path(batch['outputPath']).parent, os.W_OK)
            for key in ['outputPath', 'journalPath', 'checkpointPath']:
                assert not exists(batch[key]), f'Existing output/checkpoint; never overwrite or replay: {batch[key]}'
            if freeze:
                has_preview = verify_preview(batch, freeze)
                if args.require_preview and batch['batch'] == current:
                    assert has_preview, 'Record and validate the plan-only wrapper output before live dispatch.'
    print(json.dumps({'kind': 'read_only_candidate09_preflight', 'inputsVerified': True, 'futureFreezeVerified': bool(freeze), 'beforeBatch': args.before_batch, 'providerCalls': 0, 'pipelineImported': False, 'filesModified': 0}, indent=2))

if __name__ == '__main__':
    main()
