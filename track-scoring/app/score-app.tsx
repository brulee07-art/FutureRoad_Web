'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, CheckCheck, ChevronDown, CircleHelp, ClipboardCheck, Download, Flag, Gauge, LogOut, Maximize, Monitor, Save, Settings2, ShieldCheck, Trophy, WifiOff, X } from 'lucide-react';
import { TEAMS, MISSIONS, bonus, emptyFlags, finalTime, formatTime, formatImprovement, rankingStatus, parseTime, standings, toCSV, type Attempt, type Flags, type Mode } from '../lib/scoring';
import { judgeToken,judgeHeaders,rememberJudge,expireJudge } from '../lib/judge-client';
import JudgeLogin from './judge-login';
import ScoringSettings,{type ResetScope} from './scoring-settings';

type View = 'judge'|'rankings'|'display';
type Draft = {minutes:string;seconds:string;flags:Flags;status:'complete'|'dnf';revision:number;dirty:boolean;requestId:string};

async function post(path:string,value:unknown){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...judgeHeaders()},body:JSON.stringify(value)});
 const data:any=await response.json();
 if(response.status===401)expireJudge();
 if(!response.ok)throw Object.assign(new Error(data.error||'저장하지 못했습니다. 다시 시도해 주세요.'),{conflict:data.conflict});
 return data;
}
function download(name:string,data:string,type:string){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clock(t:number){return new Date(t).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Seoul'});}
function RoundTime({a}:{a?:Attempt}){return <span className={a?.status==='dnf'?'dnf':'mono'}>{!a||a.status==='withdrawn'?'대기':a.status==='dnf'?'미완주':formatTime(finalTime(a))}</span>;}

export default function ScoreApp(){
 const [mode,setMode]=useState<Mode>('official');
 const activeMode=useRef(mode);activeMode.current=mode;
 const [view,setView]=useState<View>('judge');
 const [teamId,setTeamId]=useState(1);
 const [round,setRound]=useState(1);
 const [attempts,setAttempts]=useState<Attempt[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [lastSync,setLastSync]=useState(0);
 const [failure,setFailure]=useState('');
 const [reload,setReload]=useState(0);
 const [epoch,setEpoch]=useState(0);
 const resetGeneration=useRef(0);
 const [pendingSaves,setPendingSaves]=useState(0);
 const onPendingSave=useCallback((delta:number)=>setPendingSaves(n=>n+delta),[]);
 const [modal,setModal]=useState<'rules'|'settings'|null>(null);
 const [notice,setNotice]=useState('');
 const [ready,setReady]=useState(false);
 const [portal,setPortal]=useState(false);
 const [auth,setAuth]=useState<'checking'|'required'|'authorized'|'error'>('checking');
 const [authError,setAuthError]=useState('');
 const [judgeID,setJudgeID]=useState('');
 const [expiresAt,setExpiresAt]=useState(0);
 const [authReload,setAuthReload]=useState(0);
 const [loggingOut,setLoggingOut]=useState(false);
 useEffect(()=>{const q=new URLSearchParams(location.search);if(q.get('mode')==='practice')setMode('practice');if(['judge','rankings','display'].includes(q.get('view')||''))setView(q.get('view') as View);setPortal(q.get('embed')==='futureroad');setReady(true);},[]);
 useEffect(()=>{if(!ready)return;const q=new URLSearchParams({view,mode});if(portal)q.set('embed','futureroad');history.replaceState(null,'',`?${q}`);if(portal&&window.parent!==window)window.parent.postMessage({type:'futureroad:state',view,mode},'https://www.futureroad.kr');},[view,mode,ready,portal]);
 const publicDisplay=view==='display';
 useEffect(()=>{if(!ready||publicDisplay)return;let active=true;setAuth('checking');setAuthError('');
  if(!judgeToken()){setAuth('required');return;}
  fetch('/api/auth/session',{headers:judgeHeaders(),cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('로그인 상태를 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');return response.json() as Promise<{authenticated:boolean;id?:string;expiresAt?:number}>;}).then(data=>{if(!active)return;if(data.authenticated){setAuth('authorized');setJudgeID(data.id||'');setExpiresAt(data.expiresAt||0);}else{rememberJudge('');setAuth('required');}}).catch(e=>{if(active){setAuth('error');setAuthError((e as Error).message);}});
  return()=>{active=false;};
 },[ready,publicDisplay,authReload]);
 useEffect(()=>{const expired=()=>{setAuth('required');setExpiresAt(0);setModal(null);setNotice('');};window.addEventListener('futureroad:login-required',expired);return()=>window.removeEventListener('futureroad:login-required',expired);},[]);
 useEffect(()=>{if(auth!=='authorized'||!expiresAt)return;const timer=setTimeout(expireJudge,Math.max(0,expiresAt-Date.now()));return()=>clearTimeout(timer);},[auth,expiresAt]);
 useEffect(()=>{if(!ready)return;let alive=true;let fetching=false;const controller=new AbortController();
  const refresh=async()=>{if(fetching)return;fetching=true;const generation=resetGeneration.current;try{const response=await fetch(`/api/state?mode=${mode}`,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('연결이 끊겼습니다. 마지막으로 확인한 기록을 표시합니다.');const data:any=await response.json();if(alive&&generation===resetGeneration.current){setAttempts(data.attempts);setLoaded(true);setLastSync(data.serverTime);setFailure('');}}catch(e){if(alive&&generation===resetGeneration.current)setFailure((e as Error).message==='Failed to fetch'?'인터넷 연결을 확인해 주세요. 저장된 결과를 다시 연결 중입니다.':(e as Error).message);}finally{fetching=false;}};
  refresh();const timer=setInterval(refresh,2000);return()=>{alive=false;controller.abort();clearInterval(timer);};
 },[mode,ready,reload]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),7000);return()=>clearTimeout(timer);},[notice]);
 const refresh=useCallback(()=>setReload(n=>n+1),[]);
 const afterReset=(scope:ResetScope)=>{
  resetGeneration.current+=1;
  try{Object.keys(localStorage).filter(k=>scope==='all'?k.startsWith('fr-draft-v1-official-')||k.startsWith('fr-draft-v1-practice-'):k.startsWith('fr-draft-v1-practice-')).forEach(k=>localStorage.removeItem(k));}catch{}
  if(scope==='all'||mode==='practice'){setAttempts([]);setEpoch(n=>n+1);setTeamId(1);setRound(1);}
  setModal(null);refresh();setNotice(scope==='all'?'실전·테스트 기록을 모두 초기화했습니다. 모든 팀이 주행 대기 상태입니다.':'테스트 기록을 초기화했습니다. 실전 기록은 유지됩니다.');
 };
 const editorGeneration=resetGeneration.current;
 const changeMode=(next:Mode)=>{if(next===mode)return;setMode(next);setAttempts([]);setLoaded(false);setLastSync(0);setFailure('');};
 const rows=standings(attempts);
 const firstRound=rows[0].basis==='first';
 const rankTitle=firstRound?'1차 임시 순위':'1·2차 합산 순위';
 const resultTitle=firstRound?'1차 기준 기록':'최종 합산';
 const rankDescription=firstRound?'2차 입력 전 · 성공 차감을 적용한 1차 기록이 낮은 팀부터 표시합니다.':'1·2차 합산 기록이 낮은 팀부터, 동률이면 단축 폭이 큰 팀부터 표시합니다.';
 const done=attempts.filter(a=>a.status!=='withdrawn').length;
 const validTeams=rows.filter(r=>r.score!==null).length;
 const record=attempts.find(a=>a.teamId===teamId&&a.round===round);
 const displayURL=portal?`https://www.futureroad.kr/driving-display.html${mode==='practice'?'?mode=practice':''}`:`${typeof location==='undefined'?'':location.origin}/?view=display&mode=${mode}`;
 const showDisplay=()=>window.open(displayURL,'_blank','noopener,noreferrer');
 const exportCSV=()=>download(`퓨처로드_${mode==='official'?'실전':'테스트'}_순위.csv`,toCSV(attempts),'text/csv;charset=utf-8');
 const copyLink=async()=>{try{await navigator.clipboard.writeText(displayURL);setNotice('전광판 주소를 복사했습니다. 전광판 PC에서 열어 주세요.');}catch{setNotice('주소 복사를 지원하지 않는 환경입니다. 전광판 화면을 연 뒤 주소를 복사해 주세요.');}};
 const logout=async()=>{if(loggingOut)return;setLoggingOut(true);try{await post('/api/auth/logout',{});expireJudge();}catch(e){setNotice((e as Error).message);}finally{setLoggingOut(false);}};

 if(view==='display')return <main className={`display-screen ${mode==='practice'?'is-practice':''}`}>
  <header className="display-header"><div><div className="eyebrow">FUTURE ROAD · LIVE RESULTS</div><h1>자율주행 <span>실시간 순위</span></h1><p>제2회 퓨처로드 자율주행 자동차 제작 캠프</p></div><div className="display-meta"><span className={`mode-badge ${mode}`}>{mode==='official'?'실전 주행':'테스트 기록'}</span><strong>{validTeams}<small> / 9팀 {firstRound?'1차 기록':'합산'}</small></strong><Connection failure={failure} lastSync={lastSync}/></div></header>
  {failure&&<div className="alert error"><WifiOff size={20}/>{failure}</div>}
  <div className="display-table-wrap"><table className="display-table"><thead><tr><th>순위</th><th>참가팀</th><th>1차</th><th>2차</th><th>{resultTitle} <small>{firstRound?'1차 임시 순위':'낮을수록 우수'}</small></th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className={r.rank===1?'leading':''}><td><span className="rank-num">{r.rank??'—'}</span>{r.tied&&<span className="tie-label">공동</span>}</td><td><strong>{r.name}</strong><span className="school">{r.school}</span></td><td><RoundTime a={r.attempts.find(a=>a.round===1)}/></td><td><RoundTime a={r.attempts.find(a=>a.round===2)}/></td><td className="final-cell"><strong className="mono">{formatTime(r.score)}</strong><small>{r.score!==null&&!firstRound?formatImprovement(r.improvement):rankingStatus(r)}</small></td></tr>)}</tbody></table></div>
  <footer className="display-footer"><p>{firstRound?'1차 임시 순위 · 성공 차감 적용 · 기록이 낮은 팀부터 정렬':'회차별 성공 차감 적용 · 1·2차 합산 · 동률이면 단축 폭이 큰 팀 우선'}</p><div><button onClick={()=>setView('judge')}>채점 화면</button><button aria-label="전체 화면" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.();}}><Maximize size={20}/></button></div></footer>
 </main>;

 if(!ready||auth!=='authorized')return <JudgeLogin state={!ready?'checking':auth} error={authError} onRetry={()=>setAuthReload(n=>n+1)} onDisplay={()=>setView('display')} onLogin={data=>{rememberJudge(data.token);setJudgeID(data.id);setExpiresAt(data.expiresAt);setAuth('authorized');setAuthError('');refresh();}}/>;
 return <div className={`app-shell ${mode==='practice'?'is-practice':''}`}>
  <header className="app-header"><a className="brand" href={`?view=judge&mode=official${portal?'&embed=futureroad':''}`} aria-label="퓨처로드 주행 채점"><div className="brand-mark"><Flag size={25}/></div><div><strong>FUTURE<span>ROAD</span></strong><small>자율주행 주행 채점</small></div></a><div className="header-right"><button className="judge-logout" onClick={logout} disabled={loggingOut} title={`${judgeID} 로그아웃`}><LogOut size={17}/><span>{loggingOut?'로그아웃 중…':'로그아웃'}</span></button><Connection failure={failure} lastSync={lastSync}/><button className="icon-button" onClick={()=>setModal('rules')} title="평가 기준" aria-label="평가 기준"><CircleHelp size={21}/></button><button className="icon-button" onClick={()=>setModal('settings')} title="운영 설정" aria-label="운영 설정"><Settings2 size={21}/></button><button className="display-button" onClick={showDisplay}><Monitor size={18}/><span>전광판 열기</span></button></div></header>
  <div className="workspace-head"><div className="page-heading"><span className="eyebrow">제2회 퓨처로드 자율주행 자동차 제작 캠프</span><h1>{view==='judge'?'주행을 기록하고, 성장을 확인하세요.':'9개 팀의 주행 결과'}</h1><p>{view==='judge'?'성공한 항목을 체크하면 기록이 자동으로 계산됩니다.':rankDescription}</p></div><div className="mode-control"><span>기록 구분</span><div className="segmented"><button className={mode==='official'?'active':''} onClick={()=>changeMode('official')}>실전</button><button className={mode==='practice'?'active practice':''} onClick={()=>changeMode('practice')}>테스트</button></div></div></div>
  <div className="workspace-tabs"><nav aria-label="화면 선택"><button className={view==='judge'?'active':''} onClick={()=>setView('judge')}><ClipboardCheck size={19}/>주행 채점</button><button className={view==='rankings'?'active':''} onClick={()=>setView('rankings')}><Trophy size={19}/>전체 순위<span>{validTeams}/9</span></button></nav><div className="progress-info"><span className={`mode-badge ${mode}`}>{mode==='official'?'실전 기록':'테스트 전용'}</span><span>{done} / 18회 기록</span></div></div>
  {mode==='practice'&&<div className="alert practice-alert"><Flag size={19}/>지금은 테스트입니다. 실전 순위에는 반영되지 않습니다.</div>}
  {failure&&<div className="alert error"><WifiOff size={19}/><span>{failure}</span><button onClick={refresh}>다시 연결</button></div>}
  {notice&&<div className="toast" role="status"><Check size={18}/>{notice}<button aria-label="알림 닫기" onClick={()=>setNotice('')}><X size={17}/></button></div>}
  {!loaded?<div className="loading-state"><span className="loader"/><h2>주행 기록을 불러오고 있습니다</h2><p>{failure||'저장된 팀별 기록과 순위를 확인합니다.'}</p><button className="secondary-button" onClick={refresh}>다시 불러오기</button></div>:view==='rankings'?<section className="ranking-page"><div className="section-top"><div><h2>{rankTitle}</h2><p>{rankDescription}</p></div><div className="action-row"><button className="secondary-button" onClick={copyLink}><Monitor size={17}/>전광판 주소 복사</button><button className="secondary-button" onClick={exportCSV}><Download size={17}/>CSV 내려받기</button></div></div><div className="ranking-table-scroll"><table className="ranking-table"><thead><tr><th>순위</th><th>팀명 · 소속교</th><th>1차 기록</th><th>2차 기록</th><th>단축 폭</th><th>{resultTitle}</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className={r.rank===1?'leading':''}><td><span className="rank-circle">{r.rank??'—'}</span>{r.tied&&<small>공동</small>}</td><td><button className="team-link" onClick={()=>{setTeamId(r.id);setRound(r.attempts.some(a=>a.round===1&&a.status==='complete')?2:1);setView('judge');}}>{r.name}</button><span className="school">{r.school}</span></td><td><RoundTime a={r.attempts.find(a=>a.round===1)}/></td><td><RoundTime a={r.attempts.find(a=>a.round===2)}/></td><td><strong>{formatImprovement(r.improvement)}</strong><small className="record-equation">{r.score!==null&&!firstRound?'1차 기록 − 2차 기록':rankingStatus(r)}</small></td><td className="mono ranking-result">{formatTime(r.score)}</td></tr>)}</tbody></table></div><p className="table-note">{firstRound?'2차 기록이 아직 없으므로 1차 기록으로 임시 순위를 매깁니다. 같은 기록은 공동순위이며, 1차 미입력·미완주·취소 팀은 아래에 표시합니다. 2차 입력이 시작되면 두 회차 모두 완주한 팀의 합산 순위로 전환합니다.':'두 회차 모두 완주한 팀을 합산합니다. 단축 폭 = 1차 기록 − 2차 기록이며, 합산과 단축 폭이 모두 같으면 공동순위입니다. 미입력·미완주·취소 회차가 있으면 합산 순위에서 제외합니다.'} 시간은 분:초.백분의초 단위입니다.</p></section>:<main className="judge-grid">
   <div className="mobile-team-picker"><label htmlFor="mobile-team">채점할 팀</label><div><select id="mobile-team" value={teamId} onChange={e=>setTeamId(Number(e.target.value))}>{TEAMS.map(t=><option value={t.id} key={t.id}>{String(t.id).padStart(2,'0')} · {t.name} / {t.school}</option>)}</select><ChevronDown size={19}/></div></div>
   <aside className="team-sidebar"><div className="sidebar-title"><h2>참가팀</h2><span>9 TEAMS</span></div><div className="team-list" role="group" aria-label="채점할 팀 선택">{TEAMS.map(t=>{const teamAttempts=attempts.filter(a=>a.teamId===t.id&&a.status!=='withdrawn');return <button className={`team-item ${teamId===t.id?'selected':''}`} key={t.id} onClick={()=>setTeamId(t.id)} aria-pressed={teamId===t.id}><span className="team-number">{String(t.id).padStart(2,'0')}</span><span className="team-label"><strong>{t.name}</strong><small>{t.school}</small><span className="round-marks">{[1,2].map(n=><span key={n} className={teamAttempts.some(a=>a.round===n)?'filled':''}>{n}차 {teamAttempts.some(a=>a.round===n)?'기록':'대기'}</span>)}</span></span></button>;})}</div><div className="sidebar-foot"><ShieldCheck size={18}/><span>확정한 기록은<br/>다른 기기에서도 이어집니다.</span></div></aside>
   <div className="editor-column"><div className="round-tabs" role="group" aria-label="주행 회차"><button className={round===1?'active':''} onClick={()=>setRound(1)}>1차 주행</button><button className={round===2?'active':''} onClick={()=>setRound(2)}>2차 주행</button><span>{firstRound?'1차 임시 순위 반영':'1·2차 합산 순위 반영'}</span></div><Editor key={`${mode}-${teamId}-${round}-${epoch}`} mode={mode} teamId={teamId} round={round} record={record} onPendingSave={onPendingSave} onSaved={a=>{if(editorGeneration!==resetGeneration.current)return;if(a&&a.mode===activeMode.current)setAttempts(prev=>[...prev.filter(x=>x.id!==a.id),a]);refresh();}} onNotice={setNotice}/></div>
   <aside className="live-sidebar"><div className="live-heading"><div><span className="eyebrow">LIVE STANDINGS</span><h2>{firstRound?'1차 임시 순위':'실시간 순위'}</h2></div><Trophy size={23}/></div><p className="live-sub">{firstRound?'성공 차감 적용 · 1차 기록순':'두 회차 합산 · 동률이면 단축 폭 우선'}</p><ol className="mini-ranking">{rows.map(r=><li key={r.id} className={r.id===teamId?'current':''}><span className={`mini-rank ${r.rank===1?'first':''}`}>{r.rank??'—'}</span><div><strong>{r.name}</strong><small>{r.score!==null?`${r.tied?'공동 · ':''}${firstRound?'1차 기준 · 2차 대기':formatImprovement(r.improvement)}`:rankingStatus(r)}</small></div><span className="mono">{formatTime(r.score)}</span></li>)}</ol><button className="text-button" onClick={()=>setView('rankings')}>전체 결과 보기</button><div className="scoring-note"><Gauge size={21}/><strong>빠르게, 그리고 정확하게.</strong><p>성공 항목은 각각 1회만 반영합니다.<br/>최대 차감시간은 <b>60초</b>입니다.</p><button onClick={()=>setModal('rules')}>평가 기준 확인</button></div></aside>
  </main>}
  <footer className="app-footer"><span>FUTURE ROAD · 2026</span><p>광덕고등학교 창업교육 거점센터 · 퓨처로드 교과연구회</p><span>심사위원 1인 운영</span></footer>
  {modal==='rules'&&<Modal title="주행 평가 기준" onClose={()=>setModal(null)}><Rules/></Modal>}
  {modal==='settings'&&<Modal title="운영 설정" onClose={()=>setModal(null)}><ScoringSettings resetRecords={scope=>post(scope==='all'?'/api/all-reset':'/api/practice-reset',{confirm:scope==='all'?'전체 초기화':'테스트 초기화'})} savingRecord={pendingSaves>0} onReset={afterReset}/></Modal>}
 </div>;
}

