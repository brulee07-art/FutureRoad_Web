import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID,pbkdf2Sync } from 'node:crypto';
import { build } from 'esbuild';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../drizzle/0000_eager_lake.sql',import.meta.url),'utf8'));
let failAllReset=false;
const database={prepare(sql){let values=[];const stmt={bind(...v){values=v;return stmt;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){if(failAllReset&&sql==="DELETE FROM attempts WHERE mode IN ('official','practice')")throw Error('injected transaction failure');return {meta:sqlite.prepare(sql).run(...values)};}};return stmt;},async batch(items){sqlite.exec('BEGIN');try{const out=[];for(const item of items)out.push(await item.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const password='Local-Test-Password-Only';
const salt='1234567890abcdef1234567890abcdef';
const hash=`pbkdf2-sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`;
globalThis.__SCORING_TEST_ENV__={DB:database,JUDGE_LOGIN_ID:'test-judge',JUDGE_PASSWORD_HASH:hash};
const built=await build({stdin:{contents:`export {GET as state} from './app/api/state/route';export {POST as save} from './app/api/attempt/route';export {POST as reset} from './app/api/practice-reset/route';export {POST as resetAll} from './app/api/all-reset/route';export {POST as login} from './app/api/auth/login/route';export {GET as session} from './app/api/auth/session/route';export {POST as logout} from './app/api/auth/logout/route';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'test-d1-binding',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cloudflare:workers',namespace:'test-d1'}));b.onLoad({filter:/.*/,namespace:'test-d1'},()=>({contents:'export const env=globalThis.__SCORING_TEST_ENV__;',loader:'js'}));}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
let auth={};
const request=(path,data,headers={})=>new Request('https://score.test'+path,data===undefined?{headers}:{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':'192.0.2.1',...headers},body:JSON.stringify(data)});
const post=async(fn,data,headers=auth)=>{const r=await api[fn](request('/api/'+fn,data,headers));return {status:r.status,headers:r.headers,data:await r.json()};};
const state=async(mode='practice')=>(await api.state(request('/api/state?mode='+mode))).json();
const session=async(headers=auth)=>(await api.session(request('/api/auth/session',undefined,headers))).json();
const login=async(headers={})=>post('login',{id:'test-judge',password},headers);
const make=(patch={})=>({mode:'practice',teamId:9,round:2,status:'complete',rawCs:7412,flags:{lane:true,stop:false,pass:true,cross:false,pedestrian:false},revision:0,requestId:randomUUID(),...patch});

test('ID/password gate, public display and preserved scoring persistence',async t=>{
 await t.test('public result reads require no credentials and contain no session data',async()=>{const data=await state();assert.deepEqual(data.attempts,[]);assert.equal(data.token,undefined);assert.deepEqual(await session({}),{authenticated:false});});
 await t.test('anonymous writes, reset and legacy cookies are denied before any data change',async()=>{for(const headers of [{},{Cookie:'fr_judge='+'0'.repeat(64)},{Authorization:'Bearer '+'1'.repeat(64)}]){assert.equal((await post('save',make(),headers)).status,401);assert.equal((await post('reset',{confirm:'테스트 초기화'},headers)).status,401);}assert.equal((await state()).attempts.length,0);});
 await t.test('missing account configuration fails closed',async()=>{const prior=globalThis.__SCORING_TEST_ENV__.JUDGE_PASSWORD_HASH;delete globalThis.__SCORING_TEST_ENV__.JUDGE_PASSWORD_HASH;assert.equal((await login()).status,503);globalThis.__SCORING_TEST_ENV__.JUDGE_PASSWORD_HASH=prior;});
 await t.test('incorrect ID and password both fail with a generic error',async()=>{const wrongID=await post('login',{id:'other',password},{});const wrongPassword=await post('login',{id:'test-judge',password:'incorrect'},{});assert.equal(wrongID.status,401);assert.equal(wrongPassword.status,401);assert.equal(wrongID.data.error,wrongPassword.data.error);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM judge_sessions').get().n,0);});
 await t.test('login and writes reject a different origin',async()=>{assert.equal((await login({Origin:'https://wrong.test'})).status,403);assert.equal((await post('save',make(),{Origin:'https://wrong.test'})).status,403);});
 let issued;
 await t.test('valid login issues a 12-hour opaque token stored only as a digest',async()=>{issued=await login({Origin:'https://score.test'});assert.equal(issued.status,200);assert.match(issued.data.token,/^[a-f0-9]{64}$/);assert.equal(issued.data.id,'test-judge');assert.ok(issued.data.expiresAt>Date.now()+11.9*3600000);assert.ok(issued.data.expiresAt<=Date.now()+12*3600000);assert.equal(issued.headers.get('cache-control'),'no-store');auth={Authorization:'Bearer '+issued.data.token};assert.equal((await session()).authenticated,true);const stored=sqlite.prepare('SELECT id FROM judge_sessions').get();assert.notEqual(stored.id,issued.data.token);assert.ok(!stored.id.includes(issued.data.token));assert.equal(issued.data.password,undefined);assert.equal(issued.data.hash,undefined);});
 let saved;
 await t.test('authenticated valid records persist while invalid inputs fail',async()=>{assert.equal((await post('save',make({rawCs:-1}))).status,400);saved=make();const first=await post('save',saved);assert.equal(first.status,200);assert.equal(first.data.attempt.revision,1);assert.equal((await state()).attempts[0].rawCs,7412);});
 await t.test('same request is idempotent; stale edits conflict',async()=>{assert.equal((await post('save',saved)).data.attempt.revision,1);assert.equal((await post('save',make())).status,409);});
 await t.test('concurrent authenticated edits cannot overwrite each other',async()=>{const racers=await Promise.all([post('save',make({revision:1,rawCs:7500})),post('save',make({revision:1,rawCs:7600}))]);assert.deepEqual(racers.map(x=>x.status).sort(),[200,409]);assert.equal((await state()).attempts[0].revision,2);});
 await t.test('reset needs authentication and deliberate confirmation, preserves official results',async()=>{assert.equal((await post('reset',{confirm:'wrong'})).status,400);await post('save',make({mode:'official',teamId:1,round:1}));const before=(await state('official')).attempts;assert.equal((await post('reset',{confirm:'테스트 초기화'},{})).status,401);assert.equal((await state()).attempts.length,1);assert.equal((await post('reset',{confirm:'테스트 초기화'})).status,200);assert.equal((await state()).attempts.length,0);assert.deepEqual((await state('official')).attempts,before);});
 await t.test('withdrawal remains authenticated and retains audit history',async()=>{assert.equal((await post('save',make({mode:'official',teamId:1,round:1,revision:1,status:'withdrawn'}),{})).status,401);const r=await post('save',make({mode:'official',teamId:1,round:1,revision:1,status:'withdrawn'}));assert.equal(r.status,200);assert.equal((await state('official')).attempts[0].status,'withdrawn');assert.ok(sqlite.prepare('SELECT COUNT(*) AS n FROM attempt_history').get().n>=2);});
 let resetBefore;
 await t.test('all-reset rejects missing auth, wrong confirmation and cross-origin without changing 36 records',async()=>{
  for(const mode of ['official','practice'])for(let teamId=1;teamId<=9;teamId++)for(const round of [1,2]){const old=(await state(mode)).attempts.find(a=>a.teamId===teamId&&a.round===round);assert.equal((await post('save',make({mode,teamId,round,revision:old?.revision||0}))).status,200);}
  sqlite.prepare('INSERT INTO settings(id,owner,updated_at) VALUES (?,?,?)').run('preserve-settings','owner',Date.now());
  resetBefore={official:(await state('official')).attempts,practice:(await state()).attempts,history:sqlite.prepare('SELECT * FROM attempt_history ORDER BY request_id').all(),settings:sqlite.prepare('SELECT * FROM settings').all(),sessions:sqlite.prepare('SELECT * FROM judge_sessions').all(),limits:sqlite.prepare('SELECT * FROM login_limits').all()};
  assert.equal(resetBefore.official.length+resetBefore.practice.length,36);
  assert.equal((await post('resetAll',{confirm:'전체 초기화'},{})).status,401);
  for(const confirm of [undefined,'','테스트 초기화','전체'])assert.equal((await post('resetAll',{confirm})).status,400);
  assert.equal((await post('resetAll',{confirm:'전체 초기화'},{...auth,Origin:'https://wrong.test'})).status,403);
  assert.deepEqual((await state('official')).attempts,resetBefore.official);assert.deepEqual((await state()).attempts,resetBefore.practice);
  assert.deepEqual(sqlite.prepare('SELECT * FROM attempt_history ORDER BY request_id').all(),resetBefore.history);
 });
 await t.test('a reset transaction failure rolls back both current records and history',async()=>{
  failAllReset=true;try{assert.equal((await post('resetAll',{confirm:'전체 초기화'})).status,503);}finally{failAllReset=false;}
  assert.deepEqual((await state('official')).attempts,resetBefore.official);assert.deepEqual((await state()).attempts,resetBefore.practice);
  assert.deepEqual(sqlite.prepare('SELECT * FROM attempt_history ORDER BY request_id').all(),resetBefore.history);
 });
 await t.test('confirmed all-reset clears both rounds in both modes and keeps accounts and sessions',async()=>{
  const r=await post('resetAll',{confirm:'전체 초기화'});assert.equal(r.status,200);assert.deepEqual(r.data,{ok:true,scope:'all'});
  assert.deepEqual((await state('official')).attempts,[]);assert.deepEqual((await state()).attempts,[]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM attempt_history').get().n,0);
  assert.deepEqual(sqlite.prepare('SELECT * FROM settings').all(),resetBefore.settings);
  assert.deepEqual(sqlite.prepare('SELECT * FROM judge_sessions').all(),resetBefore.sessions);
  assert.deepEqual(sqlite.prepare('SELECT * FROM login_limits').all(),resetBefore.limits);
  assert.equal((await session()).authenticated,true);
 });
 await t.test('empty all-reset is safe and new official and practice records start from revision one',async()=>{
  assert.equal((await post('resetAll',{confirm:'전체 초기화'})).status,200);
  for(const mode of ['official','practice']){const r=await post('save',make({mode,teamId:1,round:1}));assert.equal(r.status,200);assert.equal(r.data.attempt.revision,1);assert.equal((await state(mode)).attempts.length,1);}
 });
 await t.test('logout revokes the server token and leaves results unchanged',async()=>{const before=(await state('official')).attempts;assert.equal((await post('logout',{})).status,200);assert.deepEqual(await session(),{authenticated:false});assert.equal((await post('save',make())).status,401);assert.deepEqual((await state('official')).attempts,before);});
 await t.test('expired sessions and altered bearer tokens cannot write',async()=>{const fresh=await login();auth={Authorization:'Bearer '+fresh.data.token};assert.equal((await session()).authenticated,true);const altered=fresh.data.token.slice(0,-1)+(fresh.data.token.endsWith('0')?'1':'0');assert.equal((await post('save',make(),{Authorization:'Bearer '+altered})).status,401);sqlite.prepare('UPDATE judge_sessions SET expires=?').run(Date.now()-1);assert.equal((await post('save',make())).status,401);assert.deepEqual(await session(),{authenticated:false});});
 await t.test('password configuration rotation invalidates previously issued sessions',async()=>{const fresh=await login();auth={Authorization:'Bearer '+fresh.data.token};globalThis.__SCORING_TEST_ENV__.JUDGE_PASSWORD_HASH=hash.slice(0,-1)+(hash.endsWith('0')?'1':'0');assert.equal((await post('save',make())).status,401);globalThis.__SCORING_TEST_ENV__.JUDGE_PASSWORD_HASH=hash;});
 await t.test('per-IP attempts are throttled and unlock after the window expires',async()=>{const headers={'cf-connecting-ip':'192.0.2.2'};for(let i=0;i<10;i++)assert.equal((await post('login',{id:'test-judge',password:'wrong'},headers)).status,401);const limited=await login(headers);assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);sqlite.prepare('UPDATE login_limits SET expires=?').run(Date.now()-1);assert.equal((await login(headers)).status,200);});
 await t.test('global attempts are throttled across distinct IPs',async()=>{sqlite.prepare('INSERT INTO login_limits(id,failures,expires) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET failures=excluded.failures,expires=excluded.expires').run('idpw:global',100,Date.now()+300000);assert.equal((await login({'cf-connecting-ip':'192.0.2.3'})).status,429);});
});
