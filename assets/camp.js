
const bar=document.querySelector('.phasebar');
const stories=Array.from(document.querySelectorAll('.story'));
const buttons=stories.map((story,i)=>{
 const b=document.createElement('button'); b.type='button'; b.textContent=story.dataset.step;
 story.id='activity-'+(i+1); b.setAttribute('aria-controls',story.id);
 b.addEventListener('click',()=>select(i)); bar.append(b); return b;
});
function select(i){stories.forEach((s,j)=>{s.hidden=j!==i;buttons[j].setAttribute('aria-pressed',String(i===j));});
 if(i===0||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 stories[i].animate([{opacity:.5},{opacity:1}],{duration:220});}
bar.hidden=false;select(0);
const route=document.querySelector('#route'), car=document.querySelector('#vehicle'), play=document.querySelector('#play'), reset=document.querySelector('#reset'), stage=document.querySelector('#stage');
const len=route.getTotalLength();
function nearest(x,y){let best=Infinity,pos=0;for(let d=0;d<len;d+=2){const p=route.getPointAtLength(d),dist=Math.hypot(p.x-x,p.y-y);if(dist<best){best=dist;pos=d;}}return pos;}
const marks=[[0,0,'출발선'],[nearest(332,228),0,'① 정지선에서 일시 정지'],[nearest(332,228),2,'① 정지선에서 일시 정지'],[nearest(853,228),0,'② 차선 변경 · 앞지르기 · 복귀'],[nearest(725,560),0,'③ 횡단보도 접근'],[nearest(725,560),1.3,'③ 보행자 통과 대기'],[nearest(430,560),0,'④ 무단횡단 상황 접근'],[nearest(430,560),1.3,'④ 보행자에 대응'],[len,0,'도착선으로 주행']];
let t=0,last=null,frame=0,playing=false;
const segments=marks.slice(1).map(([end,wait,label],i)=>({start:marks[i][0],end,duration:wait||(end-marks[i][0])/120,label}));
const total=segments.reduce((a,b)=>a+b.duration,0);
function draw(){let d=0,time=t,label='출발선';for(const seg of segments){if(time<=seg.duration){d=seg.start+(seg.end-seg.start)*time/seg.duration;label=seg.label;break;}time-=seg.duration;d=seg.end;}
 const p=route.getPointAtLength(d),q=route.getPointAtLength((d+1)%len);car.setAttribute('transform','translate('+p.x+' '+p.y+') rotate('+Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI+')');
 const msg='예시 주행 · '+(t===0?'출발선':t>=total?'한 바퀴 완주':label);if(stage.textContent!==msg)stage.textContent=msg;}
function stop(){playing=false;cancelAnimationFrame(frame);last=null;play.textContent=t>=total?'다시 주행':t?'이어서 주행':'예시 주행 시작';}
function tick(now){if(last!==null)t=Math.min(total,t+(now-last)/1000);last=now;draw();if(t>=total)stop();else frame=requestAnimationFrame(tick);}
play.onclick=()=>{if(playing){stop();return;}if(t>=total)t=0;playing=true;play.textContent='일시정지';frame=requestAnimationFrame(tick);};
reset.onclick=()=>{t=0;stop();draw();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stop();});
car.setAttribute('visibility','visible');play.parentElement.hidden=false;draw();


// Close the section menu after choosing a destination or pressing Escape.
const menu = document.querySelector('.all-menu');
menu.addEventListener('click', event => {
  if (event.target.closest('a')) menu.open = false;
});
document.addEventListener('click', event => {
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
menu.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});

// A role shortcut should open the matching guidance, including on a shared URL.
function openRole(hash) {
  const summary = document.getElementById(hash.slice(1));
  if (summary?.matches('.field-guide summary')) summary.parentElement.open = true;
}
document.querySelector('.role-nav').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (link) openRole(link.hash);
});
window.addEventListener('hashchange', () => openRole(location.hash));
openRole(location.hash);
