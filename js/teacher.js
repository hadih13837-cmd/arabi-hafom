// ============================================================
// teacher.js — پنل معلم با Supabase
// نسخه: ۲۹.۰.۰ — طراحی جدید مدیریت تکالیف
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

function vibrate(pattern = 30) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

function toPersianNum(num) {
    if (num === null || num === undefined) return '۰';
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/\d/g, x => persianDigits[parseInt(x)]);
}

function fromPersianNum(str) {
    return String(str).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

function getClassPersianName(slug) {
    const map = {
        'hafom-1': 'هفتم یک', 'hafom-2': 'هفتم دو', 'hafom-3': 'هفتم سه',
        'hafom-4': 'هفتم چهار', 'hafom-5': 'هفتم پنج', 'all': 'همه کلاس‌ها'
    };
    return map[slug] || slug || 'نامشخص';
}

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

function getTotalCompletedLessons(student) {
    if (!student) return 0;
    return parseInt(student.completed_lessons) || 0;
}

function getReadTimes() { try { return JSON.parse(localStorage.getItem(READ_TIMES_KEY) || '{}'); } catch (e) { return {}; } }
function getReadTime(studentId) { return getReadTimes()[studentId] || 0; }
function setReadTime(studentId) {
    const times = getReadTimes();
    times[studentId] = Date.now();
    localStorage.setItem(READ_TIMES_KEY, JSON.stringify(times));
}

function getReadLessons() { try { return JSON.parse(localStorage.getItem(READ_LESSONS_KEY) || '{}'); } catch (e) { return {}; } }
function isLessonReportSeen(reportId) { return getReadLessons()[reportId] === true; }
function markLessonReportAsSeen(reportId) {
    const seen = getReadLessons();
    seen[reportId] = true;
    localStorage.setItem(READ_LESSONS_KEY, JSON.stringify(seen));
}
function markAllLessonsAsSeen() {
    const seen = getReadLessons();
    allReportsRaw.forEach(r => { seen[r.id] = true; });
    localStorage.setItem(READ_LESSONS_KEY, JSON.stringify(seen));
    renderStudents(getFilteredStudents());
    updateHomeBadgesImmediately();
    showToast('همه اعلان‌ها دیده شدند', 'success');
}

function computeUnreadForConversation(conv) {
    if (conv.last_sender === 'teacher') return 0;
    const readTime = getReadTime(conv.student_id);
    if (readTime > 0 && conv.last_message_time) {
        const lastMsgTime = new Date(conv.last_message_time).getTime();
        if (lastMsgTime <= readTime) return 0;
    }
    return parseInt(conv.unread_count) || 0;
}

function getCachedData(key, duration = MESSAGES_CACHE_DURATION) {
    try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (cached && (Date.now() - cached.timestamp < duration)) return cached.data;
        return null;
    } catch (e) { return null; }
}
function setCachedData(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ data: data, timestamp: Date.now() })); } catch (e) {}
}

