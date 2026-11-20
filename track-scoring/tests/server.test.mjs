import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';

// Real SQLite executes the production SQL. The adapter provides the D1 interface.
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../drizzle/0000_eager_lake.sql',import.meta.url),'utf8'));
globalThis.__SCORING_TEST_DB__={prepare(sql){let values=[];const stmt={bind(...v){values=v;return stmt;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return {meta:sqlite.prepare(sql).run(...values)};}};return stmt;},async batch(items){const out=[];for(const item of items)out.push(await item.run());return out;}};
const built=await build({stdin:{contents:`export {GET as state} from './app/api/state/route';export {POST as save} from './app/api/attempt/route';export {POST as reset} from './app/api/practice-reset/route';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.DEV':'false'},plugins:[{name:'test-d1-binding',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cloudflare:workers',namespace:'test-d1'}));b.onLoad({filter:/.*/,namespace:'test-d1'},()=>({contents:'export const env={DB:globalThis.__SCORING_TEST_DB__};',loader:'js'}));}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const anonymous={};
const request=(path,data,headers=anonymous)=>new Request('https://score.test'+path,data===undefined?{headers}:{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
const post=async(fn,data,headers)=>{const r=await api[fn](request('/api/'+fn,data,headers));return {status:r.status,headers:r.headers,data:await r.json()};};
const state=async(mode='practice',headers=anonymous)=>(await api.state(request('/api/state?mode='+mode,undefined,headers))).json();
const make=(patch={})=>({mode:'practice',teamId:9,round:2,status:'complete',rawCs:7412,flags:{lane:true,stop:false,pass:true,cross:false,pedestrian:false},revision:0,requestId:randomUUID(),...patch});
test('single-judge anonymous access, persistence, idempotency, concurrency and reset isolation',async t=>{
 await t.test('state loads without identity, cookies or account provisioning',async()=>{const data=await state();assert.deepEqual(data.attempts,[]);assert.equal(data.access,undefined);assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM settings').get().count,0);});
 await t.test('cross-site writes are rejected without adding an authentication gate',async()=>{assert.notEqual((await post('save',make(),{Origin:'https://wrong.test'})).status,200);assert.equal((await state()).attempts.length,0);});
 let saved;
 await t.test('invalid inputs rejected; valid record persists',async()=>{assert.equal((await post('save',make({rawCs:-1}))).status,400);saved=make();const first=await post('save',saved);assert.equal(first.status,200);assert.equal(first.data.attempt.revision,1);assert.equal((await state()).attempts[0].rawCs,7412);});
 await t.test('same request is idempotent; stale edit conflicts',async()=>{assert.equal((await post('save',saved)).data.attempt.revision,1);assert.equal((await post('save',make())).status,409);});
 await t.test('simultaneous edits cannot overwrite one another',async()=>{const racers=await Promise.all([post('save',make({revision:1,rawCs:7500})),post('save',make({revision:1,rawCs:7600}))]);assert.deepEqual(racers.map(x=>x.status).sort(),[200,409]);assert.equal((await state()).attempts[0].revision,2);});
 await t.test('a fresh tablet and expired former PIN session can both save directly',async()=>{const fresh=await post('save',make({teamId:8,round:1}),{});assert.equal(fresh.status,200);const previous=await post('save',make({teamId:7,round:1}),{Cookie:'fr_judge='+ '0'.repeat(64)});assert.equal(previous.status,200);assert.equal((await state()).attempts.length,3);});
 await t.test('reset still requires deliberate confirmation',async()=>{assert.equal((await post('reset',{confirm:'wrong'})).status,400);assert.equal((await state()).attempts.length,3);});
 await t.test('practice reset preserves official results',async()=>{await post('save',make({mode:'official',teamId:1,round:1}));const before=(await state('official')).attempts;assert.equal((await post('reset',{confirm:'테스트 초기화'})).status,200);assert.equal((await state()).attempts.length,0);assert.deepEqual((await state('official')).attempts,before);});
 await t.test('withdrawal removes a record without erasing its audit history',async()=>{const r=await post('save',make({mode:'official',teamId:1,round:1,revision:1,status:'withdrawn'}));assert.equal(r.status,200);assert.equal((await state('official')).attempts[0].status,'withdrawn');assert.equal((await state('official')).attempts[0].rawCs,null);assert.ok(sqlite.prepare('SELECT COUNT(*) AS count FROM attempt_history').get().count>=2);});
});
