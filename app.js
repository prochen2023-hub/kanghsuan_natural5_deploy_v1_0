(() => {
  'use strict';
  const DATA = window.NATURAL5_DATA;
  if (!DATA) throw new Error('NATURAL5_DATA missing');
  const lessons = Object.fromEntries(DATA.lessons.map(x => [x.id, x]));
  const exams = Object.fromEntries(DATA.exams.map(x => [x.id, x]));
  const main = document.querySelector('#mainView');
  const lessonDialog = document.querySelector('#lessonDialog');
  const lessonContent = document.querySelector('#lessonContent');
  const examDialog = document.querySelector('#examDialog');
  const examContent = document.querySelector('#examContent');
  const gameDialog = document.querySelector('#gameDialog');
  const gameContent = document.querySelector('#gameContent');
  const profileDialog = document.querySelector('#profileDialog');
  const toastEl = document.querySelector('#toast');
  const STORAGE = 'natural5_state_v11';
  let sharedAudioContext = null;
  const runtime = {view:'home',lessonId:null,stage:0,quizRuns:{},match:null,classify:null,board:null,exam:null,timer:null,sim:{},labLessonId:null};

  const defaultState = () => ({
    name:'', stars:0, streak:1, lastVisit:'', completed:[], wrongs:{}, examScores:{}, quizHistory:{}, firstSeen:Date.now()
  });
  let state = loadState();
  updateStreak();

  function loadState(){
    try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORAGE)||'{}')); }
    catch { return defaultState(); }
  }
  function saveState(){ localStorage.setItem(STORAGE, JSON.stringify(state)); syncHeader(); }
  function localDate(){
    const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function updateStreak(){
    const today=localDate();
    if (!state.lastVisit){state.lastVisit=today; saveState(); return;}
    if (state.lastVisit===today) return;
    const prev = new Date(state.lastVisit+'T00:00:00');
    const now = new Date(today+'T00:00:00');
    const diff = Math.round((now-prev)/86400000);
    state.streak = diff===1 ? (state.streak||1)+1 : 1;
    state.lastVisit=today; saveState();
  }
  function syncHeader(){
    document.querySelector('#stars').textContent = state.stars||0;
    document.querySelector('#streak').textContent = state.streak||1;
    document.querySelector('#profileName').textContent = state.name || '小小科學家';
  }
  function esc(s=''){ return String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function norm(s=''){ return String(s).trim().replace(/[\s　。！!？?，,、]/g,'').toLowerCase(); }
  function shuffle(arr){
    const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a;
  }
  function toast(msg){
    toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>toastEl.classList.remove('show'),1800);
  }
  function addStars(n,msg){ state.stars=(state.stars||0)+n; saveState(); if(msg) toast(`${msg} ⭐ +${n}`); }
  function unitLessons(unitId){ return DATA.units.find(u=>u.id===Number(unitId)).lessons.map(id=>lessons[id]); }
  function completedPct(unit){
    const done=unit.lessons.filter(id=>state.completed.includes(id)).length; return Math.round(done/unit.lessons.length*100);
  }
  function lessonRow(id,i){ const l=lessons[id]; return `<div class="lesson-row"><button class="lesson-link" data-open-lesson="${id}"><span>${state.completed.includes(id)?'<span class="done-dot">✓</span> ':''}${i+1}. ${esc(l.title)}</span><span>進入 ›</span></button>${speakButton(`${l.title}。${l.subtitle}。${l.phenomenon}`,'🔊')}</div>`; }
  function findNextLesson(){ return DATA.lessons.find(l=>!state.completed.includes(l.id)) || DATA.lessons[0]; }
  function sourceNote(){ return `<p class="source-note">教材依康軒五上自然公開課程架構、官方數位服務與現行課程計畫重新編寫；不重製課本全文。公開學校評量只用來分析題型、能力與圖表／實驗問法，再重新命題。</p>`; }
  function speakButton(text,label='🔊 聽導讀'){
    return `<button class="speak" type="button" data-speak-text="${esc(text)}">${label}</button>`;
  }
  function speak(text){
    if(!('speechSynthesis' in window)){ toast('這個瀏覽器不支援語音朗讀'); return; }
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(String(text).replace(/[_*#]/g,' '));
    u.lang='zh-TW'; u.rate=.93; u.pitch=1; u.volume=1;
    const voices=window.speechSynthesis.getVoices();
    u.voice=voices.find(v=>/zh-TW/i.test(v.lang)) || voices.find(v=>/^zh/i.test(v.lang)) || null;
    window.speechSynthesis.speak(u);
  }

  function nav(view){ runtime.view=view; render(); window.scrollTo({top:0,behavior:'smooth'}); }
  function render(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===runtime.view));
    if(runtime.view==='home') renderHome();
    else if(runtime.view==='units') renderUnits();
    else if(runtime.view==='lab') renderLab();
    else if(runtime.view==='games') renderGames();
    else if(runtime.view==='rescue') renderRescue();
    else if(runtime.view==='exams') renderExams();
    main.focus({preventScroll:true});
  }

  function renderHome(){
    const next=findNextLesson();
    const currentUnit=DATA.units[next.unit-1];
    const tip=DATA.dailyTips[new Date().getDate()%DATA.dailyTips.length];
    const wrongCount=Object.keys(state.wrongs||{}).length;
    main.innerHTML=`
      <section class="hero compact-home-hero">
        <p class="eyebrow">康軒版・五年級上學期</p>
        <h1>🧪 今天只學一小段</h1>
        <p>不用先看完整學期。今天從「${esc(currentUnit.title)}」的下一個活動開始，學完再往前。</p>
        <div class="hero-actions">
          <button class="btn primary" data-open-lesson="${next.id}">▶ 繼續：${esc(next.title)}</button>
          ${speakButton(`今天從${currentUnit.title}開始。下一個活動是${next.title}。${next.phenomenon}`,'🔊 聽今天任務')}
        </div>
        <div class="scope-strip"><span class="scope-pill">${currentUnit.emoji} 第${currentUnit.id}單元</span><span class="scope-pill">🛟 待救援 ${wrongCount}</span></div>
      </section>
      <div class="section-head"><div><h2>現在這一單元</h2><p>只顯示眼前 3 個活動，不把整學期一次攤開。</p></div></div>
      <section class="current-unit-focus card">
        <div class="current-unit-top"><div><span class="pill">第${currentUnit.id}單元</span><h2>${currentUnit.emoji} ${esc(currentUnit.title)}</h2><p>${esc(currentUnit.subtitle)}</p>${speakButton(`${currentUnit.title}。${currentUnit.subtitle}`,'🔊 聽單元介紹')}</div><div class="unit-progress-big">${completedPct(currentUnit)}%</div></div>
        <div class="lesson-list roomy">${currentUnit.lessons.map((id,i)=>lessonRow(id,i)).join('')}</div>
      </section>
      <div class="section-head"><div><h2>今天的 3 個生活任務</h2><p>先從生活裡的一個「為什麼」開始，再做操作，最後只救真正不會的。</p></div></div>
      <section class="grid three">
        <article class="card"><div class="mission-icon">🔎</div><h3>看一個現象</h3><p>${esc(next.phenomenon)}</p><button class="btn primary small" data-open-lesson="${next.id}">開始</button></article>
        <article class="card"><div class="mission-icon">🧠</div><h3>記一個訣竅</h3><p>${esc(tip)}</p>${speakButton(tip,'🔊 聽訣竅')}</article>
        <article class="card"><div class="mission-icon">🛟</div><h3>只救不會的</h3><p>${wrongCount?`目前有 ${wrongCount} 題待救援。`:'目前沒有待救援題目。'}</p><button class="btn secondary small" data-nav-go="rescue">開救援站</button></article>
      </section>
      <section class="card gentle-next"><div><span class="pill">想自己選別的單元？</span><h3>📚 本單元／換單元</h3><p>需要時再打開，不放在首頁嚇人。</p></div><button class="btn secondary" data-nav-go="units">選擇單元</button></section>
      ${sourceNote()}`;
  }

  function unitCard(u){
    const pct=completedPct(u);
    return `<article class="card unit-card"><span class="unit-no">${u.id}</span><span class="unit-emoji">${u.emoji}</span><h3>${esc(u.title)}</h3><p>${esc(u.subtitle)}</p><div class="progress"><i style="width:${pct}%"></i></div><span class="mini-stat">${pct}% 完成</span><div class="lesson-list">${u.lessons.map((id,i)=>lessonRow(id,i)).join('')}</div></article>`;
  }
  function examCheckpoint(title,scope,a,b){
    const sa=state.examScores[a]?.score, sb=state.examScores[b]?.score;
    return `<article class="card exam-card"><span class="pill">🔔 ${esc(scope)}</span><h3>${esc(title)}檢核站</h3><p>先做 A 卷找弱點，再用 B 卷驗證是否真的學會。</p><div class="scope-strip"><span class="score-badge">A ${sa===undefined?'—':sa}</span><span class="score-badge">B ${sb===undefined?'—':sb}</span></div><div class="hero-actions"><button class="btn primary small" data-open-exam="${a}">A 卷</button><button class="btn secondary small" data-open-exam="${b}">B 卷</button></div></article>`;
  }

  function renderUnits(){
    const next=findNextLesson(); const current=next.unit;
    main.innerHTML=`<section class="hero"><p class="eyebrow">需要時再選</p><h1>📚 本單元</h1><p>先看一個單元的 3 個活動；上方小按鈕可以切換別單元，不做大型學期地圖。</p>${speakButton('一次只看一個單元。每個單元只有三個活動，學完再往下一個。')}</section>
    <div class="unit-switcher">${DATA.units.map(u=>`<button class="unit-switch ${u.id===current?'active':''}" data-unit-focus="${u.id}">${u.emoji} ${u.id}</button>`).join('')}</div>
    <div id="unitFocus">${focusedUnitHtml(current)}</div>${sourceNote()}`;
  }
  function focusedUnitHtml(unitId){
    const u=DATA.units[Number(unitId)-1];
    return `<section class="card current-unit-focus"><div class="current-unit-top"><div><span class="pill">第${u.id}單元</span><h2>${u.emoji} ${esc(u.title)}</h2><p>${esc(u.subtitle)}</p>${speakButton(`${u.title}。${u.subtitle}`,'🔊 聽單元介紹')}</div><div class="unit-progress-big">${completedPct(u)}%</div></div><div class="lesson-list roomy">${u.lessons.map((id,i)=>lessonRow(id,i)).join('')}</div>${(u.id===2||u.id===4)?`<div class="exam-nudge"><b>📝 這個單元學完後有段考 A／B 卷。</b><button class="btn secondary small" data-nav-go="exams">去段考中心</button></div>`:''}</section>`;
  }

  function renderLab(){
    const id=runtime.labLessonId || findNextLesson().id; runtime.labLessonId=id; runtime.lessonId=id;
    const l=lessons[id],u=DATA.units[l.unit-1];
    main.innerHTML=`<section class="hero"><p class="eyebrow">直接在這裡操作，不再跳回課程</p><h1>🔬 科學實驗室</h1><p>選一個實驗後就留在這頁：先預測 → 操作 → 看證據 → 寫結論。</p>${speakButton('實驗室會直接在這裡操作，不會把你送回課程頁。先做預測，再操作，再用觀察證據說明結論。')}</section>
    <div class="lab-picker">${DATA.lessons.map(x=>`<button class="lab-chip ${x.id===id?'active':''}" data-lab-open="${x.id}">${DATA.units[x.unit-1].emoji} ${x.no}. ${esc(x.title)}</button>`).join('')}</div>
    <section class="card lab-workbench"><div class="lab-title-row"><div><span class="pill">${u.emoji} 第${l.unit}單元</span><h2>${esc(l.title)}</h2><p>${esc(l.experiment.question)}</p></div>${speakButton(`${l.experiment.question}。${l.experiment.variables}。${l.experiment.safety}`,'🔊 聽實驗說明')}</div>
      ${(l.miniLabs||[]).length?`<div class="section-head mini"><div><h3>一圈生活實驗</h3><p>挑一個就好，不必一次全做。</p></div></div><div class="mini-lab-ring standalone">${l.miniLabs.map((x,i)=>`<details class="mini-lab"><summary><span class="lab-badge">${i+1}</span><div><b>${esc(x.title)}</b><p>${esc(x.question)}</p></div></summary><div class="mini-lab-body"><p><b>怎麼做：</b>${esc(x.do)}</p><p><b>看什麼：</b>${esc(x.observe)}</p><p><b>為什麼：</b>${esc(x.why)}</p><p class="safety">⚠️ ${esc(x.safety)}</p>${speakButton(`${x.title}。問題：${x.question}。怎麼做：${x.do}。觀察：${x.observe}。原因：${x.why}。安全提醒：${x.safety}`,'🔊 聽這個實驗')}</div></details>`).join('')}</div>`:''}
      <div class="experiment-grid"><div><h3>網站模擬</h3>${renderSimulator(l)}</div><div><div class="experiment-box"><h3>公平實驗：要控制什麼？</h3><p>${esc(l.experiment.variables)}</p></div><div class="experiment-box"><h3>觀察證據</h3><p>${esc(l.experiment.observation)}</p></div><div class="experiment-box"><h3>用一句話下結論</h3><p>${esc(l.experiment.conclusion)}</p></div><p class="safety">⚠️ ${esc(l.experiment.safety)}</p></div></div>
    </section>`;
    setTimeout(()=>initStandaloneSimulator(l),0);
  }
  function initStandaloneSimulator(l){
    const s=l.sim;
    if(s==='sound') updateSound(); else if(s==='light') updateLight(); else if(s==='sun') updateSun(); else if(s==='planets') resetPlanets(); else if(s==='stars') updateStars(); else if(s==='air') updateAir(); else if(s==='fire'){runtime.sim.fire={fuel:true,oxygen:true,heat:true};updateFire();} else if(s==='rust'){runtime.sim.rust={water:true,oxygen:true,coat:false};updateRust();}
  }

  function renderGames(){
    main.innerHTML=`<section class="hero"><p class="eyebrow">每局都會換內容</p><h1>🎮 自然遊戲中心</h1><p>不再只有一題。第一、二單元已擴充到 30 組以上連連看與 20 組以上情境分類；科學島會從每課的大題庫抽題，重玩持續換情境。</p>${speakButton('先玩雙欄連連看，再玩快速分類，最後挑戰科學島。每次重玩都會從較大的題庫重新抽題。')}</section>
    <section class="grid two">${DATA.units.map(u=>`<article class="card game-unit"><div class="game-unit-head"><span class="unit-emoji" style="position:static">${u.emoji}</span><div><span class="pill">第${u.id}單元</span><h2>${esc(u.title)}</h2></div></div><p>三種玩法，重玩會換題。</p>${speakButton(`${u.title}。三種玩法：雙欄連連看、快速分類、科學島。`,'🔊 聽玩法')}<div class="game-buttons"><button class="btn primary small" data-match-open="${u.id}">🧩 雙欄連連看</button><button class="btn secondary small" data-classify-open="${u.id}">⚡ 快速分類</button><button class="btn secondary small" data-board-open="${u.id}">🎲 科學島</button></div></article>`).join('')}</section>`;
  }

  function renderRescue(){
    const items=Object.entries(state.wrongs||{});
    main.innerHTML=`<section class="hero"><p class="eyebrow">只重做真正不會的</p><h1>🛟 錯題救援站</h1><p>錯題依課程概念留下來；在救援題答對後就會從清單移除。</p>${speakButton('錯題救援站只保留真正答錯的內容。不要把已經會的全部重做，先讀解析，再回到相對應課程，用新的題目確認。')}</section>${items.length?`<div class="section-head"><div><h2>待救援 ${items.length} 題</h2><p>按「救這題」會直接回到該課救援關。</p></div></div><section>${items.map(([id,w])=>`<article class="rescue-item"><div><span class="pill">${esc(lessons[w.lessonId]?.title||'段考題')}</span><h3>${esc(w.prompt)}</h3><p>${esc(w.explain||'先回到課程重新確認證據。')}</p>${speakButton(`${w.prompt}。提示：${w.explain||'先回到課程重新確認證據。'}`,'🔊 聽題目與提示')}</div><button class="btn danger small" data-open-lesson="${w.lessonId}" data-stage="6">救這題</button></article>`).join('')}</section>`:`<section class="card empty-state"><div class="emoji">🌟</div><h2>目前沒有待救援題目</h2><p>做課內挑戰或 A／B 模擬考後，答錯的觀念會自動出現在這裡。</p><button class="btn primary" data-nav-go="units">去學一課</button></section>`}`;
  }

  function renderExams(){
    main.innerHTML=`<section class="hero"><p class="eyebrow">依公開學校考卷型態重新命題</p><h1>📝 段考 A／B 模擬卷</h1><p>每卷 40 分鐘、100 分。期中 A／B 已依公開學校定期評量的卷型重做：是非、選擇、配合、複選、看圖／實驗、填充與生活閱讀混合，不用同一種選擇題塞滿整卷。</p>${speakButton('模擬卷參考公開學校自然定期評量的題型結構重新命題，不複製原題。期中 A 卷和 B 卷考相同能力，但動物、樂器、光學和生活情境不同。')}</section><div class="exam-evidence-note"><b>期中考古卷型已納入：</b>是非、選擇、配合、複選、看圖、實驗變因、填充、生活閱讀；內容涵蓋牙齒／鳥嘴、調溫遷徙、自我保護、蟻蜂分工與蜂舞、繁殖遺傳、分貝與三要素、三類樂器、音箱、折射透鏡、近視、虹霓與光聲速度。</div><div class="section-head"><div><h2>第一次段考｜第一、二單元</h2><p>動物世界＋探索聲光世界</p></div></div><section class="grid two">${examCard(exams.midA)}${examCard(exams.midB)}</section><div class="section-head"><div><h2>第二次段考｜第三、四單元</h2><p>神祕的天空＋燃燒與生鏽</p></div></div><section class="grid two">${examCard(exams.finA)}${examCard(exams.finB)}</section>${sourceNote()}`;
  }
  function examCard(e){
    const r=state.examScores[e.id];
    const types=[...new Set(e.questions.map(q=>q.type))];
    return `<article class="card exam-card ${e.version==='B'?'b':''}"><span class="pill">${e.version} 卷・${e.time} 分鐘</span><h3>${esc(e.title)}</h3><p>${esc(e.scope)}｜${e.questions.length} 個作答項目｜100 分</p><p class="exam-style">${esc(e.examStyle||'')}</p><div class="scope-strip"><span class="score-badge">${r?`${r.score} 分`:'尚未作答'}</span><span class="scope-pill">${types.includes('multi')?'複選＋':''}圖表／實驗</span></div><button class="btn primary" data-open-exam="${e.id}">${r?'再挑戰一次':'開始作答'}</button></article>`;
  }

  // Lessons
  function openLesson(id,stage=0){
    if(!lessons[id]) return; runtime.lessonId=id; runtime.stage=Number(stage)||0; renderLesson(); lessonDialog.showModal();
  }
  const stageNames=['👀 生活現場','🕵️ 科學破案','🔬 實驗環','🧾 找證據','⚡ 一句記住','🎯 6題挑戰','🛟 救援'];
  function renderLesson(){
    const l=lessons[runtime.lessonId], u=DATA.units[l.unit-1];
    const speech=l.detailSections?.map(x=>`${x.title}。${x.body}。例子：${x.examples}。`).join('') || l.core.join('。');
    lessonContent.innerHTML=`<header class="lesson-hero"><p class="eyebrow">${u.emoji} 第${l.unit}單元・活動 ${l.no}</p><h1>${esc(l.title)}</h1><p class="lead">${esc(l.subtitle)}</p><div class="hero-actions">${speakButton(`${l.title}。${l.subtitle}。${speech}`,'🔊 聽完整導讀')}<span class="pill">完整小節・可朗讀</span></div></header><nav class="lesson-stage-nav">${stageNames.map((n,i)=>`<button class="stage-tab ${runtime.stage===i?'active':''}" data-lesson-stage="${i}">${n}</button>`).join('')}</nav><section class="stage-panel">${renderStage(l,runtime.stage)}</section>`;
    setTimeout(()=>initCurrentSimulator(l),0);
  }
  function renderStage(l,stage){
    if(stage===0){
      const scenes=l.lifeScenes||[];
      return `<h2>先遇到生活，再來學科學</h2><div class="big-question">${esc(l.phenomenon)}</div>${scenes.length?`<div class="life-scene-grid">${scenes.map(x=>`<details class="life-scene"><summary><span>${x.icon||'🔎'}</span><div><b>${esc(x.title)}</b><p>${esc(x.question)}</p></div></summary><div class="life-answer">💡 ${esc(x.answer)} ${speakButton(`${x.title}。${x.question}。${x.answer}`,'🔊 聽這個情境')}</div></details>`).join('')}</div>`:''}<div class="hero-actions">${speakButton(`${l.phenomenon}。${scenes.map(x=>x.question+'。'+x.answer).join('。')}`,'🔊 聽生活導讀')}<button class="btn primary" data-lesson-stage="1">我有感了 → 開始破案</button></div>`;
    }
    if(stage===1){
      const sections=l.detailSections||l.core.map((body,i)=>({title:`重點 ${i+1}`,body,examples:'',trap:''}));
      return `<h2>科學破案卡</h2><p class="stage-intro">這一課共有 ${sections.length} 張破案卡。一次打開一張就好；先猜，再看證據，不必一次把全部內容讀完。</p><div class="detail-stack detail-fold-stack">${sections.map((x,i)=>`<details class="detail-card detail-fold" ${i===0?'open':''}><summary><span class="detail-num">${i+1}</span><span><b>${esc(x.title)}</b><small>${i===0?'先從這張開始':'點開再看'}</small></span></summary><div class="detail-fold-body"><p>${esc(x.body)}</p>${x.visual?renderMiniVisual(x.visual):''}${x.examples?`<div class="example-line"><b>生活現場：</b>${esc(x.examples)}</div>`:''}${x.trap?`<div class="trap-line"><b>🧠 科學破案：</b>${esc(x.trap)}</div>`:''}${speakButton(`${x.title}。${x.body}。${x.examples}。${x.trap}`,'🔊 聽這張')}</div></details>`).join('')}</div><div class="hero-actions"><button class="btn primary" data-lesson-stage="2">下一關：進實驗環</button></div>`;
    }
    if(stage===2){
      const labs=l.miniLabs||[];
      return `<h2>🔬 科學實驗環：猜 → 做 → 看 → 說</h2><p class="stage-intro">不用一次做完。先挑一個最有感的生活實驗；每個都會把同一概念從不同角度叫回來。</p>${labs.length?`<div class="mini-lab-ring">${labs.map((x,i)=>`<details class="mini-lab"><summary><span class="lab-badge">${i+1}</span><div><b>${esc(x.title)}</b><p>${esc(x.question)}</p></div></summary><div class="mini-lab-body"><p><b>怎麼做：</b>${esc(x.do)}</p><p><b>看什麼：</b>${esc(x.observe)}</p><p><b>為什麼：</b>${esc(x.why)}</p><p class="safety">⚠️ ${esc(x.safety)}</p>${speakButton(`${x.title}。問題：${x.question}。怎麼做：${x.do}。觀察：${x.observe}。原因：${x.why}。安全提醒：${x.safety}`,'🔊 聽這個實驗')}</div></details>`).join('')}</div>`:''}<div class="experiment-grid"><div class="experiment-box"><h3>網站模擬｜先猜</h3><p>${esc(l.experiment.question)}</p><div id="simArea">${renderSimulator(l)}</div></div><div class="experiment-box"><h3>公平實驗提醒</h3><p>${esc(l.experiment.variables)}</p><p class="safety">⚠️ ${esc(l.experiment.safety)}</p>${speakButton(`${l.experiment.question}。${l.experiment.variables}。安全提醒：${l.experiment.safety}`,'🔊 聽實驗說明')}</div></div><div class="hero-actions"><button class="btn primary" data-lesson-stage="3">我做過／看懂了 → 找證據</button></div>`;
    }
    if(stage===3) return `<h2>從觀察走到結論</h2><div class="experiment-grid"><div class="experiment-box"><h3>操作步驟</h3><ol class="steps">${l.experiment.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div><div><div class="experiment-box"><h3>觀察到什麼？</h3><p>${esc(l.experiment.observation)}</p></div><div class="experiment-box" style="margin-top:12px"><h3>證據支持的結論</h3><p>${esc(l.experiment.conclusion)}</p></div></div></div><div class="hero-actions">${speakButton(`${l.experiment.observation}。因此，${l.experiment.conclusion}`,'🔊 聽證據與結論')}<button class="btn primary" data-lesson-stage="4">下一關：記憶訣竅</button></div>`;
    if(stage===4) return `<h2>把重點變成容易叫回來的記憶</h2>${l.memory.map((m,i)=>`<div class="memory-hook">⚡ ${i+1}. ${esc(m)}</div>`).join('')}<div class="hero-actions">${speakButton(l.memory.join('。'),'🔊 朗讀記憶法')}<button class="btn primary" data-lesson-stage="5">下一關：6 題挑戰</button></div>`;
    if(stage===5) return renderQuizStage(l);
    return renderLessonRescue(l);
  }

  function renderQuizStage(l){
    let run=runtime.quizRuns[l.id];
    if(!run) run=startQuiz(l.id,'混合');
    const answered=Object.keys(run.answers).length, correct=Object.values(run.answers).filter(x=>x.correct).length;
    const summary=answered===run.questions.length?`<div class="quiz-summary">完成！答對 ${correct}/${run.questions.length}。${correct>=4?'達到本課通過線，已記錄進度。':'先到錯題救援再試一次。'}</div>`:'';
    if(answered===run.questions.length && correct>=4 && !state.completed.includes(l.id)){
      state.completed.push(l.id); state.stars+=5; saveState(); setTimeout(()=>toast('本課完成！⭐ +5'),30);
    }
    return `<h2>分級挑戰｜每次 6 題</h2><p>基礎定位、應用連結、挑戰推理；「混合」會從三種難度抽題。</p><div class="level-switch">${['基礎','應用','挑戰','混合'].map(x=>`<button class="level-btn ${run.level===x?'active':''}" data-quiz-level="${x}">${x}</button>`).join('')}</div>${summary}<div>${run.questions.map((q,i)=>quizCard(q,i,run.answers[q.id])).join('')}</div><div class="hero-actions"><button class="btn secondary" data-quiz-restart>換一組 6 題</button><button class="btn primary" data-lesson-stage="6">到錯題救援</button></div>`;
  }
  function startQuiz(id,level){
    const l=lessons[id]; let pool=level==='混合'?l.questions:l.questions.filter(q=>q.level===level);
    if(pool.length<6) pool=[...pool,...l.questions.filter(q=>!pool.includes(q))];
    const run={level,questions:shuffle(pool).slice(0,6),answers:{}}; runtime.quizRuns[id]=run; return run;
  }
  function quizCard(q,i,res){
    return `<article class="quiz-card"><div class="qtitle">${i+1}. ${esc(q.prompt)} ${speakButton(q.prompt,'🔊')}</div><div class="quiz-options">${q.choices.map((c,idx)=>`<button class="choice ${res?(idx===q.answer?'correct':(idx===res.choice&&!res.correct?'wrong':'')):''}" data-quiz-choice="${q.id}" data-choice="${idx}" ${res?'disabled':''}>${String.fromCharCode(65+idx)}. ${esc(c)}</button>`).join('')}</div>${res?`<div class="explain">${res.correct?'✅ 正確。':'❌ 先看證據：'}${esc(q.explain)}</div>`:''}</article>`;
  }
  function renderLessonRescue(l){
    const wrongs=Object.entries(state.wrongs||{}).filter(([,w])=>w.lessonId===l.id);
    if(!wrongs.length) return `<section class="empty-state"><div class="emoji">🌟</div><h2>這一課目前沒有待救援題</h2><p>可以回到挑戰關再抽一組題目，或前往下一課。</p><div class="hero-actions"><button class="btn secondary" data-lesson-stage="5">再挑戰</button><button class="btn primary" data-mark-complete="${l.id}">✅ 標記本課完成</button></div></section>`;
    return `<h2>這一課有 ${wrongs.length} 題要救回來</h2><p>答對後會立即從救援清單移除。</p>${wrongs.map(([id,w],i)=>{const q=findQuestion(id,w.lessonId,w);return `<article class="quiz-card"><div class="qtitle">${i+1}. ${esc(w.prompt)} ${speakButton(`${w.prompt}。提示：${w.explain||''}`,'🔊')}</div>${q.type==='mc'?`<div class="quiz-options">${q.choices.map((c,j)=>`<button class="choice" data-rescue-choice="${id}" data-choice="${j}">${String.fromCharCode(65+j)}. ${esc(c)}</button>`).join('')}</div>`:`<p>${esc(w.explain)}</p><button class="btn secondary small" data-clear-wrong="${id}">我已重新確認</button>`}<div class="explain">提示：${esc(w.explain||'回到概念與證據重新確認。')}</div></article>`;}).join('')}`;
  }
  function findQuestion(qid,lessonId,fallback={}){
    const l=lessons[lessonId]; const q=l?.questions.find(x=>x.id===qid); return q||fallback;
  }
  function addWrong(q,lessonId){
    state.wrongs[q.id]={id:q.id,lessonId:lessonId||q.lessonId,prompt:q.prompt,explain:q.explain,tries:(state.wrongs[q.id]?.tries||0)+1,when:Date.now(),type:q.type,choices:q.choices,answer:q.answer,answers:q.answers}; saveState();
  }

  function renderMiniVisual(type){
    const wrap=(svg,label='概念圖')=>`<div class="concept-visual" data-visual-type="${esc(type)}" role="group" aria-label="${esc(label)}">${svg}</div>`;
    const base=(inner,label)=>wrap(`<svg viewBox="0 0 700 230" role="img" aria-label="${esc(label)}"><rect width="700" height="230" rx="18" fill="#fbfefd"/>${inner}</svg>`,label);
    if(type==='teeth') return base(`<g font-family="sans-serif" text-anchor="middle"><text x="110" y="42" font-size="24" font-weight="700">門齒</text><path d="M72 65h76l-9 68H81z" fill="#fff" stroke="#64748b" stroke-width="3"/><text x="110" y="166" font-size="20">切、咬斷</text><text x="350" y="42" font-size="24" font-weight="700">犬齒</text><path d="M328 62q22-20 44 0l-13 82h-18z" fill="#fff" stroke="#64748b" stroke-width="3"/><text x="350" y="166" font-size="20">刺、撕裂</text><text x="590" y="42" font-size="24" font-weight="700">臼齒</text><path d="M545 72q45-30 90 0l-11 65h-68z" fill="#fff" stroke="#64748b" stroke-width="3"/><text x="590" y="166" font-size="20">壓、磨碎</text></g>`,'三種牙齒與功能');
    if(type==='beaks') return base(`<g font-family="sans-serif"><text x="55" y="42" font-size="22">長細嘴</text><path d="M65 90h145" stroke="#d97706" stroke-width="10" stroke-linecap="round"/><text x="55" y="145" font-size="18">深入花朵／縫隙</text><text x="270" y="42" font-size="22">扁長嘴</text><path d="M280 95h145" stroke="#d97706" stroke-width="22" stroke-linecap="round"/><text x="270" y="145" font-size="18">淺水掃食</text><text x="500" y="42" font-size="22">鉤狀嘴</text><path d="M520 65q105 10 60 78q-22 22-52 3q38-22 16-56" fill="none" stroke="#d97706" stroke-width="12"/><text x="500" y="170" font-size="18">撕扯獵物</text></g>`,'鳥嘴形狀與覓食');
    if(type==='temperature') return base(`<text x="60" y="48" font-size="25">❄️ 冷</text><text x="55" y="115" font-size="48">🐧🐧🐧</text><text x="45" y="165" font-size="18">群聚、膨毛、脂肪保溫</text><text x="415" y="48" font-size="25">☀️ 熱</text><text x="430" y="115" font-size="48">🐕💨</text><text x="395" y="165" font-size="18">喘氣、躲陰、泡水散熱</text><text x="170" y="210" font-size="17">卵生 ≠ 外溫：鳥下蛋，但鳥是內溫動物</text>`,'動物冷熱調節');
    if(type==='migration') return base(`<text x="55" y="70" font-size="46">🦋</text><text x="300" y="70" font-size="46">🦆</text><text x="555" y="70" font-size="46">🦬</text><path d="M110 78C210 20 250 20 305 78" fill="none" stroke="#0f766e" stroke-width="5" stroke-dasharray="9 7"/><path d="M355 78C455 20 500 20 560 78" fill="none" stroke="#0f766e" stroke-width="5" stroke-dasharray="9 7"/><text x="75" y="150" font-size="20">找食物</text><text x="260" y="150" font-size="20">避寒暑</text><text x="445" y="150" font-size="20">找水源</text><text x="560" y="150" font-size="20">繁殖</text><text x="180" y="202" font-size="18">遷徙不是旅行：是提高生存與繁殖成功率</text>`,'遷徙的生存功能');
    if(type==='camouflage') return base(`<rect x="55" y="45" width="250" height="135" rx="18" fill="#e6f0e2"/><text x="85" y="105" font-size="55">🦊</text><text x="190" y="105" font-size="55">🦋</text><text x="70" y="155" font-size="19">保護色：融入背景</text><rect x="390" y="45" width="250" height="135" rx="18" fill="#efe5d5"/><text x="425" y="105" font-size="55">🦀</text><text x="535" y="105" font-size="55">🦗</text><text x="410" y="155" font-size="19">偽裝：外形像環境物</text>`,'保護色與偽裝');
    if(type==='defense') return base(`<text x="55" y="80" font-size="52">🦔</text><text x="190" y="80" font-size="52">🐢</text><text x="325" y="80" font-size="52">🦨</text><text x="460" y="80" font-size="52">🐍</text><text x="595" y="80" font-size="52">🦎</text><text x="45" y="145" font-size="17">刺</text><text x="180" y="145" font-size="17">硬殼</text><text x="305" y="145" font-size="17">臭液</text><text x="430" y="145" font-size="17">威嚇</text><text x="565" y="145" font-size="17">斷尾</text><text x="165" y="205" font-size="18">方法不同，目的相同：降低被捕食的機會</text>`,'動物多種防禦方式');
    if(type==='mimicry') return base(`<text x="110" y="85" font-size="58">🐝</text><text x="270" y="85" font-size="58">🪰</text><path d="M190 80h55" stroke="#ef4444" stroke-width="4" stroke-dasharray="7 6"/><text x="55" y="145" font-size="20">蜜蜂：可能螫人</text><text x="220" y="145" font-size="20">食蚜蠅：外形像蜂</text><text x="405" y="75" font-size="28">「看起來像危險者」</text><text x="405" y="120" font-size="22">讓捕食者猶豫</text><text x="405" y="165" font-size="18">這叫擬態，不等於保護色</text>`,'擬態與食蚜蠅');
    if(type==='social') return base(`<circle cx="125" cy="110" r="58" fill="#eef9f6"/><text x="88" y="125" font-size="46">🐜🐜</text><circle cx="350" cy="110" r="58" fill="#fffbea"/><text x="313" y="125" font-size="46">🐝🐝</text><circle cx="575" cy="110" r="58" fill="#f7fbf8"/><text x="538" y="125" font-size="46">🐒🐒</text><text x="65" y="205" font-size="18">共同生活＋分工／合作＋溝通，才稱得上社會行為</text>`,'什麼是動物社會行為');
    if(type==='signals') return base(`<text x="65" y="75" font-size="46">🐝💃</text><text x="250" y="75" font-size="46">🐜👃</text><text x="435" y="75" font-size="46">🐒📣</text><text x="590" y="75" font-size="46">✨</text><text x="45" y="135" font-size="18">動作</text><text x="245" y="135" font-size="18">氣味</text><text x="430" y="135" font-size="18">聲音</text><text x="585" y="135" font-size="18">光訊號</text><text x="170" y="205" font-size="18">動物用不同訊號傳遞食物、警戒、求偶與群體資訊</text>`,'動物溝通訊號');
    if(type==='ants') return base(`<g text-anchor="middle" font-family="sans-serif"><text x="90" y="62" font-size="40">👑🐜</text><text x="90" y="110" font-size="22">蟻后</text><text x="90" y="143" font-size="18">主要產卵</text><text x="265" y="62" font-size="40">🐜</text><text x="265" y="110" font-size="22">雄蟻</text><text x="265" y="143" font-size="18">主要交配</text><text x="440" y="62" font-size="40">🐜</text><text x="440" y="110" font-size="22">工蟻</text><text x="440" y="143" font-size="18">覓食／育幼／維巢</text><text x="610" y="62" font-size="40">💪🐜</text><text x="610" y="110" font-size="22">兵蟻*</text><text x="610" y="143" font-size="18">部分物種防禦</text></g>`,'螞蟻社會分工');
    if(type==='bees') return base(`<g text-anchor="middle" font-family="sans-serif"><text x="120" y="70" font-size="48">👑🐝</text><text x="120" y="120" font-size="22">蜂王：產卵</text><text x="350" y="70" font-size="48">🐝</text><text x="350" y="120" font-size="22">雄蜂：交配</text><text x="585" y="70" font-size="48">🐝🐝</text><text x="585" y="120" font-size="22">工蜂：採蜜、育幼…</text><text x="350" y="190" font-size="18">蜂王不是「總指揮」：群體靠訊號、本能與互動運作</text></g>`,'蜜蜂社會分工');
    if(type==='bee_dance'||type==='bee_science') return base(`<circle cx="585" cy="45" r="27" fill="#fbbf24"/><text x="558" y="90" font-size="17">太陽</text><rect x="70" y="35" width="205" height="160" rx="20" fill="#f4d06f" opacity=".35"/><path d="M175 165c-42-35-42-75 0-100c42 25 42 65 0 100z" fill="none" stroke="#7c4a03" stroke-width="5"/><path d="M175 125l75-55" stroke="#ef4444" stroke-width="7" stroke-linecap="round"/><text x="72" y="218" font-size="18">蜂巢內：搖擺段角度</text><path d="M330 165L565 82" stroke="#0f766e" stroke-width="5" stroke-dasharray="10 7"/><text x="355" y="205" font-size="18">對應蜜源相對太陽的方向</text>`,'蜜蜂搖擺舞與蜜源方向');
    if(type==='macaque') return base(`<text x="70" y="90" font-size="54">🐒</text><text x="145" y="58" font-size="20">外婆—媽媽—女兒常留在原群</text><path d="M165 92h330" stroke="#0f766e" stroke-width="5"/><text x="545" y="90" font-size="54">🐒➡️</text><text x="445" y="155" font-size="18">成年公猴常離開出生群</text><text x="110" y="190" font-size="18">母系社會 ≠ 沒有公猴</text>`,'臺灣獼猴母系社會');
    if(['reproduction_cycle','courtship','nest','fertilization','birth','parentalcare','inheritance'].includes(type)) return base(`<g text-anchor="middle" font-family="sans-serif"><text x="70" y="62" font-size="40">🦩</text><text x="70" y="110" font-size="18">求偶</text><text x="205" y="62" font-size="40">🦋</text><text x="205" y="110" font-size="18">交配／受精</text><text x="350" y="62" font-size="40">🥚 / 🤰</text><text x="350" y="110" font-size="18">卵生／胎生</text><text x="510" y="62" font-size="40">🐣</text><text x="510" y="110" font-size="18">孵化／出生</text><text x="640" y="62" font-size="40">🦘</text><text x="640" y="110" font-size="18">育幼</text></g><text x="170" y="190" font-size="18">親子相似但不完全一樣：遺傳特徵＋個體差異</text>`,'動物繁殖與育幼歷程');

    // Unit 2-1: every card intentionally has a distinct visual.
    if(type==='noise_context') return base(`<text x="55" y="55" font-size="46">🎵</text><text x="135" y="55" font-size="25">喜歡的音樂</text><path d="M65 120C95 80 125 160 155 120S215 80 245 120" fill="none" stroke="#0f766e" stroke-width="6"/><text x="400" y="55" font-size="46">🚧</text><text x="485" y="55" font-size="25">施工聲</text><path d="M405 120l25-50l30 100l30-90l30 80l30-40" fill="none" stroke="#ef4444" stroke-width="6"/><text x="85" y="200" font-size="18">「好不好聽」是感受</text><text x="405" y="200" font-size="18">「太大聲／太久」才是聽力風險重點</text>`,'樂音與噪音的生活情境');
    if(type==='decibel') return base(`<rect x="85" y="40" width="220" height="145" rx="24" fill="#fff" stroke="#94a3b8" stroke-width="4"/><text x="130" y="92" font-size="22">聲級計</text><text x="125" y="148" font-size="45" font-weight="700">72 dB</text><path d="M400 170V65" stroke="#334155" stroke-width="8"/><path d="M390 170h20" stroke="#334155" stroke-width="8"/><rect x="430" y="100" width="65" height="70" fill="#86efac"/><rect x="510" y="70" width="65" height="100" fill="#fde68a"/><rect x="590" y="40" width="65" height="130" fill="#fca5a5"/><text x="430" y="205" font-size="16">較低</text><text x="515" y="205" font-size="16">較高</text><text x="590" y="205" font-size="16">很高</text>`,'聲級計與分貝');
    if(type==='wave_amp') return base(`<line x1="45" y1="115" x2="655" y2="115" stroke="#cbd5e1" stroke-width="2"/><path d="M55 115C85 95 115 135 145 115S205 95 235 115S295 135 325 115" fill="none" stroke="#0f766e" stroke-width="5"/><path d="M380 115C410 55 440 175 470 115S530 55 560 115S620 175 650 115" fill="none" stroke="#7c3aed" stroke-width="5"/><text x="115" y="65" font-size="20">振幅小 → 較小聲</text><text x="430" y="35" font-size="20">振幅大 → 較大聲</text><line x1="615" y1="55" x2="615" y2="175" stroke="#ef4444" stroke-width="3"/><text x="525" y="210" font-size="17">振幅看「上下擺多大」</text>`,'聲波振幅與音量');
    if(type==='noise_control') return base(`<rect x="45" y="55" width="175" height="120" rx="18" fill="#fff5f5"/><text x="85" y="92" font-size="28">① 源頭</text><text x="70" y="132" font-size="19">關小聲／維修</text><text x="70" y="160" font-size="19">降低產生量</text><path d="M240 115h55" stroke="#94a3b8" stroke-width="5"/><rect x="300" y="55" width="175" height="120" rx="18" fill="#fffbea"/><text x="340" y="92" font-size="28">② 路徑</text><text x="325" y="132" font-size="19">隔音／拉遠</text><text x="325" y="160" font-size="19">減少傳到耳朵</text><path d="M495 115h55" stroke="#94a3b8" stroke-width="5"/><rect x="555" y="55" width="110" height="120" rx="18" fill="#eefbf7"/><text x="575" y="92" font-size="28">③ 耳</text><text x="570" y="137" font-size="19">耳罩</text><text x="570" y="162" font-size="19">縮時間</text>`,'降低噪音的三層策略');
    if(type==='hearing') return base(`<circle cx="130" cy="105" r="70" fill="#eef9ff"/><text x="85" y="125" font-size="58">👂</text><path d="M245 105h240" stroke="#0f766e" stroke-width="10" stroke-linecap="round"/><circle cx="300" cy="105" r="22" fill="#86efac"/><circle cx="390" cy="105" r="28" fill="#fde68a"/><circle cx="485" cy="105" r="36" fill="#fca5a5"/><text x="255" y="55" font-size="18">小聲／短時間</text><text x="425" y="55" font-size="18">大聲＋久</text><text x="250" y="185" font-size="19">風險取決於「聲音強度 × 暴露時間」</text>`,'聲音強度與暴露時間對聽力的影響');

    // Unit 2-2 distinct visuals.
    if(type==='instrument_types') return base(`<g text-anchor="middle" font-family="sans-serif"><text x="115" y="65" font-size="52">🎸</text><text x="115" y="115" font-size="22">弦樂</text><text x="115" y="150" font-size="18">弦振動</text><text x="350" y="65" font-size="52">🪈</text><text x="350" y="115" font-size="22">管樂</text><text x="350" y="150" font-size="18">空氣柱振動</text><text x="585" y="65" font-size="52">🥁</text><text x="585" y="115" font-size="22">打擊樂</text><text x="585" y="150" font-size="18">膜／本體振動</text></g><text x="210" y="205" font-size="18">分類關鍵：主要「誰」在振動發聲</text>`,'三大類樂器的主要振動體');
    if(type==='frequency') return base(`<line x1="45" y1="75" x2="655" y2="75" stroke="#d1d5db"/><path d="M55 75C95 35 135 115 175 75S255 35 295 75" fill="none" stroke="#0f766e" stroke-width="5"/><text x="80" y="35" font-size="18">低頻：每秒振動較少</text><line x1="45" y1="165" x2="655" y2="165" stroke="#d1d5db"/><path d="M55 165C70 125 85 205 100 165S130 125 145 165S175 205 190 165S220 125 235 165S265 205 280 165S310 125 325 165" fill="none" stroke="#7c3aed" stroke-width="5"/><text x="390" y="150" font-size="18">高頻：每秒振動較多 → 音調較高</text><text x="390" y="190" font-size="18">Hz＝每秒振動次數</text>`,'頻率與音調高低');
    if(type==='strings') return base(`<line x1="80" y1="60" x2="610" y2="60" stroke="#334155" stroke-width="5"/><circle cx="220" cy="60" r="8" fill="#ef4444"/><circle cx="480" cy="60" r="8" fill="#ef4444"/><text x="145" y="105" font-size="19">短弦</text><path d="M90 145h210" stroke="#0f766e" stroke-width="7"/><text x="95" y="190" font-size="18">短／緊 → 通常高音</text><path d="M390 145h220" stroke="#7c3aed" stroke-width="3"/><text x="405" y="190" font-size="18">長／鬆 → 通常低音</text><text x="245" y="225" font-size="17">公平比較：一次只改長度或張力</text>`,'弦長與鬆緊對音調');
    if(type==='air_column') return base(`<rect x="90" y="45" width="90" height="145" rx="14" fill="#d9f2ff" stroke="#5b8ea6" stroke-width="4"/><rect x="300" y="85" width="90" height="105" rx="14" fill="#d9f2ff" stroke="#5b8ea6" stroke-width="4"/><rect x="510" y="120" width="90" height="70" rx="14" fill="#d9f2ff" stroke="#5b8ea6" stroke-width="4"/><text x="72" y="220" font-size="18">長空氣柱：低</text><text x="280" y="220" font-size="18">中</text><text x="500" y="220" font-size="18">短空氣柱：高</text><path d="M110 30h50m210 20h50m210 30h50" stroke="#ef4444" stroke-width="5"/>`,'空氣柱長度與音調');
    if(type==='percussion') return base(`<g fill="#0f766e"><rect x="70" y="40" width="70" height="145" rx="8"/><rect x="190" y="65" width="70" height="120" rx="8"/><rect x="310" y="90" width="70" height="95" rx="8"/><rect x="430" y="115" width="70" height="70" rx="8"/></g><text x="65" y="215" font-size="18">長音板：較低</text><text x="420" y="215" font-size="18">短音板：較高</text><circle cx="600" cy="110" r="60" fill="#fde68a" stroke="#d97706" stroke-width="4"/><line x1="545" y1="80" x2="655" y2="80" stroke="#7c3aed" stroke-width="3"/><text x="545" y="185" font-size="17">鼓面張力也會影響音調</text>`,'鐵琴與鼓的音調');
    if(type==='sound_three') return base(`<text x="70" y="45" font-size="22" font-weight="700">音量＝振幅</text><path d="M55 95C85 55 115 135 145 95S205 55 235 95" fill="none" stroke="#0f766e" stroke-width="5"/><text x="270" y="45" font-size="22" font-weight="700">音調＝頻率</text><path d="M270 95C285 55 300 135 315 95S345 55 360 95S390 135 405 95" fill="none" stroke="#7c3aed" stroke-width="5"/><text x="465" y="45" font-size="22" font-weight="700">音色＝波形／頻譜</text><path d="M470 95q20-45 40 0t40 0t40 0t40 0" fill="none" stroke="#f59e0b" stroke-width="5"/><text x="80" y="180" font-size="18">大小</text><text x="310" y="180" font-size="18">高低</text><text x="520" y="180" font-size="18">聲音指紋</text>`,'聲音三要素');
    if(type==='voice') return base(`<text x="60" y="62" font-size="50">🗣️</text><path d="M155 62h145" stroke="#ef4444" stroke-width="8"/><path d="M155 95h145" stroke="#ef4444" stroke-width="4"/><text x="150" y="135" font-size="18">聲帶長短、厚薄與張力</text><rect x="390" y="45" width="220" height="125" rx="30" fill="#eef9ff" stroke="#7db8cc" stroke-width="4"/><text x="420" y="90" font-size="24">口腔／鼻腔／咽腔</text><text x="430" y="128" font-size="19">共鳴塑造音色</text><text x="115" y="205" font-size="18">平均趨勢不是規則：不能只靠音高判斷個人性別</text>`,'人聲的聲帶與共鳴');
    if(type==='soundbox') return base(`<line x1="70" y1="70" x2="260" y2="70" stroke="#334155" stroke-width="6"/><path d="M100 70q20 40 40 0t40 0t40 0" fill="none" stroke="#ef4444" stroke-width="4"/><text x="70" y="125" font-size="18">小振動源：推動空氣有限</text><path d="M305 70h70" stroke="#64748b" stroke-width="4"/><text x="330" y="55" font-size="24">→</text><rect x="405" y="45" width="190" height="115" rx="16" fill="#e8d5b7" stroke="#a67c52" stroke-width="4"/><line x1="435" y1="60" x2="565" y2="60" stroke="#334155" stroke-width="6"/><path d="M605 85q35 25 0 50m18-70q60 40 0 80" fill="none" stroke="#0ea5e9" stroke-width="5"/><text x="405" y="205" font-size="18">音箱：耦合較大表面＋共鳴，更有效推動空氣</text>`,'音箱增強聲音的原理');

    // Unit 2-3 distinct visuals.
    if(type==='straight_light') return base(`<circle cx="80" cy="115" r="28" fill="#fbbf24"/><text x="58" y="165" font-size="18">光源</text><rect x="255" y="45" width="35" height="140" fill="#d1d5db"/><circle cx="272" cy="115" r="10" fill="#fff"/><rect x="470" y="45" width="35" height="140" fill="#d1d5db"/><circle cx="487" cy="115" r="10" fill="#fff"/><line x1="108" y1="115" x2="620" y2="115" stroke="#ef4444" stroke-width="6"/><text x="235" y="215" font-size="18">孔洞對準時才能看到光：光在均勻介質中近似直線前進</text>`,'光沿直線前進');
    if(type==='refraction') return base(`<rect width="700" height="105" rx="18" fill="#eef9ff"/><rect y="105" width="700" height="125" fill="#d9f2ff"/><line x1="0" y1="105" x2="700" y2="105" stroke="#5b8ea6" stroke-width="3"/><line x1="160" y1="30" x2="350" y2="105" stroke="#ef4444" stroke-width="6"/><line x1="350" y1="105" x2="440" y2="220" stroke="#ef4444" stroke-width="6"/><line x1="350" y1="20" x2="350" y2="220" stroke="#64748b" stroke-dasharray="8 7"/><text x="40" y="45" font-size="20">空氣</text><text x="40" y="145" font-size="20">水</text><text x="420" y="85" font-size="18">跨介質：方向改變</text>`,'光從空氣進入水的折射');
    if(type==='mirage') return base(`<rect width="700" height="165" rx="18" fill="#dff2ff"/><rect y="165" width="700" height="65" fill="#d8b26e"/><text x="55" y="70" font-size="45">🌴</text><text x="580" y="95" font-size="45">👀</text><path d="M110 95C250 120 350 210 560 115" fill="none" stroke="#ef4444" stroke-width="5"/><path d="M110 105C240 135 360 205 560 125" fill="none" stroke="#f59e0b" stroke-width="3"/><text x="175" y="35" font-size="19">近地面熱空氣密度不同 → 光路逐漸彎曲</text><text x="180" y="215" font-size="18">眼睛沿直線反推位置，可能看成「地面有倒影／水」</text>`,'海市蜃樓的折射光路');
    if(type==='convex') return base(`<line x1="70" y1="65" x2="300" y2="65" stroke="#ef4444" stroke-width="4"/><line x1="70" y1="115" x2="300" y2="115" stroke="#ef4444" stroke-width="4"/><line x1="70" y1="165" x2="300" y2="165" stroke="#ef4444" stroke-width="4"/><path d="M320 35q70 80 0 160q-70-80 0-160z" fill="#d9f2ff" stroke="#5b8ea6" stroke-width="4"/><line x1="335" y1="65" x2="570" y2="115" stroke="#ef4444" stroke-width="4"/><line x1="335" y1="115" x2="570" y2="115" stroke="#ef4444" stroke-width="4"/><line x1="335" y1="165" x2="570" y2="115" stroke="#ef4444" stroke-width="4"/><circle cx="570" cy="115" r="7" fill="#f59e0b"/><text x="505" y="180" font-size="18">會聚到焦點附近</text>`,'凸透鏡會聚平行光');
    if(type==='lens_image') return base(`<path d="M350 30q65 85 0 170q-65-85 0-170z" fill="#d9f2ff" stroke="#5b8ea6" stroke-width="4"/><line x1="50" y1="180" x2="650" y2="180" stroke="#64748b"/><text x="70" y="70" font-size="42">🌼</text><line x1="105" y1="75" x2="350" y2="75" stroke="#ef4444" stroke-width="4"/><line x1="350" y1="75" x2="570" y2="150" stroke="#ef4444" stroke-width="4"/><line x1="105" y1="75" x2="350" y2="180" stroke="#f59e0b" stroke-width="4"/><line x1="350" y1="180" x2="565" y2="75" stroke="#f59e0b" stroke-width="4"/><text x="520" y="65" font-size="42" transform="rotate(180 545 65)">🌼</text><text x="55" y="215" font-size="17">物體距離不同時，可看到正立放大虛像或形成倒立實像</text>`,'凸透鏡成像與物距');
    if(type==='focus_safe') return base(`<circle cx="105" cy="70" r="34" fill="#fbbf24"/><path d="M145 70h160" stroke="#f59e0b" stroke-width="5"/><path d="M330 35q65 80 0 160q-65-80 0-160z" fill="#d9f2ff" stroke="#5b8ea6" stroke-width="4"/><line x1="345" y1="70" x2="555" y2="120" stroke="#ef4444" stroke-width="5"/><circle cx="555" cy="120" r="9" fill="#ef4444"/><text x="415" y="175" font-size="22">能量集中</text><rect x="35" y="185" width="630" height="34" rx="12" fill="#fff1ef"/><text x="75" y="208" font-size="17">⚠️ 不用太陽光做聚焦燃燒；網站只做安全光路模擬</text>`,'凸透鏡聚光與安全');
    if(type==='myopia') return base(`<text x="45" y="45" font-size="20">未矯正：焦點在視網膜前</text><path d="M330 45q95 70 0 140q-95-70 0-140z" fill="#f7d8cf" stroke="#a56b5e" stroke-width="4"/><path d="M245 70h100" stroke="#ef4444" stroke-width="4"/><path d="M245 150h100" stroke="#ef4444" stroke-width="4"/><line x1="345" y1="70" x2="455" y2="110" stroke="#ef4444" stroke-width="4"/><line x1="345" y1="150" x2="455" y2="110" stroke="#ef4444" stroke-width="4"/><line x1="500" y1="55" x2="500" y2="175" stroke="#334155" stroke-width="7"/><circle cx="455" cy="110" r="7" fill="#ef4444"/><path d="M120 45q-38 70 0 140q38-70 0-140z" fill="#d9f2ff" stroke="#5b8ea6" stroke-width="4"/><text x="35" y="215" font-size="17">凹透鏡先讓光發散，再由眼睛聚焦到視網膜上</text>`,'近視與凹透鏡矯正');
    if(type==='rainbow') return base(`<circle cx="350" cy="115" r="82" fill="#dff6ff" stroke="#75b9d6" stroke-width="4"/><line x1="70" y1="75" x2="285" y2="95" stroke="#fff" stroke-width="12"/><line x1="70" y1="75" x2="285" y2="95" stroke="#f59e0b" stroke-width="4"/><path d="M285 95L405 75L310 165L520 115" fill="none" stroke="#ef4444" stroke-width="5"/><path d="M285 100L410 90L320 170L520 140" fill="none" stroke="#7c3aed" stroke-width="5"/><text x="510" y="95" font-size="17">紅</text><text x="510" y="160" font-size="17">紫</text><text x="65" y="205" font-size="17">主虹：折射＋色散＋1次內反射＋再折射；紅外、紫內</text>`,'主虹水滴光路與色序');
    if(type==='bubble') return base(`<circle cx="210" cy="115" r="85" fill="none" stroke="#60a5fa" stroke-width="8"/><path d="M150 55q60 40 120 0" fill="none" stroke="#f43f5e" stroke-width="8"/><path d="M145 75q65 40 130 0" fill="none" stroke="#f59e0b" stroke-width="8"/><path d="M140 95q70 40 140 0" fill="none" stroke="#22c55e" stroke-width="8"/><text x="350" y="70" font-size="24">肥皂泡薄膜</text><text x="350" y="112" font-size="19">膜前後表面反射光互相干涉</text><text x="350" y="150" font-size="19">厚度不同 → 強化不同顏色</text><text x="350" y="195" font-size="18">和雨後彩虹的水滴色散機制不同</text>`,'肥皂泡薄膜干涉色');
    if(type==='light_sound') return base(`<text x="70" y="70" font-size="54">⚡</text><path d="M145 58h260" stroke="#f59e0b" stroke-width="6"/><text x="175" y="42" font-size="18">光：約 3×10⁸ m/s</text><text x="70" y="165" font-size="54">🔊</text><path d="M145 155h110" stroke="#0ea5e9" stroke-width="6"/><text x="175" y="138" font-size="18">聲：約 343 m/s（20°C空氣）</text><text x="420" y="112" font-size="22">先看到閃電</text><text x="420" y="155" font-size="22">後聽到雷聲</text><text x="210" y="215" font-size="18">光約快 87 萬倍；雷雨安全優先</text>`,'光速與聲速比較');
    if(type==='aquarium') return base(`<rect x="75" y="45" width="245" height="150" rx="8" fill="#cfeeff" stroke="#5b8ea6" stroke-width="5"/><text x="145" y="135" font-size="55">🐟</text><line x1="205" y1="105" x2="480" y2="78" stroke="#ef4444" stroke-width="4"/><line x1="205" y1="135" x2="480" y2="165" stroke="#ef4444" stroke-width="4"/><text x="420" y="45" font-size="20">平面缸：先想視位置改變</text><text x="420" y="118" font-size="20">圓弧缸：可能像透鏡</text><text x="420" y="165" font-size="20">可放大、縮小或變形</text><text x="85" y="220" font-size="17">別硬背「魚一定變大」；先看容器形狀與光路</text>`,'水族箱折射與視像');
    return '';
  }

  // Simulators
  function renderSimulator(l){
    const s=l.sim;
    if(s==='sound') return `<div class="simulator"><div class="sim-controls"><label>有效弦長 <b id="lenVal">50</b>：<input id="soundLen" type="range" min="20" max="90" value="50"></label><label>鬆緊程度 <b id="tensionVal">50</b>：<input id="soundTension" type="range" min="20" max="90" value="50"></label><button class="btn primary small" id="playTone" type="button">🎸 撥一下，聽聲音</button><button class="btn secondary small" id="playReferenceTone" type="button">🔔 測試喇叭</button></div><div class="sim-output" id="soundOut">調整弦長與鬆緊，再按「撥一下」比較音調。</div><div class="audio-status" id="audioStatus" aria-live="polite">尚未播放</div></div>`;
    if(s==='light') return `<div class="simulator"><label>入射角 <b id="angleVal">45°</b><input id="lightAngle" type="range" min="5" max="75" value="45"></label><svg id="raySvg" class="ray-svg" viewBox="0 0 500 300" aria-label="光折射示意圖"></svg><div class="sim-output" id="lightOut"></div></div>`;
    if(s==='sun') return `<div class="simulator"><label>季節概念模型：<select id="seasonSelect"><option value="summer">夏季</option><option value="spring">春／秋</option><option value="winter">冬季</option></select></label><svg id="sunSvg" class="sky-svg" viewBox="0 0 500 280"></svg><div class="sim-output" id="sunOut"></div><p class="field-help">此為概念模型，角度用來呈現「高低趨勢」，不是特定地點的實測值。</p></div>`;
    if(s==='planets') return `<div class="simulator"><p><b>任務：</b>從離太陽最近開始，依序點完八大行星。</p><div id="planetButtons" class="planet-row"></div><div class="sim-output" id="planetOut">已完成 0 / 8</div><button class="btn secondary small" data-planets-reset>重新打亂</button></div>`;
    if(s==='stars') return `<div class="simulator"><label>同一晚經過時間 <b id="starTimeVal">0</b> 小時<input id="starTime" type="range" min="0" max="6" value="0"></label><svg id="starsSvg" class="sky-svg" viewBox="0 0 500 320"></svg><div class="sim-output">北極星放在中心附近作為方向參考；其他星點會隨時間呈現規律轉動的概念。</div></div>`;
    if(s==='air') return `<div class="simulator"><label>罩杯大小：<select id="cupSize"><option value="small">小杯</option><option value="large">大杯</option><option value="open">不罩杯</option></select></label><div class="sim-output" id="airOut"></div><p class="safety">這是概念模擬，不提供真實燃燒秒數。真正火焰實驗須由教師或成人指導。</p></div>`;
    if(s==='fire') return `<div class="simulator"><p>把三個燃燒條件打開或關閉：</p><div class="switches"><button class="toggle on" data-fire-toggle="fuel">🪵 可燃物</button><button class="toggle on" data-fire-toggle="oxygen">💨 助燃物</button><button class="toggle on" data-fire-toggle="heat">🌡️ 足夠溫度</button></div><div class="sim-output" id="fireOut"><span class="flame">🔥</span><br>三要素都具備，燃燒可持續。</div></div>`;
    if(s==='rust') return `<div class="simulator"><p>控制鐵釘周遭條件：</p><div class="switches"><button class="toggle on" data-rust-toggle="water">💧 有水</button><button class="toggle on" data-rust-toggle="oxygen">💨 有氧氣</button><button class="toggle" data-rust-toggle="coat">🛡️ 有保護層</button></div><div class="sim-output" id="rustOut"></div></div>`;
    return `<div class="simulator"><div class="prediction-options">${l.experiment.prediction.map((p,i)=>`<button data-predict="${i}">${String.fromCharCode(65+i)}. ${esc(p)}</button>`).join('')}</div><div id="predictOut" class="sim-output">先選一個預測，再看證據。</div></div>`;
  }
  function initCurrentSimulator(l){
    if(!lessonDialog.open || runtime.stage!==2) return;
    const s=l.sim;
    if(s==='sound') updateSound();
    else if(s==='light') updateLight();
    else if(s==='sun') updateSun();
    else if(s==='planets') resetPlanets();
    else if(s==='stars') updateStars();
    else if(s==='air') updateAir();
    else if(s==='fire'){runtime.sim.fire={fuel:true,oxygen:true,heat:true}; updateFire();}
    else if(s==='rust'){runtime.sim.rust={water:true,oxygen:true,coat:false}; updateRust();}
  }
  function updateSound(){
    const len=Number(document.querySelector('#soundLen')?.value||50), t=Number(document.querySelector('#soundTension')?.value||50);
    const f=Math.round(220*Math.sqrt(t/50)*(50/len));
    const lv=document.querySelector('#lenVal'), tv=document.querySelector('#tensionVal'), out=document.querySelector('#soundOut'); if(!out)return;
    if(lv)lv.textContent=len;if(tv)tv.textContent=t; out.innerHTML=`概念頻率指標：約 <b>${f}</b> Hz。弦越短、越緊，通常音調越高。`;
    runtime.sim.sound={len,t,f};
  }
  async function getAudioContext(){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) throw new Error('AudioContext unsupported');
    if(!sharedAudioContext || sharedAudioContext.state==='closed') sharedAudioContext=new AC();
    if(sharedAudioContext.state==='suspended') await sharedAudioContext.resume();
    return sharedAudioContext;
  }
  async function playSynthTone(freq=440,duration=.72,kind='pluck'){
    const ac=await getAudioContext();
    const master=ac.createGain(); master.gain.setValueAtTime(.0001,ac.currentTime); master.connect(ac.destination);
    const now=ac.currentTime;
    master.gain.exponentialRampToValueAtTime(.28,now+.018);
    master.gain.exponentialRampToValueAtTime(.0001,now+duration);
    const partials=kind==='pluck'?[1,2,3]:[1];
    partials.forEach((ratio,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type=i===0?'triangle':'sine';o.frequency.setValueAtTime(freq*ratio,now);g.gain.value=1/(i+1.8);o.connect(g).connect(master);o.start(now);o.stop(now+duration+.03);});
    return ac;
  }
  async function playTone(){
    updateSound(); const f=runtime.sim.sound?.f||220; const st=document.querySelector('#audioStatus');
    try{
      await playSynthTone(f,.8,'pluck');
      if(st) st.textContent=`✅ 已播放約 ${f} Hz。若沒有聽到，請確認裝置不是靜音，並再按一次。`;
      const btn=document.querySelector('#playTone'); if(btn){btn.textContent='🎸 再撥一次';setTimeout(()=>{if(btn.isConnected)btn.textContent='🎸 撥一下，聽聲音';},900);}
    }catch(err){console.error('audio play failed',err);if(st)st.textContent='⚠️ 無法啟動聲音。請確認瀏覽器允許網站播放音訊。';toast('聲音啟動失敗，請確認裝置音量與瀏覽器音訊權限');}
  }
  async function playReferenceTone(){
    const st=document.querySelector('#audioStatus');
    try{await playSynthTone(440,.55,'reference');if(st)st.textContent='✅ 測試音已播放（A4 約 440 Hz）。';}
    catch(err){console.error('reference audio failed',err);if(st)st.textContent='⚠️ 測試音無法播放。';}
  }
  function updateLight(){
    const a=Number(document.querySelector('#lightAngle')?.value||45), rad=a*Math.PI/180, refr=Math.asin(Math.sin(rad)/1.33)*180/Math.PI;
    const svg=document.querySelector('#raySvg'), out=document.querySelector('#lightOut'), av=document.querySelector('#angleVal'); if(!svg)return;
    if(av)av.textContent=`${a}°`;
    const cx=250,cy=150,L=150; const x1=cx-Math.sin(rad)*L,y1=cy-Math.cos(rad)*L,x2=cx+Math.sin(refr)*L,y2=cy+Math.cos(refr)*L;
    svg.innerHTML=`<rect width="500" height="150" fill="#eef9ff"/><rect y="150" width="500" height="150" fill="#d9f2ff"/><line x1="0" y1="150" x2="500" y2="150" stroke="#5b8ea6" stroke-width="2"/><line x1="250" y1="28" x2="250" y2="272" stroke="#9fb4bd" stroke-dasharray="7 7"/><line x1="${x1}" y1="${y1}" x2="250" y2="150" stroke="#f59e0b" stroke-width="5"/><line x1="250" y1="150" x2="${x2}" y2="${y2}" stroke="#ef4444" stroke-width="5"/><text x="20" y="34" font-size="20">空氣</text><text x="20" y="184" font-size="20">水</text>`;
    if(out)out.innerHTML=`入射角 ${a.toFixed(0)}° → 水中折射角概念值約 <b>${refr.toFixed(1)}°</b>。斜射跨介質時，光路會改變。`;
  }
  function updateSun(){
    const season=document.querySelector('#seasonSelect')?.value||'summer'; const cfg={summer:[75,'夏季代表：太陽較高、影子較短'],spring:[60,'春／秋代表：介於夏冬之間'],winter:[38,'冬季代表：太陽較低、影子較長']}[season];
    const ang=cfg[0]*Math.PI/180, groundY=230, poleX=250,poleH=100, sunX=poleX-170*Math.cos(ang), sunY=groundY-170*Math.sin(ang), shadow=100/Math.tan(ang), endX=poleX+shadow;
    const svg=document.querySelector('#sunSvg'); if(!svg)return;
    svg.innerHTML=`<rect width="500" height="280" fill="#eef9ff"/><rect y="230" width="500" height="50" fill="#e7f2df"/><circle cx="${sunX}" cy="${sunY}" r="22" fill="#fbbf24"/><line x1="250" y1="130" x2="250" y2="230" stroke="#334155" stroke-width="10"/><line x1="250" y1="230" x2="${Math.min(470,endX)}" y2="230" stroke="#64748b" stroke-width="12"/><line x1="${sunX}" y1="${sunY}" x2="250" y2="130" stroke="#f59e0b" stroke-width="3" stroke-dasharray="7 6"/>`;
    document.querySelector('#sunOut').textContent=cfg[1]+'；影子方向在太陽相反一側。';
  }
  const planetOrder=['水星','金星','地球','火星','木星','土星','天王星','海王星'];
  function resetPlanets(){ runtime.sim.planets={order:shuffle(planetOrder),progress:0}; renderPlanets(); }
  function renderPlanets(){
    const box=document.querySelector('#planetButtons'); if(!box)return; const s=runtime.sim.planets;
    box.innerHTML=s.order.map(p=>`<button class="planet-chip" data-planet="${p}" ${s.progress>=planetOrder.indexOf(p)+1?'disabled':''}>${p}</button>`).join('');
    document.querySelector('#planetOut').textContent=`已完成 ${s.progress} / 8${s.progress===8?' 🎉 水金地火木土天海！':''}`;
  }
  function clickPlanet(p){
    const s=runtime.sim.planets||{progress:0}; if(p===planetOrder[s.progress]){s.progress++; if(s.progress===8){addStars(3,'行星排序完成');} renderPlanets();} else toast(`下一顆應該不是「${p}」，再想想水金地火木土天海。`);
  }
  function updateStars(){
    const h=Number(document.querySelector('#starTime')?.value||0), svg=document.querySelector('#starsSvg'); if(!svg)return; document.querySelector('#starTimeVal').textContent=h;
    const pts=[[330,90],[380,150],[320,220],[180,90],[120,180],[200,250],[410,250],[90,80]]; const ang=h*12*Math.PI/180,cx=250,cy=160;
    const rotated=pts.map(([x,y])=>{const dx=x-cx,dy=y-cy;return [cx+dx*Math.cos(ang)-dy*Math.sin(ang),cy+dx*Math.sin(ang)+dy*Math.cos(ang)]});
    svg.innerHTML=`<rect width="500" height="320" fill="#14233d"/><circle cx="250" cy="160" r="6" fill="#fef3c7"/><text x="265" y="166" fill="#fff" font-size="18">北極星</text>${rotated.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%3+3}" fill="#fff"/>`).join('')}`;
  }
  function updateAir(){
    const v=document.querySelector('#cupSize')?.value||'small'; const text={small:'小杯：可用空氣較少，火焰通常較快因氧氣不足而熄滅。',large:'大杯：可用空氣相對較多，通常比小杯能維持較久。',open:'不罩杯：能持續從周圍補充新鮮空氣，若其他條件足夠，較容易持續燃燒。'}[v]; document.querySelector('#airOut').textContent=text;
  }
  function updateFire(){
    const s=runtime.sim.fire; const on=s.fuel&&s.oxygen&&s.heat; const out=document.querySelector('#fireOut'); if(!out)return;
    document.querySelectorAll('[data-fire-toggle]').forEach(b=>b.classList.toggle('on',!!s[b.dataset.fireToggle]));
    out.innerHTML=`<span class="flame ${on?'':'off'}">🔥</span><br>${on?'三要素都具備：燃燒可持續。':'至少少了一個要素：燃燒無法持續或不易開始。'}`;
  }
  function updateRust(){
    const s=runtime.sim.rust; const rust=s.water&&s.oxygen&&!s.coat; const out=document.querySelector('#rustOut'); if(!out)return;
    document.querySelectorAll('[data-rust-toggle]').forEach(b=>b.classList.toggle('on',!!s[b.dataset.rustToggle]));
    out.innerHTML=`<span class="rust-sample">${rust?'🟫':'🔩'}</span><br>${rust?'水與氧氣都能接觸鐵：生鏽條件較完整。':s.coat?'有保護層：水和氧氣較難直接接觸鐵。':'缺少水或氧氣之一：生鏽較不容易。'}`;
  }

  // Matching game: clear two-column matching, not hidden memory cards.
  function openMatch(unitId){
    const bank=DATA.matching['u'+unitId].map((p,i)=>({id:i,a:p[0],b:p[1]}));
    const round=shuffle(bank).slice(0,8);
    runtime.match={unitId:Number(unitId),round,left:round,right:shuffle(round),selectedL:null,selectedR:null,matched:[],moves:0}; renderMatch(); gameDialog.showModal();
  }
  function renderMatch(){
    const g=runtime.match,u=DATA.units[g.unitId-1];
    gameContent.innerHTML=`<p class="eyebrow">${u.emoji} ${esc(u.title)}</p><h1>🧩 雙欄連連看</h1><div class="game-how"><b>玩法：</b>先點左邊一張，再點右邊你認為相配的。配對成功會變綠；錯了會保留內容讓你再想，不用記翻牌位置。</div><div class="game-stats"><span>配對 ${g.matched.length}/8</span><span>嘗試 ${g.moves}</span><span>本單元題庫 ${DATA.matching['u'+g.unitId].length} 對</span></div><div class="pair-audio">${speakButton(g.left.map(x=>x.a).join('。'),'🔊 聽左欄')}${speakButton(g.right.map(x=>x.b).join('。'),'🔊 聽右欄')}</div><div class="pair-columns"><div><h3>左邊：現象／名詞</h3>${g.left.map(x=>`<button class="pair-card ${g.selectedL===x.id?'selected':''} ${g.matched.includes(x.id)?'matched':''}" data-match-left="${x.id}" ${g.matched.includes(x.id)?'disabled':''}>${esc(x.a)}</button>`).join('')}</div><div><h3>右邊：解釋／功能</h3>${g.right.map(x=>`<button class="pair-card ${g.selectedR===x.id?'selected':''} ${g.matched.includes(x.id)?'matched':''}" data-match-right="${x.id}" ${g.matched.includes(x.id)?'disabled':''}>${esc(x.b)}</button>`).join('')}</div></div><div id="matchFeedback" class="game-feedback">${g.matched.length===8?'🎉 全部配對完成！':'先選左邊，再選右邊。'}</div><div class="hero-actions"><button class="btn secondary" data-match-new="${g.unitId}">🔄 換一局 8 對</button></div>`;
  }
  function tryMatch(){
    const g=runtime.match;if(g.selectedL===null||g.selectedR===null)return;g.moves++;
    if(g.selectedL===g.selectedR){g.matched.push(g.selectedL);if(g.matched.length===8)addStars(8,'連連看完成');g.selectedL=g.selectedR=null;renderMatch();}
    else {const right=g.right.find(x=>x.id===g.selectedR);const left=g.left.find(x=>x.id===g.selectedL);const msg=`還沒配對：${left.a} ≠ ${right.b}`;g.selectedL=g.selectedR=null;renderMatch();setTimeout(()=>{const el=document.querySelector('#matchFeedback');if(el)el.textContent=msg;},20);}
  }
  function matchSelect(side,id){const g=runtime.match;if(!g||g.matched.includes(id))return;if(side==='L')g.selectedL=id;else g.selectedR=id;renderMatch();tryMatch();}

  // Classification game
  function openClassify(unitId){
    const cfg=DATA.classify['u'+unitId],items=shuffle(cfg.items.map((x,i)=>({id:i,text:x[0],answer:x[1]}))).slice(0,10);
    runtime.classify={unitId:Number(unitId),categories:cfg.categories,items,index:0,score:0,answered:false,last:null};renderClassify();gameDialog.showModal();
  }
  function renderClassify(){
    const g=runtime.classify,u=DATA.units[g.unitId-1];const item=g.items[g.index];
    if(!item){gameContent.innerHTML=`<p class="eyebrow">${u.emoji} ${esc(u.title)}</p><h1>⚡ 快速分類完成</h1><div class="score-big">${g.score}/10</div><p>每局會從 ${DATA.classify['u'+g.unitId].items.length} 題中重新抽 10 題。</p><button class="btn primary" data-classify-new="${g.unitId}">再玩一局</button>`;return;}
    gameContent.innerHTML=`<p class="eyebrow">${u.emoji} ${esc(u.title)}</p><h1>⚡ 快速分類</h1><div class="game-stats"><span>第 ${g.index+1}/10 題</span><span>答對 ${g.score}</span></div><div class="classify-prompt">${esc(item.text)}</div><div class="pair-audio">${speakButton(`${item.text}。它最適合放在哪一類？`,'🔊 讀題')}</div><p>它最適合放在哪一類？</p><div class="classify-options">${g.categories.map(c=>`<button class="classify-btn" data-classify-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div>${g.last?`<div class="game-feedback">${esc(g.last)}</div>`:''}`;
  }
  function classifyAnswer(cat){const g=runtime.classify;if(!g)return;const item=g.items[g.index];if(cat===item.answer){g.score++;g.last='✅ 正確！';addStars(1);}else g.last=`❌ 這題應放在「${item.answer}」。`;g.index++;renderClassify();}

  // Board game

  // Board game
  function openBoard(unitId){
    const pool=unitLessons(unitId).flatMap(l=>l.questions.map(q=>({...q,lessonId:l.id}))); runtime.board={unitId:Number(unitId),pos:0,turn:0,pool:shuffle(pool),qi:0,current:null,correct:0}; renderBoard();gameDialog.showModal();
  }
  function renderBoard(){
    const g=runtime.board,u=DATA.units[g.unitId-1]; const labels=['起點','觀察','證據','變因','推理','生活','安全','圖表','記憶','應用','挑戰','觀察','證據','變因','推理','生活','安全','圖表','記憶','應用','Boss','證據','挑戰','終點'];
    gameContent.innerHTML=`<p class="eyebrow">${u.emoji} ${esc(u.title)}</p><h1>🎲 科學島 24 格</h1><p>題目從本單元至少 ${g.pool.length} 題中抽取；同一局盡量不重複。</p><div class="game-stats"><span>位置 ${g.pos+1}/24</span><span>回合 ${g.turn}</span><span>答對 ${g.correct}</span></div><div class="board">${labels.map((t,i)=>`<div class="tile ${g.pos===i?'player':''}"><b>${i+1}</b><br>${t}</div>`).join('')}</div>${g.current?boardQuestion(g.current):g.pos>=23?`<div class="result-panel"><b>🏁 到終點！</b><p>本局答對 ${g.correct} 題。可以再開一局，題庫會重新洗牌。</p><button class="btn primary" data-board-new="${g.unitId}">再玩一局</button></div>`:`<button class="btn primary" data-board-roll>🎲 擲骰子</button>`}`;
  }
  function boardQuestion(q){return `<article class="quiz-card"><div class="qtitle">踩到題目：${esc(q.prompt)} ${speakButton(q.prompt,'🔊')}</div><div class="quiz-options">${q.choices.map((c,i)=>`<button class="choice" data-board-choice="${i}">${String.fromCharCode(65+i)}. ${esc(c)}</button>`).join('')}</div></article>`;}
  function boardRoll(){const g=runtime.board;if(!g||g.current||g.pos>=23)return;const d=1+Math.floor(Math.random()*6);g.pos=Math.min(23,g.pos+d);g.turn++;if(g.pos<23)g.current=g.pool[g.qi++%g.pool.length];toast(`🎲 ${d} 點，前進到第 ${g.pos+1} 格`);renderBoard();}
  function boardAnswer(choice){const g=runtime.board,q=g.current;if(!q)return;if(Number(choice)===q.answer){g.correct++;addStars(2,'答對');}else{addWrong(q,q.lessonId);toast(`答錯：${q.explain}`);}g.current=null;renderBoard();}

  // Exams
  function openExam(id){
    const e=exams[id]; if(!e)return; clearInterval(runtime.timer); runtime.exam={id,start:Date.now(),answers:{},submitted:false,result:null,bonus:false}; renderExam(); examDialog.showModal(); runtime.timer=setInterval(updateTimer,1000); updateTimer();
  }
  function updateTimer(){
    const el=document.querySelector('#timerText'); if(!el||!runtime.exam)return; const e=exams[runtime.exam.id]; const left=Math.max(0,e.time*60-Math.floor((Date.now()-runtime.exam.start)/1000)); const m=Math.floor(left/60),s=left%60;el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; if(left===0){clearInterval(runtime.timer);toast('時間到，可以送出作答。');}
  }
  function renderExam(){
    const e=exams[runtime.exam.id], rt=runtime.exam; if(rt.submitted){renderExamResult(e,rt.result);return;}
    const groups=[]; for(const q of e.questions){let g=groups.find(x=>x.name===q.section);if(!g){g={name:q.section,items:[]};groups.push(g);}g.items.push(q);}
    let n=0;
    examContent.innerHTML=`<div class="exam-head"><div><p class="eyebrow">${esc(e.scope)}・${e.version} 卷</p><h1>${esc(e.title)}</h1><p>${e.questions.length} 個作答項目・總分 100 分。題型比照公開學校定期評量的混合卷型重新命題。</p></div><div class="timer" id="timerText">40:00</div></div><div class="exam-instruction">${esc(e.examStyle||'')}</div>${groups.map(g=>`<h2 class="exam-section">${esc(g.name)}</h2>${g.items.map(q=>{n++;return renderExamQ(q,n);}).join('')}`).join('')}<div class="hero-actions"><button class="btn primary" data-submit-exam>交卷並計分</button><button class="btn secondary" data-exam-top>回到考卷最上方</button></div>`;
  }
  function renderExamDiagram(type){
    if(!type)return '';
    if(type==='animal_temp')return `<svg class="exam-diagram" viewBox="0 0 560 170" role="img" aria-label="動物調節體溫情境圖"><rect width="560" height="170" rx="18" fill="#f7fbff"/><text x="70" y="45" font-size="25">❄️ 冷</text><text x="45" y="105" font-size="42">🐥🐥🐥</text><text x="360" y="45" font-size="25">☀️ 熱</text><text x="370" y="105" font-size="42">🦁 🌳</text><text x="30" y="150" font-size="18">聚集保溫</text><text x="355" y="150" font-size="18">躲陰影散熱</text></svg>`;
    if(type==='soundbox')return `<svg class="exam-diagram" viewBox="0 0 560 190"><rect width="560" height="190" rx="18" fill="#fffaf0"/><rect x="45" y="70" width="190" height="85" rx="10" fill="#e8d5b7"/><line x1="65" y1="75" x2="215" y2="75" stroke="#334155" stroke-width="6"/><text x="92" y="125" font-size="22">有音箱</text><line x1="340" y1="75" x2="490" y2="75" stroke="#334155" stroke-width="6"/><text x="370" y="125" font-size="22">無音箱</text><text x="125" y="35" font-size="18">橡皮筋條件相同</text><text x="360" y="35" font-size="18">只改變音箱</text></svg>`;
    if(type==='refraction')return `<svg class="exam-diagram" viewBox="0 0 560 220"><rect width="560" height="100" fill="#eef9ff"/><rect y="100" width="560" height="120" fill="#cfeeff"/><line x1="0" y1="100" x2="560" y2="100" stroke="#5b8ea6" stroke-width="3"/><line x1="120" y1="25" x2="270" y2="100" stroke="#ef4444" stroke-width="6"/><line x1="270" y1="100" x2="340" y2="205" stroke="#ef4444" stroke-width="6"/><line x1="270" y1="25" x2="270" y2="205" stroke="#64748b" stroke-dasharray="8 7"/><text x="20" y="35" font-size="20">空氣</text><text x="20" y="140" font-size="20">水</text><text x="315" y="82" font-size="18">交界處改變方向</text></svg>`;
    if(type==='sunshadow')return `<svg class="exam-diagram" viewBox="0 0 560 220"><rect width="560" height="170" fill="#eef9ff"/><rect y="170" width="560" height="50" fill="#dfeecf"/><circle cx="100" cy="55" r="28" fill="#fbbf24"/><line x1="280" y1="80" x2="280" y2="170" stroke="#334155" stroke-width="10"/><line x1="280" y1="170" x2="430" y2="170" stroke="#64748b" stroke-width="12"/><line x1="100" y1="55" x2="280" y2="80" stroke="#f59e0b" stroke-width="4" stroke-dasharray="8 7"/><text x="345" y="205" font-size="18">影子在太陽相反側</text></svg>`;
    if(type==='teeth')return renderMiniVisual('teeth').replace('concept-visual','exam-diagram-wrap');
    if(type==='bee_dance')return renderMiniVisual('bee_dance').replace('concept-visual','exam-diagram-wrap');
    if(type==='ant_roles')return renderMiniVisual('ants').replace('concept-visual','exam-diagram-wrap');
    if(type==='soundwaves')return `<svg class="exam-diagram" viewBox="0 0 640 220"><rect width="640" height="220" rx="18" fill="#f8fbff"/><text x="35" y="35" font-size="19">A 振幅小</text><path d="M35 90C70 70 105 110 140 90S210 70 245 90" fill="none" stroke="#0f766e" stroke-width="5"/><text x="355" y="35" font-size="19">B 振幅大</text><path d="M350 90C385 35 420 145 455 90S525 35 560 90" fill="none" stroke="#7c3aed" stroke-width="5"/><text x="170" y="185" font-size="20">頻率相近；B 振幅較大 → 通常較響</text></svg>`;
    if(type==='xylophone')return `<svg class="exam-diagram" viewBox="0 0 640 220"><rect width="640" height="220" rx="18" fill="#fffaf0"/><g fill="#0f766e"><rect x="70" y="45" width="70" height="140" rx="8"/><rect x="180" y="65" width="70" height="120" rx="8"/><rect x="290" y="85" width="70" height="100" rx="8"/><rect x="400" y="105" width="70" height="80" rx="8"/></g><text x="65" y="210" font-size="18">長、低音</text><text x="395" y="210" font-size="18">短、高音</text></svg>`;
    if(type==='myopia')return renderMiniVisual('myopia').replace('concept-visual','exam-diagram-wrap');
    if(type==='rainbow')return renderMiniVisual('rainbow').replace('concept-visual','exam-diagram-wrap');
    if(type==='lens_image')return renderMiniVisual('lens_image').replace('concept-visual','exam-diagram-wrap');
    if(type==='light_sound')return renderMiniVisual('light_sound').replace('concept-visual','exam-diagram-wrap');
    if(type==='candle')return `<svg class="exam-diagram" viewBox="0 0 560 200"><rect width="560" height="200" rx="18" fill="#fffaf1"/><text x="70" y="45" font-size="21">小杯</text><text x="360" y="45" font-size="21">大杯</text><rect x="45" y="60" width="150" height="110" rx="35" fill="#d8eef7" fill-opacity=".6" stroke="#78a6bd" stroke-width="4"/><rect x="315" y="50" width="205" height="120" rx="35" fill="#d8eef7" fill-opacity=".6" stroke="#78a6bd" stroke-width="4"/><text x="95" y="135" font-size="40">🕯️</text><text x="390" y="135" font-size="40">🕯️</text></svg>`;
    if(type==='firetriangle')return `<svg class="exam-diagram" viewBox="0 0 560 230"><polygon points="280,25 70,195 490,195" fill="#fff3dd" stroke="#f59e0b" stroke-width="5"/><text x="235" y="80" font-size="24">可燃物</text><text x="90" y="180" font-size="24">助燃物</text><text x="365" y="180" font-size="24">達燃點</text><text x="245" y="155" font-size="44">🔥</text></svg>`;
    if(type==='rust')return `<svg class="exam-diagram" viewBox="0 0 560 210"><rect width="560" height="210" rx="18" fill="#fbfaf7"/><g font-size="18"><text x="55" y="35">乾燥</text><text x="230" y="35">加水</text><text x="405" y="35">加醋</text></g><g font-size="55"><text x="55" y="115">🔩</text><text x="225" y="115">🟫</text><text x="400" y="115">🟫</text></g><text x="35" y="175" font-size="17">控制鐵量、容器、時間相同</text></svg>`;
    return '';
  }
  function renderExamQ(q,n){
    const diagram=renderExamDiagram(q.diagram); const pts=`<span class="q-points">${q.points}分</span>`;
    if(q.type==='fill') return `<fieldset class="exam-q"><legend>${n}. ${esc(q.prompt)} ${pts} <button class="speak" type="button" data-speak-text="${esc(q.prompt)}">🔊</button></legend>${diagram}<input type="text" data-exam-fill="${q.id}" autocomplete="off" placeholder="填入答案"></fieldset>`;
    if(q.type==='multi') return `<fieldset class="exam-q"><legend>${n}. ${esc(q.prompt)} ${pts} <button class="speak" type="button" data-speak-text="${esc(q.prompt)}">🔊</button></legend>${diagram}<div class="multi-tip">可複選</div>${q.choices.map((c,i)=>`<label class="exam-choice"><input type="checkbox" value="${i}" data-exam-multi="${q.id}"> ${String.fromCharCode(65+i)}. ${esc(c)}</label>`).join('')}</fieldset>`;
    const choices=q.type==='tf'?['○ 正確','× 錯誤']:q.choices;
    return `<fieldset class="exam-q"><legend>${n}. ${esc(q.prompt)} ${pts} <button class="speak" type="button" data-speak-text="${esc(q.prompt)}">🔊</button></legend>${diagram}${choices.map((c,i)=>`<label class="exam-choice"><input type="radio" name="${q.id}" value="${i}" data-exam-single="${q.id}"> ${q.type==='pair'?esc(c):`${String.fromCharCode(65+i)}. ${esc(c)}`}</label>`).join('')}</fieldset>`;
  }
  function submitExam(){
    const e=exams[runtime.exam.id], answers={}, wrong=[]; let score=0;
    for(const q of e.questions){let ok=false,ans=null;
      if(q.type==='fill'){const el=document.querySelector(`[data-exam-fill="${q.id}"]`);ans=el?.value||'';ok=q.answers.some(a=>norm(a)===norm(ans));}
      else if(q.type==='multi'){ans=[...document.querySelectorAll(`[data-exam-multi="${q.id}"]:checked`)].map(x=>Number(x.value)).sort((a,b)=>a-b); const target=[...q.answers].sort((a,b)=>a-b);ok=ans.length===target.length&&ans.every((x,i)=>x===target[i]);}
      else {const sel=document.querySelector(`input[name="${q.id}"]:checked`);ans=sel?Number(sel.value):null;const target=q.type==='tf'?(q.answer?0:1):q.answer;ok=ans===target;}
      answers[q.id]=ans;if(ok)score+=q.points;else{wrong.push(q);addWrong(q,q.lessonId);}
    }
    const date=localDate(); state.examScores[e.id]={score,date}; saveState(); runtime.exam.submitted=true;runtime.exam.result={score,wrong,answers,date};clearInterval(runtime.timer);
    if(!runtime.exam.bonus){const bonus=score>=90?20:score>=80?12:6;runtime.exam.bonus=true;addStars(bonus,score>=90?'模考達成 90+':'完成模考');}
    renderExam();
  }

  function renderExamResult(e,r){
    const byLesson={}; for(const q of r.wrong){byLesson[q.lessonId]=(byLesson[q.lessonId]||0)+1;}
    examContent.innerHTML=`<div class="result-panel"><p class="eyebrow">${esc(e.title)} 完成</p><div class="score-big">${r.score} 分</div><p>${r.score>=90?'🌟 很穩定，可以用另一卷驗證。':r.score>=80?'👍 基礎不錯，先救幾個弱點再做另一卷。':'🛟 先依錯題分類救援，再挑戰另一卷。'}</p><div class="scope-strip">${Object.entries(byLesson).map(([lid,c])=>`<span class="scope-pill">${esc(lessons[lid]?.title||'其他')}：${c} 題</span>`).join('')}</div></div><div class="section-head"><div><h2>錯題解析 ${r.wrong.length} 題</h2><p>已自動同步到錯題救援站。</p></div></div>${r.wrong.length?r.wrong.map(q=>`<article class="wrong-review"><b>${esc(q.prompt)}</b><p>${esc(q.explain)}</p>${speakButton(`${q.prompt}。解析：${q.explain}`,'🔊 聽解析')}<button class="btn secondary small" data-open-lesson="${q.lessonId}" data-stage="${q.type==='fill'?4:6}">回課程救援</button></article>`).join(''):`<section class="card empty-state"><div class="emoji">🏆</div><h2>全對！</h2><p>可以用另一份平行卷確認不是背答案。</p></section>`}<div class="hero-actions"><button class="btn primary" data-exam-close>回段考中心</button><button class="btn secondary" data-open-exam="${e.id}">再做一次</button></div>`;
  }

  // Events
  document.addEventListener('click', e => {
    const t=e.target.closest('button'); if(!t)return;
    if(t.dataset.nav){nav(t.dataset.nav);return;}
    if(t.dataset.navGo){nav(t.dataset.navGo);return;}
    if(t.dataset.unitFocus){const box=document.querySelector('#unitFocus');document.querySelectorAll('.unit-switch').forEach(b=>b.classList.toggle('active',b.dataset.unitFocus===t.dataset.unitFocus));if(box)box.innerHTML=focusedUnitHtml(Number(t.dataset.unitFocus));return;}
    if(t.dataset.labOpen){runtime.labLessonId=t.dataset.labOpen;renderLab();return;}
    if(t.id==='homeBrand'){nav('home');return;}
    if(t.id==='profileBtn'||t.hasAttribute('data-profile-open')){document.querySelector('#nameInput').value=state.name||'';profileDialog.showModal();return;}
    if(t.id==='saveProfile'){e.preventDefault();state.name=document.querySelector('#nameInput').value.trim().slice(0,12);saveState();profileDialog.close();render();toast('研究員名字已儲存');return;}
    if(t.dataset.close==='lesson'){lessonDialog.close();window.speechSynthesis?.cancel?.();return;}
    if(t.dataset.close==='exam'){examDialog.close();clearInterval(runtime.timer);window.speechSynthesis?.cancel?.();return;}
    if(t.dataset.close==='game'){gameDialog.close();return;}
    if(t.dataset.speakText!==undefined){speak(t.dataset.speakText);return;}
    if(t.dataset.openLesson){if(examDialog.open)examDialog.close();openLesson(t.dataset.openLesson,t.dataset.stage||0);return;}
    if(t.dataset.lessonStage!==undefined){runtime.stage=Number(t.dataset.lessonStage);renderLesson();lessonContent.scrollIntoView({block:'start'});return;}
    if(t.dataset.quizLevel){startQuiz(runtime.lessonId,t.dataset.quizLevel);renderLesson();return;}
    if(t.hasAttribute('data-quiz-restart')){const lvl=runtime.quizRuns[runtime.lessonId]?.level||'混合';startQuiz(runtime.lessonId,lvl);renderLesson();return;}
    if(t.dataset.quizChoice){const l=lessons[runtime.lessonId],run=runtime.quizRuns[l.id],q=run.questions.find(x=>x.id===t.dataset.quizChoice);if(!q||run.answers[q.id])return;const ch=Number(t.dataset.choice),correct=ch===q.answer;run.answers[q.id]={choice:ch,correct};if(correct)addStars(1);else addWrong(q,l.id);renderLesson();return;}
    if(t.dataset.markComplete){const id=t.dataset.markComplete;if(!state.completed.includes(id)){state.completed.push(id);addStars(5,'本課完成');}else toast('這一課已經完成');renderLesson();return;}
    if(t.dataset.rescueChoice){const id=t.dataset.rescueChoice,w=state.wrongs[id],q=findQuestion(id,w?.lessonId,w);if(!q)return;const ok=Number(t.dataset.choice)===q.answer;if(ok){delete state.wrongs[id];saveState();addStars(2,'救回一題');renderLesson();}else toast('還沒救回來：先讀解析再試一次。');return;}
    if(t.dataset.clearWrong){delete state.wrongs[t.dataset.clearWrong];saveState();renderLesson();return;}
    if(t.dataset.predict!==undefined){const l=lessons[runtime.lessonId],idx=Number(t.dataset.predict),correct=idx===l.experiment.correct;document.querySelectorAll('[data-predict]').forEach((b,i)=>{b.disabled=true;b.classList.add(i===l.experiment.correct?'good':(i===idx?'bad':''));});document.querySelector('#predictOut').innerHTML=`${correct?'✅ 預測正確。':'🔎 預測和證據不同，這正是學習的地方。'}<br>${esc(l.experiment.observation)}<br><b>${esc(l.experiment.conclusion)}</b>`;return;}
    if(t.id==='playTone'){playTone();return;}
    if(t.id==='playReferenceTone'){playReferenceTone();return;}
    if(t.hasAttribute('data-planets-reset')){resetPlanets();return;}
    if(t.dataset.planet){clickPlanet(t.dataset.planet);return;}
    if(t.dataset.fireToggle){runtime.sim.fire[t.dataset.fireToggle]=!runtime.sim.fire[t.dataset.fireToggle];updateFire();return;}
    if(t.dataset.rustToggle){runtime.sim.rust[t.dataset.rustToggle]=!runtime.sim.rust[t.dataset.rustToggle];updateRust();return;}
    if(t.dataset.matchOpen){openMatch(t.dataset.matchOpen);return;}
    if(t.dataset.matchLeft!==undefined){matchSelect('L',Number(t.dataset.matchLeft));return;}
    if(t.dataset.matchRight!==undefined){matchSelect('R',Number(t.dataset.matchRight));return;}
    if(t.dataset.matchNew){openMatch(t.dataset.matchNew);return;}
    if(t.dataset.classifyOpen){openClassify(t.dataset.classifyOpen);return;}
    if(t.dataset.classifyChoice!==undefined){classifyAnswer(t.dataset.classifyChoice);return;}
    if(t.dataset.classifyNew){openClassify(t.dataset.classifyNew);return;}
    if(t.dataset.boardOpen){openBoard(t.dataset.boardOpen);return;}
    if(t.dataset.boardNew){openBoard(t.dataset.boardNew);return;}
    if(t.hasAttribute('data-board-roll')){boardRoll();return;}
    if(t.dataset.boardChoice!==undefined){boardAnswer(t.dataset.boardChoice);return;}
    if(t.dataset.openExam){if(examDialog.open)examDialog.close();openExam(t.dataset.openExam);return;}
    if(t.hasAttribute('data-submit-exam')){if(confirm('確定要交卷並計分嗎？'))submitExam();return;}
    if(t.hasAttribute('data-exam-top')){examContent.scrollTo({top:0,behavior:'smooth'});return;}
    if(t.hasAttribute('data-exam-close')){examDialog.close();nav('exams');return;}
  });
  document.addEventListener('input',e=>{if(e.target.id==='soundLen'||e.target.id==='soundTension')updateSound();else if(e.target.id==='lightAngle')updateLight();else if(e.target.id==='starTime')updateStars();});
  document.addEventListener('change',e=>{if(e.target.id==='seasonSelect')updateSun();else if(e.target.id==='cupSize')updateAir();});
  [lessonDialog,examDialog,gameDialog].forEach(d=>d.addEventListener('cancel',()=>{clearInterval(runtime.timer);window.speechSynthesis?.cancel?.();}));

  // PWA registration only when served over HTTP(S).
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  syncHeader(); render();
})();
