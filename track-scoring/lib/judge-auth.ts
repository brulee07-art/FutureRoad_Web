import { env } from 'cloudflare:workers';

const SESSION_MS = 12 * 60 * 60 * 1000;
const WINDOW_MS = 5 * 60 * 1000;
const encoder = new TextEncoder();
export class AuthError extends Error {
 constructor(message:string, public status=401, public retryAfter?:number){super(message);}
}
function database(){if(!env.DB)throw new AuthError('인증 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',503);return env.DB;}
function configuration(){
 const id=env.JUDGE_LOGIN_ID;
 const encoded=env.JUDGE_PASSWORD_HASH;
 const parts=encoded?.split('$');
 if(!id||!parts||parts[0]!=='pbkdf2-sha256'||parts[1]!=='100000'||!/^[a-f0-9]{32}$/.test(parts[2])||!/^[a-f0-9]{64}$/.test(parts[3]))throw new AuthError('심사위원 계정 설정을 확인해 주세요.',503);
 return {id,encoded:encoded!,salt:parts[2],hash:parts[3]};
}
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');
const unhex=(value:string)=>Uint8Array.from(value.match(/../g)!,v=>parseInt(v,16));
async function digest(value:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
function equal(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<64;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export function checkAuthOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new AuthError('다른 사이트에서 전송한 요청입니다.',403);}
function bearer(req:Request){const value=req.headers.get('authorization')||'';return /^Bearer [a-f0-9]{64}$/.test(value)?value.slice(7):null;}
async function sessionKey(token:string){const cfg=configuration();return 'idpw:'+await digest(`${cfg.id}\n${cfg.encoded}\n${token}`);}
export async function authenticatedSession(req:Request){
 const token=bearer(req);if(!token)return null;
 const row=await database().prepare('SELECT id,expires FROM judge_sessions WHERE id=?').bind(await sessionKey(token)).first<{id:string;expires:number}>();
 if(!row||row.expires<=Date.now())return null;
 return {id:configuration().id,expiresAt:row.expires};
}
export async function requireJudge(req:Request){checkAuthOrigin(req);const session=await authenticatedSession(req);if(!session)throw new AuthError('심사위원 로그인이 필요합니다. 다시 로그인해 주세요.');return session;}
export async function loginJudge(req:Request,readInput:()=>Promise<any>){
 checkAuthOrigin(req);
 const cfg=configuration();
 const now=Date.now();
 const ipKey='idpw:ip:'+await digest(`${cfg.salt}:${req.headers.get('cf-connecting-ip')||'unknown'}`);
 for(const [key,maximum] of [[ipKey,10],['idpw:global',100]] as const){
  const row=await database().prepare('INSERT INTO login_limits (id,failures,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET failures=CASE WHEN expires<=? THEN 1 ELSE failures+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING failures,expires').bind(key,now+WINDOW_MS,now,now).first<{failures:number;expires:number}>();
  if(!row||row.failures>maximum)throw new AuthError('로그인 시도가 많습니다. 5분 후 다시 시도해 주세요.',429,Math.max(1,Math.ceil(((row?.expires||now+WINDOW_MS)-now)/1000)));
 }
 const input=await readInput();
 if(typeof input?.id!=='string'||typeof input?.password!=='string'||input.id.length>64||input.password.length>256)throw new AuthError('ID와 비밀번호를 확인해 주세요.',401);
 const key=await crypto.subtle.importKey('raw',encoder.encode(input.password),'PBKDF2',false,['deriveBits']);
 const candidate=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(cfg.salt),iterations:100000},key,256));
 const rightID=equal(await digest(input.id.trim()),await digest(cfg.id));
 if(!equal(candidate,cfg.hash)||!rightID)throw new AuthError('ID 또는 비밀번호가 올바르지 않습니다.',401);
 const token=hex(crypto.getRandomValues(new Uint8Array(32)));
 const expiresAt=now+SESSION_MS;
 await database().batch([
  database().prepare('DELETE FROM judge_sessions WHERE expires<=?').bind(now),
  database().prepare('DELETE FROM login_limits WHERE id=? OR expires<=?').bind(ipKey,now),
  database().prepare('INSERT INTO judge_sessions (id,expires) VALUES (?,?)').bind(await sessionKey(token),expiresAt)
 ]);
 return {token,expiresAt,id:cfg.id};
}
export async function logoutJudge(req:Request){checkAuthOrigin(req);const token=bearer(req);if(token)await database().prepare('DELETE FROM judge_sessions WHERE id=?').bind(await sessionKey(token)).run();}
