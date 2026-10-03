// ================= API HELPER =================
const API = '';

function getToken(){ return localStorage.getItem('kutubxonam_token'); }
function setToken(t){ localStorage.setItem('kutubxonam_token', t); }
function clearToken(){ localStorage.removeItem('kutubxonam_token'); }

async function api(path, options = {}){
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if(token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, Object.assign({}, options, { headers }));
  let data = null;
  try{ data = await res.json(); }catch(e){ /* no body */ }
  if(!res.ok){
    const err = new Error((data && data.error) || 'Server xatosi');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ================= STATE =================
let currentUser = null;
let books = [];
let selectedBookId = null;
let searchTerm = '';
let pickedStudent = null;
let activeTab = 'books';

// ================= HELPERS =================
function fmt(iso){ return new Date(iso).toLocaleDateString('uz-UZ', {day:'2-digit', month:'2-digit', year:'numeric'}); }
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function isOverdue(iso){ return Date.now() > new Date(iso).getTime(); }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(()=>t.classList.remove('show'), 2800);
}
function switchScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  if(id) document.getElementById(id).classList.remove('hidden');
}
document.querySelectorAll('[data-back]').forEach(btn=>{
  btn.addEventListener('click', ()=>switchScreen(btn.dataset.back));
});

// ================= THEME =================
const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/></svg>';
function updateThemeIcons(){
  const theme = document.documentElement.getAttribute('data-theme');
  const icon = theme === 'dark' ? MOON_ICON : SUN_ICON;
  document.getElementById('themeToggle').innerHTML = icon;
  const t2 = document.getElementById('themeToggle2');
  if(t2) t2.innerHTML = icon;
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('kutubxonam_theme', next);
  updateThemeIcons();
}
document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('themeToggle2').addEventListener('click', toggleTheme);

// ================= NAVIGATION =================
document.getElementById('btnStaffRole').onclick = ()=>switchScreen('staffRegisterScreen');
document.getElementById('btnStudentRole').onclick = ()=>switchScreen('studentRegisterScreen');
document.getElementById('btnGoLogin').onclick = ()=>switchScreen('loginScreen');

// ================= REGISTER / LOGIN =================
async function handleRegister(role){
  const prefix = role === 'staff' ? 'staff' : 'student';
  const fullName = document.getElementById(prefix+'FullName').value.trim();
  const phone = document.getElementById(prefix+'Phone').value.trim();
  const schoolName = document.getElementById(prefix+'School').value.trim();
  const login = document.getElementById(prefix+'Login').value.trim();
  const password = document.getElementById(prefix+'Password').value;
  const errBox = document.getElementById(prefix+'Error');
  const btn = document.getElementById(prefix+'RegisterBtn');

  errBox.textContent = '';
  btn.disabled = true; btn.textContent = 'Iltimos kuting...';
  try{
    const data = await api('/api/auth/register', {
      method:'POST',
      body: JSON.stringify({ fullName, phone, schoolName, role, login, password })
    });
    setToken(data.token);
    currentUser = data.user;
    await enterApp();
  }catch(err){
    errBox.textContent = err.message;
  }finally{
    btn.disabled = false; btn.textContent = "Ro'yxatdan o'tish";
  }
}
document.getElementById('staffRegisterBtn').onclick = ()=>handleRegister('staff');
document.getElementById('studentRegisterBtn').onclick = ()=>handleRegister('student');

document.getElementById('loginBtn').onclick = async ()=>{
  const login = document.getElementById('loginLogin').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errBox.textContent = '';
  if(!login || !password){ errBox.textContent = 'Login va parolni kiriting'; return; }
  btn.disabled = true; btn.textContent = 'Tekshirilmoqda...';
  try{
    const data = await api('/api/auth/login', { method:'POST', body: JSON.stringify({ login, password }) });
    setToken(data.token);
    currentUser = data.user;
    await enterApp();
  }catch(err){
    errBox.textContent = err.message;
  }finally{
    btn.disabled = false; btn.textContent = 'Kirish';
  }
};

function logout(){
  clearToken();
  currentUser = null;
  document.getElementById('mainApp').classList.add('hidden');
  document.querySelectorAll('.form-card input').forEach(i=>i.value='');
  switchScreen('landingScreen');
}

