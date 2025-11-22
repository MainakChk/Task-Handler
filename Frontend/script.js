/* CONFIG */
const API = "/tasks"; // backend endpoint

/* AUTH REDIRECT */
(function ensureAuth(){
  const user = JSON.parse(localStorage.getItem('tm_user') || 'null');
  const isAuthPage = window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('register.html');

  if(!user && !isAuthPage){
    window.location.href = 'login.html';
  }
  if(user && isAuthPage){
    window.location.href = 'index.html';
  }
})();

/* THEME TOGGLE */
const themeToggle = document.getElementById('themeToggle');
function loadTheme(){
  const t = localStorage.getItem('tm_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  if(themeToggle) themeToggle.textContent = t === 'dark' ? '🌙' : '☀️';
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tm_theme', next);
  loadTheme();
}
if(themeToggle) themeToggle.addEventListener('click', toggleTheme);
loadTheme();

/* UI REFS */
const userArea = document.getElementById('userBadge');
const tasksContainer = document.getElementById('tasksContainer');

const totalTasksEl = document.getElementById('totalTasks');
const completedTasksEl = document.getElementById('completedTasks');
const pendingTasksEl = document.getElementById('pendingTasks');
const completionRateEl = document.getElementById('completionRate');
const legendBox = document.getElementById('legendBox');

const taskForm = document.getElementById('taskForm');
const titleInput = document.getElementById('title');
const descInput = document.getElementById('description');
const categoryInput = document.getElementById('categoryInput');
const priorityInput = document.getElementById('priorityInput');
const dueInput = document.getElementById('dueDate');
const btnClear = document.getElementById('btnClear');

const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const filterStatus = document.getElementById('filterStatus');

const confirmModal = document.getElementById('confirmModal');
const confirmText = document.getElementById('confirmText');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

const logoutBtn = document.getElementById('logoutBtn');
const dueFilterRow = document.getElementById('dueFilter');
const dashboardChartPanel = document.getElementById('dashboardChartPanel');

const dashboardSection = document.getElementById('dashboardSection');
const analyticsSection = document.getElementById('analyticsSection');

let tasks = [];
let editingId = null;
let countdownIntervals = {};
let categoryChart = null;
let barChartObj = null;
let pieChartObj = null;
let currentDueFilter = 'all';

/* Add: priority filter select (UI inserted dynamically so we don't change HTML) */
let filterPriority = null;
function injectPriorityFilter(){
  try {
    const sa = document.querySelector('.search-area');
    if(!sa) return;
    // avoid duplicate
    if(document.getElementById('filterPriority')) return;

    const sel = document.createElement('select');
    sel.id = 'filterPriority';
    sel.className = 'filter';
    sel.innerHTML = `
      <option value="all">All priority</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    `;
    // insert after status select (if exists) else append
    const statusEl = filterStatus || sa.querySelector('.filter:last-child');
    if(statusEl && statusEl.parentNode === sa) sa.insertBefore(sel, statusEl.nextSibling);
    else sa.appendChild(sel);

    filterPriority = sel;
    filterPriority.addEventListener('change', applyFiltersAndRender);
  } catch(e){
    console.warn('injectPriorityFilter failed', e);
  }
}

/* USER BADGE */
function updateUserArea(){
  const u = JSON.parse(localStorage.getItem('tm_user') || 'null');
  if(!userArea) return;
  userArea.innerHTML = '';
  if(u){
    userArea.textContent = (u.username || '').slice(0,2).toUpperCase();
    userArea.title = `Welcome, ${u.username || 'User'}`;
    userArea.style.cursor = 'pointer';
    userArea.onclick = () => {
      if(confirm("Sign out?")){
        localStorage.removeItem('tm_user');
        window.location.href = 'login.html';
      }
    };
  }
}
updateUserArea();

/* NAVIGATION (Dashboard / Tasks / Analytics) */
const navBtns = document.querySelectorAll('.nav-btn[data-section]');
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showSection(btn.dataset.section);
  });
});

