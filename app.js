// =================== NARZĘDZIA / POMOCNICZE ===================
const qs  = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

function escapeHtml(s){
  if(!s) return '';
  return s.replaceAll('&','&amp;')
          .replaceAll('<','&lt;')
          .replaceAll('>','&gt;')
          .replaceAll('"','&quot;');
}
function randomId(){ return Date.now() + '-' + Math.random().toString(16).slice(2); }

// =================== TABS ===================
const tabs = {
  todayBtn:   qs('#tab-today'),
  journalBtn: qs('#tab-journal'),
  eventsBtn:  qs('#tab-events'),
  tasksBtn:   qs('#tab-tasks'),
  backupBtn:  qs('#tab-backup'),
  panels: {
    today:   qs('#panel-today'),
    journal: qs('#panel-journal'),
    events:  qs('#panel-events'),
    tasks:   qs('#panel-tasks'),
    backup:  qs('#panel-backup'),
  }
};
tabs.todayBtn?.addEventListener('click',  ()=>switchTab('today'));
tabs.journalBtn?.addEventListener('click',()=>switchTab('journal'));
tabs.eventsBtn?.addEventListener('click', ()=>switchTab('events'));
tabs.tasksBtn?.addEventListener('click',  ()=>switchTab('tasks'));
tabs.backupBtn?.addEventListener('click', ()=>switchTab('backup'));

function switchTab(name){
  ['today','journal','events','tasks','backup'].forEach(n=>{
    const btn   = qs(`#tab-${n}`);
    const panel = tabs.panels[n];
    const active = (n===name);
    if(btn)   btn.classList.toggle('active', active);
    if(panel) panel.classList.toggle('hidden', !active);
  });
  window.scrollTo({top:0, behavior:'smooth'});
}

