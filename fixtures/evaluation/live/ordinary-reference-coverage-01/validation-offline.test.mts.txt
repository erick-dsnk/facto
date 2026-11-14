import test from 'node:test';
import assert from 'node:assert/strict';
import { decideVerdict } from '/workspace/junction-2026-current/services/api/src/policy/verdict.ts';
import type { AssessedJudgment } from '/workspace/junction-2026-current/services/api/src/policy/assessment.ts';

const claim = 'The Rellan canal opened for freight traffic in 1886.';
function fixture(): AssessedJudgment {
  const evidence = [
    {id:'r1',url:'https://archive-one.example/transport',title:'Transport guide',excerpt:'The Rellan canal began freight operations in 1886. Its western terminus connects the inland mill district with the navigable river.'},
    {id:'r2',url:'https://history-two.example/canals',title:'Canal history',excerpt:'Freight routes expanded when navigation on the Rellan canal opened in 1886; engineers had linked the river wharves to the industrial basin.'},
  ].map((s,index)=>({...s,publisher:null,publishedAt:null,retrievedAt:'2026-11-14T00:00:00Z',contentBasis:'page_text' as const,sourceGroup:`independent-${index}`,echoGroup:null,sourceRole:'unknown' as const,directlyAddressesClaim:true,matchesTimePlaceAndPopulation:true,stance:'supports' as const,stanceProbability:.96}));
  return { checkedText:claim,label:'supported',probabilities:{supported:.96,contradicted:.01,misleading:.01,insufficient_evidence:.02},evidence,selectedEvidenceIds:['r1'],misleadingReason:null,misleadingEvidenceIds:[],sourceAssessments:{r1:{contentBasis:'ordinary_reference',confidence:.95},r2:{contentBasis:'ordinary_reference',confidence:.95}},claimRisk:{level:'ordinary',confidence:.95},originAssessments:[] };
}
const abstains = (j:AssessedJudgment) => assert.equal(decideVerdict(j,[]).verdict,'insufficient_evidence');
test('two developed ordinary accounts can qualify and retain both citations',()=>{const out=decideVerdict(fixture(),[]);assert.equal(out.verdict,'supported');assert.deepEqual(out.selectedEvidenceIds,['r1','r2']);});
test('single ordinary account never inherits single-source registry authority',()=>{const j=fixture();j.evidence=j.evidence.slice(0,1);delete j.sourceAssessments.r2;assert.equal(decideVerdict(j,[{host:'archive-one.example',path:'/transport',claim:/canal/,rationale:'Synthetic test only.'}]).verdict,'insufficient_evidence');});
test('reference confidence threshold stays at .85',()=>{const j=fixture();j.sourceAssessments.r2.confidence=.849;abstains(j);});
test('shared origin defeats ordinary corroboration',()=>{const j=fixture();j.originAssessments=[{evidenceIds:['r1','r2'],relationship:'common_origin',confidence:.99}];abstains(j);});
test('identical copied account defeats ordinary corroboration',()=>{const j=fixture();j.evidence[1].excerpt=j.evidence[0].excerpt;abstains(j);});
test('rejected bridge still joins otherwise independent ordinary accounts',()=>{const j=fixture();j.evidence.push({...j.evidence[0],id:'bridge',url:'https://bridge-three.example/copy',sourceGroup:'bridge',excerpt:'A promotional linking passage with an independently disclosed common source.',directlyAddressesClaim:false});j.sourceAssessments.bridge={contentBasis:'promotional',confidence:.99};j.originAssessments=[{evidenceIds:['r1','bridge'],relationship:'common_origin',confidence:.99},{evidenceIds:['r2','bridge'],relationship:'common_origin',confidence:.99}];abstains(j);});
test('opposing direct account blocks ordinary label',()=>{const j=fixture();j.evidence[1].stance='contradicts';abstains(j);});
test('out-of-scope corroborator cannot qualify',()=>{const j=fixture();j.evidence[1].matchesTimePlaceAndPopulation=false;abstains(j);});
test('two bare statements remain ineligible',()=>{const j=fixture();j.sourceAssessments.r1.contentBasis='bare_assertion';j.sourceAssessments.r2.contentBasis='bare_assertion';abstains(j);});
test('typed high risk cannot use ordinary reference accounts',()=>{const j=fixture();j.claimRisk.level='health_safety';abstains(j);});
test('lexical medical safety trigger cannot use ordinary reference accounts even when typed ordinary',()=>{const j=fixture();j.checkedText='The Rellan health treatment cures asthma.';abstains(j);});
test('unknown risk cannot use ordinary reference accounts',()=>{const j=fixture();j.claimRisk.level='unknown';abstains(j);});
test('ordinary reference accounts do not lower the verdict threshold',()=>{const j=fixture();j.probabilities={supported:.849,contradicted:.01,misleading:.01,insufficient_evidence:.131};abstains(j);});
