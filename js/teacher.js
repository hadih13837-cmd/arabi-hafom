// ============================================================
// teacher.js — پنل معلم با Supabase
// نسخه: ۲۶.۰.۰ — رفع کامل خطای مهلت شخصی و کلاسی
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
            updateHomeBadgesImmediately();
        }
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

function switchMessagesTab(tab) {
    document.querySelectorAll('.messages-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.messages-tab-content').forEach(c => c.classList.remove('active'));
    const tabBtn = document.querySelector(`.messages-tab-btn[data-tab="${tab}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    const tabContent = document.getElementById('tab-' + tab);
    if (tabContent) tabContent.classList.add('active');
    if (tab === 'personal') loadStudentConversations();
    else if (tab === 'class') loadClassMessages();
}

async function sendClassMessage() {
    const className = document.getElementById('class-message-target').value;
    const title = document.getElementById('class-message-title').value.trim();
    const text = document.getElementById('class-message-text').value.trim();
    const type = document.getElementById('class-message-type').value;
    if (!title) { showToast('عنوان را وارد کنید', 'warning'); return; }
    if (!text) { showToast('متن پیام را وارد کنید', 'warning'); return; }
    const messageData = { message_id: 'cls_' + Date.now(), class_name: className, title, text, type, date: new Date().toISOString(), date_persian: new Date().toLocaleDateString('fa-IR') };
    try {
        showToast('در حال ارسال...', 'info');
        const result = await sendClassMessageToSupabase(messageData);
        if (result.success) {
            showToast('پیام کلاسی ارسال شد! ✅', 'success');
            document.getElementById('class-message-title').value = '';
            document.getElementById('class-message-text').value = '';
            localStorage.removeItem(CLASS_MESSAGES_CACHE_KEY);
            setTimeout(loadClassMessages, 500);
        } else showToast('خطا در ارسال', 'error');
    } catch (error) { showToast('خطا در ارسال', 'error'); }
}

async function loadClassMessages() {
    const container = document.getElementById('class-messages-list');
    if (!container) return;
    const cached = getCachedData(CLASS_MESSAGES_CACHE_KEY);
    if (cached && cached.length > 0) renderClassMessages(cached);
    else container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const messages = await getClassMessagesFromSupabase('all');
        setCachedData(CLASS_MESSAGES_CACHE_KEY, messages);
        renderClassMessages(messages);
    } catch (error) { if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderClassMessages(messages) {
    const container = document.getElementById('class-messages-list');
    if (!container) return;
    if (!messages || messages.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز پیام کلاسی ارسال نشده</div>'; return; }
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    const typeTexts = { info: 'ℹ️ اطلاعیه', warning: '⚠️ هشدار', success: '✅ تبریک', reminder: '🔔 یادآوری' };
    let html = '';
    messages.forEach(msg => {
        html += `<div class="class-message-item type-${msg.type || 'info'}"><div class="class-message-item-header"><div class="class-message-item-title">${msg.title}</div><div class="class-message-item-type">${typeTexts[msg.type] || 'ℹ️'}</div></div><div class="class-message-item-text">${msg.text}</div><div class="class-message-item-footer"><div class="class-message-item-target">👥 ${getClassPersianName(msg.class_name)}</div><div>${msg.date_persian || ''}</div></div></div>`;
    });
    container.innerHTML = html;
}

async function loadStudentConversations() {
    const container = document.getElementById('messenger-list-items');
    if (!container) return;
    const cached = getCachedData(CONVERSATIONS_CACHE_KEY);
    if (cached && cached.length > 0) {
        currentConversations = cached;
        currentConversations.forEach(conv => { conv.unread_count = computeUnreadForConversation(conv); });
        renderMessengerList(currentConversations);
    } else container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const conversations = await getStudentConversationsFromSupabase();
        conversations.forEach(conv => { conv.unread_count = computeUnreadForConversation(conv); });
        currentConversations = conversations;
        setCachedData(CONVERSATIONS_CACHE_KEY, conversations);
        if (currentConversations.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز مکالمه‌ای وجود نداره</div>'; return; }
        renderMessengerList(currentConversations);
        updateHomeBadgesImmediately();
    } catch (error) { if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderMessengerList(conversations) {
    const container = document.getElementById('messenger-list-items');
    if (!container) return;
    if (conversations.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">مکالمه‌ای یافت نشد</div>'; return; }
    let html = '';
    conversations.forEach(conv => {
        const isActive = currentChatStudent && currentChatStudent.student_id === conv.student_id;
        const avatarHtml = renderAvatarHTML(conv);
        const unreadCount = conv.unread_count || 0;
        html += `<div class="messenger-item ${isActive ? 'active' : ''}" onclick="openChatWith('${conv.student_id}', '${conv.student_name}', '${conv.class_name}')"><div class="messenger-item-avatar">${avatarHtml}</div><div class="messenger-item-info"><div class="messenger-item-name">${conv.student_name}</div><div class="messenger-item-last">${conv.last_message || 'بدون پیام'}</div></div><div class="messenger-item-meta"><div class="messenger-item-time">${conv.last_date_persian || ''}</div>${unreadCount > 0 ? `<div class="messenger-item-unread">${toPersianNum(unreadCount)}</div>` : ''}</div></div>`;
    });
    container.innerHTML = html;
}

function filterMessengerList(query) {
    query = query.toLowerCase().trim();
    if (!query) { renderMessengerList(currentConversations); return; }
    const filtered = currentConversations.filter(c => (c.student_name || '').toLowerCase().includes(query));
    renderMessengerList(filtered);
}

async function openChatWith(studentId, studentName, className) {
    currentChatStudent = { student_id: studentId, student_name: studentName, class_name: className };
    document.getElementById('messenger-empty').style.display = 'none';
    document.getElementById('messenger-list').style.display = 'none';
    document.getElementById('messenger-chat').style.display = 'flex';
    document.getElementById('messenger-chat-name').textContent = studentName;
    document.getElementById('messenger-chat-status').textContent = getClassPersianName(className);
    const avatarEl = document.getElementById('messenger-chat-avatar');
    const conv = currentConversations.find(c => c.student_id === studentId);
    if (conv) avatarEl.innerHTML = renderAvatarHTML(conv);
    else avatarEl.innerHTML = `<img src="${DEFAULT_AVATAR_URL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    setReadTime(studentId);
    const convIndex = currentConversations.findIndex(c => c.student_id === studentId);
    if (convIndex >= 0) { currentConversations[convIndex].unread_count = 0; setCachedData(CONVERSATIONS_CACHE_KEY, currentConversations); renderMessengerList(currentConversations); }
    updateHomeBadgesImmediately();
    await loadChatMessages(studentId);
    markAllMessagesAsSeenSupabase(studentId, 'teacher').catch(() => {});
}

function closeMessengerChat() {
    document.getElementById('messenger-empty').style.display = 'flex';
    document.getElementById('messenger-list').style.display = 'flex';
    document.getElementById('messenger-chat').style.display = 'none';
    currentChatStudent = null;
    loadStudentConversations();
}

async function loadChatMessages(studentId) {
    const container = document.getElementById('messenger-chat-messages');
    if (!container) return;
    const cacheKey = 'teacherMessagesCache_' + studentId;
    const cached = getCachedData(cacheKey);
    if (cached && cached.length > 0) renderChatMessages(cached);
    else container.innerHTML = '<div class="messenger-chat-messages-empty">در حال بارگذاری...</div>';
    try {
        const messages = await getPersonalMessages(studentId);
        if (messages.length === 0) { container.innerHTML = '<div class="messenger-chat-messages-empty">هنوز پیامی رد و بدل نشده<br>اولین پیام رو بفرست!</div>'; return; }
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));
        setCachedData(cacheKey, messages);
        renderChatMessages(messages);
    } catch (error) { if (!cached) container.innerHTML = '<div class="messenger-chat-messages-empty">خطا</div>'; }
}

