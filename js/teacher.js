// ============================================================
// teacher.js — پنل معلم با Supabase
// نسخه: ۱۶.۰.۰ — با کارنامه‌های واقعی + سوییچ واضح
// ============================================================

// ============================================================
// تنظیمات
// ============================================================
const TEACHER_PASSWORD_KEY = 'teacherPassword';
const DEFAULT_PASSWORD = 'hadi1383';
const READ_TIMES_KEY = 'teacherReadTimes';
const MESSAGES_CACHE_DURATION = 1800000;
const CONVERSATIONS_CACHE_KEY = 'teacherConversationsCache';
const CLASS_MESSAGES_CACHE_KEY = 'teacherClassMessagesCache';
const STUDENTS_CACHE_KEY = 'teacherStudentsCache';
const LESSONS_CACHE_KEY = 'teacherLessonsCache';
const EVENTS_CACHE_KEY = 'teacherEventsCache';
const CONTESTS_CACHE_KEY = 'teacherContestsCache';
const LIBRARY_CACHE_KEY = 'teacherLibraryCache';
const LESSON_STATUS_CACHE_KEY = 'teacherLessonStatusCache';
const REPORTS_CACHE_KEY = 'teacherReportsCache';

const DEFAULT_AVATAR_URL = 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';

// ============================================================
// لرزش دستگاه
// ============================================================
function vibrate(pattern = 30) {
    if (navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (e) {}
    }
}

let allStudents = [];
let currentConversations = [];
let currentChatStudent = null;
let currentRankingClass = 'hafom-1';
let pageHistory = ['home'];
let currentProfileStudent = null;
let currentProfileLessons = [];
let currentProfileStatus = {};
let currentProfileReports = [];

let conversationsChannel = null;

// ============================================================
// توابع کمکی
// ============================================================
function toPersianNum(num) {
    if (num === null || num === undefined) return '۰';
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/\d/g, x => persianDigits[parseInt(x)]);
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

// ============================================================
// مدیریت زمان خواندن
// ============================================================
function getReadTimes() {
    try { return JSON.parse(localStorage.getItem(READ_TIMES_KEY) || '{}'); } catch (e) { return {}; }
}

function getReadTime(studentId) {
    const times = getReadTimes();
    return times[studentId] || 0;
}

function setReadTime(studentId) {
    const times = getReadTimes();
    times[studentId] = Date.now();
    localStorage.setItem(READ_TIMES_KEY, JSON.stringify(times));
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

// ============================================================
// کش
// ============================================================
function getCachedData(key, duration = MESSAGES_CACHE_DURATION) {
    try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (cached && (Date.now() - cached.timestamp < duration)) return cached.data;
        return null;
    } catch (e) { return null; }
}

function setCachedData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data: data, timestamp: Date.now() }));
    } catch (e) {}
}

// ============================================================
// رندر آواتار
// ============================================================
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

// ============================================================
// توابع lesson_status
// ============================================================
async function getLessonStatusForStudent(studentId) {
    try {
        const client = getSupabase();
        if (!client) return {};
        const { data, error } = await client
            .from('lesson_status')
            .select('*')
            .eq('student_id', studentId);
        if (error) { console.error('خطا در گرفتن وضعیت:', error); return {}; }
        const statusMap = {};
        (data || []).forEach(item => {
            statusMap[item.lesson_id] = {
                is_enabled: item.is_enabled !== false,
                id: item.id
            };
        });
        return statusMap;
    } catch (error) {
        console.error('خطا:', error);
        return {};
    }
}

async function updateLessonStatus(studentId, lessonId, updates) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        const { data: existing } = await client
            .from('lesson_status')
            .select('id')
            .eq('student_id', studentId)
            .eq('lesson_id', lessonId)
            .maybeSingle();
        if (existing) {
            const { error } = await client
                .from('lesson_status')
                .update(updates)
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await client
                .from('lesson_status')
                .insert({
                    student_id: studentId,
                    lesson_id: lessonId,
                    is_enabled: updates.is_enabled !== undefined ? updates.is_enabled : true,
                    custom_points: 0
                });
            if (error) throw error;
        }
        return { success: true };
    } catch (error) {
        console.error('خطا در آپدیت وضعیت:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// گرفتن کارنامه‌های دانش‌آموز از Supabase
// ============================================================
async function getStudentReports(studentId) {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client
            .from('reports')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('خطا در گرفتن کارنامه‌ها:', error);
            return [];
        }
        console.log('✅ کارنامه‌ها دریافت شد:', data);
        return data || [];
    } catch (error) {
        console.error('خطا:', error);
        return [];
    }
}

// ============================================================
// محاسبه امتیاز کل
// ============================================================
function calculateTotalPoints(student) {
    const basePoints = student.total_points || 0;
    const customAdded = student.custom_points_added || 0;
    return basePoints + customAdded;
}

// ============================================================
// ورود
// ============================================================
function checkPassword() {
    const input = document.getElementById('login-password').value.trim();
    const savedPassword = localStorage.getItem(TEACHER_PASSWORD_KEY) || DEFAULT_PASSWORD;
    if (input === savedPassword) {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-panel').classList.add('active');
        localStorage.setItem('teacherLoggedIn', 'true');
        pageHistory = ['home'];
        navigateToPage('home', false);
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
    }
}

