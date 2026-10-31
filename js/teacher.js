// ============================================================
// teacher.js — پنل معلم با Supabase
// نسخه: ۳۸.۰.۰ — حذف کامل دکمه و کدهای مربوط به حذف کارنامه
// ============================================================

const TEACHER_PASSWORD_KEY = 'teacherPassword';
const DEFAULT_PASSWORD = 'hadi1383';
const READ_TIMES_KEY = 'teacherReadTimes';
const READ_LESSONS_KEY = 'teacherReadLessons';
const MESSAGES_CACHE_DURATION = 1800000;
const CONVERSATIONS_CACHE_KEY = 'teacherConversationsCache';
const CLASS_MESSAGES_CACHE_KEY = 'teacherClassMessagesCache';
const STUDENTS_CACHE_KEY = 'teacherStudentsCache';
const LESSONS_CACHE_KEY = 'teacherLessonsCache';
const EVENTS_CACHE_KEY = 'teacherEventsCache';
const CONTESTS_CACHE_KEY = 'teacherContestsCache';
const LIBRARY_CACHE_KEY = 'teacherLibraryCache';

const DEFAULT_AVATAR_URL = 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';

let allStudents = [];
let allLessonsList = [];
let allLessonStatuses = []; 
let allReportsMap = {}; 
let allReportsRaw = [];
let currentConversations = [];
let currentChatStudent = null;
let currentRankingClass = 'hafom-1';
let currentStudentClassFilter = 'all';
let pageHistory = ['home'];
let currentProfileStudent = null;
let currentProfileLessons = [];
let currentProfileStatus = {};
let currentProfileReports = [];

let selectedClassDay = null;
let toggleStatusValue = true;

let conversationsChannel = null;

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function vibrate(pattern = 30) { if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} } }
function toPersianNum(num) { if (num === null || num === undefined) return '۰'; const p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹']; return num.toString().replace(/\d/g, x => p[parseInt(x)]); }
function fromPersianNum(str) { return String(str).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }
function getClassPersianName(slug) { const m = {'hafom-1':'هفتم یک','hafom-2':'هفتم دو','hafom-3':'هفتم سه','hafom-4':'هفتم چهار','hafom-5':'هفتم پنج','all':'همه کلاس‌ها'}; return m[slug] || slug || 'نامشخص'; }

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const text = document.getElementById('toast-text');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    icon.textContent = icons[type] || '✅';
    text.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function getTotalCompletedLessons(student) { return student ? (parseInt(student.completed_lessons) || 0) : 0; }
function getReadTimes() { try { return JSON.parse(localStorage.getItem(READ_TIMES_KEY) || '{}'); } catch (e) { return {}; } }
function getReadTime(studentId) { return getReadTimes()[studentId] || 0; }
function setReadTime(studentId) { const t = getReadTimes(); t[studentId] = Date.now(); localStorage.setItem(READ_TIMES_KEY, JSON.stringify(t)); }
function getReadLessons() { try { return JSON.parse(localStorage.getItem(READ_LESSONS_KEY) || '{}'); } catch (e) { return {}; } }
function isLessonReportSeen(reportId) { return getReadLessons()[reportId] === true; }
function markLessonReportAsSeen(reportId) { const s = getReadLessons(); s[reportId] = true; localStorage.setItem(READ_LESSONS_KEY, JSON.stringify(s)); }
function markAllLessonsAsSeen() { const s = getReadLessons(); allReportsRaw.forEach(r => { s[r.id] = true; }); localStorage.setItem(READ_LESSONS_KEY, JSON.stringify(s)); renderStudents(getFilteredStudents()); updateHomeBadgesImmediately(); showToast('همه اعلان‌ها دیده شدند', 'success'); }
function computeUnreadForConversation(conv) { if (conv.last_sender === 'teacher') return 0; const readTime = getReadTime(conv.student_id); if (readTime > 0 && conv.last_message_time) { if (new Date(conv.last_message_time).getTime() <= readTime) return 0; } return parseInt(conv.unread_count) || 0; }
function getCachedData(key, duration = MESSAGES_CACHE_DURATION) { try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && (Date.now() - c.timestamp < duration)) return c.data; return null; } catch (e) { return null; } }
function setCachedData(key, data) { try { localStorage.setItem(key, JSON.stringify({ data: data, timestamp: Date.now() })); } catch (e) {} }

function renderAvatarHTML(student) {
    const url = (student && student.avatar_url) ? String(student.avatar_url).trim() : '';
    if (!url || url === 'null' || url === 'undefined' || url === 'default') return `<img src="${DEFAULT_AVATAR_URL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    if (url.startsWith('emoji:')) { const em = url.replace('emoji:', '').trim(); if (!em || em === '👤' || em === '👦🏻' || em === '👦') return `<img src="${DEFAULT_AVATAR_URL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; return `<span>${em}</span>`; }
    if (url.startsWith('data:image') || url.startsWith('http')) return `<img src="${url}" onerror="this.src='${DEFAULT_AVATAR_URL}'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    return `<img src="${DEFAULT_AVATAR_URL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
}

async function loadAllReportsForBadges() {
    try {
        const c = getSupabase();
        if (!c) return;
        const { data } = await c.from('reports').select('*').order('created_at', { ascending: false });
        allReportsRaw = data || [];
        allReportsMap = {};
        allReportsRaw.forEach(r => {
            if (!allReportsMap[r.student_id]) allReportsMap[r.student_id] = [];
            allReportsMap[r.student_id].push(r.lesson_id);
        });
    } catch (e) {}
}

function countUnreadLessonReports() {
    let count = 0;
    const seen = getReadLessons();
    allReportsRaw.forEach(r => { if (!seen[r.id]) count++; });
    return count;
}

async function getLessonStatusForStudent(studentId) {
    try {
        const c = getSupabase();
        if (!c) return {};
        const { data } = await c.from('lesson_status').select('*').eq('student_id', studentId);
        const s = {};
        (data || []).forEach(i => {
            s[i.lesson_id] = { is_enabled: i.is_enabled !== false, custom_due_date: i.custom_due_date || null, id: i.id };
        });
        return s;
    } catch (e) { return {}; }
}

async function updateLessonStatus(studentId, lessonId, updates) {
    try {
        const c = getSupabase();
        if (!c) return { success: false };
        const { data: existing } = await c.from('lesson_status').select('id').eq('student_id', studentId).eq('lesson_id', lessonId).maybeSingle();
        if (existing) { await c.from('lesson_status').update(updates).eq('id', existing.id); }
        else { await c.from('lesson_status').insert({ student_id: studentId, lesson_id: lessonId, is_enabled: updates.is_enabled !== undefined ? updates.is_enabled : true, custom_points: 0, custom_due_date: updates.custom_due_date || null }); }
        return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
}

async function getStudentReports(studentId) {
    try {
        const c = getSupabase();
        if (!c) return [];
        const { data } = await c.from('reports').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
        return data || [];
    } catch (e) { return []; }
}

function calculateTotalPoints(student) {
    return (parseInt(student.total_points) || 0) + (parseInt(student.custom_points_added) || 0) + (parseInt(student.custom_total_points) || 0);
}

async function getTeacherPassword() {
    try {
        const c = getSupabase();
        if (!c) return localStorage.getItem(TEACHER_PASSWORD_KEY) || DEFAULT_PASSWORD;
        const { data } = await c.from('teacher_settings').select('password').eq('id', 1).maybeSingle();
        if (data && data.password) {
            localStorage.setItem(TEACHER_PASSWORD_KEY, data.password);
            return data.password;
        }
    } catch (e) {}
    return localStorage.getItem(TEACHER_PASSWORD_KEY) || DEFAULT_PASSWORD;
}

async function checkPassword() {
    const input = document.getElementById('login-password').value.trim();
    const saved = await getTeacherPassword();
    if (input === saved) {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-panel').classList.add('active');
        localStorage.setItem('teacherLoggedIn', 'true');
        pageHistory = ['home'];
        navigateToPage('home', false);
        try { history.replaceState({ teacherPage: 'home' }, '', '#home'); } catch (e) {}
    } else {
        showToast('رمز ورود اشتباه است!', 'error');
        document.getElementById('login-password').value = '';
    }
}

function logout() {
    if (confirm('آیا می‌خواهید از پنل خارج شوید؟')) {
        localStorage.removeItem('teacherLoggedIn');
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('main-panel').classList.remove('active');
        stopAllRealtime();
        pageHistory = ['home'];
        try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
    }
}

window.addEventListener('load', () => {
    if (localStorage.getItem('teacherLoggedIn') === 'true') {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-panel').classList.add('active');
        pageHistory = ['home'];
        navigateToPage('home', false);
        try { history.replaceState({ teacherPage: 'home' }, '', '#home'); } catch (e) {}
        setTimeout(() => { updateHomeBadgesImmediately(); startConversationsRealtime(); }, 1000);
    }
    const loginInput = document.getElementById('login-password');
    if (loginInput) { loginInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkPassword(); }); }
});

