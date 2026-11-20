import { json } from '../../../../lib/server';
import { logoutJudge,AuthError } from '../../../../lib/judge-auth';
export async function POST(req:Request){try{await logoutJudge(req);return json({ok:true});}catch(e){return json({error:e instanceof AuthError?e.message:'로그아웃하지 못했습니다. 다시 시도해 주세요.'},e instanceof AuthError?e.status:503);}}
