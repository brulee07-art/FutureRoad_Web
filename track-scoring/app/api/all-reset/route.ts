import { db,json,writer,body } from '../../../lib/server';
import { AuthError } from '../../../lib/judge-auth';

export async function POST(req:Request){
 try{
  await writer(req);
  if((await body(req)).confirm!=='전체 초기화')return json({error:'확인란에 전체 초기화를 입력해 주세요.'},400);
  // D1 executes a batch transactionally. Account settings and sessions are preserved.
  await db().batch([
   db().prepare("DELETE FROM attempt_history WHERE attempt_id LIKE 'official:%' OR attempt_id LIKE 'practice:%'"),
   db().prepare("DELETE FROM attempts WHERE mode IN ('official','practice')")
  ]);
  return json({ok:true,scope:'all'});
 }catch(e){
  return json({error:e instanceof AuthError?e.message:'전체 기록을 초기화하지 못했습니다. 기록을 확인한 뒤 다시 시도해 주세요.'},e instanceof AuthError?e.status:503);
 }
}