// ================= ENTER APP =================
async function enterApp(){
  switchScreen(null);
  document.getElementById('mainApp').classList.remove('hidden');
  renderGreeting();
  document.getElementById('staffAddBox').classList.toggle('hidden', currentUser.role !== 'staff');
  await loadBooks();
  renderBooksGrid();
  renderSidePanel();
}

function renderGreeting(){
  const box = document.getElementById('greetingBox');
  const roleLabel = currentUser.role === 'staff' ? 'Xodim' : "O'quvchi";
  box.innerHTML = `<span class="role-pill">${roleLabel}</span><span>Salom, <strong>${esc(currentUser.fullName.split(' ')[0])}</strong>!</span><button class="logout-btn" id="logoutBtn">Chiqish</button>`;
  document.getElementById('logoutBtn').onclick = logout;
}

// ================= TABS =================
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    document.getElementById('booksTab').classList.toggle('hidden', activeTab !== 'books');
    document.getElementById('historyTab').classList.toggle('hidden', activeTab !== 'history');
    if(activeTab === 'history') await loadHistory();
  });
});

// ================= BOOKS =================
async function loadBooks(){
  try{
    books = await api('/api/books');
  }catch(err){
    showToast(err.message);
    books = [];
  }
  renderOverdueBanner();
}

function filteredBooks(){
  const term = searchTerm.toLowerCase();
  return books.filter(b => (b.title + ' ' + b.author).toLowerCase().includes(term));
}

function renderOverdueBanner(){
  const banner = document.getElementById('overdueBanner');
  if(currentUser.role !== 'student'){ banner.innerHTML=''; return; }
  const mine = books.filter(b => b.status === 'borrowed' && b.student_id === currentUser.id);
  const overdue = mine.filter(b => isOverdue(b.due_at));
  if(!overdue.length){ banner.innerHTML=''; return; }
  banner.innerHTML = `<div class="banner">⏰ Quyidagi kitob(lar)ning muddati tugagan:<br>${overdue.map(b=>`«${esc(b.title)}» — muddat: ${fmt(b.due_at)}`).join(' · ')}</div>`;
}

function renderBooksGrid(){
  const grid = document.getElementById('booksGrid');
  const list = filteredBooks();
  document.getElementById('shelfLabel').textContent = `KITOBLAR JAVONI — ${list.length} ta (jami ${books.length} ta)`;
  grid.innerHTML = '';
  if(!books.length){ grid.innerHTML = '<div class="no-results">Hali kitob qo\'shilmagan.</div>'; return; }
  if(!list.length){ grid.innerHTML = '<div class="no-results">Hech narsa topilmadi.</div>'; return; }
  list.forEach(b=>{
    const el = document.createElement('div');
    el.className = 'book ' + b.status;
    const coverHTML = b.cover_url ? `<img src="${esc(b.cover_url)}" alt="">` : '';
    let statusText = 'Javonda bor';
    if(b.status === 'borrowed'){
      statusText = currentUser.role === 'staff'
        ? `${esc(b.student_name)} — muddat: ${fmt(b.due_at)}` + (isOverdue(b.due_at) ? ' ⚠️' : '')
        : (b.student_id === currentUser.id ? `Sizda — muddat: ${fmt(b.due_at)}` : "O'quvchida");
    }
    el.innerHTML = `<div class="spine">${coverHTML}<span class="dot"></span></div><div class="info"><div class="title">${esc(b.title)}</div><div class="author">${esc(b.author)}</div><div class="status-line">${statusText}</div></div>`;
    el.onclick = ()=>{ selectedBookId = b.id; pickedStudent = null; renderSidePanel(); };
    grid.appendChild(el);
  });
}

document.getElementById('searchInput').addEventListener('input', e=>{
  searchTerm = e.target.value;
  renderBooksGrid();
});

// ================= COVER UPLOAD =================
function resizeImageToDataURL(file, maxW, maxH, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ev=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        const ratio = Math.min(maxW/w, maxH/h, 1);
        w = Math.round(w*ratio); h = Math.round(h*ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = ()=>reject(new Error('rasm yuklanmadi'));
      img.src = ev.target.result;
    };
    reader.onerror = ()=>reject(new Error('fayl o\'qilmadi'));
    reader.readAsDataURL(file);
  });
}

