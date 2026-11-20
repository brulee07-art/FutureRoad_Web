import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, MISSIONS, bonus, emptyFlags, finalTime, formatTime, formatImprovement, rankingStatus, parseTime, standings, validateAttempt, toCSV } from '../lib/scoring.ts';
const attempt=(overrides={})=>({id:'practice:1:1',mode:'practice',teamId:1,round:1,status:'complete',rawCs:7400,flags:emptyFlags(),revision:1,updatedAt:1,requestId:'ab000000-0000-4000-8000-000000000000',...overrides});
test('confirmed nine teams and 60-second maximum',()=>{assert.equal(TEAMS.length,9);assert.equal(new Set(TEAMS.map(t=>t.id)).size,9);assert.equal(bonus(Object.fromEntries(MISSIONS.map(m=>[m.key,true]))),6000);assert.equal(bonus({lane:true,stop:true,pass:true,cross:false,pedestrian:false}),3500);});
test('manual stopwatch parsing and strict centisecond arithmetic',()=>{assert.equal(parseTime('1','14'),7400);assert.equal(parseTime('','00.01'),1);assert.equal(parseTime('99','59.99'),599999);for(const args of [['1','60'],['0','0'],['-1','1'],['1','1.001'],['',''],['1e2','1'],['1','1e1']])assert.equal(parseTime(...args),null);assert.equal(finalTime(attempt({flags:{...emptyFlags(),lane:true,stop:true}})),5900);assert.equal(formatTime(5900),'0:59.00');});
const pair=(teamId,first,second)=>[attempt({teamId,rawCs:first}),attempt({teamId,round:2,rawCs:second})];
test('first-round-only times rank all nine teams by adjusted time rather than team order',()=>{
 for(const mode of ['official','practice']){
  const rows=standings(TEAMS.map(t=>attempt({mode,teamId:t.id,rawCs:(10-t.id)*1000})));
  assert.deepEqual(rows.map(r=>r.id),[9,8,7,6,5,4,3,2,1]);
  assert.deepEqual(rows.map(r=>r.rank),[1,2,3,4,5,6,7,8,9]);
  assert.equal(rows.every(r=>r.basis==='first'&&r.improvement===null),true);
  assert.equal(rows[0].score,1000);
  assert.equal(rankingStatus(rows[0]),'1차 임시 순위 · 2차 대기');
 }
});
test('first-round provisional ranking applies success deductions including zero and negative times',()=>{
 const full=Object.fromEntries(MISSIONS.map(m=>[m.key,true]));
 const rows=standings([attempt({teamId:1,rawCs:9000,flags:{...emptyFlags(),pass:true}}),attempt({teamId:2,rawCs:8000}),attempt({teamId:3,rawCs:6000,flags:full}),attempt({teamId:4,rawCs:5000,flags:full})]);
 assert.deepEqual(rows.slice(0,4).map(r=>[r.id,r.score,r.rank]),[[4,-1000,1],[3,0,2],[1,7000,3],[2,8000,4]]);
});
test('first-round ties share rank and missing, withdrawn or DNF first runs stay below ranked teams',()=>{
 const rows=standings([attempt({teamId:4,rawCs:5000}),attempt({teamId:2,rawCs:5000}),attempt({teamId:3,rawCs:6000}),attempt({teamId:1,status:'dnf',rawCs:null}),attempt({teamId:5,status:'withdrawn'})]);
 assert.deepEqual(rows.slice(0,3).map(r=>[r.id,r.rank,r.tied]),[[2,1,true],[4,1,true],[3,3,false]]);
 assert.equal(rows.slice(3).every(r=>r.rank===null&&r.score===null&&!r.tied),true);
 assert.equal(rankingStatus(rows.find(r=>r.id===1)),'1차 미완주 · 순위 제외');
 assert.equal(rankingStatus(rows.find(r=>r.id===5)),'1차 기록 대기');
 assert.equal(standings([]).every(r=>r.rank===null&&r.score===null),true);
});
test('starting round two switches to sums without comparing first-only times with totals; cancelling all second runs restores provisional ranks',()=>{
 const first=[attempt({teamId:1,rawCs:9000}),attempt({teamId:2,rawCs:5000})];
 const second=attempt({teamId:1,round:2,rawCs:7000});
 const combined=standings([...first,second]);
 assert.equal(combined[0].basis,'combined');assert.equal(combined[0].id,1);assert.equal(combined[0].score,16000);assert.equal(combined[0].rank,1);
 assert.equal(combined.find(r=>r.id===2).rank,null);
 const restored=standings([...first,{...second,status:'withdrawn'}]);
 assert.equal(restored[0].basis,'first');assert.equal(restored[0].id,2);assert.equal(restored[0].score,5000);
 const dnf=standings([...first,{...second,status:'dnf',rawCs:null}]);
 assert.equal(dnf[0].basis,'combined');assert.equal(dnf.every(r=>r.rank===null),true);
});
test('first-round CSV uses the same order and explicitly labels provisional results',()=>{
 const csv=toCSV([attempt({teamId:1,rawCs:9000}),attempt({teamId:2,rawCs:8000,flags:{...emptyFlags(),lane:true}})]);
 const cells=line=>line.slice(1,-1).split('\",\"');
 const lines=csv.slice(1).split('\r\n').map(cells);
 assert.equal(lines[0][3],'1차 기준 기록');assert.equal(lines[0][5],'순위 상태');
 assert.equal(lines[1][0],'1');assert.equal(lines[1][2],'아이작');assert.equal(lines[1][3],'1:10.00');assert.equal(lines[1][4],'');assert.equal(lines[1][5],'1차 임시 순위 · 2차 대기');
 assert.equal(lines[2][0],'2');assert.equal(lines[2][2],'동신동덕');
 assert.equal(lines.length,10);assert.equal(lines.every(r=>r.length===14),true);
});
test('sum of two adjusted runs wins rather than a single best run',()=>{
 const rows=standings([...pair(1,8000,7400).map(a=>({...a,flags:{...emptyFlags(),pass:true}})),...pair(2,10000,5000),...pair(3,9000,7000)]);
 assert.deepEqual(rows.slice(0,3).map(r=>[r.id,r.score,r.rank]),[[1,11400,1],[2,15000,2],[3,16000,3]]);
 assert.equal(rows[0].improvement,600);
});
test('equal totals favor larger improvement in adjusted time',()=>{
 const first=attempt({teamId:2,rawCs:8000});
 const second=attempt({teamId:2,round:2,rawCs:8000,flags:{...emptyFlags(),pass:true}});
 const rows=standings([...pair(1,7500,6500),first,second,...pair(3,7000,7000),...pair(4,6500,7500)]);
 assert.deepEqual(rows.slice(0,4).map(r=>[r.id,r.rank,r.improvement]),[[2,1,2000],[1,2,1000],[3,3,0],[4,4,-1000]]);
 assert.equal(rows.slice(0,4).some(r=>r.tied),false);
});
test('lower total remains primary even when another team improves more',()=>{
 const rows=standings([...pair(1,6000,6500),...pair(2,9000,4000)]);
 assert.equal(rows[0].id,1);assert.equal(rows[0].improvement,-500);
});
test('equal totals and improvement share competition rank; equal totals alone do not',()=>{
 const rows=standings([...pair(1,8000,6000),...pair(2,8000,6000),...pair(3,7500,6500)]);
 assert.deepEqual(rows.slice(0,3).map(r=>r.rank),[1,1,3]);
 assert.deepEqual(rows.slice(0,3).map(r=>r.tied),[true,true,false]);
});
test('missing, DNF and withdrawn rounds cannot produce a total or rank',()=>{
 const data=[attempt({teamId:1}),...pair(2,5000,6000).map(a=>a.round===2?{...a,status:'dnf',rawCs:null}:a),...pair(3,5000,6000).map(a=>a.round===1?{...a,status:'withdrawn'}:a),attempt({teamId:4,round:2}),...pair(5,8000,7000)];
 const rows=standings(data);assert.equal(rows[0].id,5);assert.equal(rows[0].rank,1);
 for(const r of rows.slice(1)){assert.equal(r.rank,null);assert.equal(r.score,null);assert.equal(r.improvement,null);assert.equal(r.tied,false);}
 assert.equal(rankingStatus(rows.find(r=>r.id===1)),'2차 기록 대기');
 assert.equal(rankingStatus(rows.find(r=>r.id===2)),'미완주 포함 · 순위 제외');
 assert.equal(rankingStatus(rows.find(r=>r.id===3)),'1차 기록 대기');
 assert.equal(rankingStatus(rows.find(r=>r.id===6)),'1·2차 기록 대기');
});
test('negative and zero adjusted totals remain valid with exact centiseconds',()=>{
 const flags=Object.fromEntries(MISSIONS.map(m=>[m.key,true]));
 const a=attempt({rawCs:4500,flags});assert.equal(finalTime(a),-1500);assert.equal(formatTime(finalTime(a)),'−0:15.00');
 const rows=standings([a,attempt({round:2,rawCs:4500,flags}),...pair(2,6000,6000).map(a=>({...a,flags})),...pair(3,6001,5999).map(a=>({...a,flags}))]);
 assert.deepEqual(rows.slice(0,3).map(r=>[r.id,r.score,r.rank]),[[1,-3000,1],[3,0,2],[2,0,3]]);
 assert.equal(rows[1].improvement,2);assert.equal(formatTime(rows[1].score),'0:00.00');
 assert.equal(formatImprovement(2),'0:00.02 단축');assert.equal(formatImprovement(-2),'0:00.02 증가');assert.equal(formatImprovement(0),'변화 없음');
});
test('reject invalid API inputs and recompute identities server-side',()=>{const base=attempt();for(const patch of [{teamId:10},{round:3},{mode:'untrusted'},{revision:-1},{rawCs:0},{rawCs:3.1},{rawCs:600000},{flags:{lane:true}},{flags:{...emptyFlags(),bonus:true}},{flags:{...emptyFlags(),lane:'true'}},{requestId:'bad'}])assert.throws(()=>validateAttempt({...base,...patch}));const a=validateAttempt({...base,id:'official:9:2'});assert.equal(a.id,'practice:1:1');assert.equal(validateAttempt({...base,status:'dnf'}).rawCs,null);assert.equal(bonus(validateAttempt({...base,status:'dnf',flags:Object.fromEntries(MISSIONS.map(m=>[m.key,true]))}).flags),0);});
test('CSV exports the same total, tiebreak, both rounds and excluded statuses',()=>{
 const text=toCSV([attempt({flags:{...emptyFlags(),lane:true}}),attempt({round:2,rawCs:6000}),...pair(2,7000,5400),attempt({teamId:3,status:'dnf',rawCs:null})]);
 assert.ok(text.startsWith('\ufeff'));const lines=text.slice(1).split('\r\n');
 const cells=line=>line.slice(1,-1).split('","');
 const header=cells(lines[0]);const records=lines.slice(1).map(cells);
 assert.equal(lines.length,10);assert.equal(header.length,14);assert.equal(records.every(row=>row.length===14),true);
 assert.equal(records[0][2],'아이작');assert.equal(records[0][3],'2:04.00');assert.equal(records[0][4],'16');
 const first=records.find(row=>row[2]==='동신동덕');assert.equal(first[3],'2:04.00');assert.equal(first[4],'4');assert.equal(first[8],'1:04.00');assert.equal(first[9],'차로 유지 완주');assert.equal(first[12],'1:00.00');
 assert.equal(records.find(row=>row[2]==='리듬타')[5],'미완주 포함 · 순위 제외');
});