window.addEventListener('load', () => {
    if (localStorage.getItem('teacherLoggedIn') === 'true') {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-panel').classList.add('active');
        pageHistory = ['home'];
        navigateToPage('home', false);
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
        loginInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
});

// ============================================================
// Realtime
// ============================================================
function startConversationsRealtime() {
    if (conversationsChannel) return;
    if (typeof subscribeToConversations !== 'function') return;
    conversationsChannel = subscribeToConversations(async (payload) => {
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

// ============================================================
// ناوبری
// ============================================================
function navigateToPage(pageId, addToHistory = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');
    if (addToHistory) {
        if (pageHistory[pageHistory.length - 1] !== pageId) pageHistory.push(pageId);
    }
    const backBtn = document.getElementById('header-back-btn');
    if (backBtn) backBtn.style.display = pageId === 'home' ? 'none' : 'flex';
    const titles = {
        home: 'خانه', students: 'دانش‌آموزان', rankings: 'رتبه‌بندی', messages: 'پیام‌رسانی',
        lessons: 'مدیریت تکالیف', calendar: 'تقویم', contests: 'مسابقات', library: 'کتابخانه',
        reports: 'گزارش‌ها', settings: 'تنظیمات', 'student-profile': 'پروفایل دانش‌آموز'
    };
    const icons = {
        home: '🏠', students: '👥', rankings: '🏆', messages: '💬', lessons: '📚',
        calendar: '📅', contests: '🎯', library: '📖', reports: '📄', settings: '⚙️',
        'student-profile': '👤'
    };
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

function goBack() {
    if (pageHistory.length > 1) {
        pageHistory.pop();
        const prevPage = pageHistory[pageHistory.length - 1];
        navigateToPage(prevPage, false);
    } else {
        logout();
    }
}

// ============================================================
// محاسبه کل unread
// ============================================================
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

// ============================================================
// صفحه خانه
// ============================================================
async function loadHomeData() {
    try {
        const cachedStudents = getCachedData(STUDENTS_CACHE_KEY);
        const cachedConvs = getCachedData(CONVERSATIONS_CACHE_KEY);
        if (cachedStudents && cachedStudents.length > 0) {
            allStudents = cachedStudents;
            const totalStudents = cachedStudents.length;
            const totalLessons = cachedStudents.reduce((sum, s) => sum + (parseInt(s.completed_lessons) || 0), 0);
            document.getElementById('home-stat-students').textContent = toPersianNum(totalStudents);
            document.getElementById('home-stat-lessons').textContent = toPersianNum(totalLessons);
            renderHomeTopStudents(cachedStudents);
        }
        if (cachedConvs && cachedConvs.length > 0) {
            currentConversations = cachedConvs;
            updateHomeBadgesImmediately();
        }
        const [students, conversations] = await Promise.all([
            getAllStudents(),
            getStudentConversationsFromSupabase()
        ]);
        if (students && students.length > 0) {
            allStudents = students;
            setCachedData(STUDENTS_CACHE_KEY, students);
            const totalStudents = students.length;
            const totalLessons = students.reduce((sum, s) => sum + (parseInt(s.completed_lessons) || 0), 0);
            document.getElementById('home-stat-students').textContent = toPersianNum(totalStudents);
            document.getElementById('home-stat-lessons').textContent = toPersianNum(totalLessons);
            renderHomeTopStudents(students);
        }
        if (conversations && conversations.length > 0) {
            conversations.forEach(conv => { conv.unread_count = computeUnreadForConversation(conv); });
            currentConversations = conversations;
            setCachedData(CONVERSATIONS_CACHE_KEY, conversations);
            updateHomeBadgesImmediately();
        }
    } catch (error) { console.error('Error loading home:', error); }
}

function renderHomeTopStudents(students) {
    const container = document.getElementById('home-top-students');
    if (!container) return;
    const top = [...students]
        .sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a))
        .slice(0, 5);
    if (top.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز دانش‌آموزی ثبت‌نام نکرده</div>';
        return;
    }
    let html = '';
    top.forEach((student, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : toPersianNum(rank);
        html += `
            <div class="home-top-item" onclick="openStudentProfile('${student.student_id}')">
                <div class="home-top-rank">${medal}</div>
                <div class="home-top-avatar">${renderAvatarHTML(student)}</div>
                <div class="home-top-info">
                    <div class="home-top-name">${student.name || 'دانش‌آموز'}</div>
                    <div class="home-top-class">${getClassPersianName(student.class_name)}</div>
                </div>
                <div class="home-top-points">
                    <span>⭐</span>
                    <span>${toPersianNum(calculateTotalPoints(student))}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================
// تب‌های پیام‌رسانی
// ============================================================
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

// ============================================================
// ارسال پیام کلاسی
// ============================================================
async function sendClassMessage() {
    const className = document.getElementById('class-message-target').value;
    const title = document.getElementById('class-message-title').value.trim();
    const text = document.getElementById('class-message-text').value.trim();
    const type = document.getElementById('class-message-type').value;
    if (!title) { showToast('لطفاً عنوان پیام را وارد کنید', 'warning'); return; }
    if (!text) { showToast('لطفاً متن پیام را وارد کنید', 'warning'); return; }
    const messageData = {
        message_id: 'cls_' + Date.now(), class_name: className, title: title, text: text, type: type,
        date: new Date().toISOString(), date_persian: new Date().toLocaleDateString('fa-IR')
    };
    try {
        showToast('در حال ارسال...', 'info');
        const result = await sendClassMessageToSupabase(messageData);
        if (result.success) {
            showToast('پیام کلاسی ارسال شد! ✅', 'success');
            document.getElementById('class-message-title').value = '';
            document.getElementById('class-message-text').value = '';
            localStorage.removeItem(CLASS_MESSAGES_CACHE_KEY);
            setTimeout(loadClassMessages, 500);
        } else showToast('خطا در ارسال پیام', 'error');
    } catch (error) { showToast('خطا در ارسال پیام', 'error'); }
}

// ============================================================
// بارگذاری پیام‌های کلاسی
// ============================================================
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
    } catch (error) {
        if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

function renderClassMessages(messages) {
    const container = document.getElementById('class-messages-list');
    if (!container) return;
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز پیام کلاسی ارسال نشده</div>';
        return;
    }
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    const typeTexts = { info: 'ℹ️ اطلاعیه', warning: '⚠️ هشدار', success: '✅ تبریک', reminder: '🔔 یادآوری' };
    let html = '';
    messages.forEach(msg => {
        html += `
            <div class="class-message-item type-${msg.type || 'info'}">
                <div class="class-message-item-header">
                    <div class="class-message-item-title">${msg.title}</div>
                    <div class="class-message-item-type">${typeTexts[msg.type] || 'ℹ️'}</div>
                </div>
                <div class="class-message-item-text">${msg.text}</div>
                <div class="class-message-item-footer">
                    <div class="class-message-item-target">👥 ${getClassPersianName(msg.class_name)}</div>
                    <div>${msg.date_persian || ''}</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================
// بارگذاری مکالمات
// ============================================================
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
        if (currentConversations.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز مکالمه‌ای وجود نداره</div>';
            return;
        }
        renderMessengerList(currentConversations);
        updateHomeBadgesImmediately();
    } catch (error) {
        if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

function renderMessengerList(conversations) {
    const container = document.getElementById('messenger-list-items');
    if (!container) return;
    if (conversations.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">مکالمه‌ای یافت نشد</div>';
        return;
    }
    let html = '';
    conversations.forEach(conv => {
        const isActive = currentChatStudent && currentChatStudent.student_id === conv.student_id;
        const avatarHtml = renderAvatarHTML(conv);
        const unreadCount = conv.unread_count || 0;
        html += `
            <div class="messenger-item ${isActive ? 'active' : ''}" onclick="openChatWith('${conv.student_id}', '${conv.student_name}', '${conv.class_name}')">
                <div class="messenger-item-avatar">${avatarHtml}</div>
                <div class="messenger-item-info">
                    <div class="messenger-item-name">${conv.student_name}</div>
                    <div class="messenger-item-last">${conv.last_message || 'بدون پیام'}</div>
                </div>
                <div class="messenger-item-meta">
                    <div class="messenger-item-time">${conv.last_date_persian || ''}</div>
                    ${unreadCount > 0 ? `<div class="messenger-item-unread">${toPersianNum(unreadCount)}</div>` : ''}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function filterMessengerList(query) {
    query = query.toLowerCase().trim();
    if (!query) { renderMessengerList(currentConversations); return; }
    const filtered = currentConversations.filter(c => (c.student_name || '').toLowerCase().includes(query));
    renderMessengerList(filtered);
}

// ============================================================
// باز کردن چت
// ============================================================
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
    else avatarEl.innerHTML = `<img src="${DEFAULT_AVATAR_URL}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    setReadTime(studentId);
    const convIndex = currentConversations.findIndex(c => c.student_id === studentId);
    if (convIndex >= 0) {
        currentConversations[convIndex].unread_count = 0;
        setCachedData(CONVERSATIONS_CACHE_KEY, currentConversations);
        renderMessengerList(currentConversations);
    }
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

// ============================================================
// بارگذاری پیام‌های چت
// ============================================================
async function loadChatMessages(studentId) {
    const container = document.getElementById('messenger-chat-messages');
    if (!container) return;
    const cacheKey = 'teacherMessagesCache_' + studentId;
    const cached = getCachedData(cacheKey);
    if (cached && cached.length > 0) renderChatMessages(cached);
    else container.innerHTML = '<div class="messenger-chat-messages-empty">در حال بارگذاری...</div>';
    try {
        const messages = await getPersonalMessages(studentId);
        if (messages.length === 0) {
            container.innerHTML = '<div class="messenger-chat-messages-empty">هنوز پیامی رد و بدل نشده<br>اولین پیام رو بفرست!</div>';
            return;
        }
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));
        setCachedData(cacheKey, messages);
        renderChatMessages(messages);
    } catch (error) {
        if (!cached) container.innerHTML = '<div class="messenger-chat-messages-empty">خطا در بارگذاری</div>';
    }
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
        html += `
            <div class="messenger-chat-message ${senderClass}">
                <div>${msg.text}</div>
                <div class="messenger-chat-message-time">${time}${tickHtml}</div>
            </div>
        `;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ============================================================
// ارسال پیام چت
// ============================================================
async function sendChatMessage() {
    if (!currentChatStudent) return;
    const input = document.getElementById('messenger-chat-input');
    const text = input.value.trim();
    if (!text) return;
    const messageData = {
        message_id: 'pm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        student_id: currentChatStudent.student_id,
        student_name: currentChatStudent.student_name,
        class_name: currentChatStudent.class_name,
        sender: 'teacher', text: text,
        date: new Date().toISOString(),
        date_persian: new Date().toLocaleDateString('fa-IR'),
        is_seen: false
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
    } catch (error) { showToast('خطا در ارسال پیام', 'error'); }
}

// ============================================================
// نوتیفیکیشن درون‌برنامه‌ای
// ============================================================
function showTeacherInAppNotification(studentName, message, studentId) {
    document.querySelectorAll('.inapp-notification').forEach(n => n.remove());
    const notif = document.createElement('div');
    notif.className = 'inapp-notification';
    notif.innerHTML = `
        <div class="inapp-icon">💬</div>
        <div class="inapp-content">
            <div class="inapp-title">پیام از ${studentName}</div>
            <div class="inapp-text">${(message || '').substring(0, 60)}${(message || '').length > 60 ? '...' : ''}</div>
        </div>
    `;
    notif.onclick = () => {
        notif.remove();
        navigateToPage('messages', true);
        setTimeout(() => {
            switchMessagesTab('personal');
            setTimeout(() => {
                const conv = currentConversations.find(c => c.student_id === studentId);
                if (conv) openChatWith(studentId, conv.student_name, conv.class_name);
            }, 400);
        }, 300);
    };
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 50);
    setTimeout(() => { notif.classList.remove('show'); setTimeout(() => notif.remove(), 400); }, 6000);
}

// ============================================================
// صدای دینگ
// ============================================================
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

// ============================================================
// دانش‌آموزان
// ============================================================
async function loadStudents() {
    const container = document.getElementById('students-grid');
    if (!container) return;
    const cached = getCachedData(STUDENTS_CACHE_KEY);
    if (cached && cached.length > 0) { allStudents = cached; renderStudents(allStudents); }
    else container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const students = await getAllStudents();
        allStudents = students;
        setCachedData(STUDENTS_CACHE_KEY, allStudents);
        renderStudents(allStudents);
    } catch (error) {
        if (!cached) container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

function renderStudents(students) {
    const container = document.getElementById('students-grid');
    if (!container) return;
    if (students.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">دانش‌آموزی یافت نشد</div>';
        return;
    }
    let html = '';
    students.forEach(student => {
        html += `
            <div class="student-card" onclick="openStudentProfile('${student.student_id}')">
                <div class="student-avatar">${renderAvatarHTML(student)}</div>
                <div class="student-info">
                    <div class="student-name">${student.name || 'بدون نام'}</div>
                    <span class="student-class">${getClassPersianName(student.class_name)}</span>
                    <div class="student-stats">
                        <span>📚 ${toPersianNum(student.completed_lessons || 0)} تکلیف</span>
                        <span>📊 ${toPersianNum(student.avg_percent || 0)}%</span>
                    </div>
                </div>
                <div class="student-points">
                    <span>⭐</span>
                    <span>${toPersianNum(calculateTotalPoints(student))}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function filterStudents() {
    const query = document.getElementById('student-search').value.toLowerCase().trim();
    const classFilter = document.getElementById('student-class-filter').value;
    let filtered = allStudents;
    if (classFilter !== 'all') filtered = filtered.filter(s => s.class_name === classFilter);
    if (query) filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(query));
    renderStudents(filtered);
}

// ============================================================
// باز کردن پروفایل دانش‌آموز
// ============================================================
async function openStudentProfile(studentId) {
    const student = allStudents.find(s => s.student_id === studentId);
    if (!student) { showToast('دانش‌آموز پیدا نشد', 'error'); return; }

    currentProfileStudent = student;
    vibrate(15);

    const content = document.getElementById('student-profile-content');
    if (content) content.innerHTML = '<div style="text-align:center; padding:60px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';

    navigateToPage('student-profile', true);

    try {
        const response = await fetch('./lessons/index.json');
        const data = await response.json();
        currentProfileLessons = data.lessons || [];

        console.log('📋 شروع بارگذاری اطلاعات دانش‌آموز:', student.name);
        
        // بارگذاری وضعیت و کارنامه‌ها
        currentProfileStatus = await getLessonStatusForStudent(studentId);
        currentProfileReports = await getStudentReports(studentId);
        
        console.log('✅ وضعیت تکالیف:', currentProfileStatus);
        console.log('✅ کارنامه‌ها:', currentProfileReports);

        renderStudentProfile();
    } catch (error) {
        console.error('خطا در بارگذاری پروفایل:', error);
        if (content) content.innerHTML = '<div style="text-align:center; padding:60px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

// ============================================================
// رندر پروفایل دانش‌آموز
// ============================================================
function renderStudentProfile() {
    const container = document.getElementById('student-profile-content');
    if (!container || !currentProfileStudent) return;

    const student = currentProfileStudent;
    const totalPoints = calculateTotalPoints(student);
    const classPersian = getClassPersianName(student.class_name);

    // نقشه‌ی کارنامه‌ها
    const reportMap = {};
    currentProfileReports.forEach(r => {
        if (!reportMap[r.lesson_id]) {
            reportMap[r.lesson_id] = r;
        }
    });

    let lessonsHTML = '';
    currentProfileLessons.forEach(lesson => {
        const status = currentProfileStatus[lesson.id] || { is_enabled: true };
        const isEnabled = status.is_enabled !== false;
        const report = reportMap[lesson.id];
        const isDone = !!report;

        let reportHTML = '';
        if (isDone) {
            reportHTML = `
                <div class="profile-lesson-report done">
                    <div class="report-row">
                        <span class="report-label">✅ انجام شده</span>
                        <span class="report-value-percent">${toPersianNum(report.percent || 0)}%</span>
                    </div>
                    <div class="report-row">
                        <span class="report-label">امتیاز کسب‌شده:</span>
                        <span class="report-value-points">${toPersianNum(report.score || 0)} از ${toPersianNum(report.total_points || 0)}</span>
                    </div>
                    <div class="report-row">
                        <span class="report-label">پاسخ صحیح:</span>
                        <span class="report-value">${toPersianNum(report.correct || 0)}</span>
                    </div>
                    <div class="report-row">
                        <span class="report-label">پاسخ غلط:</span>
                        <span class="report-value">${toPersianNum(report.wrong || 0)}</span>
                    </div>
                </div>
            `;
        } else {
            reportHTML = `
                <div class="profile-lesson-report pending">
                    <span class="report-badge pending">⏳ انجام نشده</span>
                </div>
            `;
        }

        // سوییچ فقط برای تکالیف انجام‌نشده
        const toggleHTML = isDone ? '' : `
            <div class="profile-lesson-toggle">
                <span class="toggle-label ${isEnabled ? 'enabled' : 'disabled'}">
                    ${isEnabled ? '🟢 فعال' : '🔴 غیرفعال'}
                </span>
                <label class="switch-small">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''}
                           onchange="toggleLessonEnabled('${lesson.id}', this.checked)">
                    <span class="slider-small"></span>
                </label>
            </div>
        `;

        lessonsHTML += `
            <div class="profile-lesson-item ${!isEnabled && !isDone ? 'disabled' : ''} ${isDone ? 'done' : ''}">
                <div class="profile-lesson-header">
                    <div class="profile-lesson-title">${lesson.title}</div>
                    ${isDone ? '<span class="lesson-done-badge">✓</span>' : ''}
                </div>
                <div class="profile-lesson-meta">
                    <span>📅 مهلت: ${lesson.dueDate || 'نامشخص'}</span>
                    <span>📝 ${toPersianNum(lesson.activityCount || 0)} سوال</span>
                </div>
                ${reportHTML}
                ${toggleHTML}
            </div>
        `;
    });

    if (currentProfileLessons.length === 0) {
        lessonsHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">تکلیفی یافت نشد</div>';
    }

    container.innerHTML = `
        <div class="profile-header-card">
            <div class="profile-avatar-big">${renderAvatarHTML(student)}</div>
            <div class="profile-name-big">${student.name || 'بدون نام'}</div>
            <div class="profile-class-big">${classPersian}</div>
        </div>

        <div class="profile-stats-grid">
            <div class="profile-stat-card">
                <div class="profile-stat-icon">⭐</div>
                <div class="profile-stat-value">${toPersianNum(totalPoints)}</div>
                <div class="profile-stat-label">امتیاز کل</div>
            </div>
            <div class="profile-stat-card">
                <div class="profile-stat-icon">📚</div>
                <div class="profile-stat-value">${toPersianNum(student.completed_lessons || 0)}</div>
                <div class="profile-stat-label">تکالیف انجام‌شده</div>
            </div>
            <div class="profile-stat-card">
                <div class="profile-stat-icon">📊</div>
                <div class="profile-stat-value">${toPersianNum(student.avg_percent || 0)}%</div>
                <div class="profile-stat-label">میانگین درصد</div>
            </div>
            <div class="profile-stat-card">
                <div class="profile-stat-icon">🔥</div>
                <div class="profile-stat-value">${toPersianNum(student.streak_days || 0)}</div>
                <div class="profile-stat-label">روز متوالی</div>
            </div>
        </div>

        <button class="profile-chat-btn" onclick="goToChatFromProfile()">
            💬 چت با این دانش‌آموز
        </button>

        <div class="profile-total-points-card">
            <div class="profile-total-points-label">⭐ امتیاز کل (قابل ویرایش)</div>
            <div class="profile-total-points-value">${toPersianNum(totalPoints)}</div>
            <div class="profile-total-points-actions">
                <button class="point-btn minus" onclick="changeTotalPoints(-10)">−۱۰</button>
                <button class="point-btn minus" onclick="changeTotalPoints(-1)">−۱</button>
                <button class="point-btn plus" onclick="changeTotalPoints(1)">+۱</button>
                <button class="point-btn plus" onclick="changeTotalPoints(10)">+۱۰</button>
            </div>
        </div>

        <div class="profile-lessons-card">
            <div class="profile-lessons-title">📚 مدیریت تکالیف</div>
            <div class="profile-lessons-list">
                ${lessonsHTML}
            </div>
        </div>
    `;
}

// ============================================================
// فعال/غیرفعال کردن تکلیف
// ============================================================
async function toggleLessonEnabled(lessonId, isEnabled) {
    if (!currentProfileStudent) return;
    vibrate(15);
    
    const status = currentProfileStatus[lessonId] || { is_enabled: true };
    
    console.log('🔄 تغییر وضعیت:', {
        student: currentProfileStudent.student_id,
        lesson: lessonId,
        newState: isEnabled
    });
    
    const result = await updateLessonStatus(currentProfileStudent.student_id, lessonId, {
        is_enabled: isEnabled
    });
    
    if (result.success) {
        currentProfileStatus[lessonId] = { ...status, is_enabled: isEnabled };
        renderStudentProfile();
        showToast(isEnabled ? '✅ تکلیف فعال شد' : '⛔ تکلیف غیرفعال شد', 'success');
    } else {
        console.error('❌ خطا:', result.error);
        showToast('خطا در تغییر وضعیت', 'error');
    }
}

// ============================================================
// تغییر امتیاز کل
// ============================================================
async function changeTotalPoints(delta) {
    if (!currentProfileStudent) return;
    vibrate(15);

    try {
        const client = getSupabase();
        if (!client) {
            showToast('اتصال به سرور برقرار نیست', 'error');
            return;
        }

        const currentAdded = parseInt(currentProfileStudent.custom_points_added) || 0;
        const newCustomAdded = currentAdded + delta;

        console.log('🔄 تغییر امتیاز کل:', {
            student: currentProfileStudent.name,
            oldAdded: currentAdded,
            newAdded: newCustomAdded,
            delta: delta
        });

        const { error } = await client
            .from('rankings')
            .update({ custom_points_added: newCustomAdded })
            .eq('student_id', currentProfileStudent.student_id);

        if (error) throw error;

        // به‌روزرسانی در حافظه
        currentProfileStudent.custom_points_added = newCustomAdded;
        
        // پاک کردن کش‌ها
        localStorage.removeItem(STUDENTS_CACHE_KEY);
        
        // به‌روزرسانی صفحه
        renderStudentProfile();
        showToast(`امتیاز کل ${delta > 0 ? '+' + delta : delta} شد`, 'success');
        
    } catch (error) {
        console.error('❌ خطا در تغییر امتیاز:', error);
        showToast('خطا در به‌روزرسانی امتیاز کل', 'error');
    }
}

// ============================================================
// رفتن به چت از پروفایل
// ============================================================
function goToChatFromProfile() {
    if (!currentProfileStudent) return;
    const student = currentProfileStudent;
    navigateToPage('messages', true);
    setTimeout(() => {
        switchMessagesTab('personal');
        setTimeout(() => {
            openChatWith(student.student_id, student.name, student.class_name);
        }, 400);
    }, 300);
}

// ============================================================
// رتبه‌بندی
// ============================================================
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
        if (!allData) {
            const response = await getAllStudents();
            allData = response || [];
            setCachedData(STUDENTS_CACHE_KEY, allData);
        }
        const rankings = allData
            .filter(s => s.class_name === currentRankingClass)
            .sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a));
        const countEl = document.getElementById('rankings-current-count');
        if (countEl) countEl.textContent = `${toPersianNum(rankings.length)} دانش‌آموز`;
        if (rankings.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">دانش‌آموزی در این کلاس نیست</div>';
            return;
        }
        let html = '';
        rankings.forEach((student, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : toPersianNum(rank);
            html += `
                <div class="ranking-item ${rankClass}" onclick="openStudentProfile('${student.student_id}')">
                    <div class="ranking-rank">${medal}</div>
                    <div class="student-avatar" style="width:46px;height:46px;">${renderAvatarHTML(student)}</div>
                    <div class="student-info">
                        <div class="student-name">${student.name || 'بدون نام'}</div>
                        <span class="student-class">${toPersianNum(student.completed_lessons || 0)} تکلیف • ${toPersianNum(student.avg_percent || 0)}%</span>
                    </div>
                    <div class="student-points">
                        <span>⭐</span>
                        <span>${toPersianNum(calculateTotalPoints(student))}</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

// ============================================================
// مدیریت تکالیف
// ============================================================
async function loadLessonsPage() {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    const cached = getCachedData(LESSONS_CACHE_KEY, 600000);
    if (cached && cached.length > 0) renderLessonsList(cached);
    else container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const response = await fetch('./lessons/index.json');
        const data = await response.json();
        const lessons = data.lessons || [];
        setCachedData(LESSONS_CACHE_KEY, lessons);
        renderLessonsList(lessons);
    } catch (error) {
        if (!cached) container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

function renderLessonsList(lessons) {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    if (!lessons || lessons.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">تکلیفی یافت نشد</div>';
        return;
    }
    let html = '';
    lessons.forEach(lesson => {
        html += `
            <div class="lesson-item">
                <div class="lesson-item-icon">📚</div>
                <div class="lesson-item-info">
                    <div class="lesson-item-title">${lesson.title}</div>
                    <div class="lesson-item-meta">
                        <span>📅 مهلت: ${lesson.dueDate || 'نامشخص'}</span>
                        <span>📝 ${toPersianNum(lesson.activityCount || 0)} سوال</span>
                    </div>
                </div>
                <div class="lesson-item-status active">فعال</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================
// تقویم
// ============================================================
async function addEvent() {
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value.trim();
    const cls = document.getElementById('event-class').value;
    const type = document.getElementById('event-type').value;
    const desc = document.getElementById('event-desc').value.trim();
    if (!title || !date) { showToast('لطفاً عنوان و تاریخ را وارد کنید', 'warning'); return; }
    try {
        const result = await addEventToSupabase({ event_id: 'evt_' + Date.now(), title, date, class_name: cls, type, description: desc });
        if (result.success) {
            showToast('رویداد با موفقیت ثبت شد', 'success');
            document.getElementById('event-title').value = '';
            document.getElementById('event-date').value = '';
            document.getElementById('event-desc').value = '';
            localStorage.removeItem(EVENTS_CACHE_KEY);
            loadEvents();
        } else showToast('خطا در ثبت رویداد', 'error');
    } catch (error) { showToast('خطا در ثبت رویداد', 'error'); }
}

async function loadEvents() {
    const container = document.getElementById('events-list');
    if (!container) return;
    const cached = getCachedData(EVENTS_CACHE_KEY);
    if (cached && cached.length > 0) renderEvents(cached);
    else container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const events = await getEventsFromSupabase();
        setCachedData(EVENTS_CACHE_KEY, events);
        renderEvents(events);
    } catch (error) {
        if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

function renderEvents(events) {
    const container = document.getElementById('events-list');
    if (!container) return;
    if (!events || events.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز رویدادی ثبت نشده</div>';
        return;
    }
    const typeIcons = { exam: '📝', homework: '📚', holiday: '🎉', event: '📌' };
    let html = '';
    events.forEach(evt => {
        html += `
            <div class="event-item">
                <div class="event-item-icon">${typeIcons[evt.type] || '📌'}</div>
                <div class="event-item-info">
                    <div class="event-item-title">${evt.title}</div>
                    <div class="event-item-meta">${evt.date} • ${getClassPersianName(evt.class_name)}${evt.description ? ' • ' + evt.description : ''}</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================
// مسابقات
// ============================================================
async function addContest() {
    const title = document.getElementById('contest-title').value.trim();
    const prize = document.getElementById('contest-prize').value.trim();
    const start = document.getElementById('contest-start').value.trim();
    const end = document.getElementById('contest-end').value.trim();
    const desc = document.getElementById('contest-desc').value.trim();
    if (!title || !start || !end) { showToast('لطفاً عنوان و تاریخ‌ها را وارد کنید', 'warning'); return; }
    try {
        const result = await addContestToSupabase({ contest_id: 'cnt_' + Date.now(), title, prize, start_date: start, end_date: end, description: desc });
        if (result.success) {
            showToast('مسابقه با موفقیت ایجاد شد', 'success');
            document.getElementById('contest-title').value = '';
            document.getElementById('contest-prize').value = '';
            document.getElementById('contest-start').value = '';
            document.getElementById('contest-end').value = '';
            document.getElementById('contest-desc').value = '';
            localStorage.removeItem(CONTESTS_CACHE_KEY);
            loadContests();
        } else showToast('خطا در ایجاد مسابقه', 'error');
    } catch (error) { showToast('خطا در ایجاد مسابقه', 'error'); }
}

async function loadContests() {
    const container = document.getElementById('contests-list');
    if (!container) return;
    const cached = getCachedData(CONTESTS_CACHE_KEY);
    if (cached && cached.length > 0) renderContests(cached);
    else container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const contests = await getContestsFromSupabase();
        setCachedData(CONTESTS_CACHE_KEY, contests);
        renderContests(contests);
    } catch (error) {
        if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

function renderContests(contests) {
    const container = document.getElementById('contests-list');
    if (!container) return;
    if (!contests || contests.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز مسابقه‌ای نیست</div>';
        return;
    }
    let html = '';
    contests.forEach(c => {
        html += `
            <div class="contest-item">
                <div class="contest-item-icon">🏆</div>
                <div class="contest-item-info">
                    <div class="contest-item-title">${c.title}</div>
                    <div class="contest-item-meta">🎁 ${c.prize || 'بدون جایزه'} • 📅 از ${c.start_date} تا ${c.end_date}</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================
// کتابخانه
// ============================================================
async function addLibraryItem() {
    const title = document.getElementById('lib-title').value.trim();
    const type = document.getElementById('lib-type').value;
    const url = document.getElementById('lib-url').value.trim();
    const desc = document.getElementById('lib-desc').value.trim();
    if (!title || !url) { showToast('لطفاً عنوان و لینک را وارد کنید', 'warning'); return; }
    try {
        const result = await addLibraryToSupabase({ item_id: 'lib_' + Date.now(), title, type, url, description: desc });
        if (result.success) {
            showToast('منبع با موفقیت اضافه شد', 'success');
            document.getElementById('lib-title').value = '';
            document.getElementById('lib-url').value = '';
            document.getElementById('lib-desc').value = '';
            localStorage.removeItem(LIBRARY_CACHE_KEY);
            loadLibrary();
        } else showToast('خطا در افزودن منبع', 'error');
    } catch (error) { showToast('خطا در افزودن منبع', 'error'); }
}

async function loadLibrary() {
    const container = document.getElementById('library-list');
    if (!container) return;
    const cached = getCachedData(LIBRARY_CACHE_KEY);
    if (cached && cached.length > 0) renderLibrary(cached);
    else container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    try {
        const items = await getLibraryFromSupabase();
        setCachedData(LIBRARY_CACHE_KEY, items);
        renderLibrary(items);
    } catch (error) {
        if (!cached) container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

function renderLibrary(items) {
    const container = document.getElementById('library-list');
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز منبعی اضافه نشده</div>';
        return;
    }
    const typeIcons = { video: '🎬', pdf: '📄', audio: '🎵', site: '🌐', book: '📚' };
    let html = '';
    items.forEach(item => {
        html += `
            <div class="library-item">
                <div class="library-item-icon">${typeIcons[item.type] || '📄'}</div>
                <div class="library-item-info">
                    <div class="library-item-title">${item.title}</div>
                    <div class="library-item-meta">${item.description || ''} • <a href="${item.url}" target="_blank" style="color:#1976d2;">باز کردن</a></div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================
// گزارش‌ها
// ============================================================
function downloadAllStudents() {
    if (allStudents.length === 0) { showToast('داده‌ای برای دانلود نیست', 'warning'); return; }
    let csv = '\uFEFF';
    csv += 'نام,کلاس,امتیاز,تکالیف,درصد,روز متوالی\n';
    allStudents.forEach(s => {
        csv += `"${s.name}","${getClassPersianName(s.class_name)}",${calculateTotalPoints(s)},${s.completed_lessons},${s.avg_percent},${s.streak_days || 0}\n`;
    });
    downloadFile(csv, 'دانش‌آموزان.csv', 'text/csv');
    showToast('فایل دانلود شد', 'success');
}

function downloadClassReport() {
    const cls = document.getElementById('report-class-filter').value;
    const filtered = cls === 'all' ? allStudents : allStudents.filter(s => s.class_name === cls);
    if (filtered.length === 0) { showToast('داده‌ای برای دانلود نیست', 'warning'); return; }
    let csv = '\uFEFF';
    csv += 'نام,امتیاز,تکالیف,درصد\n';
    filtered.forEach(s => { csv += `"${s.name}",${calculateTotalPoints(s)},${s.completed_lessons},${s.avg_percent}\n`; });
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

function printStudentCertificates() { showToast('این قابلیت به‌زودی اضافه می‌شه', 'info'); }

function showTopStudentsReport() {
    const top = [...allStudents]
        .sort((a, b) => calculateTotalPoints(b) - calculateTotalPoints(a))
        .slice(0, 10);
    const container = document.getElementById('full-report-content');
    if (top.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">داده‌ای نیست</div>';
        return;
    }
    let html = '<div style="font-weight:900; color:#1976d2; margin-bottom:12px; font-size:15px;">🏆 ۱۰ دانش‌آموز برتر:</div>';
    top.forEach((s, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : toPersianNum(i + 1) + '.';
        html += `<div style="padding:8px 0; border-bottom:1px dashed #e3f2fd; font-size:13px;">
            ${medal} <strong>${s.name}</strong> - ${getClassPersianName(s.class_name)} - 
            <span style="color:#f57c00; font-weight:900;">${toPersianNum(calculateTotalPoints(s))} امتیاز</span>
        </div>`;
    });
    container.innerHTML = html;
}

function generateFullReport() {
    const cls = document.getElementById('report-class-filter').value;
    const filtered = cls === 'all' ? allStudents : allStudents.filter(s => s.class_name === cls);
    const container = document.getElementById('full-report-content');
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">داده‌ای نیست</div>';
        return;
    }
    const totalPoints = filtered.reduce((sum, s) => sum + calculateTotalPoints(s), 0);
    const avgPoints = Math.round(totalPoints / filtered.length);
    const totalLessons = filtered.reduce((sum, s) => sum + (parseInt(s.completed_lessons) || 0), 0);
    const avgPercent = Math.round(filtered.reduce((sum, s) => sum + (parseInt(s.avg_percent) || 0), 0) / filtered.length);
    let html = `
        <div style="font-weight:900; color:#1976d2; margin-bottom:15px; font-size:15px;">
            📊 گزارش ${cls === 'all' ? 'همه کلاس‌ها' : getClassPersianName(cls)}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div style="padding:12px; background:#fff; border-radius:12px;">
                <div style="font-size:11px; color:#78909c; font-weight:bold;">تعداد دانش‌آموزان</div>
                <div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(filtered.length)}</div>
            </div>
            <div style="padding:12px; background:#fff; border-radius:12px;">
                <div style="font-size:11px; color:#78909c; font-weight:bold;">میانگین امتیاز</div>
                <div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(avgPoints)}</div>
            </div>
            <div style="padding:12px; background:#fff; border-radius:12px;">
                <div style="font-size:11px; color:#78909c; font-weight:bold;">کل تکالیف</div>
                <div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(totalLessons)}</div>
            </div>
            <div style="padding:12px; background:#fff; border-radius:12px;">
                <div style="font-size:11px; color:#78909c; font-weight:bold;">میانگین درصد</div>
                <div style="font-size:20px; color:#1976d2; font-weight:900;">${toPersianNum(avgPercent)}%</div>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// ============================================================
// تنظیمات
// ============================================================
function changePassword() {
    const newPassword = prompt('رمز جدید را وارد کنید:');
    if (newPassword && newPassword.length >= 4) {
        localStorage.setItem(TEACHER_PASSWORD_KEY, newPassword);
        showToast('رمز با موفقیت تغییر کرد', 'success');
    } else if (newPassword) showToast('رمز باید حداقل ۴ کاراکتر باشد', 'warning');
}

function clearCache() {
    if (confirm('آیا مطمئن هستید؟ تمام داده‌های ذخیره‌شده پاک می‌شوند.')) {
        const password = localStorage.getItem(TEACHER_PASSWORD_KEY);
        const loggedIn = localStorage.getItem('teacherLoggedIn');
        localStorage.clear();
        if (password) localStorage.setItem(TEACHER_PASSWORD_KEY, password);
        if (loggedIn) localStorage.setItem('teacherLoggedIn', loggedIn);
        showToast('کش با موفقیت پاک شد', 'success');
        setTimeout(() => location.reload(), 1000);
    }
}

console.log('🎓 پنل معلم عربی هفتم - نسخه ۱۶.۰.۰');
console.log('✅ کارنامه‌های واقعی از Supabase');
console.log('✅ سوییچ فعال/غیرفعال واضح');