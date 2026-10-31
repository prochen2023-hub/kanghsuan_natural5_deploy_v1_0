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
  const STORAGE = 'natural5_state_v1';
  const runtime = {view:'home',lessonId:null,stage:0,quizRuns:{},match:null,board:null,exam:null,timer:null,sim:{}};

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
  function findNextLesson(){ return DATA.lessons.find(l=>!state.completed.includes(l.id)) || DATA.lessons[0]; }
  function sourceNote(){ return `<p class="source-note">教材依康軒五上自然公開課程架構與現行課程計畫重新編寫；不重製課本全文。公開評量僅用來整理題型與能力，再重新命題。</p>`; }
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
    const tip=DATA.dailyTips[new Date().getDate()%DATA.dailyTips.length];
    const totalDone=state.completed.length;
    const wrongCount=Object.keys(state.wrongs||{}).length;
    main.innerHTML=`
      <section class="hero">
        <p class="eyebrow">康軒版・五年級上學期・整學期</p>
        <h1>🧪 五上自然探究實驗室</h1>
        <p>自然科不是背答案：先做預測，再看實驗證據，最後用自己的話說出「為什麼」。</p>
        <div class="hero-actions">
          <button class="btn primary" data-open-lesson="${next.id}">▶ 繼續學習：${esc(next.title)}</button>
          ${speakButton('歡迎來到五上自然探究實驗室。這裡會用預測、實驗、觀察、證據和結論來學自然。做錯不用怕，錯題會自動送到救援站。')}
          <button class="btn secondary" data-nav-go="exams">📝 預覽 A／B 段考卷</button>
        </div>
        <div class="scope-strip"><span class="scope-pill">✅ 已完成 ${totalDone}/12 活動</span><span class="scope-pill">🛟 待救援 ${wrongCount} 題</span><span class="scope-pill exam">⏱️ 段考每卷 40 分鐘／100 分</span></div>
      </section>
      ${!state.name?`<section class="card" style="margin-top:16px"><div class="mission-card"><div class="mission-icon">👤</div><div><strong>不用登入牆，也能直接開始</strong><p>目前以「小小科學家」使用；想記自己的名字，再按右上角設定即可。</p></div><button class="btn secondary" data-profile-open>設定名字</button></div></section>`:''}
      <div class="section-head"><div><h2>今天的 15 分鐘任務</h2><p>一次完成一小段，不把整冊塞在同一頁。</p></div></div>
      <section class="grid three">
        <article class="card"><div class="mission-icon">🔎</div><h3>1. 看現象</h3><p>${esc(next.phenomenon)}</p><button class="btn primary small" data-open-lesson="${next.id}">從這裡開始</button></article>
        <article class="card"><div class="mission-icon">🧠</div><h3>2. 今日科學訣竅</h3><p>${esc(tip)}</p>${speakButton(tip,'🔊 聽訣竅')}</article>
        <article class="card"><div class="mission-icon">🛟</div><h3>3. 只救真的錯題</h3><p>${wrongCount?`目前有 ${wrongCount} 題需要再確認，不用把會的全部重做。`:'目前沒有待救援題目，保持下去！'}</p><button class="btn secondary small" data-nav-go="rescue">開啟救援站</button></article>
      </section>
      <div class="section-head"><div><h2>學期地圖</h2><p>4 單元 × 3 活動＝12 個主學習站。</p></div></div>
      <section class="grid four">${DATA.units.map(unitCard).join('')}</section>
      <div class="section-head"><div><h2>段考檢核點</h2><p>A、B 卷能力相同、情境不同，兩卷獨立計分。</p></div></div>
      <section class="grid two">${examCheckpoint('第一次段考','第一、二單元','midA','midB')} ${examCheckpoint('第二次段考','第三、四單元','finA','finB')}</section>
      ${sourceNote()}`;
  }

  function unitCard(u){
    const pct=completedPct(u);
    return `<article class="card unit-card"><span class="unit-no">${u.id}</span><span class="unit-emoji">${u.emoji}</span><h3>${esc(u.title)}</h3><p>${esc(u.subtitle)}</p><div class="progress"><i style="width:${pct}%"></i></div><span class="mini-stat">${pct}% 完成</span><div class="lesson-list">${u.lessons.map((id,i)=>`<button class="lesson-link" data-open-lesson="${id}"><span>${state.completed.includes(id)?'<span class="done-dot">✓</span> ':' '}${i+1}. ${esc(lessons[id].title)}</span><span>›</span></button>`).join('')}</div></article>`;
  }
  function examCheckpoint(title,scope,a,b){
    const sa=state.examScores[a]?.score, sb=state.examScores[b]?.score;
    return `<article class="card exam-card"><span class="pill">🔔 ${esc(scope)}</span><h3>${esc(title)}檢核站</h3><p>先做 A 卷找弱點，再用 B 卷驗證是否真的學會。</p><div class="scope-strip"><span class="score-badge">A ${sa===undefined?'—':sa}</span><span class="score-badge">B ${sb===undefined?'—':sb}</span></div><div class="hero-actions"><button class="btn primary small" data-open-exam="${a}">A 卷</button><button class="btn secondary small" data-open-exam="${b}">B 卷</button></div></article>`;
  }

  function renderUnits(){
    main.innerHTML=`<section class="hero"><p class="eyebrow">整學期 12 個活動</p><h1>📚 單元學習地圖</h1><p>每課固定七關：看現象 → 學概念 → 做模擬 → 找證據 → 記憶訣竅 → 分級挑戰 → 錯題救援。</p>${speakButton('整學期共有四個單元、十二個活動。每一課都會先看現象，再學概念、做模擬、找證據、用記憶訣竅整理，接著完成分級挑戰，最後只救錯題。')}</section><div class="section-head"><div><h2>四大單元</h2><p>全部開放預覽，不上鎖。</p></div></div><section class="grid two">${DATA.units.map(unitCard).join('')}</section>${sourceNote()}`;
  }

  function renderLab(){
    const simLabels={sound:'音調模擬器',light:'折射光路模擬器',sun:'太陽與影子模擬',planets:'八大行星排序',stars:'星空旋轉模擬',air:'罩杯與燃燒',fire:'燃燒三要素',rust:'生鏽條件',predict:'預測→證據'};
    main.innerHTML=`<section class="hero"><p class="eyebrow">自然科的核心</p><h1>🔬 科學實驗室</h1><p>每個實驗都用同一套思考法：問題 → 預測 → 控制條件 → 觀察 → 證據 → 結論。</p>${speakButton('做自然實驗時，先說出問題和預測，再決定一次主要改變哪一個條件。觀察後不要只寫結果，要用證據說明結論。')}</section><div class="section-head"><div><h2>12 個探究入口</h2><p>聲音、光、天空與燃燒生鏽都有互動模擬。</p></div></div><section class="grid three">${DATA.lessons.map(l=>`<article class="card"><span class="pill">${DATA.units[l.unit-1].emoji} 第${l.unit}單元</span><h3>${esc(l.title)}</h3><p>${esc(l.experiment.question)}</p><div class="scope-strip"><span class="scope-pill">${simLabels[l.sim]||'探究模擬'}</span></div><button class="btn primary small" data-open-lesson="${l.id}" data-stage="2">進入實驗</button></article>`).join('')}</section>`;
  }

  function renderGames(){
    main.innerHTML=`<section class="hero"><p class="eyebrow">不是另一張考卷</p><h1>🎮 自然遊戲中心</h1><p>用連連看建立成對記憶，再用科學島棋盤把概念放進新情境。重玩會換題。</p>${speakButton('遊戲不是只求快。連連看要把現象和概念配成一對；科學島每走到一格都會換一題，答錯會送到錯題救援站。')}</section><div class="section-head"><div><h2>概念連連看</h2><p>每單元 6 對。</p></div></div><section class="grid four">${DATA.units.map(u=>`<article class="card"><div class="unit-emoji" style="position:static">${u.emoji}</div><h3>${esc(u.title)}</h3><p>把現象與解釋配起來。</p><button class="btn primary small" data-match-open="${u.id}">玩連連看</button></article>`).join('')}</section><div class="section-head"><div><h2>科學島棋盤</h2><p>擲骰子前進，踩格答題；答錯自動加入救援。</p></div></div><section class="grid four">${DATA.units.map(u=>`<article class="card"><h3>${u.emoji} ${esc(u.title)}</h3><p>20 格探索，題目從本單元題庫抽取。</p><button class="btn secondary small" data-board-open="${u.id}">🎲 出發</button></article>`).join('')}</section>`;
  }

  function renderRescue(){
    const items=Object.entries(state.wrongs||{});
    main.innerHTML=`<section class="hero"><p class="eyebrow">只重做真正不會的</p><h1>🛟 錯題救援站</h1><p>錯題依課程概念留下來；在救援題答對後就會從清單移除。</p>${speakButton('錯題救援站只保留真正答錯的內容。不要把已經會的全部重做，先讀解析，再回到相對應課程，用新的題目確認。')}</section>${items.length?`<div class="section-head"><div><h2>待救援 ${items.length} 題</h2><p>按「救這題」會直接回到該課救援關。</p></div></div><section>${items.map(([id,w])=>`<article class="rescue-item"><div><span class="pill">${esc(lessons[w.lessonId]?.title||'段考題')}</span><h3>${esc(w.prompt)}</h3><p>${esc(w.explain||'先回到課程重新確認證據。')}</p></div><button class="btn danger small" data-open-lesson="${w.lessonId}" data-stage="6">救這題</button></article>`).join('')}</section>`:`<section class="card empty-state"><div class="emoji">🌟</div><h2>目前沒有待救援題目</h2><p>做課內挑戰或 A／B 模擬考後，答錯的觀念會自動出現在這裡。</p><button class="btn primary" data-nav-go="units">去學一課</button></section>`}`;
  }

  function renderExams(){
    main.innerHTML=`<section class="hero"><p class="eyebrow">固定題本・獨立計分</p><h1>📝 段考 A／B 模擬卷</h1><p>每卷 25 題、100 分、40 分鐘。題型包含基礎概念、科學填充、實驗／資料判讀與生活情境推理。</p>${speakButton('段考 A 卷和 B 卷不是換題目順序。兩份考同一組能力，但情境和題目不同。建議先做 A 卷找弱點，救援後再做 B 卷確認。')}</section><div class="section-head"><div><h2>第一次段考｜第一、二單元</h2><p>動物世界＋探索聲光世界</p></div></div><section class="grid two">${examCard(exams.midA)}${examCard(exams.midB)}</section><div class="section-head"><div><h2>第二次段考｜第三、四單元</h2><p>神祕的天空＋燃燒與生鏽</p></div></div><section class="grid two">${examCard(exams.finA)}${examCard(exams.finB)}</section>${sourceNote()}`;
  }
  function examCard(e){
    const r=state.examScores[e.id];
    return `<article class="card exam-card ${e.version==='B'?'b':''}"><span class="pill">${e.version} 卷・${e.time} 分鐘</span><h3>${esc(e.title)}</h3><p>${esc(e.scope)}｜25 題｜100 分</p><div class="scope-strip"><span class="score-badge">${r?`${r.score} 分`:'尚未作答'}</span>${r?`<span class="scope-pill">${esc(r.date)}</span>`:''}</div><button class="btn primary" data-open-exam="${e.id}">${r?'再挑戰一次':'開始作答'}</button></article>`;
  }

  // Lessons
  function openLesson(id,stage=0){
    if(!lessons[id]) return; runtime.lessonId=id; runtime.stage=Number(stage)||0; renderLesson(); lessonDialog.showModal();
  }
  const stageNames=['👀 看現象','🧠 學概念','🔬 做模擬','🧾 找證據','⚡ 記憶訣竅','🎯 分級挑戰','🛟 錯題救援'];
  function renderLesson(){
    const l=lessons[runtime.lessonId], u=DATA.units[l.unit-1];
    lessonContent.innerHTML=`<header class="lesson-hero"><p class="eyebrow">${u.emoji} 第${l.unit}單元・活動 ${l.no}</p><h1>${esc(l.title)}</h1><p class="lead">${esc(l.subtitle)}</p><div class="hero-actions">${speakButton(`${l.title}。${l.subtitle}。${l.phenomenon}。${l.core.join('。')}`,'🔊 聽本課導讀')}<span class="pill">字體大・可朗讀</span></div></header><nav class="lesson-stage-nav">${stageNames.map((n,i)=>`<button class="stage-tab ${runtime.stage===i?'active':''}" data-lesson-stage="${i}">${n}</button>`).join('')}</nav><section class="stage-panel">${renderStage(l,runtime.stage)}</section>`;
    setTimeout(()=>initCurrentSimulator(l),0);
  }
  function renderStage(l,stage){
    if(stage===0) return `<h2>先看現象，不急著背答案</h2><div class="big-question">${esc(l.phenomenon)}</div><div class="hero-actions">${speakButton(l.phenomenon,'🔊 讀現象')}<button class="btn primary" data-lesson-stage="1">我先想過了 → 看概念</button></div>`;
    if(stage===1) return `<h2>核心概念</h2><div class="concept-stack">${l.core.map((c,i)=>`<div class="concept"><b>${i+1}</b><div>${esc(c)}</div></div>`).join('')}</div><div class="hero-actions">${speakButton(l.core.join('。'),'🔊 朗讀重點')}<button class="btn primary" data-lesson-stage="2">下一關：做模擬</button></div>`;
    if(stage===2) return `<h2>先預測，再操作</h2><div class="experiment-grid"><div class="experiment-box"><h3>研究問題</h3><p>${esc(l.experiment.question)}</p><div id="simArea">${renderSimulator(l)}</div></div><div class="experiment-box"><h3>實驗變因提醒</h3><p>${esc(l.experiment.variables)}</p><p class="safety">⚠️ ${esc(l.experiment.safety)}</p>${speakButton(`${l.experiment.question}。${l.experiment.variables}。安全提醒：${l.experiment.safety}`,'🔊 聽實驗說明')}</div></div><div class="hero-actions"><button class="btn primary" data-lesson-stage="3">我操作過了 → 找證據</button></div>`;
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
    return `<h2>這一課有 ${wrongs.length} 題要救回來</h2><p>答對後會立即從救援清單移除。</p>${wrongs.map(([id,w],i)=>{const q=findQuestion(id,w.lessonId,w);return `<article class="quiz-card"><div class="qtitle">${i+1}. ${esc(w.prompt)}</div>${q.type==='mc'?`<div class="quiz-options">${q.choices.map((c,j)=>`<button class="choice" data-rescue-choice="${id}" data-choice="${j}">${String.fromCharCode(65+j)}. ${esc(c)}</button>`).join('')}</div>`:`<p>${esc(w.explain)}</p><button class="btn secondary small" data-clear-wrong="${id}">我已重新確認</button>`}<div class="explain">提示：${esc(w.explain||'回到概念與證據重新確認。')}</div></article>`;}).join('')}`;
  }
  function findQuestion(qid,lessonId,fallback={}){
    const l=lessons[lessonId]; const q=l?.questions.find(x=>x.id===qid); return q||fallback;
  }
  function addWrong(q,lessonId){
    state.wrongs[q.id]={id:q.id,lessonId:lessonId||q.lessonId,prompt:q.prompt,explain:q.explain,tries:(state.wrongs[q.id]?.tries||0)+1,when:Date.now(),type:q.type,choices:q.choices,answer:q.answer,answers:q.answers}; saveState();
  }

  // Simulators
  function renderSimulator(l){
    const s=l.sim;
    if(s==='sound') return `<div class="simulator"><div class="sim-controls"><label>有效弦長 <b id="lenVal">50</b>：<input id="soundLen" type="range" min="20" max="90" value="50"></label><label>鬆緊程度 <b id="tensionVal">50</b>：<input id="soundTension" type="range" min="20" max="90" value="50"></label><button class="btn primary small" id="playTone" type="button">🔊 撥一下</button></div><div class="sim-output" id="soundOut">調整弦長與鬆緊，觀察音調趨勢。</div></div>`;
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
  function playTone(){
    updateSound(); const f=runtime.sim.sound?.f||220;
    try{const AC=window.AudioContext||window.webkitAudioContext; const ac=new AC(); const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.0001,ac.currentTime);g.gain.exponentialRampToValueAtTime(.18,ac.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+.55);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.58);}catch{toast('此瀏覽器無法播放示意音');}
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

  // Matching game
  function openMatch(unitId){
    const pairs=DATA.matching['u'+unitId].map((p,i)=>({i,a:p[0],b:p[1]}));
    runtime.match={unitId:Number(unitId),cards:shuffle(pairs.flatMap(p=>[{pair:p.i,text:p.a},{pair:p.i,text:p.b}])),open:[],matched:[]}; renderMatch(); gameDialog.showModal();
  }
  function renderMatch(){
    const g=runtime.match,u=DATA.units[g.unitId-1];
    gameContent.innerHTML=`<p class="eyebrow">${u.emoji} ${esc(u.title)}</p><h1>🧩 概念連連看</h1><p>每次翻兩張，把「現象／名詞」和「解釋／功能」配成一對。</p><div class="game-stats"><span>已配對 ${g.matched.length}/6</span><span>完成獎勵 ⭐ +6</span></div><div class="match-board">${g.cards.map((c,i)=>`<button class="match-card ${g.open.includes(i)?'flipped':''} ${g.matched.includes(c.pair)?'matched':''}" data-match-card="${i}" ${g.matched.includes(c.pair)?'disabled':''}>${g.open.includes(i)||g.matched.includes(c.pair)?esc(c.text):'❓'}</button>`).join('')}</div>`;
  }
  function matchClick(idx){
    const g=runtime.match; if(!g||g.open.includes(idx)||g.matched.includes(g.cards[idx].pair)||g.open.length>=2)return; g.open.push(idx); renderMatch();
    if(g.open.length===2){const [a,b]=g.open; if(g.cards[a].pair===g.cards[b].pair){g.matched.push(g.cards[a].pair);g.open=[]; if(g.matched.length===6){addStars(6,'連連看完成');} setTimeout(renderMatch,250);}else setTimeout(()=>{g.open=[];renderMatch();},750);}
  }

  // Board game
  function openBoard(unitId){
    const pool=unitLessons(unitId).flatMap(l=>l.questions.map(q=>({...q,lessonId:l.id}))); runtime.board={unitId:Number(unitId),pos:0,turn:0,pool:shuffle(pool),qi:0,current:null}; renderBoard();gameDialog.showModal();
  }
  function renderBoard(){
    const g=runtime.board,u=DATA.units[g.unitId-1]; const labels=['起點','觀察','證據','變因','推理','安全','圖表','記憶','應用','挑戰','觀察','證據','變因','推理','安全','圖表','記憶','應用','Boss','終點'];
    gameContent.innerHTML=`<p class="eyebrow">${u.emoji} ${esc(u.title)}</p><h1>🎲 科學島棋盤</h1><div class="game-stats"><span>位置 ${g.pos+1}/20</span><span>回合 ${g.turn}</span><span>答錯會進救援站</span></div><div class="board">${labels.map((t,i)=>`<div class="tile ${g.pos===i?'player':''}"><b>${i+1}</b><br>${t}</div>`).join('')}</div>${g.current?boardQuestion(g.current):`<button class="btn primary" data-board-roll>🎲 擲骰子</button>`}`;
  }
  function boardQuestion(q){return `<article class="quiz-card"><div class="qtitle">踩到題目：${esc(q.prompt)} ${speakButton(q.prompt,'🔊')}</div><div class="quiz-options">${q.choices.map((c,i)=>`<button class="choice" data-board-choice="${i}">${String.fromCharCode(65+i)}. ${esc(c)}</button>`).join('')}</div></article>`;}
  function boardRoll(){const g=runtime.board;if(!g||g.current)return;const d=1+Math.floor(Math.random()*6);g.pos=Math.min(19,g.pos+d);g.turn++;g.current=g.pool[g.qi++%g.pool.length];toast(`🎲 ${d} 點，前進到第 ${g.pos+1} 格`);renderBoard();}
  function boardAnswer(choice){const g=runtime.board,q=g.current;if(!q)return;if(Number(choice)===q.answer){addStars(2,'答對');}else{addWrong(q,q.lessonId);toast(`答錯：${q.explain}`);}g.current=null;renderBoard();}

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
    examContent.innerHTML=`<div class="exam-head"><div><p class="eyebrow">${esc(e.scope)}・${e.version} 卷</p><h1>${esc(e.title)}</h1><p>25 題・每題 4 分・總分 100 分。A/B 卷題目不同，但能力配置相同。</p></div><div class="timer" id="timerText">40:00</div></div>${groups.map(g=>`<h2 class="exam-section">${esc(g.name)}</h2>${g.items.map(q=>{n++;return renderExamQ(q,n);}).join('')}`).join('')}<div class="hero-actions"><button class="btn primary" data-submit-exam>交卷並計分</button><button class="btn secondary" data-exam-top>回到考卷最上方</button></div>`;
  }
  function renderExamQ(q,n){
    if(q.type==='fill') return `<fieldset class="exam-q"><legend>${n}. ${esc(q.prompt)} <button class="speak" type="button" data-speak-text="${esc(q.prompt)}">🔊</button></legend><input type="text" data-exam-fill="${q.id}" autocomplete="off" placeholder="填入答案"></fieldset>`;
    return `<fieldset class="exam-q"><legend>${n}. ${esc(q.prompt)} <button class="speak" type="button" data-speak-text="${esc(q.prompt)}">🔊</button></legend>${q.choices.map((c,i)=>`<label class="exam-choice"><input type="radio" name="${q.id}" value="${i}" data-exam-mc="${q.id}"> ${String.fromCharCode(65+i)}. ${esc(c)}</label>`).join('')}</fieldset>`;
  }
  function submitExam(){
    const e=exams[runtime.exam.id], answers={}, wrong=[]; let score=0;
    for(const q of e.questions){let ok=false,ans=null;if(q.type==='mc'){const sel=document.querySelector(`input[name="${q.id}"]:checked`);ans=sel?Number(sel.value):null;ok=ans===q.answer;}else{const el=document.querySelector(`[data-exam-fill="${q.id}"]`);ans=el?.value||'';ok=q.answers.some(a=>norm(a)===norm(ans));}answers[q.id]=ans;if(ok)score+=q.points;else{wrong.push(q);addWrong(q,q.lessonId);}}
    const date=localDate(); state.examScores[e.id]={score,date}; saveState(); runtime.exam.submitted=true;runtime.exam.result={score,wrong,answers,date};clearInterval(runtime.timer);
    if(!runtime.exam.bonus){const bonus=score>=90?20:score>=80?12:6;runtime.exam.bonus=true;addStars(bonus,score>=90?'模考達成 90+':'完成模考');}
    renderExam();
  }
  function renderExamResult(e,r){
    const byLesson={}; for(const q of r.wrong){byLesson[q.lessonId]=(byLesson[q.lessonId]||0)+1;}
    examContent.innerHTML=`<div class="result-panel"><p class="eyebrow">${esc(e.title)} 完成</p><div class="score-big">${r.score} 分</div><p>${r.score>=90?'🌟 很穩定，可以用另一卷驗證。':r.score>=80?'👍 基礎不錯，先救幾個弱點再做另一卷。':'🛟 先依錯題分類救援，再挑戰另一卷。'}</p><div class="scope-strip">${Object.entries(byLesson).map(([lid,c])=>`<span class="scope-pill">${esc(lessons[lid]?.title||'其他')}：${c} 題</span>`).join('')}</div></div><div class="section-head"><div><h2>錯題解析 ${r.wrong.length} 題</h2><p>已自動同步到錯題救援站。</p></div></div>${r.wrong.length?r.wrong.map(q=>`<article class="wrong-review"><b>${esc(q.prompt)}</b><p>${esc(q.explain)}</p><button class="btn secondary small" data-open-lesson="${q.lessonId}" data-stage="${q.type==='fill'?4:6}">回課程救援</button></article>`).join(''):`<section class="card empty-state"><div class="emoji">🏆</div><h2>全對！</h2><p>可以用另一份平行卷確認不是背答案。</p></section>`}<div class="hero-actions"><button class="btn primary" data-exam-close>回段考中心</button><button class="btn secondary" data-open-exam="${e.id}">再做一次</button></div>`;
  }

  // Events
  document.addEventListener('click', e => {
    const t=e.target.closest('button'); if(!t)return;
    if(t.dataset.nav){nav(t.dataset.nav);return;}
    if(t.dataset.navGo){nav(t.dataset.navGo);return;}
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
    if(t.hasAttribute('data-planets-reset')){resetPlanets();return;}
    if(t.dataset.planet){clickPlanet(t.dataset.planet);return;}
    if(t.dataset.fireToggle){runtime.sim.fire[t.dataset.fireToggle]=!runtime.sim.fire[t.dataset.fireToggle];updateFire();return;}
    if(t.dataset.rustToggle){runtime.sim.rust[t.dataset.rustToggle]=!runtime.sim.rust[t.dataset.rustToggle];updateRust();return;}
    if(t.dataset.matchOpen){openMatch(t.dataset.matchOpen);return;}
    if(t.dataset.matchCard!==undefined){matchClick(Number(t.dataset.matchCard));return;}
    if(t.dataset.boardOpen){openBoard(t.dataset.boardOpen);return;}
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
