'use client';
import { useState } from 'react';
import { RotateCcw,ShieldCheck,Trash2 } from 'lucide-react';

export type ResetScope='practice'|'all';
export default function ScoringSettings({resetRecords,onReset,savingRecord=false}:{resetRecords:(scope:ResetScope)=>Promise<unknown>;onReset:(scope:ResetScope)=>void;savingRecord?:boolean}){
 const [busy,setBusy]=useState<ResetScope|null>(null);
 const [error,setError]=useState('');
 const [confirming,setConfirming]=useState(false);
 const [confirmation,setConfirmation]=useState('');
 const blocked=!!busy||savingRecord;
 async function execute(scope:ResetScope){
  if(blocked||(scope==='all'&&confirmation.trim()!=='전체 초기화'))return;
  setBusy(scope);setError('');
  try{await resetRecords(scope);setConfirmation('');setConfirming(false);onReset(scope);}
  catch(e){setError(e instanceof Error?e.message:'기록을 초기화하지 못했습니다. 다시 시도해 주세요.');}
  finally{setBusy(null);}
 }
 return <div className="settings-content">
  <h3><ShieldCheck size={19}/>심사위원 1인 운영</h3><p>운영본부에서 안내한 ID와 비밀번호로 로그인한 뒤 채점합니다. 로그인은 최대 12시간 유지됩니다. 사용 후에는 로그아웃해 주세요. 전광판은 로그인 없이 결과를 확인할 수 있습니다.</p>
  <hr/>
  <h3><RotateCcw size={19}/>테스트 기록 초기화</h3><p>9개 팀의 테스트 기록만 지웁니다. 실전 기록은 유지됩니다.</p>
  <button className="danger-button" disabled={blocked} onClick={()=>{if(confirm('모든 테스트 기록을 지울까요? 실전 기록은 유지됩니다.'))void execute('practice');}}>{busy==='practice'?'초기화 중…':'테스트 기록만 초기화'}</button>
  <section className="reset-all-section" aria-labelledby="reset-all-heading">
   <h3 id="reset-all-heading"><Trash2 size={19}/>실전·테스트 기록 일괄 초기화</h3>
   <p>9개 팀의 <strong>실전·테스트 1·2차 기록과 순위</strong>를 모두 지웁니다. 입력 중인 이 기기의 임시 기록도 함께 비워집니다.</p>
   <p className="reset-warning">삭제 후 복구할 수 없습니다. 필요한 결과는 먼저 전체 순위에서 CSV로 저장해 주세요.</p>
   {!confirming?<button className="danger-button reset-all-button" disabled={blocked} onClick={()=>{setConfirmation('');setError('');setConfirming(true);}}>실전·테스트 기록 일괄 초기화</button>:<form className="reset-confirmation" onSubmit={e=>{e.preventDefault();void execute('all');}}>
    <label htmlFor="reset-all-confirmation">계속하려면 <strong>전체 초기화</strong>를 입력하세요.</label>
    <input id="reset-all-confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="전체 초기화" autoComplete="off" maxLength={20} disabled={blocked}/>
    <div className="reset-confirm-actions"><button type="button" className="secondary-button" disabled={!!busy} onClick={()=>{setConfirmation('');setConfirming(false);setError('');}}>취소</button><button type="submit" className="danger-button reset-all-button" disabled={blocked||confirmation.trim()!=='전체 초기화'}>{busy==='all'?'전체 기록 삭제 중…':'전체 기록 삭제'}</button></div>
   </form>}
   {savingRecord&&<p className="reset-saving-note" role="status">진행 중인 기록 저장이 끝나면 초기화할 수 있습니다.</p>}
  </section>
  {error&&<p className="form-error" role="alert">{error}</p>}
 </div>;
}
