// ============================================================
// teacher.js — پنل معلم با Supabase
// نسخه: ۲۸.۰.۰ — مرتب‌سازی اعلان‌ها + Badge خانه + دیده‌شده کن
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
// 🆕 علامت‌گذاری همه به عنوان دیده شده
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

// 🆕 محاسبه تعداد کل اعلان‌های دیده نشده
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

    // 🆕 Badge برای دکمه دانش‌آموزان
    const unreadLessons = countUnreadLessonReports();
    const studentBadge = document.getElementById('home-badge-students');
    if (studentBadge) {
        if (unreadLessons > 0) {
            studentBadge.textContent = toPersianNum(unreadLessons);
            studentBadge.style.display = 'flex';
        } else {
            studentBadge.style.display = 'none';
        }
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
        
        await loadAllReportsForBadges(); // 🆕 لود گزارش‌ها برای اعلان

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

// (توابع پیام‌رسانی بدون تغییر - از نسخه قبلی کپی کن)
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
    
    // 🆕 مرتب‌سازی: اول کسایی که اعلان دارن، بعد بقیه
    const seen = getReadLessons();
    students.sort((a, b) => {
        const aLatest = allReportsRaw.find(r => r.student_id === a.student_id);
        const bLatest = allReportsRaw.find(r => r.student_id === b.student_id);
        const aUnread = aLatest && !seen[aLatest.id];
        const bUnread = bLatest && !seen[bLatest.id];
        
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;
        return 0; // بقیه همون ترتیب قبلی
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

// (بقیه توابع: openStudentProfile, renderStudentProfile, loadLessonsPage, loadLessonStatuses, renderLessonsList, openClassDueDateModal, closeClassDueDateModal, selectClassDay, saveClassDueDate, openToggleLessonModal, closeToggleLessonModal, setToggleStatus, saveToggleLesson, calculatePersianDatePlusDays, openDueDateEditor, selectDueDateDay, closeDueDateModal, saveDueDate, removeCustomDueDate, toggleLessonEnabled, changeTotalPoints, goToChatFromProfile, switchRankingClass, loadRankings, addEvent, loadEvents, renderEvents, addContest, loadContests, renderContests, addLibraryItem, loadLibrary, renderLibrary, downloadAllStudents, downloadClassReport, downloadFile, printStudentCertificates, showTopStudentsReport, generateFullReport, changePassword, clearCache - همه از نسخه قبلی کپی کن)