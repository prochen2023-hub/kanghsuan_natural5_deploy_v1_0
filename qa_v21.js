const fs=require('fs'), vm=require('vm'), crypto=require('crypto');
const root='/mnt/data/natural_v21_work';
const sandbox={window:{}}; vm.createContext(sandbox); vm.runInContext(fs.readFileSync(root+'/data.js','utf8'),sandbox);
const D=sandbox.window.NATURAL5_DATA, app=fs.readFileSync(root+'/app.js','utf8'), html=fs.readFileSync(root+'/index.html','utf8');
const out=[]; const pass=(name,cond,extra='')=>{out.push(`${cond?'PASS':'FAIL'} ${name}${extra?' — '+extra:''}`); if(!cond) process.exitCode=1;};
pass('version 2.1.0',D.version==='2.1.0',D.version);
pass('12 lessons',D.lessons.length===12,String(D.lessons.length));
const first6=D.lessons.slice(0,6), u2=D.lessons.filter(l=>l.unit===2);
pass('first six have >=30 questions',first6.every(l=>l.questions?.length>=30),first6.map(l=>l.questions.length).join(','));
pass('first six have >=3 life scenes',first6.every(l=>l.lifeScenes?.length>=3),first6.map(l=>l.lifeScenes?.length||0).join(','));
pass('first six have >=3 mini labs',first6.every(l=>l.miniLabs?.length>=3),first6.map(l=>l.miniLabs?.length||0).join(','));
pass('U2 detail depth',u2.every(l=>l.detailSections?.length>=5),u2.map(l=>l.detailSections.length).join(','));
let allQ=[];D.lessons.forEach(l=>l.questions.forEach(q=>allQ.push(q.id)));pass('lesson question ids unique',new Set(allQ).size===allQ.length,`${new Set(allQ).size}/${allQ.length}`);
for(const key of ['midA','midB','finA','finB']){const e=D.exams.find(x=>x.id===key);pass(`${key} exists`,!!e);if(!e)continue;pass(`${key} 100 points`,e.questions.reduce((a,q)=>a+q.points,0)===100);pass(`${key} 40 minutes`,e.time===40);pass(`${key} question ids unique`,new Set(e.questions.map(q=>q.id)).size===e.questions.length);}
pass('cache bust 2.1.0',(html.match(/2\.1\.0/g)||[]).length>=3);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);pass('HTML IDs unique',new Set(ids).size===ids.length,`${new Set(ids).size}/${ids.length}`);
for(const f of ['app.js','data.js','index.html','styles.css']){const t=fs.readFileSync(root+'/'+f,'utf8');pass(`${f} no placeholders`,!/TODO|FIXME|TBD|PLACEHOLDER/.test(t));}
const visuals=[...new Set(first6.flatMap(l=>(l.detailSections||[]).map(x=>x.visual).filter(Boolean)))];
const missing=visuals.filter(v=>!app.includes(`type==='${v}'`)&&!app.includes(`'${v}'`));pass('all U1/U2 visual types handled',missing.length===0,missing.join(','));
const u2Visuals=[...new Set(u2.flatMap(l=>l.detailSections.map(x=>x.visual)))];
const nonExact=u2Visuals.filter(v=>!app.includes(`if(type==='${v}') return base(`));pass('U2 every science-case visual has its own branch',nonExact.length===0,nonExact.join(','));
pass('U2 visual count matches card count',u2Visuals.length===u2.reduce((a,l)=>a+l.detailSections.length,0),`${u2Visuals.length} unique visuals`);

// Execute the pure SVG renderer outside the app IIFE and verify U2 cards are not only different branch names but different rendered SVG markup.
try{
 const st=app.indexOf('function renderMiniVisual(type)'), en=app.indexOf('// Simulators',st);
 const ctx={esc:(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))};vm.createContext(ctx);vm.runInContext(app.slice(st,en)+'\nthis.renderMiniVisual=renderMiniVisual;',ctx);
 const hashes=u2Visuals.map(v=>crypto.createHash('sha1').update(ctx.renderMiniVisual(v)).digest('hex'));
 pass('U2 rendered SVGs are all visually distinct',new Set(hashes).size===u2Visuals.length,`${new Set(hashes).size}/${u2Visuals.length}`);
}catch(e){pass('U2 rendered SVGs are all visually distinct',false,e.message)}
pass('visual DOM carries data-visual-type',app.includes('data-visual-type="${esc(type)}"'));
pass('life scenes have per-card narration',app.includes('聽這個情境'));
pass('mini labs have per-experiment narration',app.includes('聽這個實驗'));
pass('unit introduction narration',app.includes('聽單元介紹'));
pass('quiz narration',app.includes("speakButton(q.prompt,'🔊')"));
pass('rescue narration',app.includes('聽題目與提示'));
pass('matching narration',app.includes('聽左欄')&&app.includes('聽右欄'));
pass('classification narration',app.includes("'🔊 讀題'"));
pass('exam question narration',app.includes('data-speak-text="${esc(q.prompt)}"'));
pass('exam result narration',app.includes('聽解析'));
pass('persistent AudioContext',app.includes('sharedAudioContext')&&app.includes("sharedAudioContext.state==='suspended'")&&app.includes('await sharedAudioContext.resume()'));
pass('sound simulator has user-gesture play + reference test',app.includes("id=\"playTone\"")&&app.includes("id=\"playReferenceTone\"")&&app.includes('audioStatus'));
pass('sound synthesis uses audible gain envelope',app.includes("exponentialRampToValueAtTime(.28")&&app.includes("kind==='pluck'"));
pass('accordion science-case cards exist',app.includes('detail-fold')&&app.includes('科學破案卡'));

const allAttrs=[...new Set([...app.matchAll(/data-([a-zA-Z0-9_-]+)/g)].map(m=>m[1]).concat([...html.matchAll(/data-([a-zA-Z0-9_-]+)/g)].map(m=>m[1])))];
const passive=new Set(['choice','stage','exam-fill','exam-multi','exam-single','visual-type']);
const camel=x=>x.split('-').map((p,i)=>i?p[0].toUpperCase()+p.slice(1):p).join('');
const unhandled=allAttrs.filter(a=>!passive.has(a) && !app.includes(`dataset.${camel(a)}`) && !app.includes(`hasAttribute('data-${a}')`) && !app.includes(`hasAttribute("data-${a}")`));
pass('all clickable data-actions have handlers',unhandled.length===0,unhandled.join(','));
console.log(out.join('\n'));