// =================== STORAGE / SETTINGS ===================
const DB = {
  save(key, obj){ localStorage.setItem(key, JSON.stringify(obj)); },
  load(key){ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
};
const Settings = {
  key: 'settings',
  load(){
    try{ return JSON.parse(localStorage.getItem(this.key)) || { soundEnabled:true }; }
    catch{ return { soundEnabled:true }; }
  },
  save(obj){ localStorage.setItem(this.key, JSON.stringify(obj)); }
};

// =================== MIGRACJE (ID/DURATION) ===================
function migrateTaskIds(){
  const arr = DB.load('tasks'); let changed=false;
  arr.forEach(t=>{ if(!t.id){ t.id = randomId(); changed=true; } });
  if(changed) DB.save('tasks', arr);
}
function migrateJournalIds(){
  const arr = DB.load('journal'); let changed=false;
  arr.forEach(e=>{ if(!e.id){ e.id = randomId(); changed=true; } });
  if(changed) DB.save('journal', arr);
}
function migrateEventIds(){
  const arr = DB.load('events'); let changed=false;
  arr.forEach(e=>{ if(!e.id){ e.id = randomId(); changed=true; } });
  if(changed) DB.save('events', arr);
}
migrateTaskIds();
migrateJournalIds();
migrateEventIds();

// =================== DZIENNIK ===================
const journalForm         = qs('#journal-form');
const journalText         = qs('#journal-text');
const journalDate         = qs('#journal-date');
const journalList         = qs('#journal-list');
const journalSubmitBtn    = qs('#journal-submit');
const journalCancelEditBtn= qs('#journal-cancel-edit');
const journalFilterDate   = qs('#journal-filter-date');
const journalFilterClear  = qs('#journal-filter-clear');
const journalSearch       = qs('#journal-search'); // opcjonalnie, jeśli dodałaś pole Szukaj

let journalEditingId = null;

function setJournalEditing(id){
  journalEditingId = id;
  const editing = !!id;
  if(journalSubmitBtn)     journalSubmitBtn.textContent = editing ? 'Zaktualizuj wpis' : 'Zapisz wpis';
  if(journalCancelEditBtn) journalCancelEditBtn.style.display = editing ? 'block' : 'none';
}

function renderJournal(){
  let entries = DB.load('journal'); let changed=false;
  entries.forEach(e=>{ if(!e.id){ e.id = randomId(); changed=true; } });
  if(changed) DB.save('journal', entries);

  const filter = journalFilterDate?.value || '';
  if(filter){ entries = entries.filter(e => e.date === filter); }

  const q = (journalSearch?.value || '').trim().toLowerCase();
  if(q){
    entries = entries.filter(e =>
      (e.text||'').toLowerCase().includes(q) ||
      (e.date||'').toLowerCase().includes(q)
    );
  }

  entries = entries.slice().sort((a,b)=> (b.created||0) - (a.created||0));

  journalList.innerHTML = entries.map(e=>`
    <div class="item" data-id="${e.id}">
      <div>
        <strong>${escapeHtml(e.date||'—')}</strong>
        <div>${escapeHtml(e.text||'').replace(/\n/g,'<br>')}</div>
        ${e.updated ? `<div><small class="muted">Edytowano: ${new Date(e.updated).toLocaleString()}</small></div>` : ''}
      </div>
      <div class="controls">
        <button data-edit="${e.id}">Edytuj</button>
        <button data-del="${e.id}" class="btn-danger">Usuń</button>
      </div>
    </div>
  `).join('') || '<em>Brak wpisów</em>';

  renderToday(); // aktualizuj skrót w "Dziś"
}

journalForm?.addEventListener('submit', e=>{
  e.preventDefault();
  const text = journalText.value.trim();
  const date = journalDate.value || (new Date()).toISOString().slice(0,10);
  if(!text) return alert('Wpis jest pusty');

  const arr = DB.load('journal');
  if(journalEditingId){
    const item = arr.find(x => x.id === journalEditingId);
    if(item){ item.text = text; item.date = date; item.updated = Date.now(); DB.save('journal', arr); }
    setJournalEditing(null);
    journalForm.reset();
  } else {
    arr.unshift({ id: randomId(), text, date, created: Date.now() });
    DB.save('journal', arr);
    journalText.value='';
  }
  renderJournal();
});
journalList?.addEventListener('click', e=>{
  const idEdit = e.target.dataset.edit;
  const idDel  = e.target.dataset.del;
  if(idEdit){
    const arr = DB.load('journal');
    const item = arr.find(x=>x.id===idEdit);
    if(item){
      journalText.value = item.text || '';
      journalDate.value = item.date || '';
      setJournalEditing(item.id);
      journalText.scrollIntoView({behavior:'smooth', block:'center'});
      journalText.focus();
    }
  }
  if(idDel){
    if(!confirm('Na pewno usunąć ten wpis?')) return;
    let arr = DB.load('journal');
    arr = arr.filter(x=>x.id !== idDel);
    DB.save('journal', arr);
    renderJournal();
  }
});
journalCancelEditBtn?.addEventListener('click', ()=>{ setJournalEditing(null); journalForm.reset(); });
journalFilterDate?.addEventListener('change', renderJournal);
journalFilterClear?.addEventListener('click', ()=>{ if(journalFilterDate) journalFilterDate.value=''; renderJournal(); });
journalSearch?.addEventListener('input', renderJournal);

// =================== WYDARZENIA ===================
const eventForm         = qs('#event-form');
const eventsList        = qs('#events-list');
const eventsFilterDate  = qs('#events-filter-date');
const eventsFilterClear = qs('#events-filter-clear');
const exportDayBtn      = qs('#events-export-day'); // opcjonalny przycisk "Eksportuj dzień do .ics"

let eventsSelectedDate = ''; // YYYY-MM-DD

function renderEvents(){
  let arr = DB.load('events').slice();
  const f = eventsSelectedDate || (eventsFilterDate?.value || '');
  if(f){ arr = arr.filter(ev => ev.when.slice(0,10) === f); }

  arr.sort((a,b)=> new Date(a.when) - new Date(b.when));
  eventsList.innerHTML = arr.map((ev)=>`
    <div class="item">
      <div>
        <strong>${escapeHtml(ev.title)}</strong>
        <div><small>${new Date(ev.when).toLocaleString()}</small></div>
      </div>
      <div class="controls">
        <button data-ics="${ev.id}" class="btn-secondary">Do kalendarza</button>
        <button data-del-event="${ev.id}" class="btn-danger">Usuń</button>
      </div>
    </div>
  `).join('') || '<em>Brak wydarzeń</em>';

  renderMiniCalendarGrid(); // zaktualizuj kropki
  renderToday();
}

eventForm?.addEventListener('submit', e=>{
  e.preventDefault();
  const title     = qs('#event-title').value.trim();
  const date      = qs('#event-date').value;
  const time      = qs('#event-time').value;
  const remindMin = Number(qs('#event-remind-min').value || 10);
  if(!title || !date || !time) return alert('Uzupełnij pola');

  const when = new Date(date + 'T' + time);
  const arr = DB.load('events');
  arr.push({ id: randomId(), title, when: when.toISOString(), remindMin });
  DB.save('events', arr);
  eventForm.reset();

  eventsSelectedDate = date;
  if(eventsFilterDate) eventsFilterDate.value = date;

  renderEvents();
  scheduleChecks();
});
eventsList?.addEventListener('click', e=>{
  const idIcs = e.target.dataset.ics;
  const idDel = e.target.dataset.delEvent;

  if(idIcs){
    const ev = DB.load('events').find(x=>x.id===idIcs);
    if(ev) downloadICSForEvent(ev);
  }
  if(idDel){
    if(!confirm('Usunąć to wydarzenie?')) return;
    let arr = DB.load('events');
    arr = arr.filter(x=>x.id !== idDel);
    DB.save('events', arr);
    renderEvents();
  }
});
eventsFilterDate?.addEventListener('change', ()=>{ eventsSelectedDate = eventsFilterDate.value || ''; renderEvents(); });
eventsFilterClear?.addEventListener('click', ()=>{ eventsSelectedDate = ''; if(eventsFilterDate) eventsFilterDate.value=''; renderEvents(); });

// ---- MINI KALENDARZ (miesięczny) ----
const calTitle = qs('#cal-title');
const calGrid  = qs('#cal-grid');
const calPrev  = qs('#cal-prev');
const calNext  = qs('#cal-next');

const MONTHS_PL = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
const DOW_PL    = ['Pn','Wt','Śr','Cz','Pt','So','Nd'];

let calYear, calMonth;

function initMiniCalendar(){
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  buildMiniCalendarSkeleton();
  renderMiniCalendarGrid();
}
function buildMiniCalendarSkeleton(){
  calGrid.innerHTML = '';
  for(const d of DOW_PL){
    const dow = document.createElement('div');
    dow.className = 'dow';
    dow.textContent = d;
    calGrid.appendChild(dow);
  }
}
function renderMiniCalendarGrid(){
  // usuń stare komórki dni
  qsa('#cal-grid .cal-cell').forEach(n=>n.remove());

  const first   = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth+1, 0).getDate();
  const start   = (first.getDay() + 6) % 7; // pon=0

  calTitle.textContent = `${MONTHS_PL[calMonth]} ${calYear}`;

  // mapa data->liczba wydarzeń
  const events = DB.load('events');
  const counts = {};
  events.forEach(ev=>{
    const d = ev.when.slice(0,10);
    counts[d] = (counts[d]||0) + 1;
  });

  for(let i=0;i<start;i++){
    const empty = document.createElement('div');
    empty.className = 'cal-cell cal-empty';
    empty.style.visibility = 'hidden';
    calGrid.appendChild(empty);
  }

  const todayStr = (new Date()).toISOString().slice(0,10);
  for(let day=1; day<=lastDay; day++){
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-cell';
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    cell.dataset.date = dateStr;

    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = String(day);
    cell.appendChild(num);

    const dots = document.createElement('div');
    dots.className = 'dots';
    const c = counts[dateStr] || 0;
    for(let i=0;i<Math.min(c,3);i++){
      const dot = document.createElement('span');
      dot.className = 'dot ev';
      dots.appendChild(dot);
    }
    cell.appendChild(dots);

    if(dateStr === todayStr) cell.classList.add('today');
    if(eventsSelectedDate && dateStr === eventsSelectedDate) cell.classList.add('selected');

    cell.addEventListener('click', ()=>{
      const d = cell.dataset.date;
      const dateInput = qs('#event-date'); if(dateInput) dateInput.value = d;
      eventsSelectedDate = d; if(eventsFilterDate) eventsFilterDate.value = d;
      renderEvents();
      qsa('.cal-cell.selected').forEach(n=>n.classList.remove('selected'));
      cell.classList.add('selected');
    });

    calGrid.appendChild(cell);
  }
}
calPrev?.addEventListener('click', ()=>{
  calMonth--; if(calMonth<0){ calMonth=11; calYear--; }
  buildMiniCalendarSkeleton(); renderMiniCalendarGrid();
});
calNext?.addEventListener('click', ()=>{
  calMonth++; if(calMonth>11){ calMonth=0; calYear++; }
  buildMiniCalendarSkeleton(); renderMiniCalendarGrid();
});
initMiniCalendar();