function startConversationsRealtime() {
    if (conversationsChannel) return;
    if (typeof subscribeToConversations !== 'function') return;
    conversationsChannel = subscribeToConversations(async (payload) => {
        if (payload.table === 'reports' && payload.eventType === 'INSERT') {
            await loadAllReportsForBadges();
            const a = document.querySelector('.page.active');
            if (a && a.id === 'page-students') renderStudents(getFilteredStudents());
            updateHomeBadgesImmediately();
        }
        const convs = await getStudentConversationsFromSupabase();
        convs.forEach(c => { c.unread_count = computeUnreadForConversation(c); });
        currentConversations = convs;
        setCachedData(CONVERSATIONS_CACHE_KEY, convs);
        const a = document.querySelector('.page.active');
        if (a && a.id === 'page-messages') {
            const t = document.querySelector('.messages-tab-btn.active');
            if (t && t.dataset.tab === 'personal' && !currentChatStudent) renderMessengerList(currentConversations);
        }
        updateHomeBadgesImmediately();
        if (payload.eventType === 'INSERT' && payload.new && payload.new.sender === 'student') {
            playDingSound(); vibrate([30, 50, 30]); showTeacherInAppNotification(payload.new.student_name, payload.new.text, payload.new.student_id);
        }
        if (currentChatStudent && payload.new && currentChatStudent.student_id === payload.new.student_id) await loadChatMessages(currentChatStudent.student_id);
    });
}

function stopAllRealtime() {
    if (conversationsChannel) {
        try { const c = getSupabase(); if (c) c.removeChannel(conversationsChannel); } catch(e) {}
        conversationsChannel = null;
    }
}

const PAGE_HASH_MAP = { 'home':'#home','students':'#students','rankings':'#rankings','messages':'#messages','lessons':'#lessons','calendar':'#calendar','contests':'#contests','library':'#library','reports':'#reports','settings':'#settings','student-profile':'#student-profile' };

function pushTeacherHistory(pageId) { try { history.pushState({ teacherPage: pageId }, '', PAGE_HASH_MAP[pageId] || ('#' + pageId)); } catch (e) {} }

function navigateToPage(pageId, addToHistory = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');
    if (addToHistory) { if (pageHistory[pageHistory.length - 1] !== pageId) pageHistory.push(pageId); pushTeacherHistory(pageId); }
    const backBtn = document.getElementById('header-back-btn');
    if (backBtn) backBtn.style.display = pageId === 'home' ? 'none' : 'flex';
    const titles = { home:'خانه', students:'دانش‌آموزان', rankings:'رتبه‌بندی', messages:'پیام‌رسانی', lessons:'مدیریت تکالیف', calendar:'تقویم', contests:'مسابقات', library:'کتابخانه', reports:'گزارش‌ها', settings:'تنظیمات', 'student-profile':'پروفایل دانش‌آموز' };
    const icons = { home:'🏠', students:'👥', rankings:'🏆', messages:'💬', lessons:'📚', calendar:'📅', contests:'🎯', library:'📖', reports:'📄', settings:'⚙️', 'student-profile':'👤' };
    const titleEl = document.getElementById('panel-page-title'); const iconEl = document.getElementById('header-icon');
    if (titleEl) titleEl.textContent = titles[pageId] || 'خانه';
    if (iconEl) iconEl.textContent = icons[pageId] || '🎓';
    switch (pageId) {
        case 'home': loadHomeData(); break;
        case 'students': loadStudents(); break;
        case 'rankings': loadRankings(); break;
        case 'messages': loadClassMessages(); loadStudentConversations(); break;
        case 'lessons': loadLessonsPage(); break;
        case 'calendar': loadEvents(); break;
        case 'contests': loadContests(); break;
        case 'library': loadLibrary(); break;
    }
}

function showPage(pageId) { navigateToPage(pageId, true); }
function goBack() { history.back(); }

window.addEventListener('popstate', function(event) {
    const l = document.getElementById('login-screen'); const m = document.getElementById('main-panel');
    if (l && l.classList.contains('active')) return;
    if (!m || !m.classList.contains('active')) return;
    const targetPage = event.state && event.state.teacherPage ? event.state.teacherPage : null;
    const a = document.querySelector('.page.active'); const currentPageId = a ? a.id.replace('page-', '') : 'home';
    if (targetPage === currentPageId) {
        if (currentPageId === 'home') {
            if (confirm('خروج؟')) logout(); else pushTeacherHistory('home');
        }
        return;
    }
    if (!targetPage) {
        if (currentPageId !== 'home') { navigateToPageSilent('home'); pushTeacherHistory('home'); }
        else { if (confirm('خروج؟')) logout(); else pushTeacherHistory('home'); }
        return;
    }
    if (PAGE_HASH_MAP[targetPage]) {
        navigateToPageSilent(targetPage);
        if (pageHistory[pageHistory.length - 1] !== targetPage) pageHistory.push(targetPage);
    } else {
        navigateToPageSilent('home');
    }
});

function navigateToPageSilent(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');
    const backBtn = document.getElementById('header-back-btn');
    if (backBtn) backBtn.style.display = pageId === 'home' ? 'none' : 'flex';
    const titles = { home:'خانه', students:'دانش‌آموزان', rankings:'رتبه‌بندی', messages:'پیام‌رسانی', lessons:'مدیریت تکالیف', calendar:'تقویم', contests:'مسابقات', library:'کتابخانه', reports:'گزارش‌ها', settings:'تنظیمات', 'student-profile':'پروفایل دانش‌آموز' };
    const icons = { home:'🏠', students:'👥', rankings:'🏆', messages:'💬', lessons:'📚', calendar:'📅', contests:'🎯', library:'📖', reports:'📄', settings:'⚙️', 'student-profile':'👤' };
    const titleEl = document.getElementById('panel-page-title'); const iconEl = document.getElementById('header-icon');
    if (titleEl) titleEl.textContent = titles[pageId] || 'خانه';
    if (iconEl) iconEl.textContent = icons[pageId] || '🎓';
    switch (pageId) {
        case 'home': loadHomeData(); break;
        case 'students': loadStudents(); break;
        case 'rankings': loadRankings(); break;
        case 'messages': loadClassMessages(); loadStudentConversations(); break;
        case 'lessons': loadLessonsPage(); break;
        case 'calendar': loadEvents(); break;
        case 'contests': loadContests(); break;
        case 'library': loadLibrary(); break;
    }
}

function computeTotalUnread() {
    if (!currentConversations) return 0;
    let t = 0;
    currentConversations.forEach(c => { t += computeUnreadForConversation(c); });
    return t;
}

function updateHomeBadgesImmediately() {
    const c = getCachedData(CONVERSATIONS_CACHE_KEY);
    if (c) currentConversations = c;
    const u = computeTotalUnread();
    const s = document.getElementById('home-stat-messages');
    if (s) s.textContent = toPersianNum(u);
    const b = document.getElementById('home-badge-messages');
    if (b) { if (u > 0) { b.textContent = toPersianNum(u); b.style.display = 'block'; } else b.style.display = 'none'; }
    const t = document.getElementById('personal-unread-badge');
    if (t) { if (u > 0) { t.textContent = toPersianNum(u); t.style.display = 'block'; } else t.style.display = 'none'; }
    const ul = countUnreadLessonReports();
    const sb = document.getElementById('home-badge-students');
    if (sb) { if (ul > 0) { sb.textContent = toPersianNum(ul); sb.style.display = 'flex'; } else sb.style.display = 'none'; }
}

async function loadHomeData() {
    try {
        const cs = getCachedData(STUDENTS_CACHE_KEY);
        const cc = getCachedData(CONVERSATIONS_CACHE_KEY);
        if (cs && cs.length > 0) {
            allStudents = cs;
            document.getElementById('home-stat-students').textContent = toPersianNum(cs.length);
            document.getElementById('home-stat-lessons').textContent = toPersianNum(cs.reduce((sum, s) => sum + getTotalCompletedLessons(s), 0));
            renderHomeTopStudents(cs);
        }
        if (cc && cc.length > 0) { currentConversations = cc; updateHomeBadgesImmediately(); }
        await loadAllReportsForBadges();
        const [st, co] = await Promise.all([getAllStudents(), getStudentConversationsFromSupabase()]);
        if (st && st.length > 0) {
            allStudents = st;
            setCachedData(STUDENTS_CACHE_KEY, st);
            document.getElementById('home-stat-students').textContent = toPersianNum(st.length);
            document.getElementById('home-stat-lessons').textContent = toPersianNum(st.reduce((sum, s) => sum + getTotalCompletedLessons(s), 0));
            renderHomeTopStudents(st);
        }
        if (co && co.length > 0) {
            co.forEach(c => { c.unread_count = computeUnreadForConversation(c); });
            currentConversations = co;
            setCachedData(CONVERSATIONS_CACHE_KEY, co);
        }
        updateHomeBadgesImmediately();
    } catch (e) {}
}

