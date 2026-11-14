#!/usr/bin/env python3
"""Offline comparison of explicitly supplied PUBLIC live-development reports."""
import argparse
import collections
import hashlib
import json
from pathlib import Path

THRESHOLD = 0.8
SUBSTANTIVE = {'original_record', 'attributable_research', 'substantive_secondary'}
LIMITATIONS = [
    'Repeated OPEN development observations, not a held-out evaluation or causal experiment. Provider/index/cache and model variability can change results.',
    'Acquisition stages contain normalized retained records, capped by the application, not the complete raw API result pool. They cannot establish retrieval recall.',
    'Source-qualified record yield means recorded directness and scope, stance confidence >=0.8, and a recorded substantive source assessment >=0.8. It is not a complete verdict-policy decision or independent source verification.',
    'Acquisition records are unjudged. Assessments are linked only to identical source-content fingerprints in the following recorded judgment. Missing/dropped/changed records are unassessed, not low quality.',
    'SourceGroup/echo/common-origin grouping only describes recorded dependence. Distinct domains or missing origin links do not prove independence.',
    'Provider delivery/cached extraction is not current origin accessibility. Non-null publisher/date metadata does not establish complete provenance.',
    'Exact queries, hashes, costs and bytes are reported when retained. Full request options, raw responses, request IDs and origin statuses cannot be reconstructed from absent fields.',
]


def sha(value):
    if isinstance(value, str):
        value = value.encode()
    return hashlib.sha256(value).hexdigest()


def fingerprint(record):
    return sha(json.dumps({key: record.get(key) for key in
                          ['id', 'url', 'title', 'publisher', 'publishedAt', 'contentBasis', 'excerpt']},
                         ensure_ascii=False, sort_keys=True))


def direct(record):
    probability = record.get('stanceProbability')
    return (record.get('directlyAddressesClaim') is True
            and record.get('matchesTimePlaceAndPopulation') is True
            and record.get('stance') in {'supports', 'contradicts'}
            and isinstance(probability, (int, float)) and THRESHOLD <= probability <= 1
            and record.get('url', '').startswith(('https://', 'http://'))
            and bool(record.get('excerpt', '').strip()))


def qualified(record, assessment):
    return (direct(record) and isinstance(assessment, dict)
            and assessment.get('contentBasis') in SUBSTANTIVE
            and isinstance(assessment.get('confidence'), (int, float))
            and THRESHOLD <= assessment['confidence'] <= 1)


def families(records, origins):
    parent = list(range(len(records)))

    def root(index):
        while parent[index] != index:
            index = parent[index]
        return index

    for i, left in enumerate(records):
        for j, right in enumerate(records[:i]):
            same = bool(left.get('sourceGroup')) and left.get('sourceGroup') == right.get('sourceGroup')
            same |= bool(left.get('echoGroup')) and left.get('echoGroup') == right.get('echoGroup')
            same |= any(pair.get('relationship') == 'common_origin' and pair.get('confidence', 0) >= THRESHOLD
                        and {left.get('id'), right.get('id')} <= set(pair.get('evidenceIds', [])) for pair in origins)
            if same:
                parent[root(i)] = root(j)
    grouped = collections.defaultdict(list)
    for index, record in enumerate(records):
        grouped[root(index)].append({'id': record.get('id'), 'sourceGroup': record.get('sourceGroup'), 'url': record.get('url')})
    return list(grouped.values())


def churn(initial, alternate):
    first = {record.get('sourceGroup') for record in initial if record.get('sourceGroup')}
    later = {record.get('sourceGroup') for record in alternate if record.get('sourceGroup')}
    first_urls = {record.get('url') for record in initial}
    later_urls = {record.get('url') for record in alternate}
    return {'initialGroups': sorted(first), 'alternateGroups': sorted(later),
            'addedGroups': sorted(later - first), 'notReturnedGroups': sorted(first - later),
            'sharedGroups': sorted(first & later), 'groupJaccard': len(first & later) / len(first | later) if first | later else None,
            'newURLs': sorted(later_urls - first_urls), 'repeatedURLs': sorted(first_urls & later_urls)}