let pendingCoverDataUrl = null;
document.getElementById('newBookCoverFile').addEventListener('change', async e=>{
  const file = e.target.files[0];
  if(!file) return;
  document.getElementById('coverUploadText').textContent = 'Yuklanmoqda...';
  try{
    pendingCoverDataUrl = await resizeImageToDataURL(file, 320, 420, 0.75);
    const img = document.getElementById('coverPreviewImg');
    img.src = pendingCoverDataUrl; img.classList.remove('hidden');
    document.getElementById('coverUploadText').classList.add('hidden');
  }catch(err){
    showToast('Rasmni yuklashda xatolik');
    document.getElementById('coverUploadText').textContent = '📷 Muqova';
  }
});
function resetCoverUpload(){
  pendingCoverDataUrl = null;
  document.getElementById('newBookCoverFile').value = '';
  const img = document.getElementById('coverPreviewImg');
  img.src=''; img.classList.add('hidden');
  const txt = document.getElementById('coverUploadText');
  txt.textContent = '📷 Muqova'; txt.classList.remove('hidden');
}

document.getElementById('addBookBtn').onclick = async ()=>{
  const titleInput = document.getElementById('newBookTitle');
  const authorInput = document.getElementById('newBookAuthor');
  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  if(!title || !author){ showToast('Kitob nomi va muallifini kiriting'); return; }
  try{
    await api('/api/books', { method:'POST', body: JSON.stringify({ title, author, coverUrl: pendingCoverDataUrl }) });
    titleInput.value=''; authorInput.value=''; resetCoverUpload();
    showToast(`"${title}" javonga qo'shildi`);
    await loadBooks();
    renderBooksGrid();
  }catch(err){
    showToast(err.message);
  }
};

// ================= SIDE PANEL =================
function renderSidePanel(){
  const panel = document.getElementById('sidePanel');
  const book = books.find(b=>b.id===selectedBookId);

  if(!book){
    panel.innerHTML = `<h2>Kitob tanlang</h2><div class="sub">Ma'lumot olish uchun chapdan birini bosing</div><div class="p-empty">${currentUser.role==='staff' ? 'Kitob berish yoki qaytarib olish shu yerdan amalga oshiriladi.' : 'Kitobni olish uchun kutubxonaga tashrif buyuring.'}</div>`;
    return;
  }

  if(currentUser.role !== 'staff'){
    panel.innerHTML = `<h2>${esc(book.title)}</h2><div class="sub">${esc(book.author)}</div><div class="p-message">📚<br>Sizni maktab kutubxonasida kutamiz!<br><span style="opacity:.7;font-size:12px;">Ushbu kitobni olish uchun kutubxonaga tashrif buyuring.</span></div>`;
    return;
  }

  if(book.status === 'available'){
    panel.innerHTML = `
      <h2>Kitob berish</h2>
      <div class="sub">O'quvchini qidirib tanlang</div>
      <div class="p-field"><label>Kitob</label><input type="text" value="${esc(book.title)} — ${esc(book.author)}" disabled></div>
      <div class="p-field"><label>O'quvchi ismini yozing</label><input type="text" id="studentSearchInput" placeholder="Masalan: Aziza"></div>
      <div class="student-results hidden" id="studentResults"></div>
      <div class="student-picked hidden" id="studentPicked"></div>
      <button class="btn btn-solid btn-full" id="giveBtn" disabled>Avval o'quvchini tanlang</button>
    `;
    const searchInput = document.getElementById('studentSearchInput');
    const resultsBox = document.getElementById('studentResults');
    const pickedBox = document.getElementById('studentPicked');
    const giveBtn = document.getElementById('giveBtn');

    let searchTimer = null;
    searchInput.addEventListener('input', ()=>{
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      if(q.length < 2){ resultsBox.classList.add('hidden'); resultsBox.innerHTML=''; return; }
      searchTimer = setTimeout(async ()=>{
        try{
          const students = await api('/api/students?q=' + encodeURIComponent(q));
          if(!students.length){ resultsBox.innerHTML = '<div class="student-result-item">Topilmadi</div>'; }
          else{
            resultsBox.innerHTML = students.map(s=>`<div class="student-result-item" data-id="${s.id}" data-name="${esc(s.full_name)}">${esc(s.full_name)}${s.phone ? ' — '+esc(s.phone) : ''}</div>`).join('');
            resultsBox.querySelectorAll('.student-result-item[data-id]').forEach(item=>{
              item.onclick = ()=>{
                pickedStudent = { id: item.dataset.id, name: item.dataset.name };
                pickedBox.textContent = `Tanlandi: ${pickedStudent.name}`;
                pickedBox.classList.remove('hidden');
                resultsBox.classList.add('hidden');
                searchInput.value = '';
                giveBtn.disabled = false;
                giveBtn.textContent = 'Berildi (2 haftaga)';
              };
            });
          }
          resultsBox.classList.remove('hidden');
        }catch(err){ showToast(err.message); }
      }, 300);
    });

    giveBtn.onclick = async ()=>{
      if(!pickedStudent) return;
      giveBtn.disabled = true; giveBtn.textContent = 'Iltimos kuting...';
      try{
        await api(`/api/books/${book.id}/checkout`, { method:'POST', body: JSON.stringify({ studentId: pickedStudent.id }) });
        showToast(`"${book.title}" — ${pickedStudent.name}ga berildi`);
        selectedBookId = null; pickedStudent = null;
        await loadBooks();
        renderBooksGrid(); renderSidePanel();
      }catch(err){
        showToast(err.message);
        giveBtn.disabled = false; giveBtn.textContent = 'Berildi (2 haftaga)';
      }
    };
  } else {
    panel.innerHTML = `
      <h2>Kitobni qaytarib olish</h2>
      <div class="sub">Hozir o'quvchida</div>
      <div class="p-field"><label>Kitob</label><input type="text" value="${esc(book.title)} — ${esc(book.author)}" disabled></div>
      <div class="p-field"><label>Kim oldi</label><input type="text" value="${esc(book.student_name || '')}" disabled></div>
      <div class="p-field"><label>Olgan kuni</label><input type="text" value="${fmt(book.borrowed_at)}" disabled></div>
      <div class="p-field"><label>Topshirish muddati</label><input type="text" value="${fmt(book.due_at)}${isOverdue(book.due_at) ? ' — MUDDATI TUGAGAN' : ''}" disabled></div>
      <button class="btn btn-ghost btn-full" id="returnBtn">Qaytarib olindi</button>
    `;
    document.getElementById('returnBtn').onclick = async ()=>{
      try{
        await api(`/api/books/${book.id}/return`, { method:'POST' });
        showToast(`"${book.title}" javonga qaytdi`);
        selectedBookId = null;
        await loadBooks();
        renderBooksGrid(); renderSidePanel();
      }catch(err){ showToast(err.message); }
    };
  }
}

