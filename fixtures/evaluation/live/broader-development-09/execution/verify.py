"""Read-only candidate09 execution verification. Standard library; no network."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parent
read = lambda name: json.loads((ROOT / name).read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()


def verify(originals=False, content_only=False):
    copied = read('COPY_MAP.json')['files']
    for item in copied:
        path = ROOT / item['path']
        assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], item['path']
        if originals:
            assert sha(Path(item['originalPath'])) == item['sha256'], item['originalPath']
    if not content_only:
        for item in read('MANIFEST.json')['files']:
            path = ROOT / item['path']
            assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], item['path']
    freeze = read('freeze/candidate09-freeze.json')
    assert freeze['commit'] == '9a5e80d88bd1d93e4a1c194d23bc1a59662af135'
    assert freeze['sourceSHA256'] == '9de0531baa85af7bac2d1940b28c91136dce6c455bcafe24e3cf7b1d8739f9ad'
    assert sha(ROOT / 'freeze/candidate09-freeze.json') == 'f12a85c3a308882c52e9c4f271cea80ae0479ba49a29a5fc0f2951d28ea0cdf1'
    manifest = read('inputs/live-manifest.json')
    expected = {case['label']: case for case in manifest['cases']}
    allowlist = read('reference-code/retrieval-text-allowlist.json')
    public = {case['label']: case['publicSpans'] for case in allowlist['cases']}
    reports = [read(f'runs/batch-{n:02}/report.json') for n in range(1, 5)]
    cases = [case for report in reports for case in report['cases']]
    assert len(cases) == 16 and {case['label'] for case in cases} == set(expected)
    attempts = [attempt for case in cases for attempt in case['attempts']]
    for n, report in enumerate(reports, 1):
        assert report['completed'] is True
        assert report['metadata']['commit'] == freeze['commit']
        assert report['metadata']['sourceSHA256'] == freeze['sourceSHA256']
        assert report['metadata']['dirty'] is False
        assert report['wrapperSHA256'] == sha(ROOT / 'runner/run-open-development.mts')
        assert report['batchManifestSHA256'] == sha(ROOT / f'inputs/batch-{n:02}.json')
        assert report['counts']['declared'] == report['counts']['observed'] == report['counts']['terminalReceipts'] == 4
        assert all(report['counts'][key] == 0 for key in ['localStops', 'transportFailures', 'providerErrors'])
        assert all(value == 401 for value in report['auth'].values())
        journal = [json.loads(line) for line in (ROOT / f'runs/batch-{n:02}/journal.jsonl').read_text().splitlines()]
        assert all(sum(row['phase'] == phase for row in journal) == report['totals']['attempts']
                   for phase in ['dispatch_reserved', 'attempt_finished'])
        for key in ['attempts', 'calls', 'requestBytes', 'measuredInputTokens', 'unknownInputTokenReservations',
                    'chargedInputTokens', 'pendingDispatchReservations', 'knownCostUSD', 'attemptsWithUnknownCost']:
            assert journal[-1]['totals'][key] == report['totals'][key], key
        assert report['totals']['unknownInputTokenReservations'] == report['totals']['pendingDispatchReservations'] == 0
        assert report['totals']['chargedInputTokens'] <= report['limits']['inputTokens']
        assert report['totals']['requestBytes'] <= report['limits']['totalRequestBytes']
        assert report['totals']['elapsedMs'] <= report['limits']['wallMs']
        assert all(report['totals']['calls'][kind] <= cap for kind, cap in report['limits']['calls'].items())
    for case in cases:
        declared = expected[case['label']]
        assert case['terminalReceived'] is True and not case['mismatch'] and not case['localStops']
        assert case['rejectedAdmissionCount'] == 0
        assert all(row['issue'] is None for row in case['deterministicPublicIssues'])
        assert all(text in declared['allowedPublic'] for text in case['admittedPublic'])
        if not declared['allowedPublic']:
            assert not any(attempt['kind'] != 'jev' for attempt in case['attempts'])
        for attempt in case['attempts']:
            assert attempt['dispatched'] and attempt['status'] == 200
            assert attempt['requestBytes'] <= 65_536
            if attempt['kind'] == 'search':
                matches = [span for span in public[case['label']] if attempt['query'] in span['queries']]
                assert len(matches) == 1
                assert attempt['retrievalTextSHA256'] == {'objective': allowlist['objectiveSHA256'],
                    'highlightQuery': matches[0]['highlightQuerySHA256']}
            elif attempt['kind'] == 'contents':
                assert len(attempt['contentURLs']) == 1
                assert attempt['retrievalTextSHA256']['highlightQuery'] in [span['highlightQuerySHA256'] for span in public[case['label']]]
    summary = read('computed/broader-candidate09-runtime-summary.json')
    assert summary['sourceVerificationStatus'] == 'pending_independent_review_not_inferred_from_raw_correctness'
    assert summary['totals']['attempts'] == len(attempts) == 102
    calls = {kind: sum(attempt['kind'] == kind for attempt in attempts) for kind in ['jev', 'search', 'contents']}
    assert calls == summary['totals']['calls'] == {'jev': 41, 'search': 25, 'contents': 36}
    assert sum(attempt['requestBytes'] for attempt in attempts) == summary['totals']['requestBytes'] == 1_381_736
    assert sum(attempt['inputTokens'] or 0 for attempt in attempts) == summary['totals']['inputTokens'] == 329_197
    assert sum(report['totals']['elapsedMs'] for report in reports) == summary['totals']['sumReportedBatchElapsedMs'] == 39_806
    admitted = sum(len(case['admittedPublic']) for case in cases)
    assert admitted == sum(len(case['expected']['claims']) for case in expected.values()) == 13
    unique = [case for case in cases if case['label'].startswith('BD') and case['label'][2:].isdigit()]
    correct = wrong = abstained = 0
    for case in unique:
        events = [event for event in case['events'] if event['type'] == 'claim.result']
        assert len(events) == 1 and events[0]['cached'] is False
        claim = expected[case['label']]['expected']['claims'][0]
        assert events[0]['checkedPublicText'] in claim['acceptedTexts']
        if events[0]['verdict'] == 'insufficient_evidence':
            abstained += 1
        elif events[0]['verdict'] == claim['verdict']:
            correct += 1
        else:
            wrong += 1
    assert (len(unique), correct, wrong, abstained) == (12, 4, 0, 8)
    comparison = read('comparison/candidate09-vs08/comparison.json')
    assert comparison['thresholds'] == {'stance': .8, 'substance': .85, 'commonOrigin': .85}
    assert comparison['scriptSHA256'] == sha(ROOT / 'comparison/compare.py')
    assert len(comparison['pairs']) == 16
    assert sha(ROOT / 'runs/batch-01/report.json') == '3e8296a92808620eb29c054b39755a92fb38bfdd4d406fa40e779a9fcc5c8367'
    return {'kind': 'candidate09_execution_package_verification', 'copiedFilesVerified': len(copied),
            'originalWorkspaceCopiesChecked': originals, 'fullPackageManifestChecked': not content_only,
            'providerCalls': 0, 'pipelineImports': 0, 'reports': 4, 'terminalReceipts': 16,
            'attempts': len(attempts), 'exactPublicAdmissions': admitted, 'uniqueFacts': len(unique),
            'rawCorrectDefinitive': correct, 'abstained': abstained, 'wrongDefinitive': wrong,
            'sourceVerificationCredit': 'not_claimed_execution_only'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--originals', action='store_true')
    parser.add_argument('--content-only', action='store_true')
    args = parser.parse_args()
    print(json.dumps(verify(args.originals, args.content_only), indent=2))