def stage_summary(stage, linked=None):
    judgments = {fingerprint(record): record for record in (linked or {}).get('records', [])}
    assessments = (linked or {}).get('sourceAssessments') or {}
    records = []
    for record in stage.get('records', []):
        judged = judgments.get(fingerprint(record))
        assessment = assessments.get(record.get('id')) if judged is not None else None
        records.append({
            'id': record.get('id'), 'url': record.get('url'), 'title': record.get('title'),
            'contentBasis': record.get('contentBasis'), 'excerpt': record.get('excerpt'),
            'excerptSHA256': sha(record.get('excerpt', '')), 'sourceContentFingerprint': fingerprint(record),
            'excerptCodePoints': len(record.get('excerpt', '')), 'atExcerptCap': len(record.get('excerpt', '')) == 2000,
            'provenance': {key: record.get(key) for key in ['publisher', 'publishedAt', 'retrievedAt', 'sourceGroup', 'echoGroup']},
            'assessmentStatus': 'linked_identical_content' if judged is not None else 'not_assessed',
            'judgment': None if judged is None else {key: judged.get(key) for key in
                        ['sourceRole', 'directlyAddressesClaim', 'matchesTimePlaceAndPopulation', 'stance', 'stanceProbability']},
            'sourceAssessment': assessment,
            'sourceQualifiedRecord': qualified(judged, assessment) if judged is not None else None,
        })
    assessed = [record for record in records if record['assessmentStatus'] != 'not_assessed']
    qualified_records = [record for record in records if record['sourceQualifiedRecord'] is True]
    grouped = families(stage.get('records', []), (linked or {}).get('originAssessments') or [])
    qualified_ids = {record['id'] for record in qualified_records}
    metrics = {
        'records': len(records), 'pageText': sum(record['contentBasis'] == 'page_text' for record in records),
        'highlights': sum(record['contentBasis'] == 'highlight' for record in records),
        'assessedIdenticalContent': len(assessed), 'unassessed': len(records) - len(assessed),
        'directnessTrue': sum(record['judgment'].get('directlyAddressesClaim') is True for record in assessed),
        'scopeTrue': sum(record['judgment'].get('matchesTimePlaceAndPopulation') is True for record in assessed),
        'sourceQualifiedRecords': len(qualified_records),
        'sourceQualifiedFractionOfAssessed': len(qualified_records) / len(assessed) if assessed else None,
        'recordedFamilyCount': len(grouped),
        'familiesContainingQualifiedRecords': sum(any(record['id'] in qualified_ids for record in group) for group in grouped),
        'publisherKnown': sum(bool(record['provenance']['publisher']) for record in records),
        'publicationDateKnown': sum(bool(record['provenance']['publishedAt']) for record in records),
        'atExcerptCap': sum(record['atExcerptCap'] for record in records),
    }
    return {'stage': stage.get('stage'), 'metrics': metrics, 'records': records, 'recordedFamilies': grouped,
            'claimRisk': (linked or {}).get('claimRisk'), 'originAssessments': (linked or {}).get('originAssessments'),
            'selectedEvidenceIds': stage.get('selectedEvidenceIds')}