function renderAvatarHTML(student) {
    const avatarUrl = (student && student.avatar_url) ? String(student.avatar_url).trim() : '';
    if (!avatarUrl || avatarUrl === '' || avatarUrl === 'null' || avatarUrl === 'undefined' || avatarUrl === 'default') {
        return `<img src="${DEFAULT_AVATAR_URL}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '').trim();
        if (!emoji || emoji === '👤' || emoji === '👦🏻' || emoji === '👦') {
            return `<img src="${DEFAULT_AVATAR_URL}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        }
        return `<span>${emoji}</span>`;
    }
    if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
    if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="" onerror="this.src='${DEFAULT_AVATAR_URL}'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
    return `<img src="${DEFAULT_AVATAR_URL}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
}

async function loadAllReportsForBadges() {
    try {
        const client = getSupabase();
        if (!client) return;
        const { data, error } = await client.from('reports').select('*').order('created_at', { ascending: false });
        if (error) return;
        allReportsRaw = data || [];
        allReportsMap = {};
        allReportsRaw.forEach(r => {
            if (!allReportsMap[r.student_id]) allReportsMap[r.student_id] = [];
            allReportsMap[r.student_id].push(r.lesson_id);
        });
    } catch (e) { console.error(e); }
}

function countUnreadLessonReports() {
    let count = 0;
    const seen = getReadLessons();
    allReportsRaw.forEach(r => {
        if (!seen[r.id]) count++;
    });
    return count;
}

async function getLessonStatusForStudent(studentId) {
    try {
        const client = getSupabase();
        if (!client) return {};
        const { data, error } = await client.from('lesson_status').select('*').eq('student_id', studentId);
        if (error) return {};
        const statusMap = {};
        (data || []).forEach(item => {
            statusMap[item.lesson_id] = { is_enabled: item.is_enabled !== false, custom_due_date: item.custom_due_date || null, id: item.id };
        });
        return statusMap;
    } catch (error) { return {}; }
}

async function updateLessonStatus(studentId, lessonId, updates) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        const { data: existing } = await client.from('lesson_status').select('id').eq('student_id', studentId).eq('lesson_id', lessonId).maybeSingle();
        if (existing) {
            const { error } = await client.from('lesson_status').update(updates).eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await client.from('lesson_status').insert({
                student_id: studentId, lesson_id: lessonId,
                is_enabled: updates.is_enabled !== undefined ? updates.is_enabled : true,
                custom_points: 0, custom_due_date: updates.custom_due_date || null
            });
            if (error) throw error;
        }
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getStudentReports(studentId) {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('reports').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

function calculateTotalPoints(student) {
    const basePoints = parseInt(student.total_points) || 0;
    const customAdded = parseInt(student.custom_points_added) || 0;
    const customTotal = parseInt(student.custom_total_points) || 0;
    return basePoints + customAdded + customTotal;
}

function checkPassword() {
    const input = document.getElementById('login-password').value.trim();
    const savedPassword = localStorage.getItem(TEACHER_PASSWORD_KEY) || DEFAULT_PASSWORD;
    if (input === savedPassword) {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-panel').classList.add('active');
        localStorage.setItem('teacherLoggedIn', 'true');
        pageHistory = ['home'];
        navigateToPage('home', false);
        try { history.replaceState({ teacherPage: 'home' }, '', '#home'); } catch (e) {}
        setTimeout(() => {
            const apiInput = document.getElementById('setting-api-url');
            if (apiInput && typeof SUPABASE_URL !== 'undefined') apiInput.value = SUPABASE_URL;
        }, 500);
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
        setTimeout(() => {
            const apiInput = document.getElementById('setting-api-url');
            if (apiInput && typeof SUPABASE_URL !== 'undefined') apiInput.value = SUPABASE_URL;
        }, 500);
        setTimeout(() => {
            updateHomeBadgesImmediately();
            startConversationsRealtime();
        }, 1000);
    }
    const loginInput = document.getElementById('login-password');
    if (loginInput) {
        loginInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkPassword(); });
    }
});

function startConversationsRealtime() {
    if (conversationsChannel) return;
    if (typeof subscribeToConversations !== 'function') return;
    conversationsChannel = subscribeToConversations(async (payload) => {
        if (payload.table === 'reports' && payload.eventType === 'INSERT') {
            await loadAllReportsForBadges();
            const activeScreen = document.querySelector('.page.active');
            if (activeScreen && activeScreen.id === 'page-students') {
                renderStudents(getFilteredStudents());
            }
            updateHomeBadgesImmediately();
        }
        const conversations = await getStudentConversationsFromSupabase();
        conversations.forEach(conv => { conv.unread_count = computeUnreadForConversation(conv); });
        currentConversations = conversations;
        setCachedData(CONVERSATIONS_CACHE_KEY, conversations);
        const activeScreen = document.querySelector('.page.active');
        if (activeScreen && activeScreen.id === 'page-messages') {
            const activeTab = document.querySelector('.messages-tab-btn.active');
            if (activeTab && activeTab.dataset.tab === 'personal' && !currentChatStudent) {
                renderMessengerList(currentConversations);
            }
        }
        updateHomeBadgesImmediately();
        if (payload.eventType === 'INSERT' && payload.new && payload.new.sender === 'student') {
            playDingSound();
            vibrate([30, 50, 30]);
            showTeacherInAppNotification(payload.new.student_name || 'دانش‌آموز', payload.new.text, payload.new.student_id);
        }
        if (currentChatStudent && payload.new && currentChatStudent.student_id === payload.new.student_id) {
            await loadChatMessages(currentChatStudent.student_id);
        }
    });
}

function stopAllRealtime() {
    if (conversationsChannel) {
        try { const client = getSupabase(); if (client) client.removeChannel(conversationsChannel); } catch(e) {}
        conversationsChannel = null;
    }
}

const PAGE_HASH_MAP = {
    'home': '#home', 'students': '#students', 'rankings': '#rankings', 'messages': '#messages',
    'lessons': '#lessons', 'calendar': '#calendar', 'contests': '#contests', 'library': '#library',
    'reports': '#reports', 'settings': '#settings', 'student-profile': '#student-profile'
};

function pushTeacherHistory(pageId) {
    try { history.pushState({ teacherPage: pageId }, '', PAGE_HASH_MAP[pageId] || ('#' + pageId)); } catch (e) {}
}

function navigateToPage(pageId, addToHistory = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');
    
    if (addToHistory) {
        if (pageHistory[pageHistory.length - 1] !== pageId) pageHistory.push(pageId);
        pushTeacherHistory(pageId);
    }
    
    const backBtn = document.getElementById('header-back-btn');
    if (backBtn) backBtn.style.display = pageId === 'home' ? 'none' : 'flex';
    
    const titles = { home: 'خانه', students: 'دانش‌آموزان', rankings: 'رتبه‌بندی', messages: 'پیام‌رسانی', lessons: 'مدیریت تکالیف', calendar: 'تقویم', contests: 'مسابقات', library: 'کتابخانه', reports: 'گزارش‌ها', settings: 'تنظیمات', 'student-profile': 'پروفایل دانش‌آموز' };
    const icons = { home: '🏠', students: '👥', rankings: '🏆', messages: '💬', lessons: '📚', calendar: '📅', contests: '🎯', library: '📖', reports: '📄', settings: '⚙️', 'student-profile': '👤' };
    
    const titleEl = document.getElementById('panel-page-title');
    const iconEl = document.getElementById('header-icon');
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
    const loginScreen = document.getElementById('login-screen');
    const mainPanel = document.getElementById('main-panel');
    if (loginScreen && loginScreen.classList.contains('active')) return;
    if (!mainPanel || !mainPanel.classList.contains('active')) return;
    const targetPage = event.state && event.state.teacherPage ? event.state.teacherPage : null;
    const activePage = document.querySelector('.page.active');
    const currentPageId = activePage ? activePage.id.replace('page-', '') : 'home';
    
    if (targetPage === currentPageId) {
        if (currentPageId === 'home') {
            if (confirm('آیا می‌خواهید از پنل معلم خارج شوید؟')) logout();
            else pushTeacherHistory('home');
        }
        return;
    }
    if (!targetPage) {
        if (currentPageId !== 'home') { navigateToPageSilent('home'); pushTeacherHistory('home'); }
        else { if (confirm('آیا می‌خواهید از پنل معلم خارج شوید؟')) logout(); else pushTeacherHistory('home'); }
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
    const titles = { home: 'خانه', students: 'دانش‌آموزان', rankings: 'رتبه‌بندی', messages: 'پیام‌رسانی', lessons: 'مدیریت تکالیف', calendar: 'تقویم', contests: 'مسابقات', library: 'کتابخانه', reports: 'گزارش‌ها', settings: 'تنظیمات', 'student-profile': 'پروفایل دانش‌آموز' };
    const icons = { home: '🏠', students: '👥', rankings: '🏆', messages: '💬', lessons: '📚', calendar: '📅', contests: '🎯', library: '📖', reports: '📄', settings: '⚙️', 'student-profile': '👤' };
    const titleEl = document.getElementById('panel-page-title');
    const iconEl = document.getElementById('header-icon');
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
    if (!currentConversations || currentConversations.length === 0) return 0;
    let total = 0;
    currentConversations.forEach(conv => { total += computeUnreadForConversation(conv); });
    return total;
}

function updateHomeBadgesImmediately() {
    const cached = getCachedData(CONVERSATIONS_CACHE_KEY);
    if (cached) currentConversations = cached;
    const totalUnread = computeTotalUnread();
    const msgStat = document.getElementById('home-stat-messages');
    if (msgStat) msgStat.textContent = toPersianNum(totalUnread);
    const badge = document.getElementById('home-badge-messages');
    if (badge) {
        if (totalUnread > 0) { badge.textContent = toPersianNum(totalUnread); badge.style.display = 'block'; }
        else badge.style.display = 'none';
    }
    const tabBadge = document.getElementById('personal-unread-badge');
    if (tabBadge) {
        if (totalUnread > 0) { tabBadge.textContent = toPersianNum(totalUnread); tabBadge.style.display = 'block'; }
        else tabBadge.style.display = 'none';
    }
    const unreadLessons = countUnreadLessonReports();
    const studentBadge = document.getElementById('home-badge-students');
    if (studentBadge) {
        if (unreadLessons > 0) { studentBadge.textContent = toPersianNum(unreadLessons); studentBadge.style.display = 'flex'; }
        else studentBadge.style.display = 'none';
    }
}

async function loadHomeData() {
    try {
        const cachedStudents = getCachedData(STUDENTS_CACHE_KEY);
        const cachedConvs = getCachedData(CONVERSATIONS_CACHE_KEY);
        if (cachedStudents && cachedStudents.length > 0) {
            allStudents = cachedStudents;
            document.getElementById('home-stat-students').textContent = toPersianNum(cachedStudents.length);
            document.getElementById('home-stat-lessons').textContent = toPersianNum(cachedStudents.reduce((sum, s) => sum + getTotalCompletedLessons(s), 0));
            renderHomeTopStudents(cachedStudents);
        }
        if (cachedConvs && cachedConvs.length > 0) { currentConversations = cachedConvs; updateHomeBadgesImmediately(); }
        await loadAllReportsForBadges();
        const [students, conversations] = await Promise.all([getAllStudents(), getStudentConversationsFromSupabase()]);
        if (students && students.length > 0) {
            allStudents = students;
            setCachedData(STUDENTS_CACHE_KEY, students);
            document.getElementById('home-stat-students').textContent = toPersianNum(students.length);
            document.getElementById('home-stat-lessons').textContent = toPersianNum(students.reduce((sum, s) => sum + getTotalCompletedLessons(s), 0));
            renderHomeTopStudents(students);
        }
        if (conversations && conversations.length > 0) {
            conversations.forEach(conv => { conv.unread_count = computeUnreadForConversation(conv); });
            currentConversations = conversations;
            setCachedData(CONVERSATIONS_CACHE_KEY, conversations);
        }
        updateHomeBadgesImmediately();
    } catch (error) { console.error('Error:', error); }
}

function renderHomeTopStudents(students) {
    const container = document.getElementById('home-top-students');
    if (!container) return;
    const top = [...students].sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a)).slice(0, 5);
    if (top.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز دانش‌آموزی ثبت‌نام نکرده</div>'; return; }
    let html = '';
    top.forEach((student, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : toPersianNum(rank);
        const totalLessons = getTotalCompletedLessons(student);
        html += `<div class="home-top-item" onclick="openStudentProfile('${student.student_id}')"><div class="home-top-rank">${medal}</div><div class="home-top-avatar">${renderAvatarHTML(student)}</div><div class="home-top-info"><div class="home-top-name">${student.name || 'دانش‌آموز'}</div><div class="home-top-class">${getClassPersianName(student.class_name)} • ${toPersianNum(totalLessons)} تکلیف</div></div><div class="home-top-points"><span>⭐</span><span>${toPersianNum(calculateTotalPoints(student))}</span></div></div>`;
    });
    container.innerHTML = html;
}

// (توابع پیام‌رسانی: switchMessagesTab, sendClassMessage, loadClassMessages, renderClassMessages, loadStudentConversations, renderMessengerList, filterMessengerList, openChatWith, closeMessengerChat, loadChatMessages, renderChatMessages, sendChatMessage, showTeacherInAppNotification, playDingSound - بدون تغییر از نسخه قبلی کپی کن)

async function loadStudents() {
    const container = document.getElementById('students-grid');
    if (!container) return;
    const cached = getCachedData(STUDENTS_CACHE_KEY);
    if (cached && cached.length > 0) {
        allStudents = cached;
        await loadAllReportsForBadges();
        renderStudents(getFilteredStudents());
    } else {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    }
    try {
        const students = await getAllStudents();
        allStudents = students;
        setCachedData(STUDENTS_CACHE_KEY, allStudents);
        await loadAllReportsForBadges();
        renderStudents(getFilteredStudents());
        updateHomeBadgesImmediately();
    } catch (error) { if (!cached) container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function getFilteredStudents() {
    let filtered = [...allStudents];
    if (currentStudentClassFilter !== 'all') filtered = filtered.filter(s => s.class_name === currentStudentClassFilter);
    const query = document.getElementById('student-search')?.value?.toLowerCase().trim() || '';
    if (query) filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(query) || (s.student_code || '').includes(query));
    return filtered;
}

function filterStudentsByClass(className, btn) {
    currentStudentClassFilter = className;
    document.querySelectorAll('.class-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderStudents(getFilteredStudents());
}

function filterStudents() { renderStudents(getFilteredStudents()); }

function renderStudents(students) {
    const container = document.getElementById('students-grid');
    if (!container) return;
    if (students.length === 0) { container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">دانش‌آموزی یافت نشد</div>'; return; }
    const seen = getReadLessons();
    students.sort((a, b) => {
        const aLatest = allReportsRaw.find(r => r.student_id === a.student_id);
        const bLatest = allReportsRaw.find(r => r.student_id === b.student_id);
        const aUnread = aLatest && !seen[aLatest.id];
        const bUnread = bLatest && !seen[bLatest.id];
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;
        return 0;
    });
    let html = '';
    students.forEach(student => {
        const studentCode = student.student_code || '---';
        const totalLessons = getTotalCompletedLessons(student);
        const completedLessonIds = allReportsMap[student.student_id] || [];
        const hasCompletedAny = completedLessonIds.length > 0;
        const latestReport = allReportsRaw.find(r => r.student_id === student.student_id);
        let hasUnreadLesson = false;
        if (latestReport && !isLessonReportSeen(latestReport.id)) hasUnreadLesson = true;
        let badgesHTML = '';
        if (hasUnreadLesson) badgesHTML += `<div class="student-notif-badge">🔔 اعلان</div>`;
        else if (hasCompletedAny) badgesHTML += `<div class="student-done-badge">✅</div>`;
        const onClickHandler = latestReport ? `markAndOpenProfile('${student.student_id}', '${latestReport.id}')` : `openStudentProfile('${student.student_id}')`;
        html += `<div class="student-card ${hasUnreadLesson ? 'has-new-lesson' : (hasCompletedAny ? 'has-done-lesson' : '')}" onclick="${onClickHandler}">${badgesHTML}<div class="student-avatar">${renderAvatarHTML(student)}</div><div class="student-info"><div class="student-name">${student.name || 'بدون نام'}</div><span class="student-class">${getClassPersianName(student.class_name)}</span><div class="student-stats"><span>🔑 ${studentCode}</span><span>📚 ${toPersianNum(totalLessons)} تکلیف</span></div></div><div class="student-points"><span>⭐</span><span>${toPersianNum(calculateTotalPoints(student))}</span></div></div>`;
    });
    container.innerHTML = html;
}

function markAndOpenProfile(studentId, reportId) {
    markLessonReportAsSeen(reportId);
    openStudentProfile(studentId);
    updateHomeBadgesImmediately();
    setTimeout(() => { renderStudents(getFilteredStudents()); }, 500);
}

// ============================================================
// پروفایل دانش‌آموز
// ============================================================
async function openStudentProfile(studentId) {
    let student = allStudents.find(s => s.student_id === studentId);
    if (!student) { showToast('دانش‌آموز پیدا نشد', 'error'); return; }
    currentProfileStudent = student;
    vibrate(15);
    const content = document.getElementById('student-profile-content');
    if (content) content.innerHTML = '<div style="text-align:center; padding:60px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    navigateToPage('student-profile', true);
    try {
        const client = getSupabase();
        if (client) {
            const { data: freshData } = await client.from('rankings').select('*').eq('student_id', studentId).maybeSingle();
            if (freshData) { currentProfileStudent = freshData; const idx = allStudents.findIndex(s => s.student_id === studentId); if (idx >= 0) allStudents[idx] = freshData; }
        }
        const response = await fetch('./lessons/index.json');
        const data = await response.json();
        currentProfileLessons = data.lessons || [];
        currentProfileStatus = await getLessonStatusForStudent(studentId);
        currentProfileReports = await getStudentReports(studentId);
        renderStudentProfile();
    } catch (error) { if (content) content.innerHTML = '<div style="text-align:center; padding:60px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function isLessonExpiredForStudent(lesson, customDueDate) {
    const displayDueDate = customDueDate || lesson.dueDate || 'نامشخص';
    if (displayDueDate === 'نامشخص') return false;
    const today = new Date();
    const persianDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
    return persianDateToNum(persianDate) > persianDateToNum(displayDueDate);
}

function persianDateToNum(dateStr) {
    if (!dateStr || dateStr === 'نامشخص') return 0;
    const normalized = String(dateStr).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    const parts = normalized.split(/[\/\-]/);
    if (parts.length !== 3) return 0;
    return parseInt(parts[0]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[2]);
}

function renderStudentProfile() {
    const container = document.getElementById('student-profile-content');
    if (!container || !currentProfileStudent) return;
    const student = currentProfileStudent;
    const totalPoints = calculateTotalPoints(student);
    const classPersian = getClassPersianName(student.class_name);
    const studentCode = student.student_code || '---';
    const completedLessons = getTotalCompletedLessons(student);

    const reportMap = {};
    currentProfileReports.forEach(r => { if (!reportMap[r.lesson_id]) reportMap[r.lesson_id] = r; });

    let lessonsHTML = '';
    currentProfileLessons.forEach(lesson => {
        const status = currentProfileStatus[lesson.id] || { is_enabled: true, custom_due_date: null };
        const isEnabled = status.is_enabled !== false;
        const customDueDate = status.custom_due_date || null;
        const report = reportMap[lesson.id];
        const isDone = !!report;
        const displayDueDate = customDueDate || lesson.dueDate || 'نامشخص';
        const isCustom = !!customDueDate;
        const isExpired = isLessonExpiredForStudent(lesson, customDueDate);

        let reportHTML = '';
        if (isDone) {
            reportHTML = `<div class="profile-lesson-report done"><div class="report-row"><span class="report-label">✅ انجام شده</span><span class="report-value-percent">${toPersianNum(report.percent || 0)}%</span></div><div class="report-row"><span class="report-label">امتیاز:</span><span class="report-value-points">${toPersianNum(report.score || 0)} از ${toPersianNum(report.total_points || 0)}</span></div></div>`;
        } else if (isExpired && !isCustom) {
            reportHTML = `<div class="profile-lesson-report pending"><span class="report-badge" style="background:linear-gradient(135deg,#ffcdd2,#ef9a9a);color:#b71c1c;">⏰ منقضی شده</span></div>`;
        } else {
            reportHTML = `<div class="profile-lesson-report pending"><span class="report-badge pending">⏳ انجام نشده</span></div>`;
        }

        const toggleHTML = `<div class="profile-lesson-toggle"><span class="toggle-label ${isEnabled ? 'enabled' : 'disabled'}">${isEnabled ? '🟢 فعال' : '🔴 غیرفعال'}</span><label class="switch-small"><input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleLessonEnabled('${lesson.id}', this.checked)"><span class="slider-small"></span></label></div>`;
        
        const dueDateHTML = `<div class="profile-lesson-duedate"><div class="due-date-info"><span class="due-date-label">📅 مهلت:</span><span class="due-date-value ${isCustom ? 'custom' : (isExpired ? 'expired' : '')}">${displayDueDate}</span>${isCustom ? '<span class="custom-badge">سفارشی</span>' : ''}${isExpired && !isCustom ? '<span class="expired-badge">منقضی</span>' : ''}</div><button class="edit-date-btn" onclick="openDueDateEditor('${lesson.id}', '${displayDueDate}', ${isCustom})">✏️ ${isCustom ? 'ویرایش' : 'تمدید'}</button></div>`;

        lessonsHTML += `<div class="profile-lesson-item ${!isEnabled ? 'disabled' : ''} ${isDone ? 'done' : ''}"><div class="profile-lesson-header"><div class="profile-lesson-title">${lesson.title}</div>${isDone ? '<span class="lesson-done-badge">✓</span>' : ''}</div><div class="profile-lesson-meta"><span>📝 ${toPersianNum(lesson.activityCount || 0)} سوال</span></div>${dueDateHTML}${reportHTML}${toggleHTML}</div>`;
    });

    if (currentProfileLessons.length === 0) lessonsHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">تکلیفی یافت نشد</div>';

    container.innerHTML = `<div class="profile-header-card"><div class="profile-avatar-big">${renderAvatarHTML(student)}</div><div class="profile-name-big">${student.name || 'بدون نام'}</div><div class="profile-class-big">${classPersian}</div></div><div class="profile-stats-grid"><div class="profile-stat-card" onclick="openEditStudentCode()" style="cursor:pointer;"><div class="profile-stat-icon">🔑</div><div class="profile-stat-value">${studentCode}</div><div class="profile-stat-label">کد ورود (کلیک کن)</div></div><div class="profile-stat-card" onclick="openEditCompletedLessons()" style="cursor:pointer;"><div class="profile-stat-icon">📚</div><div class="profile-stat-value">${toPersianNum(completedLessons)}</div><div class="profile-stat-label">تکالیف (کلیک کن)</div></div><div class="profile-stat-card"><div class="profile-stat-icon">📊</div><div class="profile-stat-value">${toPersianNum(student.avg_percent || 0)}%</div><div class="profile-stat-label">میانگین درصد</div></div><div class="profile-stat-card"><div class="profile-stat-icon">🔥</div><div class="profile-stat-value">${toPersianNum(student.streak_days || 0)}</div><div class="profile-stat-label">روز متوالی</div></div></div><button class="profile-chat-btn" onclick="goToChatFromProfile()">💬 چت با این دانش‌آموز</button><div class="profile-total-points-card"><div class="profile-total-points-label">⭐ امتیاز کل (قابل ویرایش)</div><div class="profile-total-points-value">${toPersianNum(totalPoints)}</div><div class="profile-total-points-actions"><button class="point-btn minus" onclick="changeTotalPoints(-10)">−۱۰</button><button class="point-btn minus" onclick="changeTotalPoints(-1)">−۱</button><button class="point-btn plus" onclick="changeTotalPoints(1)">+۱</button><button class="point-btn plus" onclick="changeTotalPoints(10)">+۱۰</button></div></div><div class="profile-lessons-card"><div class="profile-lessons-title">📚 مدیریت تکالیف</div><div class="profile-lessons-list">${lessonsHTML}</div></div>`;
}