// ====== Eksport wybranego dnia do .ics (opcjonalny przycisk) ======
exportDayBtn?.addEventListener('click', ()=>{
  const day = eventsSelectedDate || eventsFilterDate?.value;
  if(!day) return alert('Wybierz dzień w filtrze.');
  const all = DB.load('events').filter(ev => ev.when.slice(0,10)===day);
  if(!all.length) return alert('Brak wydarzeń w tym dniu.');
  const ics = buildICSMulti(all);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const blob = new Blob([ics], {type:'text/calendar;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  if(isIOS){ location.assign(url); setTimeout(()=>URL.revokeObjectURL(url), 10000); }
  else{
    const a=document.createElement('a');
    a.href=url; a.download=`wydarzenia-${day}.ics`; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
});

// =================== TASKS (WAŻNE RZECZY) ===================
const taskForm           = qs('#task-form');
const tasksList          = qs('#tasks-list');
const taskTitle          = qs('#task-title');
const taskPriority       = qs('#task-priority');
const taskSubmitBtn      = qs('#task-submit');
const taskCancelEditBtn  = qs('#task-cancel-edit');
const taskFilterStatus   = qs('#task-filter-status');
const taskFilterPriority = qs('#task-filter-priority');

let taskEditingId = null;

function setTaskEditing(id){
  taskEditingId = id;
  const editing = !!id;
  if(taskSubmitBtn)     taskSubmitBtn.textContent = editing ? 'Zaktualizuj' : 'Dodaj';
  if(taskCancelEditBtn) taskCancelEditBtn.style.display = editing ? 'block' : 'none';
}
function priorityWeight(p){ if(p==='high') return 2; if(p==='medium') return 1; return 0; }
function applyTaskFilters(arr){
  const status = taskFilterStatus?.value || 'all';
  const pr     = taskFilterPriority?.value || 'all';
  return arr.filter(t=>{
    const statusOk = status==='all' ? true : (status==='active' ? !t.done : !!t.done);
    const prOk     = (pr==='all') ? true : (t.priority===pr);
    return statusOk && prOk;
  });
}
function renderTasks(){
  let arr = DB.load('tasks'); let changed=false;
  arr.forEach(t=>{ if(!t.id){ t.id = randomId(); changed=true; } });
  if(changed) DB.save('tasks', arr);

  arr = applyTaskFilters(arr);

  arr = arr.slice().sort((a,b)=>{
    if(a.done !== b.done) return a.done ? 1 : -1;
    const pw = priorityWeight(b.priority) - priorityWeight(a.priority);
    if(pw!==0) return pw;
    return (b.created||0) - (a.created||0);
  });
  tasksList.innerHTML = arr.map(t=>{
    const badge = `<span class="badge ${t.priority}">${t.priority==='high'?'Wysoki':t.priority==='medium'?'Średni':'Niski'}</span>`;
    return `
      <div class="item ${t.done ? 'done' : ''} priority-${t.priority}" data-id="${t.id}">
        <div><strong>${escapeHtml(t.title)}</strong> ${badge}</div>
        <div class="controls">
          <button data-toggle="${t.id}">${t.done ? 'Oznacz jako nie' : 'Zrobione'}</button>
          <button data-edit-task="${t.id}">Edytuj</button>
          <button data-del-task="${t.id}" class="btn-danger">Usuń</button>
        </div>
      </div>`;
  }).join('') || '<em>Brak zadań</em>';

  renderToday();
}
taskForm?.addEventListener('submit', e=>{
  e.preventDefault();
  const title = taskTitle.value.trim();
  const pr    = taskPriority.value;
  if(!title) return;

  const arr = DB.load('tasks');
  if(taskEditingId){
    const item = arr.find(x=>x.id===taskEditingId);
    if(item){ item.title = title; item.priority = pr; item.updated = Date.now(); DB.save('tasks', arr); }
    setTaskEditing(null); taskForm.reset();
  } else {
    arr.unshift({ id: randomId(), title, priority: pr, done:false, created: Date.now() });
    DB.save('tasks', arr); taskForm.reset();
  }
  renderTasks();
});
tasksList?.addEventListener('click', e=>{
  if(e.target.dataset.toggle!=null){
    const id = e.target.dataset.toggle;
    const arr = DB.load('tasks');
    const task = arr.find(t => t.id === id);
    if(task){ task.done = !task.done; DB.save('tasks', arr); renderTasks(); }
  }
  if(e.target.dataset.editTask!=null){
    const id = e.target.dataset.editTask;
    const arr = DB.load('tasks');
    const task = arr.find(t => t.id === id);
    if(task){
      taskTitle.value = task.title;
      taskPriority.value = task.priority;
      setTaskEditing(task.id);
      taskTitle.scrollIntoView({behavior:'smooth', block:'center'});
      taskTitle.focus();
    }
  }
  if(e.target.dataset.delTask!=null){
    if(!confirm('Usunąć to zadanie?')) return;
    const id = e.target.dataset.delTask;
    let arr = DB.load('tasks');
    arr = arr.filter(t => t.id !== id);
    DB.save('tasks', arr);
    renderTasks();
  }
});
taskCancelEditBtn?.addEventListener('click', ()=>{ setTaskEditing(null); taskForm.reset(); });
taskFilterStatus?.addEventListener('change', renderTasks);
taskFilterPriority?.addEventListener('change', renderTasks);

// =================== WIDOK „DZIŚ” ===================
const todayHeader       = qs('#today-header');
const todayEventsList   = qs('#today-events');
const todayTasksList    = qs('#today-tasks');
const todayJournalForm  = qs('#today-journal-form');
const todayJournalText  = qs('#today-journal-text');
const goEventsBtn       = qs('#go-events');
const goTasksBtn        = qs('#go-tasks');

function renderToday(){
  if(!tabs.panels.today) return; // jeśli nie masz tej sekcji w HTML – nic nie rób

  const now = new Date();
  const dayStr = now.toISOString().slice(0,10);
  const fmt = new Intl.DateTimeFormat('pl-PL', { weekday:'long', day:'2-digit', month:'long' });
  if(todayHeader) todayHeader.innerHTML = `<strong>${fmt.format(now)}</strong>`;

  // Wydarzenia dziś
  let evs = DB.load('events').filter(ev => ev.when.slice(0,10) === dayStr)
    .sort((a,b)=> new Date(a.when) - new Date(b.when));
  todayEventsList.innerHTML = evs.length ? evs.map(ev=>{
    const t = new Date(ev.when).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    return `
      <div class="item">
        <div><strong>${t}</strong> – ${escapeHtml(ev.title)}</div>
        <div class="controls">
          <button data-ics="${ev.id}" class="btn-secondary">Do kalendarza</button>
        </div>
      </div>`;
  }).join('') : '<em>Brak wydarzeń dzisiaj</em>';

  // 3 najważniejsze zadania (niezrobione)
  let tasks = DB.load('tasks')
    .filter(t => !t.done)
    .sort((a,b)=> (priorityWeight(b.priority)-priorityWeight(a.priority)) || ((b.created||0)-(a.created||0)))
    .slice(0,3);
  todayTasksList.innerHTML = tasks.length ? tasks.map(t=>{
    const badge = `<span class="badge ${t.priority}">${t.priority==='high'?'Wysoki':t.priority==='medium'?'Średni':'Niski'}</span>`;
    return `
      <div class="item" data-id="${t.id}">
        <div><strong>${escapeHtml(t.title)}</strong> ${badge}</div>
        <div class="controls">
          <button data-done="${t.id}">Zrobione</button>
        </div>
      </div>`;
  }).join('') : '<em>Brak zadań do zrobienia</em>';
}
todayEventsList?.addEventListener('click', e=>{
  const idIcs = e.target.dataset.ics;
  if(idIcs){
    const ev = DB.load('events').find(x=>x.id===idIcs);
    if(ev) downloadICSForEvent(ev);
  }
});
todayTasksList?.addEventListener('click', e=>{
  const idDone = e.target.dataset.done;
  if(idDone){
    const arr = DB.load('tasks');
    const t = arr.find(x=>x.id===idDone);
    if(t){ t.done = true; DB.save('tasks', arr); renderTasks(); renderToday(); }
  }
});
goEventsBtn?.addEventListener('click', ()=>{
  const day = (new Date()).toISOString().slice(0,10);
  eventsSelectedDate = day;
  if(eventsFilterDate) eventsFilterDate.value = day;
  switchTab('events'); renderEvents();
});
goTasksBtn?.addEventListener('click', ()=>{ switchTab('tasks'); });

todayJournalForm?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const text = todayJournalText.value.trim();
  if(!text) return;
  const arr = DB.load('journal');
  const day = (new Date()).toISOString().slice(0,10);
  arr.unshift({ id: randomId(), text, date: day, created: Date.now() });
  DB.save('journal', arr);
  todayJournalText.value = '';
  renderJournal(); renderToday();
});

// =================== POWIADOMIENIA + DŹWIĘK + SCHEDULER ===================
const notifyBtn   = qs('#notify-perm');
const soundToggleBtn = qs('#sound-toggle');
const soundTestBtn   = qs('#sound-test');
let settings = Settings.load();

notifyBtn?.addEventListener('click', requestNotificationPermission);
function requestNotificationPermission(){
  if(!('Notification' in window)) return alert('Twoja przeglądarka nie wspiera powiadomień.');
  Notification.requestPermission().then(perm=>{ alert('Uprawnienie: ' + perm); });
}

function updateSoundUi(){
  if(soundToggleBtn) soundToggleBtn.textContent = settings.soundEnabled ? '🔔 Dźwięk: włączony' : '🔕 Dźwięk: wyłączony';
}
updateSoundUi();

soundToggleBtn?.addEventListener('click', ()=>{
  settings.soundEnabled = !settings.soundEnabled;
  Settings.save(settings);
  updateSoundUi();
  if(settings.soundEnabled) tryBeep();
});
soundTestBtn?.addEventListener('click', ()=>{ tryBeep(); });

function tryBeep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.26);
  }catch(e){ console.log('Audio error', e); }
}