def describe_case(sample, allowed):
    public = [text for text in sample.get('admittedPublic', []) if text in allowed]
    outcomes = [dict((key, event.get(key)) for key in ['checkedPublicText', 'verdict', 'reasonCode', 'selectedEvidenceIds', 'cached'])
                for event in sample.get('events', []) if event.get('type') == 'claim.result' and event.get('checkedPublicText') in allowed]
    terminal_events = [{key: event.get(key) for key in ['type', 'reasonCode', 'admissionAction'] if key in event}
                       for event in sample.get('events', []) if event.get('type') in
                       {'claim.result', 'pipeline.error', 'claim.skipped', 'claim.needs_confirmation', 'check.cancelled'}]
    stages = []
    entries = sample.get('evidence', [])
    for index, entry in enumerate(entries):
        following = entry if entry.get('stage') == 'judgment' else next(
            (later for later in entries[index + 1:] if later.get('stage') == 'judgment'), None)
        # Do not borrow a judgment across a later acquisition stage if a stage failed.
        if entry.get('stage') != 'judgment':
            for later in entries[index + 1:]:
                if later.get('stage') == 'judgment':
                    break
                if later.get('stage') in {'retrieval', 'alternate'}:
                    following = None
                    break
        result = stage_summary(entry, following)
        result['ordinal'] = len(stages) + 1
        stages.append(result)
    attempts = []
    for attempt in sample.get('attempts', []):
        attempts.append({key: attempt.get(key) for key in ['kind', 'ordinal', 'dispatched', 'requestBytes', 'durationMs', 'status', 'outcome',
                         'inputTokens', 'costUSD', 'query', 'contentURLs', 'retrievalTextSHA256'] if key in attempt})
        if attempt.get('kind') in {'search', 'contents'}:
            attempts[-1]['fullRequestOptions'] = attempt.get('requestOptions')
            attempts[-1]['requestOptionsStatus'] = 'observed' if 'requestOptions' in attempt else 'not_retained'
    initial = next((entry.get('records', []) for entry in entries if entry.get('stage') == 'retrieval'), [])
    alternate = next((entry.get('records', []) for entry in entries if entry.get('stage') == 'alternate'), [])
    dispatched = [attempt for attempt in attempts if attempt.get('dispatched') is True]
    resources = {kind: {
        'calls': sum(attempt['kind'] == kind for attempt in dispatched),
        'requestBytes': sum(attempt.get('requestBytes', 0) for attempt in dispatched if attempt['kind'] == kind),
        'knownCostUSD': sum(attempt['costUSD'] for attempt in dispatched if attempt['kind'] == kind and isinstance(attempt.get('costUSD'), (int, float))),
        'attemptsWithUnknownCost': sum(attempt['kind'] == kind and attempt.get('costUSD') is None for attempt in dispatched),
    } for kind in ['search', 'contents', 'jev']}
    return {'label': sample['label'], 'allowedPublic': allowed, 'admittedPublic': public,
            'admission': sample.get('admission'), 'reportedOutcomes': outcomes, 'terminalEvents': terminal_events,
            'terminalReceived': sample.get('terminalReceived'), 'terminalType': sample.get('terminalType'),
            'stages': stages, 'alternateObserved': any(entry.get('stage') == 'alternate' for entry in entries),
            'alternateChurn': churn(initial, alternate) if any(entry.get('stage') == 'alternate' for entry in entries) else None,
            'attempts': attempts, 'resources': resources,
            'usage': sample.get('usage'), 'runtime': sample.get('runtime'), 'stageMs': sample.get('stageMs'),
            'localStops': sample.get('localStops'), 'mismatch': sample.get('mismatch')}


def load_reports(paths):
    reports, cases = [], {}
    for name in paths:
        path = Path(name).resolve()
        data = path.read_bytes()
        if len(data) > 8 * 1024 * 1024:
            raise ValueError('public_report_size_limit')
        report = json.loads(data)
        allowed = {case['label']: case.get('allowedPublic', []) for case in report['predeclaredCases']}
        reports.append({'path': str(path), 'sha256': sha(data), 'startedAt': report.get('startedAt'),
                        'metadata': report.get('metadata'), 'completed': report.get('completed'),
                        'counts': report.get('counts'), 'totals': report.get('totals'), 'limits': report.get('limits')})
        for sample in report['cases']:
            if sample['label'] in cases:
                raise ValueError('duplicate_case_label')
            cases[sample['label']] = describe_case(sample, allowed[sample['label']])
    return {'reports': reports, 'cases': cases}


