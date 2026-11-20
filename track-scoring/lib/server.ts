import { env } from 'cloudflare:workers';
import { validateAttempt, type Attempt, type Mode } from './scoring';
import { requireJudge } from './judge-auth';
export function db(){if(!env.DB)throw Error('저장소 연결을 확인해 주세요.');return env.DB;}
export function json(v:unknown,status=200,headers:Record<string,string>={}){return Response.json(v,{status,headers:{'Cache-Control':'no-store',...headers}});}
export async function body(req:Request){const t=await req.text();if(t.length>12000)throw Error('요청이 너무 큽니다.');return JSON.parse(t);}
export function originOK(req:Request){const o=req.headers.get('origin');if(o&&o!==new URL(req.url).origin)throw Error('다른 사이트에서 전송한 요청입니다.');}
// Public result reads are separate from authenticated judging writes.
export async function writer(req:Request){await requireJudge(req);}
export function rowToAttempt(r:any):Attempt{return {id:r.id,mode:r.mode,teamId:r.team_id,round:r.round,status:r.status,rawCs:r.raw_cs,flags:JSON.parse(r.flags),revision:r.revision,requestId:r.request_id,updatedAt:r.updated_at};}
export async function list(mode:Mode){const r=await db().prepare('SELECT * FROM attempts WHERE mode=? ORDER BY team_id,round').bind(mode).all();return r.results.map(rowToAttempt);}
export async function save(input:any){const v=validateAttempt(input);const current:any=await db().prepare('SELECT * FROM attempts WHERE id=?').bind(v.id).first();if(current?.request_id===v.requestId)return rowToAttempt(current);
 const old:any=await db().prepare('SELECT snapshot FROM attempt_history WHERE request_id=?').bind(v.requestId).first();if(old)return JSON.parse(old.snapshot);
 const now=Date.now();let result;
 if(v.revision===0){result=await db().prepare('INSERT OR IGNORE INTO attempts (id,mode,team_id,round,status,raw_cs,flags,revision,request_id,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?) RETURNING *').bind(v.id,v.mode,v.teamId,v.round,v.status,v.rawCs,JSON.stringify(v.flags),v.requestId,now).all();}
 else {result=await db().prepare('UPDATE attempts SET status=?,raw_cs=?,flags=?,revision=revision+1,request_id=?,updated_at=? WHERE id=? AND revision=? RETURNING *').bind(v.status,v.rawCs,JSON.stringify(v.flags),v.requestId,now,v.id,v.revision).all();}
 if(!result.results.length)throw Error('CONFLICT');const a=rowToAttempt(result.results[0]);await db().prepare('INSERT OR IGNORE INTO attempt_history (request_id,attempt_id,snapshot,updated_at) VALUES (?,?,?,?)').bind(v.requestId,v.id,JSON.stringify(a),now).run();return a;
}
