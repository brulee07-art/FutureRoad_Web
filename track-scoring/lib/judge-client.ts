const storageKey='fr-judge-session-v2';
let memoryToken='';
export function judgeToken(){if(memoryToken)return memoryToken;try{return sessionStorage.getItem(storageKey)||'';}catch{return '';}}
export function rememberJudge(token:string){memoryToken=token;try{if(token)sessionStorage.setItem(storageKey,token);else sessionStorage.removeItem(storageKey);}catch{/* Embedded browsers can still use the in-memory session. */}}
export function judgeHeaders():Record<string,string>{const token=judgeToken();return token?{Authorization:`Bearer ${token}`}:{}};
export function expireJudge(){rememberJudge('');window.dispatchEvent(new Event('futureroad:login-required'));}