def pair_cases(baseline, candidate):
    rows = []
    for label in sorted(set(baseline) | set(candidate)):
        first, later = baseline.get(label), candidate.get(label)
        row = {'label': label, 'baseline': first, 'candidate': later}
        row['pairStatus'] = ('missing_baseline' if first is None else 'candidate_pending' if later is None
                             else 'public_plan_mismatch' if first['allowedPublic'] != later['allowedPublic'] else 'paired')
        if row['pairStatus'] == 'paired':
            row['admittedSpansChanged'] = first['admittedPublic'] != later['admittedPublic']
            row['admissionChanged'] = first['admission'] != later['admission']
            row['resourceDeltas'] = {kind: {key: later['resources'][kind][key] - value for key, value in metrics.items()}
                                     for kind, metrics in first['resources'].items()}
            row['acquisitionStageDeltas'] = []
            for stage in ['retrieval', 'alternate']:
                old = next((entry for entry in first['stages'] if entry['stage'] == stage), None)
                new = next((entry for entry in later['stages'] if entry['stage'] == stage), None)
                if old is None or new is None:
                    row['acquisitionStageDeltas'].append({'stage': stage, 'status': 'stage_not_observed_on_both_sides'})
                    continue
                if row['admittedSpansChanged']:
                    row['acquisitionStageDeltas'].append({'stage': stage, 'status': 'admitted_spans_differ'})
                    continue
                row['acquisitionStageDeltas'].append({'stage': stage,
                    'metrics': {key: new['metrics'][key] - value for key, value in old['metrics'].items()
                                if isinstance(value, (int, float)) and isinstance(new['metrics'].get(key), (int, float))},
                    'sourceGroupChurn': churn([{'sourceGroup': r['provenance']['sourceGroup'], 'url': r['url']} for r in old['records']],
                                              [{'sourceGroup': r['provenance']['sourceGroup'], 'url': r['url']} for r in new['records']])})
        rows.append(row)
    return rows


def campaign_resources(reports):
    return {'calls': {kind: sum(report['totals']['calls'][kind] for report in reports) for kind in ['search', 'contents', 'jev']},
            **{key: sum(report['totals'].get(key, 0) for report in reports)
               for key in ['requestBytes', 'measuredInputTokens', 'knownCostUSD', 'attemptsWithUnknownCost']}}


