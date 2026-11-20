'use client';
import { useState } from 'react';
import { Flag,LockKeyhole,Monitor } from 'lucide-react';

type Session={token:string;id:string;expiresAt:number};
export default function JudgeLogin({state,error,onRetry,onDisplay,onLogin}:{state:'checking'|'required'|'authorized'|'error';error:string;onRetry:()=>void;onDisplay:()=>void;onLogin:(session:Session)=>void}){
 const [id,setID]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [failure,setFailure]=useState('');
 return <main className="judge-login"><div className="login-brand"><Flag size={25}/><strong>FUTURE ROAD</strong><span>제2회 퓨처로드 자율주행 자동차 제작 캠프</span></div><section className="login-card" aria-labelledby="judge-login-title"><div className="login-icon"><LockKeyhole size={30}/></div><p className="eyebrow">JUDGE ACCESS</p><h1 id="judge-login-title">심사위원 로그인</h1><p className="login-intro">주행 기록을 입력하려면<br/>운영본부에서 안내한 ID와 비밀번호를 입력해 주세요.</p>
 {state==='checking'?<div className="login-wait" role="status"><span className="loader"/>로그인 상태를 확인하고 있습니다.</div>:state==='error'?<div className="login-error"><p role="alert">{error}</p><button className="secondary-button" onClick={onRetry}>다시 확인</button></div>:<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setFailure('');try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,password})});const data=await response.json() as Session&{error?:string};if(!response.ok)throw Error(data.error||'로그인하지 못했습니다. 다시 시도해 주세요.');setPassword('');onLogin(data);}catch(e){setPassword('');setFailure(e instanceof Error?e.message:'로그인하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}}>
 <label htmlFor="judge-id">ID</label><input id="judge-id" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={id} onChange={e=>setID(e.target.value)} maxLength={64} required disabled={busy}/>
 <label htmlFor="judge-password">PASSWORD</label><input id="judge-password" name="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} maxLength={256} required disabled={busy}/>
 {failure&&<p className="login-error" role="alert">{failure}</p>}
 <button className="login-submit" type="submit" disabled={busy}>{busy?'로그인 확인 중…':'로그인 · 주행 채점 시작'}</button><p className="login-session-note">로그인은 최대 12시간 유지됩니다.</p>
 </form>}
 <div className="login-public"><span>전광판은 로그인 없이 볼 수 있습니다.</span><button onClick={onDisplay}><Monitor size={18}/>실시간 순위 보기</button></div></section><p className="login-footer">광덕고등학교 창업교육 거점센터 · 퓨처로드 교과연구회</p></main>;
}
