import { json } from '../../../../lib/server';
import { authenticatedSession } from '../../../../lib/judge-auth';
export async function GET(req:Request){try{const session=await authenticatedSession(req);return json(session?{authenticated:true,...session}:{authenticated:false});}catch{return json({error:'로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.'},503);}}
