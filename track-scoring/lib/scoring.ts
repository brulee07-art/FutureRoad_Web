export const TEAMS = [
 ['동신동덕','광주동신여자고등학교'],['아이작','광주인성고등학교'],['리듬타','조선대학교부속고등학교'],['동일모터스','동일미래과학고등학교'],['빛고을 모빌리티','빛고을고등학교'],['아잉(AING)','광주소프트웨어마이스터고등학교'],['오소프','광덕고등학교'],['플라잉카','금호고등학교'],['코드베이스','설월여자고등학교']
].map(([name,school],i)=>({id:i+1,name,school}));
export const MISSIONS = [
 {key:'lane',name:'차로 유지 완주',seconds:10,detail:'4개 바퀴가 모두 트랙 밖으로 벗어난 적 없이 한 바퀴 완주',short:'차로 유지'},
 {key:'stop',name:'일시정지',seconds:5,detail:'정지선 이전 지정 구역에서 완전히 정지하고 2초 이상 대기 후 출발',short:'일시정지'},
 {key:'pass',name:'앞지르기·복귀',seconds:20,detail:'앞차를 완전히 추월하고 지정 구간이 끝나기 전에 원래 차로로 복귀',short:'앞지르기'},
 {key:'cross',name:'횡단보도 대응',seconds:10,detail:'횡단보도 앞에서 접촉 없이 정지·대기하고 보행자 모형 통과 후 출발',short:'횡단보도'},
 {key:'pedestrian',name:'무단횡단 대응',seconds:15,detail:'노면 표시 없는 구간에서 보행자 모형 앞에 접촉 없이 정지하고 통과 후 출발',short:'무단횡단'}
] as const;
export type Flags = Record<string,boolean>;
export type Mode = 'official'|'practice';
export type Attempt = {id:string;mode:Mode;teamId:number;round:number;status:'complete'|'dnf'|'withdrawn';rawCs:number|null;flags:Flags;revision:number;updatedAt:number;requestId:string};
export const emptyFlags=():Flags=>Object.fromEntries(MISSIONS.map(m=>[m.key,false]));
export function bonus(flags:Flags){return MISSIONS.reduce((sum,m)=>sum+(flags[m.key]===true?m.seconds*100:0),0);}
export function finalTime(a:Attempt){return a.status==='complete'&&a.rawCs!==null?a.rawCs-bonus(a.flags):null;}
export function formatTime(cs:number|null|undefined){if(cs===null||cs===undefined)return '—';const neg=cs<0?'−':'';cs=Math.abs(cs);return `${neg}${Math.floor(cs/6000)}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;}
export function parseTime(minutes:string,seconds:string):number|null {
 if(!/^\d{1,2}$/.test(minutes||'0')||!/^\d{1,2}(?:\.\d{1,2})?$/.test(seconds))return null;
 const m=Number(minutes||0),s=Number(seconds);if(m>99||s>=60||s<0)return null;
 const cs=m*6000+Math.round(s*100);return cs>0?cs:null;
}
export function rankingBasis(attempts:Attempt[]){return attempts.some(a=>a.round===2&&a.status!=='withdrawn')?'combined' as const:'first' as const;}
export function standings(attempts:Attempt[]){
 const basis=rankingBasis(attempts);
 const rows=TEAMS.map(t=>{
  const all=attempts.filter(a=>a.teamId===t.id&&a.status!=='withdrawn');
  const first=all.find(a=>a.round===1),second=all.find(a=>a.round===2);
  const firstTime=first?finalTime(first):null,secondTime=second?finalTime(second):null;
  const complete=firstTime!==null&&secondTime!==null;
  return {...t,attempts:all,basis,score:basis==='first'?firstTime:complete?firstTime+secondTime:null,improvement:complete?firstTime-secondTime:null,rank:null as number|null,tied:false};
 });
 rows.sort((a,b)=>{
  if(a.score===null||b.score===null)return a.score===null&&b.score===null?a.id-b.id:a.score===null?1:-1;
  return a.score-b.score||(basis==='combined'?b.improvement!-a.improvement!:0)||a.id-b.id;
 });
 rows.forEach((row,i)=>{if(row.score!==null){const same=(other:typeof row)=>other.score===row.score&&other.improvement===row.improvement;row.rank=i>0&&same(rows[i-1])?rows[i-1].rank:i+1;row.tied=rows.some((other,j)=>j!==i&&same(other));}});
 return rows;
}
export function formatImprovement(cs:number|null){return cs===null?'—':cs===0?'변화 없음':`${formatTime(Math.abs(cs))} ${cs>0?'단축':'증가'}`;}
export function rankingStatus(row:ReturnType<typeof standings>[number]){
 if(row.basis==='first'){
  if(row.score!==null)return '1차 임시 순위 · 2차 대기';
  return row.attempts.some(a=>a.round===1&&a.status==='dnf')?'1차 미완주 · 순위 제외':'1차 기록 대기';
 }
 if(row.score!==null)return '합산 완료';
 if(row.attempts.some(a=>a.status==='dnf'))return '미완주 포함 · 순위 제외';
 const missing=[1,2].filter(n=>!row.attempts.some(a=>a.round===n&&a.status==='complete'));
 return `${missing.join('·')}차 기록 대기`;
}
export function validateAttempt(v:any){
 if(!v||!['official','practice'].includes(v.mode)||!TEAMS.some(t=>t.id===v.teamId)||![1,2].includes(v.round)||!['complete','dnf','withdrawn'].includes(v.status))throw Error('팀·회차·주행 상태를 확인해 주세요.');
 if(!Number.isInteger(v.revision)||v.revision<0)throw Error('기록 버전이 올바르지 않습니다. 새로고침해 주세요.');
 if(typeof v.requestId!=='string'||! /^[a-f0-9-]{36}$/.test(v.requestId))throw Error('저장 요청을 다시 시도해 주세요.');
 if(!v.flags||typeof v.flags!=='object'||Array.isArray(v.flags)||Object.keys(v.flags).length!==5||MISSIONS.some(m=>typeof v.flags[m.key]!=='boolean'))throw Error('성공 항목을 확인해 주세요.');
 if(v.status==='complete'&&(!Number.isInteger(v.rawCs)||v.rawCs<=0||v.rawCs>=600000))throw Error('주행시간을 0분 00.01초부터 99분 59.99초 사이로 입력해 주세요.');
 return {...v,id:`${v.mode}:${v.teamId}:${v.round}`,rawCs:v.status==='complete'?v.rawCs:null,flags:v.status==='complete'?v.flags:emptyFlags()};
}
export function toCSV(attempts:Attempt[]){
 const quote=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
 const header=['순위','학교','팀',rankingBasis(attempts)==='first'?'1차 기준 기록':'최종 합산 기록','단축 폭(초: 1차-2차)','순위 상태',...[1,2].flatMap(n=>[`${n}차 실제 주행시간`,`${n}차 차감(초)`,`${n}차 기록`,`${n}차 성공 항목`])];
 const rows=standings(attempts).map(r=>[r.rank,r.school,r.name,formatTime(r.score),r.improvement===null?'':r.improvement/100,rankingStatus(r),...[1,2].flatMap(n=>{
  const a=r.attempts.find(a=>a.round===n);
  return a?.status==='complete'?[formatTime(a.rawCs),bonus(a.flags)/100,formatTime(finalTime(a)),MISSIONS.filter(m=>a.flags[m.key]).map(m=>m.name).join(' / ')]:['','',a?.status==='dnf'?'미완주':'대기',''];
 })]);
 return '\ufeff'+[header,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
}
