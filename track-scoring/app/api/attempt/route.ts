import { json,body,writer,save } from '../../../lib/server';
import { AuthError } from '../../../lib/judge-auth';
export async function POST(req:Request){try{await writer(req);const a=await save(await body(req));return json({attempt:a});}catch(e){const msg=(e as Error).message;return json({error:msg==='CONFLICT'?'다른 화면에서 이 기록을 수정했습니다. 최신 기록을 불러온 뒤 다시 입력해 주세요.':msg,conflict:msg==='CONFLICT'},e instanceof AuthError?e.status:msg==='CONFLICT'?409:400);}}