// ================= HISTORY =================
async function loadHistory(){
  const list = document.getElementById('historyList');
  list.innerHTML = '<div class="p-empty">Yuklanmoqda...</div>';
  try{
    const path = currentUser.role === 'staff' ? '/api/history/school' : '/api/history/me';
    const data = await api(path);
    if(!data.length){ list.innerHTML = '<div class="no-results">Tarix hali bo\'sh.</div>'; return; }
    list.innerHTML = data.map(h=>{
      const returned = !!h.returned_at;
      const statusHTML = returned
        ? `<span class="h-status returned">Qaytarilgan — ${fmt(h.returned_at)}</span>`
        : `<span class="h-status active">${isOverdue(h.due_at) ? 'Muddati tugagan' : (currentUser.role === 'staff' ? "O'quvchida" : 'Hozir sizda')} — muddat: ${fmt(h.due_at)}</span>`;
      const who = currentUser.role === 'staff' ? `<div class="h-meta">O'quvchi: ${esc(h.student_name)}${h.student_phone ? ' — '+esc(h.student_phone) : ''}</div>` : '';
      return `<div class="history-item"><div class="h-title">${esc(h.title)} — ${esc(h.author)}</div><div class="h-meta">Olingan sana: ${fmt(h.borrowed_at)}</div>${who}${statusHTML}</div>`;
    }).join('');
  }catch(err){
    list.innerHTML = `<div class="no-results">${esc(err.message)}</div>`;
  }
}

// ================= INIT =================
(async function init(){
  const savedTheme = localStorage.getItem('kutubxonam_theme');
  document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');
  updateThemeIcons();

  const token = getToken();
  if(token){
    try{
      currentUser = await api('/api/auth/me');
      await enterApp();
      return;
    }catch(err){
      clearToken();
    }
  }
  switchScreen('landingScreen');
})();