function renderHomeTopStudents(students) {
    const cont = document.getElementById('home-top-students');
    if (!cont) return;
    const top = [...students].sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a)).slice(0, 5);
    if (top.length === 0) { cont.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز دانش‌آموزی ثبت‌نام نکرده</div>'; return; }
    let h = '';
    top.forEach((s, i) => {
        const r = i + 1;
        const m = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : toPersianNum(r);
        h += `<div class="home-top-item" onclick="openStudentProfile('${escapeHTML(s.student_id)}')"><div class="home-top-rank">${m}</div><div class="home-top-avatar">${renderAvatarHTML(s)}</div><div class="home-top-info"><div class="home-top-name">${escapeHTML(s.name || 'دانش‌آموز')}</div><div class="home-top-class">${getClassPersianName(s.class_name)} • ${toPersianNum(getTotalCompletedLessons(s))} تکلیف</div></div><div class="home-top-points"><span>⭐</span><span>${toPersianNum(calculateTotalPoints(s))}</span></div></div>`;
    });
    cont.innerHTML = h;
}

async function loadStudents() {
    const c = document.getElementById('students-grid');
    if (!c) return;
    const ca = getCachedData(STUDENTS_CACHE_KEY);
    if (ca && ca.length > 0) {
        allStudents = ca;
        await loadAllReportsForBadges();
        renderStudents(getFilteredStudents());
    } else {
        c.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    }
    try {
        const st = await getAllStudents();
        allStudents = st;
        setCachedData(STUDENTS_CACHE_KEY, st);
        await loadAllReportsForBadges();
        renderStudents(getFilteredStudents());
        updateHomeBadgesImmediately();
    } catch (e) {
        if (!ca) c.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا</div>';
    }
}

function getFilteredStudents() {
    let f = [...allStudents];
    if (currentStudentClassFilter !== 'all') f = f.filter(s => s.class_name === currentStudentClassFilter);
    const q = document.getElementById('student-search')?.value?.toLowerCase().trim() || '';
    if (q) f = f.filter(s => (s.name || '').toLowerCase().includes(q) || (s.student_code || '').includes(q));
    return f;
}
function filterStudentsByClass(cn, btn) {
    currentStudentClassFilter = cn;
    document.querySelectorAll('.class-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderStudents(getFilteredStudents());
}
function filterStudents() { renderStudents(getFilteredStudents()); }

function renderStudents(students) {
    const c = document.getElementById('students-grid');
    if (!c) return;
    if (students.length === 0) { c.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">دانش‌آموزی یافت نشد</div>'; return; }
    
    const seen = getReadLessons();
    
    students.sort((a, b) => {
        const aReports = allReportsRaw.filter(r => r.student_id === a.student_id);
        const bReports = allReportsRaw.filter(r => r.student_id === b.student_id);
        const aHasUnseen = aReports.some(r => !seen[r.id]);
        const bHasUnseen = bReports.some(r => !seen[r.id]);
        if (aHasUnseen && !bHasUnseen) return -1;
        if (!aHasUnseen && bHasUnseen) return 1;
        const aHasDone = aReports.length > 0;
        const bHasDone = bReports.length > 0;
        if (aHasDone && !bHasDone) return -1;
        if (!aHasDone && bHasDone) return 1;
        return 0;
    });
    
    let h = '';
    students.forEach(s => {
        const sc = s.student_code || '---';
        const tl = getTotalCompletedLessons(s);
        const studentReports = allReportsRaw.filter(r => r.student_id === s.student_id);
        const hasDoneLesson = studentReports.length > 0;
        const hasUnseenReport = studentReports.some(r => !seen[r.id]);
        const latestReport = studentReports.length > 0 ? studentReports[0] : null;
        
        let badgeHTML = '';
        if (hasUnseenReport) {
            badgeHTML += `<div class="student-notif-badge">🔔 اعلان</div>`;
        } else if (hasDoneLesson) {
            badgeHTML += `<div class="student-done-badge">✅</div>`;
        }
        
        let onclickAction = '';
        if (hasUnseenReport && latestReport) {
            onclickAction = `markAndOpenProfile('${escapeHTML(s.student_id)}', '${escapeHTML(latestReport.id)}')`;
        } else {
            onclickAction = `openStudentProfile('${escapeHTML(s.student_id)}')`;
        }
        
        const cardClass = hasUnseenReport ? 'has-new-lesson' : (hasDoneLesson ? 'has-done-lesson' : '');
        
        h += `<div class="student-card ${cardClass}" onclick="${onclickAction}">
            ${badgeHTML}
            <div class="student-avatar">${renderAvatarHTML(s)}</div>
            <div class="student-info">
                <div class="student-name">${escapeHTML(s.name || 'بدون نام')}</div>
                <span class="student-class">${getClassPersianName(s.class_name)}</span>
                <div class="student-stats"><span>🔑 ${sc}</span><span>📚 ${toPersianNum(tl)} تکلیف</span></div>
            </div>
            <div class="student-points"><span>⭐</span><span>${toPersianNum(calculateTotalPoints(s))}</span></div>
        </div>`;
    });
    c.innerHTML = h;
}

function markAndOpenProfile(sid, rid) {
    markLessonReportAsSeen(rid);
    openStudentProfile(sid);
    updateHomeBadgesImmediately();
    setTimeout(() => { renderStudents(getFilteredStudents()); }, 500);
}
async function openStudentProfile(sid) {
    let s = allStudents.find(x => x.student_id === sid);
    if (!s) { showToast('دانش‌آموز پیدا نشد', 'error'); return; }
    currentProfileStudent = s;
    vibrate(15);
    const c = document.getElementById('student-profile-content');
    if (c) c.innerHTML = '<div style="text-align:center; padding:60px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    navigateToPage('student-profile', true);
    try {
        const cl = getSupabase();
        if (cl) {
            const { data } = await cl.from('rankings').select('*').eq('student_id', sid).maybeSingle();
            if (data) {
                currentProfileStudent = data;
                const i = allStudents.findIndex(x => x.student_id === sid);
                if (i >= 0) allStudents[i] = data;
            }
        }
        const r = await fetch('./lessons/index.json');
        const d = await r.json();
        currentProfileLessons = d.lessons || [];
        currentProfileStatus = await getLessonStatusForStudent(sid);
        currentProfileReports = await getStudentReports(sid);
        renderStudentProfile();
    } catch (e) {
        if (c) c.innerHTML = '<div style="text-align:center; padding:60px; color:#c62828; font-weight:bold;">خطا</div>';
    }
}

function isLessonExpiredForStudent(lesson, cd) {
    const d = cd || lesson.dueDate || 'نامشخص';
    if (d === 'نامشخص') return false;
    const t = new Date();
    const pd = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    return persianDateToNum(pd) > persianDateToNum(d);
}

function persianDateToNum(ds) {
    if (!ds || ds === 'نامشخص') return 0;
    const n = String(ds).replace(/[۰-۹]/g, x => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x));
    const p = n.split(/[\/\-]/);
    if (p.length !== 3) return 0;
    return parseInt(p[0]) * 10000 + parseInt(p[1]) * 100 + parseInt(p[2]);
}

function renderStudentProfile() {
    const c = document.getElementById('student-profile-content');
    if (!c || !currentProfileStudent) return;
    const s = currentProfileStudent;
    const tp = calculateTotalPoints(s);
    const cp = getClassPersianName(s.class_name);
    const sc = s.student_code || '---';
    const cl = getTotalCompletedLessons(s);

    const rm = {};
    currentProfileReports.forEach(r => { if (!rm[r.lesson_id]) rm[r.lesson_id] = r; });

    let lh = '';
    currentProfileLessons.forEach(l => {
        const st = currentProfileStatus[l.id] || { is_enabled: true, custom_due_date: null };
        const ie = st.is_enabled !== false;
        const cd = st.custom_due_date || null;
        const r = rm[l.id];
        const id = !!r;
        const dd = cd || l.dueDate || 'نامشخص';
        const ic = !!cd;
        const ix = isLessonExpiredForStudent(l, cd);

        let rh = '';
        if (id) {
            // فقط نمایش کارنامه - دکمه حذف وجود ندارد
            rh = `<div class="profile-lesson-report done">
                    <div class="report-row"><span class="report-label">✅ انجام شده</span><span class="report-value-percent">${toPersianNum(r.percent || 0)}%</span></div>
                    <div class="report-row"><span class="report-label">امتیاز:</span><span class="report-value-points">${toPersianNum(r.score || 0)} از ${toPersianNum(r.total_points || 0)}</span></div>
                  </div>`;
        } else if (ix && !ic) {
            rh = `<div class="profile-lesson-report pending"><span class="report-badge" style="background:linear-gradient(135deg,#ffcdd2,#ef9a9a);color:#b71c1c;">⏰ منقضی شده</span></div>`;
        } else {
            rh = `<div class="profile-lesson-report pending"><span class="report-badge pending">⏳ انجام نشده</span></div>`;
        }

        const th = `<div class="profile-lesson-toggle"><span class="toggle-label ${ie ? 'enabled' : 'disabled'}">${ie ? '🟢 فعال' : '🔴 غیرفعال'}</span><label class="switch-small"><input type="checkbox" ${ie ? 'checked' : ''} onchange="toggleLessonEnabled('${l.id}', this.checked)"><span class="slider-small"></span></label></div>`;
        const dh = `<div class="profile-lesson-duedate"><div class="due-date-info"><span class="due-date-label">📅 مهلت:</span><span class="due-date-value ${ic ? 'custom' : (ix ? 'expired' : '')}">${dd}</span>${ic ? '<span class="custom-badge">سفارشی</span>' : ''}${ix && !ic ? '<span class="expired-badge">منقضی</span>' : ''}</div><button class="edit-date-btn" onclick="openDueDateEditor('${l.id}', '${dd}', ${ic})">✏️ ${ic ? 'ویرایش' : 'تمدید'}</button></div>`;

        lh += `<div class="profile-lesson-item ${!ie ? 'disabled' : ''} ${id ? 'done' : ''}"><div class="profile-lesson-header"><div class="profile-lesson-title">${escapeHTML(l.title)}</div>${id ? '<span class="lesson-done-badge">✓</span>' : ''}</div><div class="profile-lesson-meta"><span>📝 ${toPersianNum(l.activityCount || 0)} سوال</span></div>${dh}${rh}${th}</div>`;
    });
    if (currentProfileLessons.length === 0) lh = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">تکلیفی یافت نشد</div>';

    c.innerHTML = `<div class="profile-header-card"><div class="profile-avatar-big">${renderAvatarHTML(s)}</div><div class="profile-name-big">${escapeHTML(s.name || 'بدون نام')}</div><div class="profile-class-big">${cp}</div></div><div class="profile-stats-grid"><div class="profile-stat-card" onclick="openEditStudentCode()" style="cursor:pointer;"><div class="profile-stat-icon">🔑</div><div class="profile-stat-value">${sc}</div><div class="profile-stat-label">کد ورود (کلیک کن)</div></div><div class="profile-stat-card" onclick="openEditCompletedLessons()" style="cursor:pointer;"><div class="profile-stat-icon">📚</div><div class="profile-stat-value">${toPersianNum(cl)}</div><div class="profile-stat-label">تکالیف (کلیک کن)</div></div><div class="profile-stat-card"><div class="profile-stat-icon">📊</div><div class="profile-stat-value">${toPersianNum(s.avg_percent || 0)}%</div><div class="profile-stat-label">میانگین درصد</div></div><div class="profile-stat-card"><div class="profile-stat-icon">🔥</div><div class="profile-stat-value">${toPersianNum(s.streak_days || 0)}</div><div class="profile-stat-label">روز متوالی</div></div></div><button class="profile-chat-btn" onclick="goToChatFromProfile()">💬 چت با این دانش‌آموز</button><div class="profile-total-points-card"><div class="profile-total-points-label">⭐ امتیاز کل (قابل ویرایش)</div><div class="profile-total-points-value">${toPersianNum(tp)}</div><div class="profile-total-points-actions"><button class="point-btn minus" onclick="changeTotalPoints(-10)">−۱۰</button><button class="point-btn minus" onclick="changeTotalPoints(-1)">−۱</button><button class="point-btn plus" onclick="changeTotalPoints(1)">+۱</button><button class="point-btn plus" onclick="changeTotalPoints(10)">+۱۰</button></div></div><div class="profile-lessons-card"><div class="profile-lessons-title">📚 مدیریت تکالیف</div><div class="profile-lessons-list">${lh}</div></div>`;
}

async function toggleLessonEnabled(lessonId, isEnabled) {
    if (!currentProfileStudent) return;
    vibrate(15);
    const st = currentProfileStatus[lessonId] || { is_enabled: true };
    const r = await updateLessonStatus(currentProfileStudent.student_id, lessonId, { is_enabled: isEnabled });
    if (r.success) {
        currentProfileStatus[lessonId] = { ...st, is_enabled: isEnabled };
        renderStudentProfile();
        showToast(isEnabled ? '✅ فعال شد' : '⛔ غیرفعال شد', 'success');
    } else showToast('خطا', 'error');
}

async function changeTotalPoints(delta) {
    if (!currentProfileStudent) return;
    vibrate(15);
    try {
        const cl = getSupabase();
        if (!cl) { showToast('اتصال برقرار نیست', 'error'); return; }
        const ca = parseInt(currentProfileStudent.custom_points_added) || 0;
        const na = ca + delta;
        const { error } = await cl.from('rankings').update({ custom_points_added: na }).eq('student_id', currentProfileStudent.student_id);
        if (error) throw error;
        currentProfileStudent.custom_points_added = na;
        localStorage.removeItem(STUDENTS_CACHE_KEY);
        renderStudentProfile();
        showToast(`امتیاز ${delta > 0 ? '+' + delta : delta} شد`, 'success');
    } catch (e) { showToast('خطا', 'error'); }
}

function goToChatFromProfile() {
    if (!currentProfileStudent) return;
    const s = currentProfileStudent;
    navigateToPage('messages', true);
    setTimeout(() => {
        switchMessagesTab('personal');
        setTimeout(() => { openChatWith(s.student_id, s.name, s.class_name); }, 400);
    }, 300);
}

function switchRankingClass(cn, btn) {
    currentRankingClass = cn;
    document.querySelectorAll('.rankings-class-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const ti = document.getElementById('rankings-current-class');
    if (ti) ti.textContent = getClassPersianName(cn);
    loadRankings();
}

async function loadRankings() {
    const c = document.getElementById('rankings-list');
    if (!c) return;
    c.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        let ad = getCachedData(STUDENTS_CACHE_KEY);
        if (!ad) { const r = await getAllStudents(); ad = r || []; setCachedData(STUDENTS_CACHE_KEY, ad); }
        const rk = ad.filter(s => s.class_name === currentRankingClass).sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a));
        const ce = document.getElementById('rankings-current-count');
        if (ce) ce.textContent = `${toPersianNum(rk.length)} دانش‌آموز`;
        if (rk.length === 0) { c.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">دانش‌آموزی در این کلاس نیست</div>'; return; }
        let h = '';
        rk.forEach((s, i) => {
            const r = i + 1;
            const rc = r <= 3 ? `rank-${r}` : '';
            const m = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : toPersianNum(r);
            const tl = getTotalCompletedLessons(s);
            h += `<div class="ranking-item ${rc}" onclick="openStudentProfile('${escapeHTML(s.student_id)}')"><div class="ranking-rank">${m}</div><div class="student-avatar" style="width:46px;height:46px;">${renderAvatarHTML(s)}</div><div class="student-info"><div class="student-name">${escapeHTML(s.name || 'بدون نام')}</div><span class="student-class">${toPersianNum(tl)} تکلیف • ${toPersianNum(s.avg_percent || 0)}%</span></div><div class="student-points"><span>⭐</span><span>${toPersianNum(calculateTotalPoints(s))}</span></div></div>`;
        });
        c.innerHTML = h;
    } catch (e) {
        c.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا</div>';
    }
}
async function loadLessonsPage() {
    const c = document.getElementById('lessons-list');
    if (!c) return;
    const ca = getCachedData(LESSONS_CACHE_KEY, 600000);
    if (ca && ca.length > 0) { allLessonsList = ca; await loadLessonStatuses(); renderLessonsList(ca); }
    else c.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const r = await fetch('./lessons/index.json');
        const d = await r.json();
        const l = d.lessons || [];
        allLessonsList = l;
        setCachedData(LESSONS_CACHE_KEY, l);
        await loadLessonStatuses();
        renderLessonsList(l);
    } catch (e) {
        if (!ca) c.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا</div>';
    }
}