/* Utility: move tasksPanel between dashboard and analytics so analytics can show tasks too */
const tasksPanel = document.getElementById('tasksPanel');
function moveTasksPanel(toAnalytics){
  try {
    const dashGrid = dashboardSection.querySelector('.grid');
    const analyticsGrid = analyticsSection.querySelector('.grid');
    if(toAnalytics){
      // append tasks panel to analyticsGrid under charts
      if(analyticsGrid && tasksPanel && tasksPanel.parentNode !== analyticsGrid){
        analyticsGrid.appendChild(tasksPanel);
        // ensure tasks panel spans full width in analytics
        tasksPanel.classList.add('moved-to-analytics');
      }
    } else {
      // move back to dashboard grid (append last)
      if(dashGrid && tasksPanel && tasksPanel.parentNode !== dashGrid){
        dashGrid.appendChild(tasksPanel);
        tasksPanel.classList.remove('moved-to-analytics');
      }
    }
  } catch(e){
    console.warn('moveTasksPanel error', e);
  }
}

function showSection(name){
  if(!dashboardSection || !analyticsSection) return;

  // hide both completely
  dashboardSection.setAttribute('hidden','true');
  analyticsSection.setAttribute('hidden','true');
  dashboardSection.classList.remove('active');
  analyticsSection.classList.remove('active');

  if(name === 'analytics'){
    // show analytics (dashboard hidden). move tasks panel into analytics so users see tasks too.
    analyticsSection.removeAttribute('hidden');
    analyticsSection.classList.add('active');
    analyticsSection.setAttribute('aria-hidden','false');

    // ensure dashboard chart panel not fullwidth (no dashboard visible)
    dashboardChartPanel && dashboardChartPanel.classList.remove('fullwidth');

    // move tasks into analytics grid
    moveTasksPanel(true);

    // init/update charts
    setTimeout(()=> updateAnalytics(), 140);

    // scroll top
    setTimeout(()=> window.scrollTo({ top: 0, behavior: 'smooth' }), 160);
    return;
  }

  // name === 'tasks' or 'dashboard' or others -> show dashboard and scroll as needed
  dashboardSection.removeAttribute('hidden');
  dashboardSection.classList.add('active');
  dashboardSection.setAttribute('aria-hidden','false');

  // move tasks panel back to dashboard grid (so tasks are in right place)
  moveTasksPanel(false);

  // make chart fullwidth on dashboard
  dashboardChartPanel && dashboardChartPanel.classList.add('fullwidth');

  // Refresh charts to adapt to size
  setTimeout(()=> {
    try { categoryChart && categoryChart.resize && categoryChart.resize(); } catch(e){}
    try { barChartObj && barChartObj.resize && barChartObj.resize(); } catch(e){}
    try { pieChartObj && pieChartObj.resize && pieChartObj.resize(); } catch(e){}
  }, 120);

  // if user clicked Tasks, scroll to tasksPanel
  if(name === 'tasks'){
    setTimeout(()=> {
      const tp = document.getElementById('tasksPanel');
      tp && tp.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return;
  }

  // Default: scroll top for dashboard
  setTimeout(()=> window.scrollTo({ top: 0, behavior: 'smooth' }), 60);
}

/* LOGOUT */
if(logoutBtn){
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('tm_user');
    window.location.href = 'login.html';
  });
}

/* MOVE ADD PANEL TO TOP (if not already) */
function moveAddPanelToTop(){
  try {
    const grid = dashboardSection?.querySelector('.grid');
    const addPanel = grid?.querySelector('.add-panel');
    if(grid && addPanel){
      // move addPanel to be the first element in grid
      grid.insertBefore(addPanel, grid.firstChild);
      addPanel.classList.add('top-add-panel');
    }
  } catch(e){
    console.warn("moveAddPanelToTop failed", e);
  }
}

/* FETCH TASKS */
async function fetchTasks(){
  try {
    const res = await fetch(API);
    const data = await res.json();
    tasks = Array.isArray(data) ? data : (data?.tasks || []);
  } catch (e) {
    console.warn("API fetch failed, using empty tasks", e);
    tasks = [];
  }
  applyFiltersAndRender();
}