// scheduler: co 30s sprawdza nadchodzące wydarzenia
let schedulerInterval = null;
function scheduleChecks(){
  if(schedulerInterval) clearInterval(schedulerInterval);
  checkAndTrigger();
  schedulerInterval = setInterval(checkAndTrigger, 30*1000);
}
function checkAndTrigger(){
  const now = Date.now();
  const events = DB.load('events');
  events.forEach((ev, idx)=>{
    const when = new Date(ev.when).getTime();
    const remindAt = when - (ev.remindMin||0)*60*1000;
    if(!ev._notified && now >= remindAt && now < when + 60*1000){
      triggerNotification(ev);
      ev._notified = true;
      events[idx] = ev;
      DB.save('events', events);
      renderEvents();
    }
  });
}
function triggerNotification(ev){
  if(Notification.permission === 'granted'){
    const title = ev.title;
    const body  = `Przypomnienie: ${title}\nKiedy: ${new Date(ev.when).toLocaleString()}`;
    const n = new Notification(title, { body, tag: ev.id || undefined });
    try{ n.onclick = ()=>window.focus(); }catch(e){}
  }
  if(settings.soundEnabled) tryBeep();
}
scheduleChecks();

// =================== THEME TOGGLE ===================
const themeToggleBtn = qs('#theme-toggle');
initTheme();
themeToggleBtn?.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = (cur==='dark') ? 'light' : 'dark';
  setTheme(next);
});
function initTheme(){
  const saved = localStorage.getItem('theme');
  if(saved){ setTheme(saved); return; }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light', false);
}
function setTheme(mode, save=true){
  document.documentElement.setAttribute('data-theme', mode);
  if(themeToggleBtn) themeToggleBtn.textContent = (mode==='dark') ? '☀️ Tryb dzienny' : '🌙 Tryb nocny';
  themeToggleBtn?.classList.toggle('btn-secondary', true);
  if(save) localStorage.setItem('theme', mode);
}