async function loadLessonStatuses() {
    try {
        const cl = getSupabase();
        if (!cl) return;
        const { data } = await cl.from('lesson_status').select('*').is('student_id', null);
        allLessonStatuses = data || [];
    } catch (e) {}
}

function renderLessonsList(lessons) {
    const c = document.getElementById('lessons-list');
    if (!c) return;
    if (!lessons || lessons.length === 0) { c.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">تکلیفی یافت نشد</div>'; return; }
    let h = '';
    lessons.forEach(l => {
        const st = allLessonStatuses.filter(s => s.lesson_id === l.id);
        let sb = '';
        let hc = st.length > 0;
        if (hc) {
            st.forEach(s => {
                const cl = s.class_name === 'all' ? 'همه کلاس‌ها' : getClassPersianName(s.class_name);
                const ie = s.is_enabled !== false;
                const bc = ie ? 'badge-active' : 'badge-inactive';
                const ic = ie ? '🟢' : '🔴';
                sb += `<span class="status-badge ${bc}">${ic} ${cl}</span>`;
            });
        }
        const ds = !hc ? '<span class="status-badge badge-default">⚙️ تنظیم نشده (پیش‌فرض فعال)</span>' : '';
        const ad = st.some(s => s.class_name === 'all' && s.is_enabled === false);
        const gb = ad ? '<span class="status-badge badge-global-inactive">⚠️ برای همه غیرفعال</span>' : '';
        let cdh = '';
        st.forEach(s => {
            if (s.custom_due_date) {
                const cl = s.class_name === 'all' ? 'همه' : getClassPersianName(s.class_name);
                cdh += `<span class="date-badge">📅 ${cl}: ${s.custom_due_date}</span>`;
            }
        });
        h += `<div class="lesson-manage-card"><div class="lesson-manage-header"><div class="lesson-manage-icon">📚</div><div class="lesson-manage-title">${escapeHTML(l.title)}</div></div><div class="lesson-manage-meta"><span class="meta-item">📅 مهلت پیش‌فرض: ${l.dueDate || 'نامشخص'}</span><span class="meta-item">📝 ${toPersianNum(l.activityCount || 0)} سوال</span></div><div class="lesson-manage-status-section"><div class="status-section-label">📋 وضعیت برای کلاس‌ها:</div><div class="status-badges-container">${gb}${sb}${ds}</div></div>${cdh ? `<div class="lesson-manage-dates-section"><div class="dates-section-label">📅 مهلت‌های سفارشی:</div><div class="dates-badges-container">${cdh}</div></div>` : ''}</div>`;
    });
    c.innerHTML = h;
}

function openClassDueDateModal() {
    const m = document.getElementById('class-duedate-modal');
    if (!m) return;
    const s = document.getElementById('class-duedate-lesson-select');
    if (s) { let o = '<option value="">--- انتخاب تکلیف ---</option>'; allLessonsList.forEach(l => { o += `<option value="${l.id}">${escapeHTML(l.title)}</option>`; }); s.innerHTML = o; }
    selectedClassDay = null;
    const p = document.getElementById('class-preview-date');
    if (p) p.textContent = '---';
    const dp = document.getElementById('class-day-picker');
    if (dp) {
        let h = '';
        [1,2,3,4,5,6,7].forEach(d => { h += `<button type="button" class="day-picker-btn" data-days="${d}" onclick="selectClassDay(${d}, this)"><span class="day-picker-num">${toPersianNum(d)}</span><span class="day-picker-label">روز</span></button>`; });
        dp.innerHTML = h;
    }
    m.classList.add('active');
}

function closeClassDueDateModal() { const m = document.getElementById('class-duedate-modal'); if (m) m.classList.remove('active'); }

function selectClassDay(days, btn) {
    selectedClassDay = days;
    document.querySelectorAll('.class-day-picker .day-picker-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    const nd = calculatePersianDatePlusDays(days);
    const p = document.getElementById('class-preview-date');
    if (p) { p.textContent = nd; p.classList.add('show'); }
}

async function saveClassDueDate() {
    const ls = document.getElementById('class-duedate-lesson-select');
    const cs = document.getElementById('class-duedate-class-select');
    if (!ls || !ls.value) { showToast('تکلیف انتخاب کنید', 'warning'); return; }
    if (!cs || !cs.value) { showToast('کلاس انتخاب کنید', 'warning'); return; }
    if (!selectedClassDay) { showToast('روز انتخاب کنید', 'warning'); return; }
    const li = ls.value;
    const cn = cs.value;
    const nd = calculatePersianDatePlusDays(selectedClassDay);
    showToast('در حال ذخیره...', 'info');
    const r = await setClassDueDate(li, cn, nd);
    if (r.success) {
        closeClassDueDateModal();
        showToast(`✅ مهلت برای ${cn === 'all' ? 'همه کلاس‌ها' : getClassPersianName(cn)} تغییر کرد تا ${nd}`, 'success');
        await loadLessonStatuses();
        renderLessonsList(allLessonsList);
    } else showToast('خطا', 'error');
}

function openToggleLessonModal() {
    const m = document.getElementById('toggle-lesson-modal');
    if (!m) return;
    const s = document.getElementById('toggle-lesson-select');
    if (s) { let o = '<option value="">--- انتخاب تکلیف ---</option>'; allLessonsList.forEach(l => { o += `<option value="${l.id}">${escapeHTML(l.title)}</option>`; }); s.innerHTML = o; }
    setToggleStatus(true);
    m.classList.add('active');
}

function closeToggleLessonModal() { const m = document.getElementById('toggle-lesson-modal'); if (m) m.classList.remove('active'); }

function setToggleStatus(ia) {
    toggleStatusValue = ia;
    const a = document.getElementById('toggle-active-btn');
    const i = document.getElementById('toggle-inactive-btn');
    if (a) a.classList.toggle('active-btn', ia);
    if (i) i.classList.toggle('active-btn', !ia);
}

async function saveToggleLesson() {
    const ls = document.getElementById('toggle-lesson-select');
    const cs = document.getElementById('toggle-class-select');
    if (!ls || !ls.value) { showToast('تکلیف انتخاب کنید', 'warning'); return; }
    if (!cs || !cs.value) { showToast('کلاس انتخاب کنید', 'warning'); return; }
    const li = ls.value;
    const cn = cs.value;
    showToast('در حال ذخیره...', 'info');
    const r = await setClassLessonStatus(li, cn, toggleStatusValue);
    if (r.success) {
        closeToggleLessonModal();
        showToast(`✅ تکلیف برای ${cn === 'all' ? 'همه کلاس‌ها' : getClassPersianName(cn)} ${toggleStatusValue ? 'فعال' : 'غیرفعال'} شد`, 'success');
        await loadLessonStatuses();
        renderLessonsList(allLessonsList);
    } else showToast('خطا', 'error');
}

function calculatePersianDatePlusDays(daysToAdd) {
    const t = new Date();
    const pd = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    const p = pd.split('/').map(x => parseInt(fromPersianNum(x)));
    let y = p[0], m = p[1], d = p[2];
    const md = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    d += daysToAdd;
    while (d > md[m - 1]) {
        d -= md[m - 1];
        m += 1;
        if (m > 12) { m = 1; y += 1; }
    }
    return `${toPersianNum(y)}/${toPersianNum(String(m).padStart(2, '0'))}/${toPersianNum(String(d).padStart(2, '0'))}`;
}

function openDueDateEditor(lessonId, currentDate, isCustom) {
    if (!currentProfileStudent) return;
    vibrate(15);
    const ex = document.getElementById('due-date-modal');
    if (ex) ex.remove();
    const m = document.createElement('div');
    m.id = 'due-date-modal';
    m.className = 'due-date-modal-overlay active';
    m.innerHTML = `<div class="due-date-modal-box"><div class="due-date-modal-header"><div class="due-date-modal-icon">📅</div><div class="due-date-modal-title">تمدید مهلت تکلیف</div><div class="due-date-modal-subtitle">فقط برای این دانش‌آموز</div></div><div class="due-date-modal-body"><label class="due-date-input-label">افزودن به امروز (۱ تا ۷ روز):</label><div class="day-picker-grid" id="day-picker-grid">${[1,2,3,4,5,6,7].map(day => `<button type="button" class="day-picker-btn" data-days="${day}" onclick="selectDueDateDay(${day}, this)"><span class="day-picker-num">${toPersianNum(day)}</span><span class="day-picker-label">روز</span></button>`).join('')}</div><div class="due-date-preview-box" id="due-date-preview"><div class="preview-label">📅 تاریخ مهلت جدید:</div><div class="preview-value" id="preview-date-value">---</div></div>${isCustom ? `<div class="due-date-current-hint"><span class="hint-icon">ℹ️</span><span class="hint-text">مهلت فعلی (سفارشی): <strong>${currentDate}</strong></span></div>` : ''}<div class="due-date-warning-box" style="background:linear-gradient(135deg,#e8f5e9,#f1f8e9);border-color:#a5d6a7;color:#2e7d32;">✅ با تمدید مهلت، تکلیف از حالت منقضی خارج میشه و دانش‌آموز می‌تونه انجامش بده و امتیاز بگیره.</div></div><div class="due-date-modal-footer">${isCustom ? `<button class="due-date-btn due-date-btn-remove" onclick="removeCustomDueDate('${lessonId}')">🗑️ حذف سفارشی</button>` : ''}<button class="due-date-btn due-date-btn-cancel" onclick="closeDueDateModal()">انصراف</button><button class="due-date-btn due-date-btn-save" id="save-due-date-btn" onclick="saveDueDate('${lessonId}')" disabled>✅ تمدید کن</button></div></div>`;
    document.body.appendChild(m);
    setTimeout(() => { const f = m.querySelector('.day-picker-btn'); if (f) selectDueDateDay(1, f); }, 200);
}

let selectedDueDateDays = null;

function selectDueDateDay(days, btn) {
    selectedDueDateDays = days;
    document.querySelectorAll('.day-picker-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    const nd = calculatePersianDatePlusDays(days);
    const p = document.getElementById('preview-date-value');
    if (p) { p.textContent = nd; p.classList.add('show'); }
    const s = document.getElementById('save-due-date-btn');
    if (s) s.disabled = false;
    vibrate(10);
}

function closeDueDateModal() { const m = document.getElementById('due-date-modal'); if (m) m.remove(); selectedDueDateDays = null; }

async function saveDueDate(lessonId) {
    if (!currentProfileStudent) return;
    if (!selectedDueDateDays) { showToast('روز انتخاب کنید', 'warning'); return; }
    const nd = calculatePersianDatePlusDays(selectedDueDateDays);
    vibrate(15);
    const st = currentProfileStatus[lessonId] || { is_enabled: true };
    const r = await updateLessonStatus(currentProfileStudent.student_id, lessonId, { custom_due_date: nd, is_enabled: true });
    if (r.success) {
        currentProfileStatus[lessonId] = { ...st, custom_due_date: nd, is_enabled: true };
        try { localStorage.removeItem('lessonStatusCache'); } catch (e) {}
        closeDueDateModal();
        renderStudentProfile();
        showToast(`✅ مهلت تا ${nd} تمدید شد`, 'success');
    } else showToast('خطا', 'error');
}

async function removeCustomDueDate(lessonId) {
    if (!currentProfileStudent) return;
    vibrate(15);
    const r = await removeStudentCustomDueDate(currentProfileStudent.student_id, lessonId);
    if (r.success) {
        currentProfileStatus[lessonId] = { ...currentProfileStatus[lessonId], custom_due_date: null };
        try { localStorage.removeItem('lessonStatusCache'); } catch (e) {}
        closeDueDateModal();
        renderStudentProfile();
        showToast('✅ مهلت سفارشی حذف شد', 'success');
    } else showToast('خطا', 'error');
}
async function addEvent() {
    const ti = document.getElementById('event-title').value.trim();
    const da = document.getElementById('event-date').value.trim();
    const cl = document.getElementById('event-class').value;
    const ty = document.getElementById('event-type').value;
    const de = document.getElementById('event-desc').value.trim();
    if (!ti || !da) { showToast('عنوان و تاریخ', 'warning'); return; }
    try {
        const r = await addEventToSupabase({ event_id: 'evt_' + Date.now(), title: ti, date: da, class_name: cl, type: ty, description: de });
        if (r.success) {
            showToast('رویداد ثبت شد', 'success');
            document.getElementById('event-title').value = '';
            document.getElementById('event-date').value = '';
            document.getElementById('event-desc').value = '';
            localStorage.removeItem(EVENTS_CACHE_KEY);
            loadEvents();
        } else showToast('خطا', 'error');
    } catch (e) { showToast('خطا', 'error'); }
}

async function loadEvents() {
    const c = document.getElementById('events-list');
    if (!c) return;
    const ca = getCachedData(EVENTS_CACHE_KEY);
    if (ca && ca.length > 0) renderEvents(ca);
    else c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const ev = await getEventsFromSupabase();
        setCachedData(EVENTS_CACHE_KEY, ev);
        renderEvents(ev);
    } catch (e) { if (!ca) c.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderEvents(events) {
    const c = document.getElementById('events-list');
    if (!c) return;
    if (!events || events.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز رویدادی ثبت نشده</div>'; return; }
    const ti = { exam: '📝', homework: '📚', holiday: '🎉', event: '📌' };
    let h = '';
    events.forEach(e => { h += `<div class="event-item"><div class="event-item-icon">${ti[e.type] || '📌'}</div><div class="event-item-info"><div class="event-item-title">${escapeHTML(e.title)}</div><div class="event-item-meta">${e.date} • ${getClassPersianName(e.class_name)}${e.description ? ' • ' + escapeHTML(e.description) : ''}</div></div></div>`; });
    c.innerHTML = h;
}

async function addContest() {
    const ti = document.getElementById('contest-title').value.trim();
    const pr = document.getElementById('contest-prize').value.trim();
    const st = document.getElementById('contest-start').value.trim();
    const en = document.getElementById('contest-end').value.trim();
    const de = document.getElementById('contest-desc').value.trim();
    if (!ti || !st || !en) { showToast('عنوان و تاریخ', 'warning'); return; }
    try {
        const r = await addContestToSupabase({ contest_id: 'cnt_' + Date.now(), title: ti, prize: pr, start_date: st, end_date: en, description: de });
        if (r.success) {
            showToast('مسابقه ایجاد شد', 'success');
            document.getElementById('contest-title').value = '';
            document.getElementById('contest-prize').value = '';
            document.getElementById('contest-start').value = '';
            document.getElementById('contest-end').value = '';
            document.getElementById('contest-desc').value = '';
            localStorage.removeItem(CONTESTS_CACHE_KEY);
            loadContests();
        } else showToast('خطا', 'error');
    } catch (e) { showToast('خطا', 'error'); }
}

async function loadContests() {
    const c = document.getElementById('contests-list');
    if (!c) return;
    const ca = getCachedData(CONTESTS_CACHE_KEY);
    if (ca && ca.length > 0) renderContests(ca);
    else c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const co = await getContestsFromSupabase();
        setCachedData(CONTESTS_CACHE_KEY, co);
        renderContests(co);
    } catch (e) { if (!ca) c.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderContests(contests) {
    const c = document.getElementById('contests-list');
    if (!c) return;
    if (!contests || contests.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز مسابقه‌ای نیست</div>'; return; }
    let h = '';
    contests.forEach(x => { h += `<div class="contest-item"><div class="contest-item-icon">🏆</div><div class="contest-item-info"><div class="contest-item-title">${escapeHTML(x.title)}</div><div class="contest-item-meta">🎁 ${escapeHTML(x.prize || 'بدون جایزه')} • 📅 از ${x.start_date} تا ${x.end_date}</div></div></div>`; });
    c.innerHTML = h;
}

async function addLibraryItem() {
    const ti = document.getElementById('lib-title').value.trim();
    const ty = document.getElementById('lib-type').value;
    const ur = document.getElementById('lib-url').value.trim();
    const de = document.getElementById('lib-desc').value.trim();
    if (!ti || !ur) { showToast('عنوان و لینک', 'warning'); return; }
    try {
        const r = await addLibraryToSupabase({ item_id: 'lib_' + Date.now(), title: ti, type: ty, url: ur, description: de });
        if (r.success) {
            showToast('منبع اضافه شد', 'success');
            document.getElementById('lib-title').value = '';
            document.getElementById('lib-url').value = '';
            document.getElementById('lib-desc').value = '';
            localStorage.removeItem(LIBRARY_CACHE_KEY);
            loadLibrary();
        } else showToast('خطا', 'error');
    } catch (e) { showToast('خطا', 'error'); }
}

async function loadLibrary() {
    const c = document.getElementById('library-list');
    if (!c) return;
    const ca = getCachedData(LIBRARY_CACHE_KEY);
    if (ca && ca.length > 0) renderLibrary(ca);
    else c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const it = await getLibraryFromSupabase();
        setCachedData(LIBRARY_CACHE_KEY, it);
        renderLibrary(it);
    } catch (e) { if (!ca) c.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderLibrary(items) {
    const c = document.getElementById('library-list');
    if (!c) return;
    if (!items || items.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز منبعی اضافه نشده</div>'; return; }
    const ti = { video: '🎬', pdf: '📄', audio: '🎵', site: '🌐', book: '📚' };
    let h = '';
    items.forEach(x => { h += `<div class="library-item"><div class="library-item-icon">${ti[x.type] || '📄'}</div><div class="library-item-info"><div class="library-item-title">${escapeHTML(x.title)}</div><div class="library-item-meta">${escapeHTML(x.description || '')} • <a href="${escapeHTML(x.url)}" target="_blank" style="color:#1976d2;">باز کردن</a></div></div></div>`; });
    c.innerHTML = h;
}

function downloadAllStudents() {
    if (allStudents.length === 0) { showToast('داده‌ای نیست', 'warning'); return; }
    let csv = '\uFEFF';
    csv += 'نام,کد ورود,کلاس,امتیاز,تکالیف,درصد,روز متوالی\n';
    allStudents.forEach(s => { csv += `"${s.name}","${s.student_code || ''}","${getClassPersianName(s.class_name)}",${calculateTotalPoints(s)},${getTotalCompletedLessons(s)},${s.avg_percent},${s.streak_days || 0}\n`; });
    downloadFile(csv, 'دانش‌آموزان.csv', 'text/csv');
    showToast('دانلود شد', 'success');
}

function downloadClassReport() {
    const cl = document.getElementById('report-class-filter').value;
    const f = cl === 'all' ? allStudents : allStudents.filter(s => s.class_name === cl);
    if (f.length === 0) { showToast('داده‌ای نیست', 'warning'); return; }
    let csv = '\uFEFF';
    csv += 'نام,کد ورود,امتیاز,تکالیف,درصد\n';
    f.forEach(s => { csv += `"${s.name}","${s.student_code || ''}",${calculateTotalPoints(s)},${getTotalCompletedLessons(s)},${s.avg_percent}\n`; });
    downloadFile(csv, (cl === 'all' ? 'همه_کلاس‌ها.csv' : getClassPersianName(cl) + '.csv'), 'text/csv');
    showToast('دانلود شد', 'success');
}

function downloadFile(content, filename, type) {
    const b = new Blob([content], { type: type + ';charset=utf-8' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(u);
}

function printStudentCertificates() { showToast('به‌زودی', 'info'); }

function showTopStudentsReport() {
    const top = [...allStudents].sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a)).slice(0, 10);
    const c = document.getElementById('full-report-content');
    if (top.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae;">داده‌ای نیست</div>'; return; }
    let h = '<div style="font-weight:900; color:#1976d2; margin-bottom:12px; font-size:15px;">🏆 ۱۰ دانش‌آموز برتر:</div>';
    top.forEach((s, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : toPersianNum(i + 1) + '.';
        h += `<div style="padding:8px 0; border-bottom:1px dashed #e3f2fd; font-size:13px;">${m} <strong>${escapeHTML(s.name)}</strong> - ${getClassPersianName(s.class_name)} - <span style="color:#f57c00; font-weight:900;">${toPersianNum(calculateTotalPoints(s))} امتیاز</span></div>`;
    });
    c.innerHTML = h;
}

function generateFullReport() {
    const cl = document.getElementById('report-class-filter').value;
    const f = cl === 'all' ? allStudents : allStudents.filter(s => s.class_name === cl);
    const c = document.getElementById('full-report-content');
    if (f.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae;">داده‌ای نیست</div>'; return; }
    const tp = f.reduce((sum, s) => sum + calculateTotalPoints(s), 0);
    const ap = Math.round(tp / f.length);
    const tl = f.reduce((sum, s) => sum + getTotalCompletedLessons(s), 0);
    const aсp = Math.round(f.reduce((sum, s) => sum + (parseInt(s.avg_percent) || 0), 0) / f.length);
    let h = `<div style="font-weight:900; color:#1976d2; margin-bottom:15px; font-size:15px;">📊 گزارش ${cl === 'all' ? 'همه' : getClassPersianName(cl)}</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><div style="padding:12px; background:#fff; border-radius:12px;"><div style="font-size:11px; color:#78909c; font-weight:bold;">تعداد دانش‌آموزان</div><div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(f.length)}</div></div><div style="padding:12px; background:#fff; border-radius:12px;"><div style="font-size:11px; color:#78909c; font-weight:bold;">میانگین امتیاز</div><div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(ap)}</div></div><div style="padding:12px; background:#fff; border-radius:12px;"><div style="font-size:11px; color:#78909c; font-weight:bold;">کل تکالیف</div><div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(tl)}</div></div><div style="padding:12px; background:#fff; border-radius:12px;"><div style="font-size:11px; color:#78909c; font-weight:bold;">میانگین درصد</div><div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(aсp)}%</div></div></div>`;
    c.innerHTML = h;
}

async function changePassword() {
    const np = prompt('رمز جدید (حداقل ۴ کاراکتر):');
    if (!np || np.length < 4) {
        if (np) showToast('حداقل ۴ کاراکتر', 'warning');
        return;
    }
    try {
        const c = getSupabase();
        if (c) {
            const { error } = await c.from('teacher_settings').upsert({ id: 1, password: np }, { onConflict: 'id' });
            if (error) throw error;
        }
        localStorage.setItem(TEACHER_PASSWORD_KEY, np);
        showToast('رمز تغییر کرد', 'success');
    } catch (e) {
        showToast('خطا در تغییر رمز', 'error');
    }
}

function clearCache() {
    if (confirm('مطمئنید؟')) {
        const p = localStorage.getItem(TEACHER_PASSWORD_KEY);
        const l = localStorage.getItem('teacherLoggedIn');
        localStorage.clear();
        if (p) localStorage.setItem(TEACHER_PASSWORD_KEY, p);
        if (l) localStorage.setItem('teacherLoggedIn', l);
        showToast('پاک شد', 'success');
        setTimeout(() => location.reload(), 1000);
    }
}

function openEditStudentCode() {
    if (!currentProfileStudent) return;
    vibrate(15);
    
    const existing = document.getElementById('edit-student-code-modal');
    if (existing) existing.remove();
    
    const currentCode = currentProfileStudent.student_code || '---';
    
    const modal = document.createElement('div');
    modal.id = 'edit-student-code-modal';
    modal.className = 'change-code-overlay active';
    modal.innerHTML = `
        <div class="change-code-box">
            <button class="change-code-close" onclick="closeEditStudentCodeModal()">✕</button>
            <div class="change-code-header" style="background: linear-gradient(135deg, #42a5f5 0%, #1976d2 100%);">
                <div class="change-code-icon">🔑</div>
                <div class="change-code-title">تغییر کد ورود</div>
                <div class="change-code-subtitle">کد فعلی: <span class="current-code-badge">${currentCode}</span></div>
            </div>
            <div class="change-code-body">
                <label class="change-code-label">کد جدید (۳ رقم):</label>
                <input type="text" id="teacher-new-code-input" class="change-code-input" placeholder="123" inputmode="numeric" maxlength="3" dir="ltr">
                <div class="change-code-warning">
                    ⚠️ اگه کد رو تغییر بدی، دانش‌آموز از این به بعد باید با کد جدید وارد بشه.
                </div>
            </div>
            <div class="change-code-footer">
                <button class="change-code-btn change-code-btn-cancel" onclick="closeEditStudentCodeModal()">انصراف</button>
                <button class="change-code-btn change-code-btn-save" onclick="saveNewStudentCode()">✅ ذخیره</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const input = document.getElementById('teacher-new-code-input');
        if (input) {
            input.focus();
            input.addEventListener('input', (e) => e.target.value = e.target.value.replace(/[^0-9]/g, ''));
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveNewStudentCode(); });
        }
    }, 300);
}

function closeEditStudentCodeModal() {
    const modal = document.getElementById('edit-student-code-modal');
    if (modal) modal.remove();
}

async function saveNewStudentCode() {
    const input = document.getElementById('teacher-new-code-input');
    const newCode = input ? input.value.trim() : '';
    const studentId = currentProfileStudent ? currentProfileStudent.student_id : null;
    
    if (!studentId) return;
    if (!newCode) { showToast('کد جدید را وارد کنید.', 'warning'); return; }
    if (!/^[0-9]{3}$/.test(newCode)) { showToast('کد باید ۳ رقم باشه.', 'warning'); return; }
    
    const currentCode = currentProfileStudent.student_code;
    if (newCode === currentCode) { showToast('کد جدید با کد فعلی یکیه.', 'warning'); return; }
    
    showToast('در حال بررسی...', 'info');
    
    try {
        const client = getSupabase();
        if (!client) throw new Error('no_client');
        
        const { data: existing, error: checkError } = await client
            .from('rankings')
            .select('student_id')
            .eq('student_code', newCode)
            .maybeSingle();
            
        if (checkError && checkError.code !== 'PGRST116') throw checkError;
        if (existing && existing.student_id !== studentId) {
            showToast(`کد <strong>${newCode}</strong> قبلاً استفاده شده.`, 'error');
            return;
        }
        
        const { error: updateError } = await client
            .from('rankings')
            .update({ student_code: newCode })
            .eq('student_id', studentId);
            
        if (updateError) throw updateError;
        
        currentProfileStudent.student_code = newCode;
        renderStudentProfile(); 
        
        closeEditStudentCodeModal();
        showToast(`✅ کد ورود به <strong>${newCode}</strong> تغییر کرد.`, 'success');
        vibrate(30);
        
    } catch (error) {
        console.error('خطا در تغییر کد:', error);
        showToast('خطا در تغییر کد. لطفاً دوباره تلاش کنید.', 'error');
    }
}

function openEditCompletedLessons() { if (!currentProfileStudent) return; showToast('به زودی', 'info'); }

function playDingSound() {
    try {
        const a = new (window.AudioContext || window.webkitAudioContext)();
        const n = a.currentTime;
        [880, 1108.73].forEach((f, i) => {
            const o = a.createOscillator(); const g = a.createGain();
            o.type = 'sine'; o.frequency.value = f;
            g.gain.setValueAtTime(0, n + i * 0.15);
            g.gain.linearRampToValueAtTime(0.3, n + i * 0.15 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, n + i * 0.15 + 0.4);
            o.connect(g); g.connect(a.destination);
            o.start(n + i * 0.15); o.stop(n + i * 0.15 + 0.4);
        });
        setTimeout(() => { try { a.close(); } catch(e) {} }, 1000);
    } catch (e) {}
}

function showTeacherInAppNotification(sname, msg, sid) {
    document.querySelectorAll('.inapp-notification').forEach(n => n.remove());
    const n = document.createElement('div');
    n.className = 'inapp-notification';
    n.innerHTML = `<div class="inapp-icon">💬</div><div class="inapp-content"><div class="inapp-title">پیام از ${escapeHTML(sname)}</div><div class="inapp-text">${escapeHTML((msg || '').substring(0, 60))}${(msg || '').length > 60 ? '...' : ''}</div></div>`;
    n.onclick = () => {
        n.remove();
        navigateToPage('messages', true);
        setTimeout(() => {
            switchMessagesTab('personal');
            setTimeout(() => { const cv = currentConversations.find(c => c.student_id === sid); if (cv) openChatWith(sid, cv.student_name, cv.class_name); }, 400);
        }, 300);
    };
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 50);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 400); }, 6000);
}

function switchMessagesTab(tab) {
    document.querySelectorAll('.messages-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.messages-tab-content').forEach(c => c.classList.remove('active'));
    const t = document.querySelector(`.messages-tab-btn[data-tab="${tab}"]`);
    if (t) t.classList.add('active');
    const c = document.getElementById('tab-' + tab);
    if (c) c.classList.add('active');
    if (tab === 'personal') loadStudentConversations(); else if (tab === 'class') loadClassMessages();
}

async function sendClassMessage() {
    const cn = document.getElementById('class-message-target').value;
    const ti = document.getElementById('class-message-title').value.trim();
    const tx = document.getElementById('class-message-text').value.trim();
    const ty = document.getElementById('class-message-type').value;
    if (!ti) { showToast('عنوان را وارد کنید', 'warning'); return; }
    if (!tx) { showToast('متن پیام را وارد کنید', 'warning'); return; }
    const d = { message_id: 'cls_' + Date.now(), class_name: cn, title: ti, text: tx, type: ty, date: new Date().toISOString(), date_persian: new Date().toLocaleDateString('fa-IR') };
    try {
        showToast('در حال ارسال...', 'info');
        const r = await sendClassMessageToSupabase(d);
        if (r.success) {
            showToast('پیام ارسال شد! ✅', 'success');
            document.getElementById('class-message-title').value = '';
            document.getElementById('class-message-text').value = '';
            localStorage.removeItem(CLASS_MESSAGES_CACHE_KEY);
            setTimeout(loadClassMessages, 500);
        } else showToast('خطا', 'error');
    } catch (e) { showToast('خطا', 'error'); }
}

async function loadClassMessages() {
    const c = document.getElementById('class-messages-list');
    if (!c) return;
    const ca = getCachedData(CLASS_MESSAGES_CACHE_KEY);
    if (ca && ca.length > 0) renderClassMessages(ca);
    else c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const m = await getClassMessagesFromSupabase('all');
        setCachedData(CLASS_MESSAGES_CACHE_KEY, m);
        renderClassMessages(m);
    } catch (e) { if (!ca) c.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderClassMessages(messages) {
    const c = document.getElementById('class-messages-list');
    if (!c) return;
    if (!messages || messages.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز پیام کلاسی ارسال نشده</div>'; return; }
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tt = { info: 'ℹ️ اطلاعیه', warning: '⚠️ هشدار', success: '✅ تبریک', reminder: '🔔 یادآوری' };
    let h = '';
    messages.forEach(m => {
        h += `<div class="class-message-item type-${m.type || 'info'}"><div class="class-message-item-header"><div class="class-message-item-title">${escapeHTML(m.title)}</div><div class="class-message-item-type">${tt[m.type] || 'ℹ️'}</div></div><div class="class-message-item-text">${escapeHTML(m.text)}</div><div class="class-message-item-footer"><div class="class-message-item-target">👥 ${getClassPersianName(m.class_name)}</div><div>${m.date_persian || ''}</div></div></div>`;
    });
    c.innerHTML = h;
}

async function loadStudentConversations() {
    const c = document.getElementById('messenger-list-items');
    if (!c) return;
    const ca = getCachedData(CONVERSATIONS_CACHE_KEY);
    if (ca && ca.length > 0) {
        currentConversations = ca;
        currentConversations.forEach(x => { x.unread_count = computeUnreadForConversation(x); });
        renderMessengerList(currentConversations);
    } else c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const co = await getStudentConversationsFromSupabase();
        co.forEach(x => { x.unread_count = computeUnreadForConversation(x); });
        currentConversations = co;
        setCachedData(CONVERSATIONS_CACHE_KEY, co);
        if (co.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز مکالمه‌ای وجود نداره</div>'; return; }
        renderMessengerList(currentConversations);
        updateHomeBadgesImmediately();
    } catch (e) { if (!ca) c.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderMessengerList(convs) {
    const c = document.getElementById('messenger-list-items');
    if (!c) return;
    if (convs.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">مکالمه‌ای یافت نشد</div>'; return; }
    let h = '';
    convs.forEach(x => {
        const a = currentChatStudent && currentChatStudent.student_id === x.student_id;
        const av = renderAvatarHTML(x);
        const u = x.unread_count || 0;
        h += `<div class="messenger-item ${a ? 'active' : ''}" onclick="openChatWith('${escapeHTML(x.student_id)}', '${escapeHTML(x.student_name)}', '${escapeHTML(x.class_name)}')"><div class="messenger-item-avatar">${av}</div><div class="messenger-item-info"><div class="messenger-item-name">${escapeHTML(x.student_name)}</div><div class="messenger-item-last">${escapeHTML(x.last_message || 'بدون پیام')}</div></div><div class="messenger-item-meta"><div class="messenger-item-time">${x.last_date_persian || ''}</div>${u > 0 ? `<div class="messenger-item-unread">${toPersianNum(u)}</div>` : ''}</div></div>`;
    });
    c.innerHTML = h;
}

function filterMessengerList(q) {
    q = q.toLowerCase().trim();
    if (!q) { renderMessengerList(currentConversations); return; }
    const f = currentConversations.filter(c => (c.student_name || '').toLowerCase().includes(q));
    renderMessengerList(f);
}

async function openChatWith(sid, sname, cname) {
    currentChatStudent = { student_id: sid, student_name: sname, class_name: cname };
    document.getElementById('messenger-empty').style.display = 'none';
    document.getElementById('messenger-list').style.display = 'none';
    document.getElementById('messenger-chat').style.display = 'flex';
    document.getElementById('messenger-chat-name').textContent = sname;
    document.getElementById('messenger-chat-status').textContent = getClassPersianName(cname);
    const av = document.getElementById('messenger-chat-avatar');
    const cv = currentConversations.find(c => c.student_id === sid);
    if (cv) av.innerHTML = renderAvatarHTML(cv);
    else av.innerHTML = `<img src="${DEFAULT_AVATAR_URL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    setReadTime(sid);
    const ci = currentConversations.findIndex(c => c.student_id === sid);
    if (ci >= 0) {
        currentConversations[ci].unread_count = 0;
        setCachedData(CONVERSATIONS_CACHE_KEY, currentConversations);
        renderMessengerList(currentConversations);
    }
    updateHomeBadgesImmediately();
    await loadChatMessages(sid);
    markAllMessagesAsSeenSupabase(sid, 'teacher').catch(() => {});
}

function closeMessengerChat() {
    document.getElementById('messenger-empty').style.display = 'flex';
    document.getElementById('messenger-list').style.display = 'flex';
    document.getElementById('messenger-chat').style.display = 'none';
    currentChatStudent = null;
    loadStudentConversations();
}

async function loadChatMessages(sid) {
    const c = document.getElementById('messenger-chat-messages');
    if (!c) return;
    const ck = 'teacherMessagesCache_' + sid;
    const ca = getCachedData(ck);
    if (ca && ca.length > 0) renderChatMessages(ca);
    else c.innerHTML = '<div class="messenger-chat-messages-empty">در حال بارگذاری...</div>';
    try {
        const m = await getPersonalMessages(sid);
        if (m.length === 0) { c.innerHTML = '<div class="messenger-chat-messages-empty">هنوز پیامی رد و بدل نشده<br>اولین پیام رو بفرست!</div>'; return; }
        m.sort((a, b) => new Date(a.date) - new Date(b.date));
        setCachedData(ck, m);
        renderChatMessages(m);
    } catch (e) { if (!ca) c.innerHTML = '<div class="messenger-chat-messages-empty">خطا</div>'; }
}

function renderChatMessages(messages) {
    const c = document.getElementById('messenger-chat-messages');
    if (!c) return;
    let h = '';
    messages.forEach(m => {
        const sc = m.sender === 'teacher' ? 'teacher' : 'student';
        const t = m.date_persian || '';
        let th = '';
        if (sc === 'teacher') {
            const is = m.is_seen === true || m.is_seen === 'true' || m.is_seen === 1;
            th = is ? `<span class="chat-tick chat-tick-seen">✓✓</span>` : `<span class="chat-tick">✓</span>`;
        }
        h += `<div class="messenger-chat-message ${sc}"><div>${escapeHTML(m.text)}</div><div class="messenger-chat-message-time">${t}${th}</div></div>`;
    });
    c.innerHTML = h;
    c.scrollTop = c.scrollHeight;
}

async function sendChatMessage() {
    if (!currentChatStudent) return;
    const i = document.getElementById('messenger-chat-input');
    const tx = i.value.trim();
    if (!tx) return;
    const d = {
        message_id: 'pm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        student_id: currentChatStudent.student_id, student_name: currentChatStudent.student_name,
        class_name: currentChatStudent.class_name, sender: 'teacher', text: tx,
        date: new Date().toISOString(), date_persian: new Date().toLocaleDateString('fa-IR'), is_seen: false
    };
    try {
        i.value = '';
        const c = document.getElementById('messenger-chat-messages');
        const t = d.date_persian;
        const e = c.querySelector('.messenger-chat-messages-empty');
        if (e) e.remove();
        const el = document.createElement('div');
        el.className = 'messenger-chat-message teacher';
        el.innerHTML = `<div>${escapeHTML(tx)}</div><div class="messenger-chat-message-time">${t}<span class="chat-tick">✓</span></div>`;
        c.appendChild(el);
        c.scrollTop = c.scrollHeight;
        const ck = 'teacherMessagesCache_' + currentChatStudent.student_id;
        const ca = getCachedData(ck) || [];
        ca.push(d);
        setCachedData(ck, ca);
        await sendPersonalMessageToSupabase(d);
        setReadTime(currentChatStudent.student_id);
    } catch (e) { showToast('خطا', 'error'); }
}

console.log('🎓 پنل معلم - نسخه ۳۸.۰.۰ (بدون قابلیت حذف کارنامه)');