/* CRUD helpers */
async function createTask(payload){
  try {
    await fetch(API, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(e){ console.warn('createTask failed', e); }
}

async function patchTask(id, patch){
  try {
    await fetch(`${API}/${id}`, {
      method: "PATCH",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
  } catch(e){ console.warn('patchTask failed', e); }
}

async function deleteTaskReq(id){
  try {
    await fetch(`${API}/${id}`, { method: "DELETE" });
  } catch(e){ console.warn('deleteTaskReq failed', e); }
}

/* FORM SUBMIT (Add/Edit) */
if(taskForm){
  taskForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const title = (titleInput.value || '').trim();
    if(!title) return alert("Enter task title");

    // CRITICAL FIX FOR PRIORITY ISSUE: 
    // Get the priority value directly. If it exists, use it. If not, use 'medium'.
    let selectedPriority = 'medium';
    if(priorityInput) {
        // Read the current selected value, ensuring it's lowercased.
        selectedPriority = (priorityInput.value || '').toString().toLowerCase();
    }
    
    // Final normalization check (ensure we only save 'high', 'medium', or 'low')
    const normalizedPriority = (['high','medium','low'].includes(selectedPriority) ? selectedPriority : 'medium');

    const payload = {
      title,
      description: (descInput.value || '').trim(),
      category: categoryInput?.value || 'work',
      // Pass the correctly determined priority
      priority: normalizedPriority, 
      dueDate: dueInput?.value || null
    };

    if(editingId){
      await patchTask(editingId, payload);
      editingId = null;
    } else {
      payload.status = "pending";
      await createTask(payload);
    }

    taskForm.reset();
    await fetchTasks();

    // show tasks panel
    document.querySelector('.nav-btn[data-section="tasks"]')?.click();
  });
}

/* Clear form */
if(btnClear){
  btnClear.addEventListener('click', () => {
    taskForm.reset();
    editingId = null;
  });
}

/* DUE FILTERS wiring (segmented pills) */
if(dueFilterRow){
  dueFilterRow.querySelectorAll('.due-btn').forEach(b => {
    b.addEventListener('click', () => {
      dueFilterRow.querySelectorAll('.due-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentDueFilter = b.dataset.value || 'all';
      applyFiltersAndRender();
    });
  });
}

/* other filters wiring */
if(searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
if(filterCategory) filterCategory.addEventListener('change', applyFiltersAndRender);
if(filterStatus) filterStatus.addEventListener('change', applyFiltersAndRender);

/* RENDER TASKS - fixed priority issues: normalize priority value used for classes and display */
function clearCountdowns(){
  for(const k in countdownIntervals) clearInterval(countdownIntervals[k]);
  countdownIntervals = {};
}

function renderTasksVertical(list){
  clearCountdowns();
  if(!tasksContainer) return;
  tasksContainer.innerHTML = '';

  if(list.length === 0){
    const el = document.createElement('div');
    el.className='card';
    el.innerHTML = '<div class="small muted">No tasks. Add one!</div>';
    tasksContainer.appendChild(el);
    return;
  }

  list.forEach(t => {
    // Normalize priority
    const p = (t.priority || 'medium').toString().toLowerCase();
    const priority = (['high','medium','low'].includes(p) ? p : 'medium');

    const card = document.createElement('div');
    const priorityClass = `priority-${priority}`;
    card.className = `task-card ${priorityClass}`;

    const priText = priority.toUpperCase();
    const priBadgeClass = `priority-badge priority-${priority}`;

    const meta = document.createElement('div'); meta.className = 'task-meta';
    meta.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="${priBadgeClass}">${escapeHtml(priText)}</div>
      </div>
      <div class="task-desc">${escapeHtml(t.description || '')}</div>
      <div style="margin-top:8px;">
        <span class="category-badge ${t.category || 'work'}">${escapeHtml(t.category || '')}</span>
      </div>
    `;

    const info = document.createElement('div'); info.className='task-info';
    const dueText = document.createElement('div'); dueText.textContent = t.dueDate ? (new Date(t.dueDate)).toLocaleString() : 'No due date';
    const countdown = document.createElement('div'); countdown.className='task-countdown';
    countdown.textContent = computeCountdownLabel(t);

    const actions = document.createElement('div'); actions.className='task-actions';
    actions.innerHTML = `<button class="small-btn complete-btn">${t.status === 'completed' ? 'Undo' : 'Complete'}</button>
                           <button class="small-btn edit-btn">Edit</button>
                           <button class="small-btn delete-btn">Delete</button>`;

    // Complete toggle
    const completeBtn = actions.querySelector('.complete-btn');
    completeBtn.addEventListener('click', async ()=> {
      const newStatus = t.status === 'completed' ? 'pending' : 'completed';
      await patchTask(t.id, { status: newStatus });
      await fetchTasks();
    });

    // Edit populates form with normalized priority
    const editBtn = actions.querySelector('.edit-btn');
    editBtn.addEventListener('click', ()=> {
      editingId = t.id;
      titleInput.value = t.title;
      descInput.value = t.description || '';
      categoryInput.value = t.category || 'work';
      if(priorityInput) priorityInput.value = (t.priority || 'medium').toLowerCase();
      
      // Ensure date is displayed correctly for editing (datetime-local format)
      if (dueInput && t.dueDate) {
        // Convert to YYYY-MM-DDTHH:MM format required by datetime-local
        const dateObj = new Date(t.dueDate);
        if (!isNaN(dateObj)) {
            const pad = (num) => String(num).padStart(2, '0');
            const Y = dateObj.getFullYear();
            const M = pad(dateObj.getMonth() + 1);
            const D = pad(dateObj.getDate());
            const H = pad(dateObj.getHours());
            const m = pad(dateObj.getMinutes());
            dueInput.value = `${Y}-${M}-${D}T${H}:${m}`;
        } else {
            dueInput.value = '';
        }
      } else {
        dueInput.value = '';
      }
      
      // scroll to add panel
      const addPanel = document.querySelector('.add-panel');
      addPanel && addPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Delete
    const delBtn = actions.querySelector('.delete-btn');
    delBtn.addEventListener('click', ()=> openConfirm(`Delete "${t.title}"?`, async (ok)=> { if(!ok) return; await deleteTaskReq(t.id); await fetchTasks(); }));

    info.appendChild(dueText);
    info.appendChild(countdown);
    info.appendChild(actions);

    card.appendChild(meta);
    card.appendChild(info);

    tasksContainer.appendChild(card);

    if(t.dueDate && t.status !== 'completed'){
      countdownIntervals[t.id] = setInterval(()=> { countdown.textContent = computeCountdownLabel(t); }, 60*1000);
    }
  });
}

/* COUNTDOWN */
function computeCountdownLabel(t){
  if(!t) return '';
  if(t.status === 'completed') return 'Completed';
  if(!t.dueDate) return 'No deadline';

  const now = new Date();
  const due = new Date(t.dueDate);
  const diff = due - now;
  if(isNaN(diff)) return 'Invalid date';
  if(diff <= 0) return 'Overdue';

  const days = Math.floor(diff / (24*3600*1000));
  const hours = Math.floor((diff % (24*3600*1000)) / (3600*1000));
  const mins = Math.floor((diff % (3600*1000)) / (60*1000));
  if(days>0) return `${days}d ${hours}h left`;
  if(hours>0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/* CONFIRM MODAL */
function openConfirm(text, cb){
  if(!confirmModal) { cb(confirm(text)); return; }
  confirmText.textContent = text; confirmModal.classList.remove('hidden');
  const cleanup = ()=> { confirmModal.classList.add('hidden'); confirmYes.onclick = null; confirmNo.onclick = null; };
  confirmYes.onclick = ()=> { cleanup(); cb(true); };
  confirmNo.onclick = ()=> { cleanup(); cb(false); };
}

/* STATS & CHARTS (dashboard) */
function updateStats(list){
  const total = list.length;
  const completed = list.filter(t => t.status === 'completed').length;
  const pending = total - completed;
  if(totalTasksEl) totalTasksEl.textContent = total;
  if(completedTasksEl) completedTasksEl.textContent = completed;
  if(pendingTasksEl) pendingTasksEl.textContent = pending;

  const dueTodayCount = list.filter(t => isDueToday(t)).length;
  const dueTodayEl = document.getElementById('dueToday');
  if(dueTodayEl) dueTodayEl.textContent = dueTodayCount;

  if(completionRateEl) completionRateEl.textContent = total ? Math.round((completed/total)*100)+'%' : '0%';
}

function updateCategoryChart(list){
  const cats = ['work','personal','study'];
  const counts = cats.map(c => list.filter(t => t.category === c).length);
  const canvas = document.getElementById('categoryChart');
  const ctx = canvas?.getContext('2d');
  if(!ctx) return;

  if(categoryChart) categoryChart.destroy();

  const g1 = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  g1.addColorStop(0, 'rgba(0,234,255,0.95)');
  g1.addColorStop(1, 'rgba(0,186,230,0.75)');

  const g2 = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  g2.addColorStop(0, 'rgba(255,46,156,0.95)');
  g2.addColorStop(1, 'rgba(255,20,120,0.75)');

  const g3 = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  g3.addColorStop(0, 'rgba(123,255,144,0.95)');
  g3.addColorStop(1, 'rgba(60,215,110,0.75)');

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Work','Personal','Study'],
      datasets: [{ data: counts, backgroundColor: [g1,g2,g3], hoverOffset: 12, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } }
    }
  });

  if(legendBox) legendBox.innerText = `Work ${counts[0]} • Personal ${counts[1]} • Study ${counts[2]}`;
  setTimeout(()=> categoryChart.resize && categoryChart.resize(), 80);
}

/* ANALYTICS CHARTS */
function updateAnalytics(){
  const cats = ['work','personal','study'];

  const completionPercent = cats.map(c => {
    const ct = tasks.filter(t => t.category === c);
    const done = ct.filter(t => t.status === 'completed').length;
    return ct.length ? Math.round((done/ct.length)*100) : 0;
  });

  const counts = cats.map(c => tasks.filter(t => t.category === c).length);

  // BAR
  const barCanvas = document.getElementById('barChart');
  const barCtx = barCanvas?.getContext('2d');
  if(barCtx){
    if(barChartObj) barChartObj.destroy();

    const gradBar0 = barCtx.createLinearGradient(0,0,0,barCanvas.height);
    gradBar0.addColorStop(0, 'rgba(0,234,255,0.95)');
    gradBar0.addColorStop(1, 'rgba(0,150,200,0.6)');

    const gradBar1 = barCtx.createLinearGradient(0,0,0,barCanvas.height);
    gradBar1.addColorStop(0, 'rgba(255,46,156,0.95)');
    gradBar1.addColorStop(1, 'rgba(200,20,120,0.6)');

    const gradBar2 = barCtx.createLinearGradient(0,0,0,barCanvas.height);
    gradBar2.addColorStop(0, 'rgba(123,255,144,0.95)');
    gradBar2.addColorStop(1, 'rgba(80,200,120,0.6)');

    barChartObj = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Work','Personal','Study'],
        datasets: [{ label: 'Completion %', data: completionPercent, backgroundColor: [gradBar0,gradBar1,gradBar2], borderRadius: 8, barThickness: 36 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display:false }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') || '#fff' } },
          y: { beginAtZero: true, max: 100, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') || '#fff' }, grid: { color: 'rgba(255,255,255,0.03)' } }
        }
      }
    });
  }

  // PIE
  const pieCanvas = document.getElementById('pieChart');
  const pieCtx = pieCanvas?.getContext('2d');
  if(pieCtx){
    if(pieChartObj) pieChartObj.destroy();

    const g1 = pieCtx.createLinearGradient(0,0,pieCanvas.width,pieCanvas.height);
    g1.addColorStop(0,'rgba(0,234,255,0.95)');
    g1.addColorStop(1,'rgba(0,150,200,0.7)');

    const g2 = pieCtx.createLinearGradient(0,0,pieCanvas.width,pieCanvas.height);
    g2.addColorStop(0,'rgba(255,46,156,0.95)');
    g2.addColorStop(1,'rgba(200,20,120,0.7)');

    const g3 = pieCtx.createLinearGradient(0,0,pieCanvas.width,pieCanvas.height);
    g3.addColorStop(0,'rgba(123,255,144,0.95)');
    g3.addColorStop(1,'rgba(80,200,120,0.7)');

    pieChartObj = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: ['Work','Personal','Study'], datasets: [{ data: counts, backgroundColor: [g1,g2,g3], hoverOffset: 12 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 800, easing: 'easeOutQuart' }, plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') || '#fff' } } } }
    });
  }

  setTimeout(()=> {
    barChartObj && barChartObj.resize && barChartObj.resize();
    pieChartObj && pieChartObj.resize && pieChartObj.resize();
  }, 120);
}

/* FILTERS + DUE LOGIC (now supports priority filter) */
function applyFiltersAndRender(){
  let filtered = [...tasks];
  const q = (searchInput?.value || '').toLowerCase().trim();
  const cat = filterCategory?.value || 'all';
  const status = filterStatus?.value || 'all';
  const prior = (filterPriority?.value || 'all').toString().toLowerCase();
  const due = currentDueFilter || 'all';

  if(q) filtered = filtered.filter(t => (t.title||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q));
  if(cat !== 'all') filtered = filtered.filter(t => t.category === cat);
  if(status !== 'all') filtered = filtered.filter(t => status === 'pending'? t.status!=='completed' : t.status===status);
  if(prior !== 'all') filtered = filtered.filter(t => ((t.priority||'')+'').toLowerCase() === prior);

  if(due !== 'all'){
    const now = new Date();
    filtered = filtered.filter(t => {
      if(!t.dueDate) return false;
      const d = new Date(t.dueDate);
      if(isNaN(d)) return false;
      const diff = d - now;
      if(currentDueFilter === 'today') return isSameDate(d, now);
      if(currentDueFilter === 'week') return diff >= 0 && diff <= (7 * 24 * 3600 * 1000);
      if(currentDueFilter === 'month') return diff >= 0 && diff <= (30 * 24 * 3600 * 1000);
      return true;
    });
  }

  renderTasksVertical(filtered);
  updateStats(filtered);
  updateCategoryChart(filtered);
}

/* DATE HELPERS */
function isSameDate(a, b){
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isDueToday(t){
  if(!t || !t.dueDate) return false;
  const due = new Date(t.dueDate);
  if(isNaN(due)) return false;
  return isSameDate(due, new Date());
}

/* UTIL */
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

/* INIT */
(async function init(){
  // FIX FOR ISSUE #1: Set type and add explicit click handler for reliable date picker opening
  if(dueInput) {
    dueInput.type = 'datetime-local';
    // Add a click listener to ensure the input is focused, which usually triggers the native picker
    dueInput.addEventListener('click', () => {
        dueInput.focus();
    });
  }

  // inject priority filter into the topbar (no HTML changes)
  injectPriorityFilter();

  // ensure add panel at top of dashboard grid
  moveAddPanelToTop();

  // update user badge
  updateUserArea();

  // fetch tasks and render
  await fetchTasks();

  // default view -> dashboard (dashboard visible, analytics hidden)
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn[data-section="dashboard"]')?.classList.add('active');
  showSection('dashboard');

  // ensure charts & tasks reflect correct state
  applyFiltersAndRender();

  // periodic update for countdowns and stats
  setInterval(()=> applyFiltersAndRender(), 60*1000);

  // handle window resize for charts
  window.addEventListener('resize', () => {
    try {
      categoryChart && categoryChart.resize && categoryChart.resize();
      barChartObj && barChartObj.resize && barChartObj.resize();
      pieChartObj && pieChartObj.resize && pieChartObj.resize();
    } catch(e) { /* noop */ }
  });
})();