// ============================================================
// 🆕 مدیریت تکالیف — طراحی جدید گرافیکی
// ============================================================
async function loadLessonsPage() {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    const cached = getCachedData(LESSONS_CACHE_KEY, 600000);
    if (cached && cached.length > 0) {
        allLessonsList = cached;
        await loadLessonStatuses();
        renderLessonsList(cached);
    } else {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    }
    try {
        const response = await fetch('./lessons/index.json');
        const data = await response.json();
        const lessons = data.lessons || [];
        allLessonsList = lessons;
        setCachedData(LESSONS_CACHE_KEY, lessons);
        await loadLessonStatuses();
        renderLessonsList(lessons);
    } catch (error) { if (!cached) container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

async function loadLessonStatuses() {
    try {
        const client = getSupabase();
        if (!client) return;
        const { data, error } = await client.from('lesson_status').select('*').is('student_id', null);
        if (error) { console.warn('خطا در لود وضعیت:', error); return; }
        allLessonStatuses = data || [];
        console.log('📋 وضعیت‌های کلاسی لود شد:', allLessonStatuses.length);
    } catch (e) { console.error(e); }
}

function renderLessonsList(lessons) {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    if (!lessons || lessons.length === 0) { container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">تکلیفی یافت نشد</div>'; return; }
    
    let html = '';
    lessons.forEach(lesson => {
        // 🆕 پیدا کردن همه وضعیت‌های این تکلیف
        const statuses = allLessonStatuses.filter(s => s.lesson_id === lesson.id);
        
        // 🆕 ساخت بج‌های وضعیت
        let statusBadgesHTML = '';
        let hasAnyCustomStatus = statuses.length > 0;
        
        if (hasAnyCustomStatus) {
            statuses.forEach(status => {
                const classLabel = status.class_name === 'all' ? 'همه کلاس‌ها' : getClassPersianName(status.class_name);
                const isEnabled = status.is_enabled !== false;
                const badgeClass = isEnabled ? 'badge-active' : 'badge-inactive';
                const icon = isEnabled ? '🟢' : '🔴';
                statusBadgesHTML += `<span class="status-badge ${badgeClass}">${icon} ${classLabel}</span>`;
            });
        }
        
        // 🆕 اگه هیچ وضعیت خاصی نبود، بج پیش‌فرض
        const defaultStatusHTML = !hasAnyCustomStatus 
            ? '<span class="status-badge badge-default">⚙️ تنظیم نشده (پیش‌فرض فعال)</span>' 
            : '';
        
        // 🆕 اگه برای همه کلاس‌ها غیرفعاله
        const allClassesDisabled = statuses.some(s => s.class_name === 'all' && s.is_enabled === false);
        const globalInactiveBadge = allClassesDisabled 
            ? '<span class="status-badge badge-global-inactive">⚠️ برای همه غیرفعال</span>' 
            : '';
        
        // 🆕 تاریخ‌های سفارشی
        let customDatesHTML = '';
        statuses.forEach(status => {
            if (status.custom_due_date) {
                const classLabel = status.class_name === 'all' ? 'همه' : getClassPersianName(status.class_name);
                customDatesHTML += `<span class="date-badge">📅 ${classLabel}: ${status.custom_due_date}</span>`;
            }
        });
        
        html += `
            <div class="lesson-manage-card">
                <div class="lesson-manage-header">
                    <div class="lesson-manage-icon">📚</div>
                    <div class="lesson-manage-title">${lesson.title}</div>
                </div>
                
                <div class="lesson-manage-meta">
                    <span class="meta-item">📅 مهلت پیش‌فرض: ${lesson.dueDate || 'نامشخص'}</span>
                    <span class="meta-item">📝 ${toPersianNum(lesson.activityCount || 0)} سوال</span>
                </div>
                
                <div class="lesson-manage-status-section">
                    <div class="status-section-label">📋 وضعیت برای کلاس‌ها:</div>
                    <div class="status-badges-container">
                        ${globalInactiveBadge}
                        ${statusBadgesHTML}
                        ${defaultStatusHTML}
                    </div>
                </div>
                
                ${customDatesHTML ? `
                    <div class="lesson-manage-dates-section">
                        <div class="dates-section-label">📅 مهلت‌های سفارشی:</div>
                        <div class="dates-badges-container">${customDatesHTML}</div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

function openClassDueDateModal() {
    const modal = document.getElementById('class-duedate-modal');
    if (!modal) return;
    const select = document.getElementById('class-duedate-lesson-select');
    if (select) {
        let options = '<option value="">--- انتخاب تکلیف ---</option>';
        allLessonsList.forEach(l => { options += `<option value="${l.id}">${l.title}</option>`; });
        select.innerHTML = options;
    }
    selectedClassDay = null;
    const previewEl = document.getElementById('class-preview-date');
    if (previewEl) previewEl.textContent = '---';
    const dayPicker = document.getElementById('class-day-picker');
    if (dayPicker) {
        let html = '';
        [1,2,3,4,5,6,7].forEach(day => {
            html += `<button type="button" class="day-picker-btn" data-days="${day}" onclick="selectClassDay(${day}, this)"><span class="day-picker-num">${toPersianNum(day)}</span><span class="day-picker-label">روز</span></button>`;
        });
        dayPicker.innerHTML = html;
    }
    modal.classList.add('active');
}

function closeClassDueDateModal() {
    const modal = document.getElementById('class-duedate-modal');
    if (modal) modal.classList.remove('active');
}

function selectClassDay(days, btnElement) {
    selectedClassDay = days;
    document.querySelectorAll('.class-day-picker .day-picker-btn').forEach(b => b.classList.remove('selected'));
    if (btnElement) btnElement.classList.add('selected');
    const newDate = calculatePersianDatePlusDays(days);
    const previewEl = document.getElementById('class-preview-date');
    if (previewEl) { previewEl.textContent = newDate; previewEl.classList.add('show'); }
}

async function saveClassDueDate() {
    const lessonSelect = document.getElementById('class-duedate-lesson-select');
    const classSelect = document.getElementById('class-duedate-class-select');
    if (!lessonSelect || !lessonSelect.value) { showToast('لطفاً یک تکلیف انتخاب کنید', 'warning'); return; }
    if (!classSelect || !classSelect.value) { showToast('لطفاً یک کلاس انتخاب کنید', 'warning'); return; }
    if (!selectedClassDay) { showToast('لطفاً یک روز انتخاب کنید', 'warning'); return; }
    
    const lessonId = lessonSelect.value;
    const className = classSelect.value;
    const newDate = calculatePersianDatePlusDays(selectedClassDay);
    showToast('در حال ذخیره...', 'info');
    const result = await setClassDueDate(lessonId, className, newDate);
    if (result.success) {
        closeClassDueDateModal();
        showToast(`✅ مهلت برای ${className === 'all' ? 'همه کلاس‌ها' : getClassPersianName(className)} تغییر کرد تا ${newDate}`, 'success');
        await loadLessonStatuses();
        renderLessonsList(allLessonsList);
    } else { showToast('خطا در ذخیره', 'error'); }
}

function openToggleLessonModal() {
    const modal = document.getElementById('toggle-lesson-modal');
    if (!modal) return;
    const select = document.getElementById('toggle-lesson-select');
    if (select) {
        let options = '<option value="">--- انتخاب تکلیف ---</option>';
        allLessonsList.forEach(l => { options += `<option value="${l.id}">${l.title}</option>`; });
        select.innerHTML = options;
    }
    setToggleStatus(true);
    modal.classList.add('active');
}

function closeToggleLessonModal() {
    const modal = document.getElementById('toggle-lesson-modal');
    if (modal) modal.classList.remove('active');
}

function setToggleStatus(isActive) {
    toggleStatusValue = isActive;
    const activeBtn = document.getElementById('toggle-active-btn');
    const inactiveBtn = document.getElementById('toggle-inactive-btn');
    if (activeBtn) activeBtn.classList.toggle('active-btn', isActive);
    if (inactiveBtn) inactiveBtn.classList.toggle('active-btn', !isActive);
}

async function saveToggleLesson() {
    const lessonSelect = document.getElementById('toggle-lesson-select');
    const classSelect = document.getElementById('toggle-class-select');
    if (!lessonSelect || !lessonSelect.value) { showToast('لطفاً یک تکلیف انتخاب کنید', 'warning'); return; }
    if (!classSelect || !classSelect.value) { showToast('لطفاً یک کلاس انتخاب کنید', 'warning'); return; }
    
    const lessonId = lessonSelect.value;
    const className = classSelect.value;
    showToast('در حال ذخیره...', 'info');
    
    const result = await setClassLessonStatus(lessonId, className, toggleStatusValue);
    if (result.success) {
        closeToggleLessonModal();
        showToast(`✅ تکلیف برای ${className === 'all' ? 'همه کلاس‌ها' : getClassPersianName(className)} ${toggleStatusValue ? 'فعال' : 'غیرفعال'} شد`, 'success');
        await loadLessonStatuses();
        renderLessonsList(allLessonsList);
    } else { showToast('خطا در ذخیره', 'error'); }
}

function calculatePersianDatePlusDays(daysToAdd) {
    const today = new Date();
    const persianDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
    const parts = persianDate.split('/').map(p => parseInt(fromPersianNum(p)));
    let year = parts[0], month = parts[1], day = parts[2];
    const monthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    day += daysToAdd;
    while (day > monthDays[month - 1]) { day -= monthDays[month - 1]; month += 1; if (month > 12) { month = 1; year += 1; } }
    return `${toPersianNum(year)}/${toPersianNum(String(month).padStart(2, '0'))}/${toPersianNum(String(day).padStart(2, '0'))}`;
}

// (بقیه توابع: openDueDateEditor, selectDueDateDay, closeDueDateModal, saveDueDate, removeCustomDueDate, toggleLessonEnabled, changeTotalPoints, goToChatFromProfile, switchRankingClass, loadRankings, addEvent, loadEvents, renderEvents, addContest, loadContests, renderContests, addLibraryItem, loadLibrary, renderLibrary, downloadAllStudents, downloadClassReport, downloadFile, printStudentCertificates, showTopStudentsReport, generateFullReport, changePassword, clearCache, openEditStudentCode, openEditCompletedLessons - همه از نسخه قبلی کپی کن)