function renderChatMessages(messages) {
    const container = document.getElementById('messenger-chat-messages');
    if (!container) return;
    let html = '';
    messages.forEach(msg => {
        const senderClass = msg.sender === 'teacher' ? 'teacher' : 'student';
        const time = msg.date_persian || '';
        let tickHtml = '';
        if (senderClass === 'teacher') {
            const isSeen = msg.is_seen === true || msg.is_seen === 'true' || msg.is_seen === 1;
            tickHtml = isSeen ? `<span class="chat-tick chat-tick-seen">✓✓</span>` : `<span class="chat-tick">✓</span>`;
        }
        html += `<div class="messenger-chat-message ${senderClass}"><div>${msg.text}</div><div class="messenger-chat-message-time">${time}${tickHtml}</div></div>`;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    if (!currentChatStudent) return;
    const input = document.getElementById('messenger-chat-input');
    const text = input.value.trim();
    if (!text) return;
    const messageData = {
        message_id: 'pm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        student_id: currentChatStudent.student_id, student_name: currentChatStudent.student_name,
        class_name: currentChatStudent.class_name, sender: 'teacher', text,
        date: new Date().toISOString(), date_persian: new Date().toLocaleDateString('fa-IR'), is_seen: false
    };
    try {
        input.value = '';
        const container = document.getElementById('messenger-chat-messages');
        const time = messageData.date_persian;
        const emptyState = container.querySelector('.messenger-chat-messages-empty');
        if (emptyState) emptyState.remove();
        const msgEl = document.createElement('div');
        msgEl.className = 'messenger-chat-message teacher';
        msgEl.innerHTML = `<div>${text}</div><div class="messenger-chat-message-time">${time}<span class="chat-tick">✓</span></div>`;
        container.appendChild(msgEl);
        container.scrollTop = container.scrollHeight;
        const cacheKey = 'teacherMessagesCache_' + currentChatStudent.student_id;
        const cached = getCachedData(cacheKey) || [];
        cached.push(messageData);
        setCachedData(cacheKey, cached);
        await sendPersonalMessageToSupabase(messageData);
        setReadTime(currentChatStudent.student_id);
    } catch (error) { showToast('خطا', 'error'); }
}

function showTeacherInAppNotification(studentName, message, studentId) {
    document.querySelectorAll('.inapp-notification').forEach(n => n.remove());
    const notif = document.createElement('div');
    notif.className = 'inapp-notification';
    notif.innerHTML = `<div class="inapp-icon">💬</div><div class="inapp-content"><div class="inapp-title">پیام از ${studentName}</div><div class="inapp-text">${(message || '').substring(0, 60)}${(message || '').length > 60 ? '...' : ''}</div></div>`;
    notif.onclick = () => {
        notif.remove();
        navigateToPage('messages', true);
        setTimeout(() => { switchMessagesTab('personal'); setTimeout(() => { const conv = currentConversations.find(c => c.student_id === studentId); if (conv) openChatWith(studentId, conv.student_name, conv.class_name); }, 400); }, 300);
    };
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 50);
    setTimeout(() => { notif.classList.remove('show'); setTimeout(() => notif.remove(), 400); }, 6000);
}

function playDingSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        [880, 1108.73].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now + i * 0.15); osc.stop(now + i * 0.15 + 0.4);
        });
    } catch (e) {}
}

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
    setTimeout(() => { renderStudents(getFilteredStudents()); }, 500);
}

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

