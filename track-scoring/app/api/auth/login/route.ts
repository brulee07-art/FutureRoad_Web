import { json,body } from '../../../../lib/server';
import { loginJudge,AuthError } from '../../../../lib/judge-auth';
export async function POST(req:Request){try{return json(await loginJudge(req,()=>body(req)));}catch(e){const known=e instanceof AuthError;return json({error:known?e.message:'로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.'},known?e.status:503,known&&e.retryAfter?{'Retry-After':String(e.retryAfter)}:{});}}