def self_test():
    record = {'id': 'r', 'url': 'https://records.example.org/r', 'title': 'Record', 'excerpt': 'A direct record.',
              'contentBasis': 'page_text', 'sourceGroup': 'example.org', 'directlyAddressesClaim': True,
              'matchesTimePlaceAndPopulation': True, 'stance': 'contradicts', 'stanceProbability': .9}
    assessed = {'stage': 'judgment', 'records': [record], 'sourceAssessments': {'r': {'contentBasis': 'original_record', 'confidence': .9}}}
    assert stage_summary({'records': [record]}, assessed)['metrics']['sourceQualifiedRecords'] == 1
    changed = {**record, 'excerpt': 'Different content at the same URL.'}
    assert stage_summary({'records': [changed]}, assessed)['metrics']['unassessed'] == 1
    assert stage_summary({'records': [record]})['records'][0]['sourceQualifiedRecord'] is None
    weak = {**assessed, 'sourceAssessments': {'r': {'contentBasis': 'bare_assertion', 'confidence': 1}}}
    assert stage_summary({'records': [record]}, weak)['metrics']['sourceQualifiedRecords'] == 0
    assert len(families([record, {**record, 'id': 'copy', 'sourceGroup': 'other.org'}], [])) == 2
    assert len(families([record, {**record, 'id': 'copy'}], [])) == 1
    assert len(families([record, {**record, 'id': 'copy', 'sourceGroup': 'other.org'}], [
        {'evidenceIds': ['r', 'copy'], 'relationship': 'common_origin', 'confidence': .9}])) == 1
    print('Offline comparator self-checks passed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', nargs='+')
    parser.add_argument('--candidate', nargs='*', default=[])
    parser.add_argument('--output-dir')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.baseline or not args.output_dir:
        parser.error('--baseline and --output-dir are required')
    baseline, candidate = load_reports(args.baseline), load_reports(args.candidate)
    pairs = pair_cases(baseline['cases'], candidate['cases'])
    result = {'schemaVersion': 1, 'kind': 'offline_public_broader_acquisition_comparison', 'networkCalls': 0,
              'scriptSHA256': sha(Path(__file__).read_bytes()),
              'limitations': LIMITATIONS, 'baselineReports': baseline['reports'], 'candidateReports': candidate['reports'], 'pairs': pairs,
              'aggregateObservedResources': {'baseline': campaign_resources(baseline['reports']), 'candidate': campaign_resources(candidate['reports'])}}
    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'comparison.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    lines = ['# Public broader acquisition comparison', '', LIMITATIONS[0], '',
             'Qualification below describes recorded model assessments, not independently verified truth or complete verdict eligibility.', '',
             '| Case | Pair status | Baseline last judgment qualified / retained | Candidate last judgment qualified / retained | Alternate source-group churn |',
             '| --- | --- | --- | --- | --- |']
    for row in pairs:
        def final_count(case):
            judgments = [stage for stage in (case or {}).get('stages', []) if stage['stage'] == 'judgment']
            count = f"{judgments[-1]['metrics']['sourceQualifiedRecords']} / {judgments[-1]['metrics']['records']}" if judgments else 'unassessed'
            errors = [event for event in (case or {}).get('terminalEvents', []) if event['type'] == 'pipeline.error']
            return count + ('; operational error: ' + errors[-1].get('reasonCode', 'unknown') if errors else '')
        churn_row = (row.get('candidate') or row.get('baseline') or {}).get('alternateChurn')
        churn_text = f"+{len(churn_row.get('addedGroups', []))} / omitted {len(churn_row.get('notReturnedGroups', []))}" if churn_row is not None else 'no alternate stage'
        pair_status = row['pairStatus'] + ('; admitted spans changed' if row.get('admittedSpansChanged') else '')
        lines.append(f"| {row['label']} | {pair_status} | {final_count(row.get('baseline'))} | {final_count(row.get('candidate'))} | {churn_text} |")
    lines += ['', '“Omitted” means absent from the alternate return; initial evidence can still survive the merge.', '',
              'A last observed judgment can precede an operational error; it is not a completed factual result. Different admitted spans block numeric acquisition deltas.', '',
              '| Observed resource | Baseline | Candidate |', '| --- | --- | --- |',
              *[f"| {key} | {result['aggregateObservedResources']['baseline'][key]} | {result['aggregateObservedResources']['candidate'][key]} |"
                for key in ['calls', 'requestBytes', 'measuredInputTokens', 'knownCostUSD', 'attemptsWithUnknownCost']], '',
              'Known cost is partial wherever provider cost is unknown; it is not an estimate of total billing. Admission changes and the operational error also change resource use.', '',
              'The JSON retains per-stage metrics, identical-content assessment links, excerpts/provenance, recorded origin families, exact observed queries and hashes, costs, and explicit missing-option markers.', '',
              *['- ' + limitation for limitation in LIMITATIONS[1:]], '']
    (output / 'comparison.md').write_text('\n'.join(lines))
    print(json.dumps({'networkCalls': 0, 'baselineReports': len(baseline['reports']), 'candidateReports': len(candidate['reports']),
                      'pairStatuses': dict(collections.Counter(row['pairStatus'] for row in pairs)), 'output': str(output.resolve())}))


if __name__ == '__main__':
    main()