async function loadLessonsPage() {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    const cached = getCachedData(LESSONS_CACHE_KEY, 600000);
    if (cached && cached.length > 0) {
        allLessonsList = cached;
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
        renderLessonsList(lessons);
    } catch (error) { if (!cached) container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderLessonsList(lessons) {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    if (!lessons || lessons.length === 0) { container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">تکلیفی یافت نشد</div>'; return; }
    let html = '';
    lessons.forEach(lesson => {
        html += `<div class="lesson-item"><div class="lesson-item-icon">📚</div><div class="lesson-item-info"><div class="lesson-item-title">${lesson.title}</div><div class="lesson-item-meta"><span>📅 مهلت پیش‌فرض: ${lesson.dueDate || 'نامشخص'}</span><span>📝 ${toPersianNum(lesson.activityCount || 0)} سوال</span></div></div><div class="lesson-item-status active">فعال</div></div>`;
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

function openDueDateEditor(lessonId, currentDate, isCustom) {
    if (!currentProfileStudent) return;
    vibrate(15);
    const existing = document.getElementById('due-date-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'due-date-modal';
    modal.className = 'due-date-modal-overlay active';
    modal.innerHTML = `
        <div class="due-date-modal-box">
            <div class="due-date-modal-header">
                <div class="due-date-modal-icon">📅</div>
                <div class="due-date-modal-title">تمدید مهلت تکلیف</div>
                <div class="due-date-modal-subtitle">فقط برای این دانش‌آموز</div>
            </div>
            <div class="due-date-modal-body">
                <label class="due-date-input-label">افزودن به امروز (۱ تا ۷ روز):</label>
                <div class="day-picker-grid" id="day-picker-grid">
                    ${[1,2,3,4,5,6,7].map(day => `<button type="button" class="day-picker-btn" data-days="${day}" onclick="selectDueDateDay(${day}, this)"><span class="day-picker-num">${toPersianNum(day)}</span><span class="day-picker-label">روز</span></button>`).join('')}
                </div>
                <div class="due-date-preview-box" id="due-date-preview">
                    <div class="preview-label">📅 تاریخ مهلت جدید:</div>
                    <div class="preview-value" id="preview-date-value">---</div>
                </div>
                ${isCustom ? `<div class="due-date-current-hint"><span class="hint-icon">ℹ️</span><span class="hint-text">مهلت فعلی (سفارشی): <strong>${currentDate}</strong></span></div>` : ''}
                <div class="due-date-warning-box" style="background:linear-gradient(135deg,#e8f5e9,#f1f8e9);border-color:#a5d6a7;color:#2e7d32;">
                    ✅ با تمدید مهلت، تکلیف از حالت منقضی خارج میشه و دانش‌آموز می‌تونه انجامش بده و امتیاز بگیره.
                </div>
            </div>
            <div class="due-date-modal-footer">
                ${isCustom ? `<button class="due-date-btn due-date-btn-remove" onclick="removeCustomDueDate('${lessonId}')">🗑️ حذف سفارشی</button>` : ''}
                <button class="due-date-btn due-date-btn-cancel" onclick="closeDueDateModal()">انصراف</button>
                <button class="due-date-btn due-date-btn-save" id="save-due-date-btn" onclick="saveDueDate('${lessonId}')" disabled>✅ تمدید کن</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => {
        const firstBtn = modal.querySelector('.day-picker-btn');
        if (firstBtn) selectDueDateDay(1, firstBtn);
    }, 200);
}

let selectedDueDateDays = null;

function selectDueDateDay(days, btnElement) {
    selectedDueDateDays = days;
    document.querySelectorAll('.day-picker-btn').forEach(b => b.classList.remove('selected'));
    if (btnElement) btnElement.classList.add('selected');
    const newDate = calculatePersianDatePlusDays(days);
    const previewEl = document.getElementById('preview-date-value');
    if (previewEl) { previewEl.textContent = newDate; previewEl.classList.add('show'); }
    const saveBtn = document.getElementById('save-due-date-btn');
    if (saveBtn) saveBtn.disabled = false;
    vibrate(10);
}

function closeDueDateModal() {
    const modal = document.getElementById('due-date-modal');
    if (modal) modal.remove();
    selectedDueDateDays = null;
}

async function saveDueDate(lessonId) {
    if (!currentProfileStudent) return;
    if (!selectedDueDateDays) { showToast('یک روز انتخاب کنید', 'warning'); return; }
    const newDate = calculatePersianDatePlusDays(selectedDueDateDays);
    vibrate(15);
    const status = currentProfileStatus[lessonId] || { is_enabled: true };
    const result = await updateStudentDueDate(currentProfileStudent.student_id, lessonId, newDate);
    if (result.success) {
        currentProfileStatus[lessonId] = { ...status, custom_due_date: newDate, is_enabled: true };
        try { localStorage.removeItem('lessonStatusCache'); } catch (e) {}
        closeDueDateModal();
        renderStudentProfile();
        showToast(`✅ مهلت تا ${newDate} تمدید شد`, 'success');
    } else { showToast('خطا در ذخیره', 'error'); }
}

async function removeCustomDueDate(lessonId) {
    if (!currentProfileStudent) return;
    vibrate(15);
    const result = await removeStudentCustomDueDate(currentProfileStudent.student_id, lessonId);
    if (result.success) {
        currentProfileStatus[lessonId] = { ...currentProfileStatus[lessonId], custom_due_date: null };
        try { localStorage.removeItem('lessonStatusCache'); } catch (e) {}
        closeDueDateModal();
        renderStudentProfile();
        showToast('✅ مهلت سفارشی حذف شد', 'success');
    } else { showToast('خطا', 'error'); }
}

async function toggleLessonEnabled(lessonId, isEnabled) {
    if (!currentProfileStudent) return;
    vibrate(15);
    const status = currentProfileStatus[lessonId] || { is_enabled: true };
    const result = await updateLessonStatus(currentProfileStudent.student_id, lessonId, { is_enabled: isEnabled });
    if (result.success) {
        currentProfileStatus[lessonId] = { ...status, is_enabled: isEnabled };
        renderStudentProfile();
        showToast(isEnabled ? '✅ تکلیف فعال شد' : '⛔ تکلیف غیرفعال شد', 'success');
    } else { showToast('خطا در تغییر وضعیت', 'error'); }
}

async function changeTotalPoints(delta) {
    if (!currentProfileStudent) return;
    vibrate(15);
    try {
        const client = getSupabase();
        if (!client) { showToast('اتصال برقرار نیست', 'error'); return; }
        const currentAdded = parseInt(currentProfileStudent.custom_points_added) || 0;
        const newCustomAdded = currentAdded + delta;
        const { error } = await client.from('rankings').update({ custom_points_added: newCustomAdded }).eq('student_id', currentProfileStudent.student_id);
        if (error) throw error;
        currentProfileStudent.custom_points_added = newCustomAdded;
        localStorage.removeItem(STUDENTS_CACHE_KEY);
        renderStudentProfile();
        showToast(`امتیاز کل ${delta > 0 ? '+' + delta : delta} شد`, 'success');
    } catch (error) { showToast('خطا', 'error'); }
}

function goToChatFromProfile() {
    if (!currentProfileStudent) return;
    const student = currentProfileStudent;
    navigateToPage('messages', true);
    setTimeout(() => { switchMessagesTab('personal'); setTimeout(() => { openChatWith(student.student_id, student.name, student.class_name); }, 400); }, 300);
}

function switchRankingClass(className, btn) {
    currentRankingClass = className;
    document.querySelectorAll('.rankings-class-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const titleEl = document.getElementById('rankings-current-class');
    if (titleEl) titleEl.textContent = getClassPersianName(className);
    loadRankings();
}

async function loadRankings() {
    const container = document.getElementById('rankings-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        let allData = getCachedData(STUDENTS_CACHE_KEY);
        if (!allData) { const response = await getAllStudents(); allData = response || []; setCachedData(STUDENTS_CACHE_KEY, allData); }
        const rankings = allData.filter(s => s.class_name === currentRankingClass).sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a));
        const countEl = document.getElementById('rankings-current-count');
        if (countEl) countEl.textContent = `${toPersianNum(rankings.length)} دانش‌آموز`;
        if (rankings.length === 0) { container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">دانش‌آموزی در این کلاس نیست</div>'; return; }
        let html = '';
        rankings.forEach((student, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : toPersianNum(rank);
            const totalLessons = getTotalCompletedLessons(student);
            html += `<div class="ranking-item ${rankClass}" onclick="openStudentProfile('${student.student_id}')"><div class="ranking-rank">${medal}</div><div class="student-avatar" style="width:46px;height:46px;">${renderAvatarHTML(student)}</div><div class="student-info"><div class="student-name">${student.name || 'بدون نام'}</div><span class="student-class">${toPersianNum(totalLessons)} تکلیف • ${toPersianNum(student.avg_percent || 0)}%</span></div><div class="student-points"><span>⭐</span><span>${toPersianNum(calculateTotalPoints(student))}</span></div></div>`;
        });
        container.innerHTML = html;
    } catch (error) { container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

async function addEvent() {
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value.trim();
    const cls = document.getElementById('event-class').value;
    const type = document.getElementById('event-type').value;
    const desc = document.getElementById('event-desc').value.trim();
    if (!title || !date) { showToast('عنوان و تاریخ را وارد کنید', 'warning'); return; }
    try {
        const result = await addEventToSupabase({ event_id: 'evt_' + Date.now(), title, date, class_name: cls, type, description: desc });
        if (result.success) { showToast('رویداد ثبت شد', 'success'); document.getElementById('event-title').value = ''; document.getElementById('event-date').value = ''; document.getElementById('event-desc').value = ''; localStorage.removeItem(EVENTS_CACHE_KEY); loadEvents(); } else showToast('خطا', 'error');
    } catch (error) { showToast('خطا', 'error'); }
}

async function loadEvents() {
    const container = document.getElementById('events-list');
    if (!container) return;
    const cached = getCachedData(EVENTS_CACHE_KEY);
    if (cached && cached.length > 0) renderEvents(cached); else container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const events = await getEventsFromSupabase();
        setCachedData(EVENTS_CACHE_KEY, events);
        renderEvents(events);
    } catch (error) { if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderEvents(events) {
    const container = document.getElementById('events-list');
    if (!container) return;
    if (!events || events.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز رویدادی ثبت نشده</div>'; return; }
    const typeIcons = { exam: '📝', homework: '📚', holiday: '🎉', event: '📌' };
    let html = '';
    events.forEach(evt => {
        html += `<div class="event-item"><div class="event-item-icon">${typeIcons[evt.type] || '📌'}</div><div class="event-item-info"><div class="event-item-title">${evt.title}</div><div class="event-item-meta">${evt.date} • ${getClassPersianName(evt.class_name)}${evt.description ? ' • ' + evt.description : ''}</div></div></div>`;
    });
    container.innerHTML = html;
}

async function addContest() {
    const title = document.getElementById('contest-title').value.trim();
    const prize = document.getElementById('contest-prize').value.trim();
    const start = document.getElementById('contest-start').value.trim();
    const end = document.getElementById('contest-end').value.trim();
    const desc = document.getElementById('contest-desc').value.trim();
    if (!title || !start || !end) { showToast('عنوان و تاریخ‌ها را وارد کنید', 'warning'); return; }
    try {
        const result = await addContestToSupabase({ contest_id: 'cnt_' + Date.now(), title, prize, start_date: start, end_date: end, description: desc });
        if (result.success) { showToast('مسابقه ایجاد شد', 'success'); document.getElementById('contest-title').value = ''; document.getElementById('contest-prize').value = ''; document.getElementById('contest-start').value = ''; document.getElementById('contest-end').value = ''; document.getElementById('contest-desc').value = ''; localStorage.removeItem(CONTESTS_CACHE_KEY); loadContests(); } else showToast('خطا', 'error');
    } catch (error) { showToast('خطا', 'error'); }
}

async function loadContests() {
    const container = document.getElementById('contests-list');
    if (!container) return;
    const cached = getCachedData(CONTESTS_CACHE_KEY);
    if (cached && cached.length > 0) renderContests(cached); else container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const contests = await getContestsFromSupabase();
        setCachedData(CONTESTS_CACHE_KEY, contests);
        renderContests(contests);
    } catch (error) { if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderContests(contests) {
    const container = document.getElementById('contests-list');
    if (!container) return;
    if (!contests || contests.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز مسابقه‌ای نیست</div>'; return; }
    let html = '';
    contests.forEach(c => { html += `<div class="contest-item"><div class="contest-item-icon">🏆</div><div class="contest-item-info"><div class="contest-item-title">${c.title}</div><div class="contest-item-meta">🎁 ${c.prize || 'بدون جایزه'} • 📅 از ${c.start_date} تا ${c.end_date}</div></div></div>`; });
    container.innerHTML = html;
}

async function addLibraryItem() {
    const title = document.getElementById('lib-title').value.trim();
    const type = document.getElementById('lib-type').value;
    const url = document.getElementById('lib-url').value.trim();
    const desc = document.getElementById('lib-desc').value.trim();
    if (!title || !url) { showToast('عنوان و لینک را وارد کنید', 'warning'); return; }
    try {
        const result = await addLibraryToSupabase({ item_id: 'lib_' + Date.now(), title, type, url, description: desc });
        if (result.success) { showToast('منبع اضافه شد', 'success'); document.getElementById('lib-title').value = ''; document.getElementById('lib-url').value = ''; document.getElementById('lib-desc').value = ''; localStorage.removeItem(LIBRARY_CACHE_KEY); loadLibrary(); } else showToast('خطا', 'error');
    } catch (error) { showToast('خطا', 'error'); }
}

async function loadLibrary() {
    const container = document.getElementById('library-list');
    if (!container) return;
    const cached = getCachedData(LIBRARY_CACHE_KEY);
    if (cached && cached.length > 0) renderLibrary(cached); else container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const items = await getLibraryFromSupabase();
        setCachedData(LIBRARY_CACHE_KEY, items);
        renderLibrary(items);
    } catch (error) { if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا</div>'; }
}

function renderLibrary(items) {
    const container = document.getElementById('library-list');
    if (!container) return;
    if (!items || items.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز منبعی اضافه نشده</div>'; return; }
    const typeIcons = { video: '🎬', pdf: '📄', audio: '🎵', site: '🌐', book: '📚' };
    let html = '';
    items.forEach(item => { html += `<div class="library-item"><div class="library-item-icon">${typeIcons[item.type] || '📄'}</div><div class="library-item-info"><div class="library-item-title">${item.title}</div><div class="library-item-meta">${item.description || ''} • <a href="${item.url}" target="_blank" style="color:#1976d2;">باز کردن</a></div></div></div>`; });
    container.innerHTML = html;
}

function downloadAllStudents() {
    if (allStudents.length === 0) { showToast('داده‌ای نیست', 'warning'); return; }
    let csv = '\uFEFF';
    csv += 'نام,کد ورود,کلاس,امتیاز,تکالیف,درصد,روز متوالی\n';
    allStudents.forEach(s => { csv += `"${s.name}","${s.student_code || ''}","${getClassPersianName(s.class_name)}",${calculateTotalPoints(s)},${getTotalCompletedLessons(s)},${s.avg_percent},${s.streak_days || 0}\n`; });
    downloadFile(csv, 'دانش‌آموزان.csv', 'text/csv');
    showToast('فایل دانلود شد', 'success');
}

function downloadClassReport() {
    const cls = document.getElementById('report-class-filter').value;
    const filtered = cls === 'all' ? allStudents : allStudents.filter(s => s.class_name === cls);
    if (filtered.length === 0) { showToast('داده‌ای نیست', 'warning'); return; }
    let csv = '\uFEFF';
    csv += 'نام,کد ورود,امتیاز,تکالیف,درصد\n';
    filtered.forEach(s => { csv += `"${s.name}","${s.student_code || ''}",${calculateTotalPoints(s)},${getTotalCompletedLessons(s)},${s.avg_percent}\n`; });
    const filename = cls === 'all' ? 'همه_کلاس‌ها.csv' : getClassPersianName(cls) + '.csv';
    downloadFile(csv, filename, 'text/csv');
    showToast('فایل دانلود شد', 'success');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function printStudentCertificates() { showToast('به‌زودی', 'info'); }

function showTopStudentsReport() {
    const top = [...allStudents].sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a)).slice(0, 10);
    const container = document.getElementById('full-report-content');
    if (top.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae;">داده‌ای نیست</div>'; return; }
    let html = '<div style="font-weight:900; color:#1976d2; margin-bottom:12px; font-size:15px;">🏆 ۱۰ دانش‌آموز برتر:</div>';
    top.forEach((s, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : toPersianNum(i + 1) + '.';
        html += `<div style="padding:8px 0; border-bottom:1px dashed #e3f2fd; font-size:13px;">${medal} <strong>${s.name}</strong> - ${getClassPersianName(s.class_name)} - <span style="color:#f57c00; font-weight:900;">${toPersianNum(calculateTotalPoints(s))} امتیاز</span></div>`;
    });
    container.innerHTML = html;
}

function generateFullReport() {
    const cls = document.getElementById('report-class-filter').value;
    const filtered = cls === 'all' ? allStudents : allStudents.filter(s => s.class_name === cls);
    const container = document.getElementById('full-report-content');
    if (filtered.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae;">داده‌ای نیست</div>'; return; }
    const totalPoints = filtered.reduce((sum, s) => sum + calculateTotalPoints(s), 0);
    const avgPoints = Math.round(totalPoints / filtered.length);
    const totalLessons = filtered.reduce((sum, s) => sum + getTotalCompletedLessons(s), 0);
    const avgPercent = Math.round(filtered.reduce((sum, s) => sum + (parseInt(s.avg_percent) || 0), 0) / filtered.length);
    let html = `<div style="font-weight:900; color:#1976d2; margin-bottom:15px; font-size:15px;">📊 گزارش ${cls === 'all' ? 'همه' : getClassPersianName(cls)}</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><div style="padding:12px; background:#fff; border-radius:12px;"><div style="font-size:11px; color:#78909c; font-weight:bold;">تعداد دانش‌آموزان</div><div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(filtered.length)}</div></div><div style="padding:12px; background:#fff; border-radius:12px;"><div style="font-size:11px; color:#78909c; font-weight:bold;">میانگین امتیاز</div><div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(avgPoints)}</div></div><div style="padding:12px; background:#fff; border-radius:12px;"><div style="font-size:11px; color:#78909c; font-weight:bold;">کل تکالیف</div><div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(totalLessons)}</div></div><div style="padding:12px; background:#fff; border-radius:12px;"><div style="font-size:11px; color:#78909c; font-weight:bold;">میانگین درصد</div><div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(avgPercent)}%</div></div></div>`;
    container.innerHTML = html;
}

function changePassword() {
    const newPassword = prompt('رمز جدید:');
    if (newPassword && newPassword.length >= 4) { localStorage.setItem(TEACHER_PASSWORD_KEY, newPassword); showToast('رمز تغییر کرد', 'success'); } else if (newPassword) showToast('حداقل ۴ کاراکتر', 'warning');
}

function clearCache() {
    if (confirm('مطمئنید؟')) {
        const password = localStorage.getItem(TEACHER_PASSWORD_KEY);
        const loggedIn = localStorage.getItem('teacherLoggedIn');
        localStorage.clear();
        if (password) localStorage.setItem(TEACHER_PASSWORD_KEY, password);
        if (loggedIn) localStorage.setItem('teacherLoggedIn', loggedIn);
        showToast('کش پاک شد', 'success');
        setTimeout(() => location.reload(), 1000);
    }
}

console.log('🎓 پنل معلم عربی هفتم - نسخه ۲۶.۰.۰');