// =================== BACKUP: EXPORT / IMPORT / WIPE ===================
const exportBtn  = qs('#export-btn');
const importInput= qs('#import-input');
const importBtn  = qs('#import-btn');
const wipeBtn    = qs('#wipe-btn');

exportBtn?.addEventListener('click', ()=>{
  const payload = {
    journal: DB.load('journal'),
    events:  DB.load('events'),
    tasks:   DB.load('tasks'),
    settings: Settings.load(),
    theme: localStorage.getItem('theme') || 'light',
    exportedAt: new Date().toISOString(),
    version: 1
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.download = `moj-dziennik-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
});

importBtn?.addEventListener('click', ()=>{
  const file = importInput.files && importInput.files[0];
  if(!file) return alert('Wybierz plik JSON do importu.');
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!confirm('Import zastąpi Twoje obecne dane. Kontynuować?')) return;

      if(Array.isArray(data.journal)) localStorage.setItem('journal', JSON.stringify(data.journal));
      if(Array.isArray(data.events))  localStorage.setItem('events',  JSON.stringify(data.events));
      if(Array.isArray(data.tasks))   localStorage.setItem('tasks',   JSON.stringify(data.tasks));
      if(data.settings) Settings.save(data.settings);
      if(data.theme)    localStorage.setItem('theme', data.theme);

      // migracje po imporcie
      migrateJournalIds();
      migrateTaskIds();
      migrateEventIds();

      initTheme();
      renderJournal();
      renderEvents();
      renderTasks();
      renderToday();
      scheduleChecks();

      alert('Import zakończony powodzeniem.');
    }catch(e){
      console.error(e);
      alert('Błąd podczas importu: nieprawidłowy plik JSON.');
    }
  };
  reader.readAsText(file);
});

wipeBtn?.addEventListener('click', ()=>{
  if(!confirm('Na pewno usunąć wszystkie dane (Dziennik, Wydarzenia, Zadania, Ustawienia)?')) return;
  localStorage.removeItem('journal');
  localStorage.removeItem('events');
  localStorage.removeItem('tasks');
  localStorage.removeItem('settings');
  renderJournal();
  renderEvents();
  renderTasks();
  renderToday();
  alert('Wyczyszczono dane.');
});

// =================== iCalendar (.ics) ===================
function escapeICS(s=''){
  return String(s)
    .replace(/\\/g,'\\\\')
    .replace(/;/g,'\\;')
    .replace(/,/g,'\\,')
    .replace(/\r?\n/g,'\\n');
}
function toICSDateUTC(d){
  const pad=n=>String(n).padStart(2,'0');
  return d.getUTCFullYear()
    + pad(d.getUTCMonth()+1)
    + pad(d.getUTCDate())
    + 'T'
    + pad(d.getUTCHours())
    + pad(d.getUTCMinutes())
    + pad(d.getUTCSeconds())
    + 'Z';
}
function buildICS(ev){
  const title = ev.title || 'Wydarzenie';
  const start = new Date(ev.when);
  const durationMin = Math.max(0, Number(ev.durationMin ?? 60)); // domyślnie 60 min
  const end = durationMin > 0 ? new Date(start.getTime() + durationMin*60000) : null;
  const triggerMin = Math.max(0, Number(ev.remindMin||10));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MojDziennik//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.id || ('ev-'+Date.now())}`,
    `DTSTAMP:${toICSDateUTC(new Date())}`,
    `DTSTART:${toICSDateUTC(start)}`,
    ...(end ? [`DTEND:${toICSDateUTC(end)}`] : []),
    `SUMMARY:${escapeICS(title)}`,
    'BEGIN:VALARM',
    `TRIGGER:-PT${triggerMin}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n');
}
function buildICSMulti(events){
  const now = new Date();
  const out = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MojDziennik//PL','CALSCALE:GREGORIAN','METHOD:PUBLISH'
  ];
  for(const ev of events){
    const title = ev.title || 'Wydarzenie';
    const start = new Date(ev.when);
    const dur   = Math.max(0, Number(ev.durationMin ?? 60));
    const end   = dur>0 ? new Date(start.getTime()+dur*60000) : null;
    const trig  = Math.max(0, Number(ev.remindMin||10));
    out.push(
      'BEGIN:VEVENT',
      `UID:${ev.id || ('ev-'+start.getTime())}`,
      `DTSTAMP:${toICSDateUTC(now)}`,
      `DTSTART:${toICSDateUTC(start)}`,
      ...(end ? [`DTEND:${toICSDateUTC(end)}`] : []),
      `SUMMARY:${escapeICS(title)}`,
      'BEGIN:VALARM',
      `TRIGGER:-PT${trig}M`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(title)}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}
function downloadICSForEvent(ev){
  const ics = buildICS(ev);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);

  if(isIOS){
    // iOS/Safari/PWA – nawigacja do blob: wywołuje arkusz „Otwórz w…/Kalendarz”
    location.assign(url);
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
    return;
  }
  // Inne przeglądarki – klasyczne pobieranie
  const namePart = (ev.title||'wydarzenie').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,40) || 'wydarzenie';
  const a = document.createElement('a');
  a.href = url; a.download = `${namePart}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// =================== START RENDERÓW ===================
renderJournal();
renderEvents();
renderTasks();
renderToday();
scheduleChecks();

// =================== PWA: rejestracja Service Workera ===================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch((err) => console.log('SW register error:', err));
  });
}