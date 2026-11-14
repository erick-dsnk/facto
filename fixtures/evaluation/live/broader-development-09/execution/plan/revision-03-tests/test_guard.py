"""Offline completed-public-report guard mutation tests; no provider/pipeline imports."""
from pathlib import Path
import copy, hashlib, importlib.util, json
base=Path(__file__).resolve().parent.parent
script=base/'revision-03/preflight.py'
spec=importlib.util.spec_from_file_location('candidate_guard',script)
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
freeze=g.verify_freeze();batch=g.PLAN['batches'][0];report=g.read(batch['outputPath']);original_read=g.read
results=[]
def check(name, mutate=None, should_pass=False):
 candidate=copy.deepcopy(report)
 if mutate: mutate(candidate)
 g.read=lambda path: candidate if str(path)==batch['outputPath'] else original_read(path)
 try:
  g.verify_completed_batch(batch,freeze); passed=True
 except (AssertionError,KeyError,TypeError): passed=False
 finally: g.read=original_read
 assert passed == should_pass,(name,passed,should_pass)
 results.append({'name':name,'expectedAccept':should_pass,'actualAccept':passed})
check('actual_completed_batch01',should_pass=True)
check('explicit_null_diagnostic',lambda d:d['cases'][0].update(deterministicPublicIssues=[{'issue':None}]),True)
check('actual_privacy_issue',lambda d:d['cases'][0].update(deterministicPublicIssues=[{'issue':'private-span'}]))
check('missing_issue',lambda d:d['cases'][0].update(deterministicPublicIssues=[{}]))
check('malformed_row',lambda d:d['cases'][0].update(deterministicPublicIssues=['invalid']))
check('malformed_diagnostic_container',lambda d:d['cases'][0].update(deterministicPublicIssues={'issue':None}))
check('call_budget_overrun',lambda d:d['totals']['calls'].update(jev=17))
check('token_budget_overrun',lambda d:d['totals'].update(chargedInputTokens=140001))
check('source_hash_mismatch',lambda d:d['metadata'].update(sourceSHA256='0'*64))
check('negative_auth_probe_accepted',lambda d:d['auth'].update(unauthorizedJoinStatus=200))
check('local_stop',lambda d:d['cases'][0].update(localStops=['budget']))
print(json.dumps({'kind':'offline_guard_mutation_tests','guardSHA256':hashlib.sha256(script.read_bytes()).hexdigest(),'completedReportSHA256':hashlib.sha256(Path(batch['outputPath']).read_bytes()).hexdigest(),'tests':results,'passed':len(results),'providerCalls':0,'pipelineImported':False,'sourceFilesModified':0},indent=2))