function Connection({failure,lastSync}:{failure:string;lastSync:number}){return <span className={`connection ${failure?'offline':''}`} title={failure||'2초마다 저장된 결과를 확인합니다.'}>{failure?<WifiOff size={14}/>:<span className="connection-dot"/>}{failure?'연결 확인 중':lastSync?`동기화 ${clock(lastSync)}`:'연결 중'}</span>;}

function getDraft(record?:Attempt):Draft{const raw=record?.rawCs;return {minutes:raw!==null&&raw!==undefined?String(Math.floor(raw/6000)):'',seconds:raw!==null&&raw!==undefined?(raw%6000/100).toFixed(2):'',flags:record?.flags||emptyFlags(),status:record?.status==='dnf'?'dnf':'complete',revision:record?.revision||0,dirty:false,requestId:''};}
function Editor({mode,teamId,round,record,onSaved,onNotice,onPendingSave}:{mode:Mode;teamId:number;round:number;record?:Attempt;onSaved:(a?:Attempt)=>void;onNotice:(v:string)=>void;onPendingSave:(delta:number)=>void}){
 const key=`fr-draft-v1-${mode}-${teamId}-${round}`;
 const [draft,setDraft]=useState<Draft>(()=>{const fresh=getDraft(record);try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored&&stored.dirty&&Number.isInteger(stored.revision)&&typeof stored.minutes==='string'&&typeof stored.seconds==='string'&&['complete','dnf'].includes(stored.status)&&MISSIONS.every(m=>typeof stored.flags?.[m.key]==='boolean'))return stored;}catch{}return fresh;});
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [storageError,setStorageError]=useState(false);
 const [savedAt,setSavedAt]=useState(record?.updatedAt||0);
 const [conflict,setConflict]=useState(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{try{if(draft.dirty)localStorage.setItem(key,JSON.stringify(draft));else localStorage.removeItem(key);setStorageError(false);}catch{setStorageError(true);}},[draft,key]);
 useEffect(()=>{if(!draft.dirty&&!saving&&(record?.revision||0)>draft.revision){setDraft(getDraft(record));setSavedAt(record?.updatedAt||0);}},[record,draft.dirty,draft.revision,saving]);
 const team=TEAMS.find(t=>t.id===teamId)!;
 const raw=parseTime(draft.minutes,draft.seconds);
 const deduction=draft.status==='complete'?bonus(draft.flags):0;
 const score=raw!==null&&draft.status==='complete'?raw-deduction:null;
 const selected=MISSIONS.filter(m=>draft.flags[m.key]).length;
 const remoteChange=(record?.revision||0)>draft.revision;
 const change=(patch:Partial<Draft>)=>{setError('');setDraft(d=>({...d,...patch,dirty:true,requestId:''}));};
 const submit=async(withdraw=false)=>{
  if(saving)return;
  if(!withdraw&&draft.status==='complete'&&raw===null){setError('실제 주행시간을 입력해 주세요. 초는 0~59.99 범위입니다.');return;}
  if(withdraw&&!confirm(`${team.name} ${round}차 기록을 취소할까요? 이 기록은 순위에서 제외됩니다.`))return;
  const requestId=(!withdraw&&draft.requestId)||crypto.randomUUID();setDraft(d=>({...d,requestId,dirty:true}));setSaving(true);onPendingSave(1);setError('');
  try{const data=await post('/api/attempt',{mode,teamId,round,status:withdraw?'withdrawn':draft.status,rawCs:raw,flags:draft.flags,revision:draft.revision,requestId});const a=data.attempt as Attempt;try{localStorage.removeItem(key);}catch{}onSaved(a);onNotice(`${team.name} ${round}차 ${withdraw?'기록을 취소했습니다.':'기록을 저장했습니다.'}`);if(mounted.current){setDraft(getDraft(a));setSavedAt(a.updatedAt);setConflict(false);}}
  catch(e){if(mounted.current){setError(e instanceof Error?e.message:'저장 결과를 확인하지 못했습니다. 입력 내용은 남아 있습니다. 다시 저장해 주세요.');setConflict(!!(e as any).conflict);}onSaved();}finally{onPendingSave(-1);if(mounted.current)setSaving(false);}
 };
 const loadLatest=()=>{if(draft.dirty&&!confirm('입력 중인 내용을 버리고 저장된 최신 기록을 불러올까요?'))return;setDraft(getDraft(record));setError('');setConflict(false);setSavedAt(record?.updatedAt||0);};
 return <section className="editor-card"><header className="editor-heading"><div><span className="team-kicker">TEAM {String(team.id).padStart(2,'0')} <span>·</span> {round}차 주행</span><h2>{team.name}</h2><p>{team.school}</p></div><span className={`save-state ${draft.dirty?'unsaved':''}`}>{draft.dirty?'입력 중':record&&record.status!=='withdrawn'?'저장된 기록':'주행 대기'}</span></header>
  {remoteChange||conflict?<div className="alert error"><span>이 회차의 기록이 다른 화면에서 변경되었습니다.</span><button onClick={loadLatest}>최신 기록 불러오기</button></div>:null}
  {storageError&&<div className="alert error">이 브라우저는 임시 입력을 보관하지 못합니다. 화면을 바꾸기 전에 기록을 저장해 주세요.</div>}
  <fieldset disabled={saving} className="editor-fieldset"><div className="time-section"><div className="field-heading"><h3><Gauge size={19}/>실제 주행시간</h3><div className="status-toggle" aria-label="완주 여부"><button type="button" className={draft.status==='complete'?'active':''} aria-pressed={draft.status==='complete'} onClick={()=>change({status:'complete'})}>완주</button><button type="button" className={draft.status==='dnf'?'active dnf-active':''} aria-pressed={draft.status==='dnf'} onClick={()=>change({status:'dnf'})}>미완주</button></div></div>
   {draft.status==='complete'?<><div className="time-inputs"><label><span className="sr-only">주행시간 분</span><input value={draft.minutes} onChange={e=>change({minutes:e.target.value})} inputMode="numeric" placeholder="00" maxLength={2} aria-label="주행시간 분"/><span>분</span></label><span className="time-colon">:</span><label><span className="sr-only">주행시간 초</span><input value={draft.seconds} onChange={e=>change({seconds:e.target.value})} inputMode="decimal" placeholder="00.00" maxLength={5} aria-label="주행시간 초"/><span>초</span></label></div><p className="field-help">측정된 시간을 입력해 주세요. 소수점 둘째 자리까지 기록할 수 있습니다.</p></>:<div className="dnf-box">미완주로 기록합니다. 두 회차 모두 완주해야 합산 순위가 표시됩니다.</div>}
  </div><div className="mission-section"><div className="field-heading"><h3><CheckCheck size={19}/>성공 체크리스트</h3><span className="success-count">{draft.status==='complete'?selected:0} / 5 성공</span></div><p className="field-help">자율주행으로 성공한 항목만 체크해 주세요. 항목별 1회 반영합니다.</p><div className={`mission-list ${draft.status==='dnf'?'disabled':''}`}>{MISSIONS.map(m=><label key={m.key} className={`mission-card ${draft.flags[m.key]&&draft.status==='complete'?'checked':''}`}><input type="checkbox" checked={draft.flags[m.key]&&draft.status==='complete'} disabled={draft.status==='dnf'} onChange={e=>change({flags:{...draft.flags,[m.key]:e.target.checked}})}/><span className="check-box"><Check size={18} strokeWidth={3}/></span><span className="mission-copy"><strong>{m.name}</strong><small>{m.detail}</small></span><span className="mission-seconds">−{m.seconds}<small>초</small></span></label>)}</div><p className="track-note"><ShieldCheck size={15}/><span>트랙 이탈은 <b>4개 바퀴 모두</b> 트랙 밖으로 벗어났을 때입니다. 허용된 앞지르기 차로는 이탈이 아닙니다.</span></p></div></fieldset>
  <div className="calculation"><div className="calc-parts"><span>실제 시간 <b className="mono">{draft.status==='complete'?formatTime(raw):'—'}</b></span><span className="calc-minus">−</span><span>성공 차감 <b className="deduction">{deduction/100}초</b></span><span className="calc-equals">=</span></div><div className="calc-final"><span>이번 회차 기록</span><strong className="mono">{draft.status==='dnf'?'미완주':formatTime(score)}</strong></div></div>
  {score!==null&&score<0&&<p className="negative-note">차감시간이 주행시간보다 커 음수 기록입니다. 계산값을 그대로 순위에 반영합니다.</p>}
  {error&&<div className="form-error" role="alert">{error}</div>}
  <div className="save-area"><button className="save-button" disabled={saving||remoteChange||conflict||(!draft.dirty&&!!record&&record.status!=='withdrawn')} onClick={()=>submit()}><Save size={20}/>{saving?'저장 중…':!draft.dirty&&record&&record.status!=='withdrawn'?'저장된 기록입니다':'기록 확정 · 순위 반영'}</button><div className="save-detail"><span>{draft.dirty?'입력 중인 내용은 이 기기에 임시 보관됩니다.':savedAt?`마지막 저장 ${clock(savedAt)}`:'기록 확정 후 전광판에 표시됩니다.'}</span>{record&&record.status!=='withdrawn'&&<button disabled={saving} onClick={()=>submit(true)}>이 회차 기록 취소</button>}</div>{draft.dirty&&<button className="draft-discard" disabled={saving} onClick={loadLatest}>입력 취소 · 저장된 기록 불러오기</button>}</div>
 </section>;
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);return <dialog ref={ref} className="modal" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-inner"><header><h2>{title}</h2><button className="icon-button" aria-label="창 닫기" onClick={onClose}><X size={22}/></button></header>{children}</div></dialog>;}
function Rules(){return <div className="rules-content"><div className="rules-formula">1차 기록 <span>+</span> 2차 기록 <span>=</span> 최종 합산</div><p>회차 기록 = 실제 주행시간 − 성공 차감시간. 심사위원 1명이 차량을 따라가며 성공 항목을 체크합니다. 실패 가산점은 없으며, 각 성공은 한 회차에서 한 번만 인정합니다.</p><div className="rules-list">{MISSIONS.map(m=><div key={m.key}><span><strong>{m.name}</strong><small>{m.detail}</small></span><b>−{m.seconds}초</b></div>)}</div><ul><li>차감 합계는 회차별 최대 60초입니다.</li><li>1·2차 기록을 합산하며, 합산이 낮은 팀이 높은 순위입니다.</li><li>합산 동률이면 단축 폭(1차 기록 − 2차 기록)이 큰 팀을 우선합니다. 두 값 모두 같으면 공동순위입니다.</li><li>단축 폭은 각 회차의 성공 차감을 적용한 기록으로 계산합니다. 2차 기록이 늘면 음수로 계산합니다.</li><li>2차 입력 전에는 1차 기록이 낮은 팀부터 임시 순위를 표시합니다. 1차 동률이면 공동순위입니다.</li><li>2차 입력이 시작되면 합산 순위로 전환합니다. 두 회차 모두 완주한 팀만 합산하며, 미입력·미완주·취소 회차가 있으면 합산 순위에서 제외합니다.</li><li>차로 이탈은 4개 바퀴가 모두 허용된 트랙 밖으로 벗어난 경우입니다.</li><li>음수 기록도 계산값 그대로 반영합니다. 별도의 제한시간은 설정하지 않았습니다.</li></ul><a href="/track-scoring.pdf" target="_blank" rel="noreferrer" className="secondary-button"><Download size={18}/>트랙 · 평가 기준 PDF</a><a href="/track-scoring.png" target="_blank" rel="noreferrer"><img className="rules-track" src="/track-scoring.png" alt="기존 실증코스에 5개 성공 평가 기준을 표시한 트랙 안내도"/></a></div>;}
