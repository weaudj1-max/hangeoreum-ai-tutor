(() => {
'use strict';
const STORE_KEY = 'hangeoreum-ai-tutor-v1';
const SUBJECTS = window.TUTOR_SUBJECTS || [];
const BANK = window.TUTOR_BANK || [];
const DEFAULT = {subject:'수학', level:'보통', goal:'매일 꾸준히 공부하기', dailyTarget:5, note:'', attempts:[], wrongNotes:[], chat:[]};
let state;
try { state = {...DEFAULT, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}')}; } catch { state = {...DEFAULT}; }
for (const field of ['attempts','wrongNotes','chat']) if (!Array.isArray(state[field])) state[field]=[];
let apiAvailable=false, loginRequired=false, apiModel=null, mode='단계별 풀이', sending=false;
let volatilePassword='';
const getPassword=()=>{try{return sessionStorage.getItem('hangeoreum-app-pass')||volatilePassword;}catch{return volatilePassword;}};
const setPassword=value=>{volatilePassword=value;try{sessionStorage.setItem('hangeoreum-app-pass',value);}catch{}};
let quiz=null, toastTimer;
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const subjectMeta=id=>SUBJECTS.find(s=>s.id===id)||SUBJECTS[0]||{id:'수학',icon:'∑',color:'#eee',caption:''};
const save=()=>{ try {localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch(e){console.warn('기록 저장 실패:',e);} };
const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const niceDate=d=>{try{return new Date(d).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});}catch{return '';}};
const randomize=arr=>arr.map(v=>({v,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.v);
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3400);}
const pct=(num,den)=>den?Math.round(num/den*100):0;
function streak(){const days=new Set(state.attempts.map(x=>x.date));let current=new Date();if(!days.has(localDate(current)))current.setDate(current.getDate()-1);let n=0;while(days.has(localDate(current))){n++;current.setDate(current.getDate()-1)}return n;}
function navigate(tab){
  const tabs=['home','tutor','practice','wrong','settings'];if(!tabs.includes(tab))tab='home';
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${tab}`));
  document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  const titles={home:'학습 대시보드',tutor:'AI 개인 과외',practice:'문제 연습',wrong:'오답노트',settings:'학습 설정'};
  $('page-title').textContent=titles[tab];
  if(tab==='home')renderHome();
  if(tab==='wrong')renderWrong();
  if(tab==='tutor')renderChat();
  if(tab==='settings')renderSettings();
  window.scrollTo({top:0,behavior:'smooth'});
  history.replaceState(null,'',`#${tab}`);
}
function switchSubject(subject,tab='practice'){
  if(!SUBJECTS.some(x=>x.id===subject))return;
  state.subject=subject;save();syncSelectors();navigate(tab);
}
function syncSelectors(){
  for(const id of ['quiz-subject','chat-subject'])$(id).value=state.subject;
  $('quiz-level').value=state.level;$('chat-level').value=state.level;
  $('chat-mode-badge').textContent=`${mode} · ${state.subject}`;
}
function renderHome(){
  const total=state.attempts.length;const correct=state.attempts.filter(x=>x.correct).length;
  const today=state.attempts.filter(x=>x.date===localDate()).length;
  const goal=Math.max(1,Number(state.dailyTarget)||5);
  $('stat-total').textContent=total;$('stat-accuracy').textContent=pct(correct,total);
  $('stat-streak').textContent=streak();$('side-streak').textContent=`${streak()}일`;
  $('stat-today').textContent=today;$('stat-daily-total').textContent=`/ ${goal}문제`;
  $('today-progress').style.width=`${Math.min(100,pct(today,goal))}%`;
  $('stat-accuracy-note').textContent=total?`${correct}개 정답 · ${total-correct}개 복습 필요`:'첫 문제를 풀어보세요';
  $('nav-wrong-count').textContent=state.wrongNotes.length;
  $('today-date').textContent=new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
  $('subject-cards').innerHTML=SUBJECTS.map(s=>`<button class="subject-card" data-subject="${escapeHtml(s.id)}"><span class="subject-symbol" style="background:${s.color}">${escapeHtml(s.icon)}</span><span><strong>${escapeHtml(s.id)}</strong><small>${escapeHtml(s.caption)}</small></span></button>`).join('');
  const recent=state.attempts.slice(-4).reverse();
  $('recent-list').innerHTML=recent.length?recent.map(a=>`<div class="recent-item"><span class="recent-status ${a.correct?'':'bad'}">${a.correct?'✓':'×'}</span><div class="recent-info"><strong>${escapeHtml(a.subject)} · ${escapeHtml(a.topic||'문제 풀이')}</strong><small>${a.correct?'정답':'오답'} · ${escapeHtml(a.level||'보통')}</small></div><time>${niceDate(a.time)}</time></div>`).join(''):'<div class="empty-small">아직 기록이 없어요.<br>첫 문제를 풀면 여기에 표시돼요.</div>';
}
function renderChat(){
  const area=$('chat-messages');area.replaceChildren();
  const msgs=state.chat.filter(c=>c.subject===state.subject).slice(-60);
  if(!msgs.length){
    const intro=apiAvailable
      ? `안녕! 나는 너의 AI 과외 선생님이야. 😊\n\n지금은 ${state.subject} 수업이야. 어려운 문제를 붙여 넣거나 개념을 물어봐.\n\n풀이를 바로 보기 부담스럽다면 위에서 ‘힌트만’을 선택해도 좋아!`
      : `안녕! 한걸음 AI에 온 걸 환영해. 📚\n\n현재는 샘플 문제 체험 모드야. ‘문제 연습’에서는 과목별 문제를 바로 풀 수 있어.\n\nAI와 자유롭게 대화하려면 Cloudflare Workers AI를 배포하고 앱 비밀번호를 설정해 줘.`;
    appendMessage('assistant',intro,false);
  } else msgs.forEach(c=>appendMessage(c.role,c.content,false));
  $('chat-mode-badge').textContent=`${mode} · ${state.subject}`;
  area.scrollTop=area.scrollHeight;
}
function appendMessage(role,content,scroll=true){
  const item=document.createElement('div');item.className=`chat-message ${role==='user'?'user':role==='system'?'system':''}`;
  const icon=document.createElement('div');icon.className='chat-bubble-icon';icon.textContent=role==='user'?'나':'✦';
  const bubble=document.createElement('div');bubble.className='chat-bubble';bubble.textContent=content;
  item.append(icon,bubble);$('chat-messages').append(item);
  if(scroll)$('chat-messages').scrollTop=$('chat-messages').scrollHeight;
  return bubble;
}
function rememberChat(role,content){state.chat.push({role,content,subject:state.subject,time:new Date().toISOString()});state.chat=state.chat.slice(-150);save();}
async function apiRequest(path,body){
  const pass=getPassword();
  const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-App-Password':pass},body:JSON.stringify(body)});
  let data;try{data=await res.json()}catch{throw new Error(`서버 응답을 읽을 수 없습니다 (${res.status}).`)}
  if(!res.ok)throw new Error(data.error||`서버 오류 (${res.status})`);
  return data;
}
async function submitChat(event){
  event.preventDefault();
  const message=$('chat-input').value.trim();if(!message||sending)return;
  if(!apiAvailable){toast('AI 대화를 사용하려면 Cloudflare Workers AI와 비밀번호를 먼저 설정해 주세요.');navigate('settings');return;}
  const history=state.chat.filter(c=>c.subject===state.subject).slice(-8).map(c=>({role:c.role,content:c.content}));
  appendMessage('user',message);rememberChat('user',message);$('chat-input').value='';
  const bubble=appendMessage('assistant','답변을 생각하고 있어요…');sending=true;$('send-chat').disabled=true;
  try {
    const result=await apiRequest('/api/tutor',{message,subject:state.subject,level:state.level,mode,note:state.note,history});
    bubble.textContent=result.answer;rememberChat('assistant',result.answer);
  }catch(e){bubble.textContent=`연결 오류: ${e.message}\n설정을 확인하고 다시 질문해 주세요.`;toast(e.message)}
  finally{sending=false;$('send-chat').disabled=false;$('chat-messages').scrollTop=$('chat-messages').scrollHeight}
}
function allQuizSamples(subject,level){
  const preferred=BANK.filter(q=>q.subject===subject&&q.level===level);
  const others=randomize(BANK.filter(q=>q.subject===subject&&q.level!==level));
  return randomize(preferred).concat(others).slice(0,Math.min(3,preferred.length+others.length));
}
async function startQuiz(overrideQuestion=null){
  const subject=$('quiz-subject').value,level=$('quiz-level').value;
  state.subject=subject;state.level=level;save();syncSelectors();
  let questions,source='sample';
  if(overrideQuestion){questions=[overrideQuestion];source='review';}
  else if(document.querySelector('input[name="quiz-source"]:checked').value==='ai'){
    if(!apiAvailable){toast('AI 문제 생성은 Cloudflare 연결 후 이용할 수 있어요.');return;}
    const btn=$('generate-quiz');btn.disabled=true;btn.textContent='문제를 생성하는 중…';
    try{const result=await apiRequest('/api/quiz',{subject,level,note:state.note});questions=result.questions;source='ai';}
    catch(e){toast(`문제 생성 실패: ${e.message}`);$('quiz-stage').innerHTML=`<div class="empty-quiz"><h3>문제를 불러오지 못했어요.</h3><p>${escapeHtml(e.message)}</p></div>`;return;}
    finally{btn.disabled=false;btn.textContent='▤ 새 문제 시작';}
  }else questions=allQuizSamples(subject,level);
  if(!questions?.length){toast('이 과목의 샘플 문제가 없습니다.');return;}
  quiz={questions,index:0,selected:null,locked:false,correct:0,source};
  renderQuiz();navigate('practice');
}
function renderQuiz(){
  if(!quiz)return;
  const stage=$('quiz-stage');
  if(quiz.index>=quiz.questions.length){
    const n=quiz.questions.length,p=pct(quiz.correct,n);
    stage.innerHTML=`<div class="quiz-result"><div class="result-ring">${p}%</div><h3>${quiz.correct} / ${n}문제 정답!</h3><p>${p===100?'완벽해요! 이 기세로 다음 개념도 도전해 봐요.':p>=60?'잘했어요! 틀린 문제를 복습하면 더 좋아질 거예요.':'괜찮아요. 틀린 문제에서 배울 수 있어요. 오답노트를 확인해 봐요.'}</p><div class="result-actions"><button class="btn btn-primary" id="restart-quiz">새 문제 풀기</button><button class="btn btn-secondary" data-go="wrong">오답노트 보기</button></div></div>`;
    stage.querySelector('#restart-quiz').addEventListener('click',()=>startQuiz());
    stage.querySelector('[data-go="wrong"]').addEventListener('click',()=>navigate('wrong'));
    renderHome();return;
  }
  const q=quiz.questions[quiz.index];
  stage.innerHTML=`<div class="quiz-meta"><span>${escapeHtml(state.subject)} · ${escapeHtml(q.topic||'개념')}</span><span>문제 ${quiz.index+1} / ${quiz.questions.length}</span></div><div class="quiz-progress"><div style="width:${pct(quiz.index+1,quiz.questions.length)}%"></div></div><h2 class="quiz-q">${escapeHtml(q.question)}</h2><div class="quiz-options">${q.options.map((o,i)=>`<button class="quiz-option ${quiz.locked&&i===q.answer?'correct':''} ${quiz.locked&&i===quiz.selected&&i!==q.answer?'incorrect':''} ${!quiz.locked&&i===quiz.selected?'selected':''}" data-answer="${i}" ${quiz.locked?'disabled':''}><span class="option-number">${['①','②','③','④'][i]}</span><span>${escapeHtml(o)}</span></button>`).join('')}</div>${quiz.locked?`<div class="quiz-feedback ${quiz.selected===q.answer?'':'bad'}"><strong>${quiz.selected===q.answer?'✓ 정답이에요!':'✦ 오답이에요. 차근차근 확인해요.'}</strong><p>${escapeHtml(q.explanation)}</p></div>`:''}<div class="quiz-actions"><span class="quiz-source-pill">${quiz.source==='ai'?'✦ AI 맞춤 문제':quiz.source==='review'?'↺ 오답 복습':'📗 검토된 샘플 문제'}</span><button class="btn btn-primary" id="quiz-action" ${quiz.selected===null?'disabled':''}>${quiz.locked?(quiz.index===quiz.questions.length-1?'결과 보기 →':'다음 문제 →'):'정답 확인하기'}</button></div>`;
  stage.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',()=>{if(!quiz.locked){quiz.selected=Number(button.dataset.answer);renderQuiz();}}));
  stage.querySelector('#quiz-action').addEventListener('click',()=>{
    if(!quiz.locked){if(quiz.selected===null)return;submitAnswer();}
    else{quiz.index++;quiz.selected=null;quiz.locked=false;renderQuiz();}
  });
}
function submitAnswer(){
  if(!quiz||quiz.locked||quiz.selected===null)return;
  const q=quiz.questions[quiz.index],correct=quiz.selected===q.answer,now=new Date();
  quiz.locked=true;if(correct)quiz.correct++;
  state.attempts.push({id:q.id,subject:state.subject,level:state.level,topic:q.topic||'개념',correct,date:localDate(now),time:now.toISOString(),source:quiz.source});
  state.attempts=state.attempts.slice(-2000);
  if(!correct){
    const note={...q,subject:state.subject,level:state.level,selected:quiz.selected,date:now.toISOString(),wrongId:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`};
    state.wrongNotes.unshift(note);state.wrongNotes=state.wrongNotes.slice(0,250);
  }
  save();renderQuiz();renderHome();
}
function renderWrong(){
  $('nav-wrong-count').textContent=state.wrongNotes.length;
  const list=$('wrong-list');
  if(!state.wrongNotes.length){list.innerHTML='<div class="panel empty-quiz"><div class="empty-illustration">✓</div><h3>아직 기록된 오답이 없어요!</h3><p>문제를 풀다가 틀리면 이곳에 자동으로 저장돼요.</p></div>';return;}
  list.innerHTML=state.wrongNotes.map((q,i)=>`<div class="wrong-item"><div class="wrong-meta"><span>${escapeHtml(q.subject)}</span><span>${escapeHtml(q.topic||'개념')}</span><time>${niceDate(q.date)}</time></div><h3>${escapeHtml(q.question)}</h3><p><b>내가 고른 답:</b> ${escapeHtml(q.options[q.selected])}</p><p><b>정답:</b> ${escapeHtml(q.options[q.answer])}</p><p><b>핵심 해설:</b> ${escapeHtml(q.explanation)}</p><div class="wrong-actions"><button class="btn btn-primary" data-retry="${i}">다시 풀기 ↺</button><button class="btn btn-secondary" data-remove="${i}">노트에서 삭제</button></div></div>`).join('');
  list.querySelectorAll('[data-retry]').forEach(b=>b.addEventListener('click',()=>{
    const q=state.wrongNotes[Number(b.dataset.retry)];if(!q)return;
    $('quiz-subject').value=q.subject;$('quiz-level').value=q.level;
    startQuiz({...q});
  }));
  list.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{
    state.wrongNotes.splice(Number(b.dataset.remove),1);save();renderWrong();toast('오답노트에서 삭제했어요.');
  }));
}
function renderSettings(){
  $('setting-level').value=state.level;$('setting-goal').value=state.goal||'';
  $('setting-daily').value=state.dailyTarget||5;$('setting-note').value=state.note||'';
  $('setting-password').value=getPassword();
  $('settings-api-icon').textContent=apiAvailable?'●':'○';
  $('settings-api-title').textContent=apiAvailable?'AI API 연결됨':'AI API 미연결 · 체험 모드';
  $('settings-api-desc').textContent=apiAvailable?`연결 모델: ${apiModel||'설정된 모델'}`:'Cloudflare의 Workers AI 바인딩 및 APP_PASSWORD 비밀 변수 설정이 필요해요.';
}
async function checkHealth(){
  try{
    const res=await fetch('/api/health',{cache:'no-store'});if(!res.ok)throw Error('오류');
    const data=await res.json();apiAvailable=!!data.aiConnected;loginRequired=!!data.loginRequired;apiModel=data.model;
  }catch{apiAvailable=false;apiModel=null;}
  $('api-status').classList.toggle('connected',apiAvailable);
  $('api-status').innerHTML=`<span class="dot"></span>${apiAvailable?'AI 연결됨':'체험 모드'}`;
  $('quiz-setup-note').textContent=apiAvailable?'AI 맞춤 문제 또는 검토된 샘플 문제를 선택하세요.':'샘플 문제는 지금 바로 사용할 수 있어요. AI 생성은 Cloudflare Workers AI 연결이 필요해요.';
  renderChat();renderSettings();
}
function downloadJson(){
  const json=JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2);
  const a=document.createElement('a');const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  a.href=url;a.download=`hangeoreum-study-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('학습 기록을 내려받았어요.');
}
function attachHandlers(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.tab)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
  $('subject-cards').addEventListener('click',e=>{const btn=e.target.closest('[data-subject]');if(btn)switchSubject(btn.dataset.subject);});
  for(const id of ['quiz-subject','chat-subject'])$(id).addEventListener('change',e=>{state.subject=e.target.value;save();syncSelectors();renderChat();});
  $('quiz-level').addEventListener('change',e=>{state.level=e.target.value;save();syncSelectors();});
  $('chat-level').addEventListener('change',e=>{state.level=e.target.value;save();syncSelectors();});
  $('mode-chips').addEventListener('click',e=>{const btn=e.target.closest('[data-mode]');if(!btn)return;mode=btn.dataset.mode;$('mode-chips').querySelectorAll('button').forEach(el=>el.classList.toggle('active',el===btn));$('chat-mode-badge').textContent=`${mode} · ${state.subject}`;});
  $('chat-form').addEventListener('submit',submitChat);
  $('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit();}});
  $('clear-chat').addEventListener('click',()=>{if(!confirm(`${state.subject} 과목의 대화 기록을 삭제할까요?`))return;state.chat=state.chat.filter(x=>x.subject!==state.subject);save();renderChat();toast('대화를 삭제했어요.');});
  document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{$('chat-input').value=b.dataset.prompt;$('chat-input').focus();}));
  $('generate-quiz').addEventListener('click',()=>startQuiz());
  $('clear-wrong').addEventListener('click',()=>{if(!state.wrongNotes.length)return toast('삭제할 오답이 없어요.');if(confirm('모든 오답노트를 삭제할까요? 학습 통계는 유지됩니다.')){state.wrongNotes=[];save();renderWrong();toast('오답노트를 비웠어요.');}});
  $('save-settings').addEventListener('click',()=>{state.level=$('setting-level').value;state.goal=$('setting-goal').value.trim();state.dailyTarget=Math.max(1,Math.min(100,Number($('setting-daily').value)||5));save();syncSelectors();renderHome();toast('학습 설정을 저장했어요.');});
  $('save-note').addEventListener('click',()=>{state.note=$('setting-note').value.slice(0,9000);save();toast('학습 자료를 저장했어요.');});
  $('save-password').addEventListener('click',()=>{setPassword($('setting-password').value);toast('현재 브라우저 탭에 비밀번호를 저장했어요.');});
  $('export-data').addEventListener('click',downloadJson);
  $('reset-data').addEventListener('click',()=>{if(!confirm('모든 학습 기록·대화·오답·설정을 삭제할까요? 되돌릴 수 없습니다.'))return;state={...DEFAULT,attempts:[],wrongNotes:[],chat:[]};quiz=null;save();syncSelectors();$('quiz-stage').innerHTML='<div class="empty-quiz"><h3>기록을 초기화했어요.</h3><p>새 문제로 다시 시작해 보세요.</p></div>';renderHome();renderSettings();renderChat();toast('학습 기록을 초기화했어요.');});
}
function init(){
  const opts=SUBJECTS.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.id)}</option>`).join('');
  $('quiz-subject').innerHTML=opts;$('chat-subject').innerHTML=opts;
  if(!SUBJECTS.some(s=>s.id===state.subject))state.subject='수학';
  if(!['기초','보통','심화'].includes(state.level))state.level='보통';
  syncSelectors();renderHome();renderChat();attachHandlers();
  const tab=location.hash.slice(1);navigate(['home','tutor','practice','wrong','settings'].includes(tab)?tab:'home');
  checkHealth();
}
init();
})();
