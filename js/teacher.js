// ============================================================
// teacher.js — منطق پنل معلم
// نسخه: ۱۱.۰.۰ — Cache-First + Pre-Fetch + Background Sync
// ============================================================

// ============================================================
// تنظیمات
// ============================================================
const TEACHER_API_URL = 'https://script.google.com/macros/s/AKfycbzwzU7HKqlWOSyG2gN750kFSi-qQLoqzwDRYMnEKqpmTgCMPlRyQZcQrcoZlI4MIR3o/exec';
const TEACHER_PASSWORD_KEY = 'teacherPassword';
const DEFAULT_PASSWORD = 'hadi1383';
const READ_TIMES_KEY = 'teacherReadTimes';
const MESSAGES_CACHE_DURATION = 3600000;  // 🆕 ۱ ساعت (به‌جای ۵ دقیقه)
const CONVERSATIONS_CACHE_KEY = 'teacherConversationsCache';
const CLASS_MESSAGES_CACHE_KEY = 'teacherClassMessagesCache';
const STUDENTS_CACHE_KEY = 'teacherStudentsCache';
const LESSONS_CACHE_KEY = 'teacherLessonsCache';
const EVENTS_CACHE_KEY = 'teacherEventsCache';
const CONTESTS_CACHE_KEY = 'teacherContestsCache';
const LIBRARY_CACHE_KEY = 'teacherLibraryCache';
const CHAT_POLLING_INTERVAL = 3000;
const CONVERSATION_POLLING_INTERVAL = 3000;

let allStudents = [];
let currentConversations = [];
let currentChatStudent = null;
let chatPollingInterval = null;
let conversationPollingInterval = null;
let currentRankingClass = 'hafom-1';
let pageHistory = ['home'];

let isFetchingConversations = false;
let isFetchingChat = false;

// 🆕 Pre-Fetch Status
let prefetchDone = {
    students: false,
    conversations: false,
    classMessages: false
};

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
        'hafom-1': 'هفتم یک',
        'hafom-2': 'هفتم دو',
        'hafom-3': 'هفتم سه',
        'hafom-4': 'هفتم چهار',
        'hafom-5': 'هفتم پنج',
        'all': 'همه کلاس‌ها'
    };
    return map[slug] || slug || 'نامشخص';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const text = document.getElementById('toast-text');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    icon.textContent = icons[type] || '✅';
    text.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================================
// مدیریت زمان خواندن
// ============================================================
function getReadTimes() {
    try {
        return JSON.parse(localStorage.getItem(READ_TIMES_KEY) || '{}');
    } catch (e) {
        return {};
    }
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

// ============================================================
// محاسبه unread
// ============================================================
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
        if (cached && (Date.now() - cached.timestamp < duration)) {
            return cached.data;
        }
        return null;
    } catch (e) {
        return null;
    }
}

function setCachedData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('خطا در ذخیره کش:', e);
    }
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
        
        // 🆕 اول صفحه خانه رو از کش نشون بده (فوری)
        navigateToPage('home', false);
        
        // 🆕 بعد Pre-Fetch همه‌ی داده‌ها رو در پس‌زمینه شروع کن
        setTimeout(() => prefetchAllData(), 100);
        
        setTimeout(() => {
            const apiInput = document.getElementById('setting-api-url');
            if (apiInput) apiInput.value = TEACHER_API_URL;
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
        stopChatPolling();
        stopConversationPolling();
        pageHistory = ['home'];
        
        // 🆕 ریست Pre-Fetch Status
        prefetchDone = { students: false, conversations: false, classMessages: false };
    }
}

// ============================================================
// 🆕 Pre-Fetch همه‌ی داده‌ها در پس‌زمینه
// ============================================================
async function prefetchAllData() {
    console.log('🚀 شروع Pre-Fetch داده‌ها...');
    const startTime = performance.now();
    
    // این‌ها رو موازی اجرا کن
    const tasks = [
        prefetchStudents(),
        prefetchConversations(),
        prefetchClassMessages(),
        prefetchEvents(),
        prefetchContests(),
        prefetchLibrary()
    ];
    
    try {
        await Promise.allSettled(tasks);
        const elapsed = Math.round(performance.now() - startTime);
        console.log(`✅ Pre-Fetch کامل شد در ${elapsed} میلی‌ثانیه`);
        
        // 🆕 بعد از Pre-Fetch، صفحه فعلی رو دوباره رندر کن
        const activePage = document.querySelector('.page.active');
        if (activePage) {
            const pageId = activePage.id.replace('page-', '');
            console.log('🔄 رندر مجدد صفحه:', pageId);
        }
    } catch (e) {
        console.warn('خطا در Pre-Fetch:', e);
    }
}

async function prefetchStudents() {
    try {
        const response = await apiGet({ action: 'getAllStudents' });
        if (response.data) {
            setCachedData(STUDENTS_CACHE_KEY, response.data);
            allStudents = response.data;
            prefetchDone.students = true;
        }
    } catch (e) {}
}

async function prefetchConversations() {
    try {
        const response = await apiGet({ action: 'getStudentConversations' });
        if (response.data) {
            response.data.forEach(conv => {
                conv.unread_count = computeUnreadForConversation(conv);
            });
            setCachedData(CONVERSATIONS_CACHE_KEY, response.data);
            currentConversations = response.data;
            prefetchDone.conversations = true;
            
            // Badge رو آپدیت کن
            updateHomeBadgesImmediately();
        }
    } catch (e) {}
}

async function prefetchClassMessages() {
    try {
        const response = await apiGet({ action: 'getClassMessages' });
        if (response.data) {
            setCachedData(CLASS_MESSAGES_CACHE_KEY, response.data);
            prefetchDone.classMessages = true;
        }
    } catch (e) {}
}

async function prefetchEvents() {
    try {
        const response = await apiGet({ action: 'getEvents' });
        if (response.data) {
            setCachedData(EVENTS_CACHE_KEY, response.data);
        }
    } catch (e) {}
}

async function prefetchContests() {
    try {
        const response = await apiGet({ action: 'getContests' });
        if (response.data) {
            setCachedData(CONTESTS_CACHE_KEY, response.data);
        }
    } catch (e) {}
}

async function prefetchLibrary() {
    try {
        const response = await apiGet({ action: 'getLibrary' });
        if (response.data) {
            setCachedData(LIBRARY_CACHE_KEY, response.data);
        }
    } catch (e) {}
}

// ============================================================
// Window Load — شروع سریع
// ============================================================
window.addEventListener('load', () => {
    if (localStorage.getItem('teacherLoggedIn') === 'true') {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-panel').classList.add('active');
        
        pageHistory = ['home'];
        
        // 🆕 اول از کش (فوری)
        navigateToPage('home', false);
        
        // 🆕 بعد Pre-Fetch در پس‌زمینه
        setTimeout(() => prefetchAllData(), 100);
        
        setTimeout(() => {
            const apiInput = document.getElementById('setting-api-url');
            if (apiInput) apiInput.value = TEACHER_API_URL;
        }, 500);
        
        // Badge فوری از کش
        setTimeout(() => {
            updateHomeBadgesImmediately();
        }, 50);
    }
    
    const loginInput = document.getElementById('login-password');
    if (loginInput) {
        loginInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
});

// ============================================================
// ناوبری
// ============================================================
function navigateToPage(pageId, addToHistory = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');
    
    if (addToHistory) {
        if (pageHistory[pageHistory.length - 1] !== pageId) {
            pageHistory.push(pageId);
        }
    }
    
    const backBtn = document.getElementById('header-back-btn');
    if (backBtn) {
        backBtn.style.display = pageId === 'home' ? 'none' : 'flex';
    }
    
    const titles = {
        home: 'خانه', students: 'دانش‌آموزان', rankings: 'رتبه‌بندی',
        messages: 'پیام‌رسانی', lessons: 'مدیریت تکالیف', calendar: 'تقویم',
        contests: 'مسابقات', library: 'کتابخانه', reports: 'گزارش‌ها', settings: 'تنظیمات'
    };
    const icons = {
        home: '🏠', students: '👥', rankings: '🏆', messages: '💬',
        lessons: '📚', calendar: '📅', contests: '🎯', library: '📖',
        reports: '📄', settings: '⚙️'
    };
    
    const titleEl = document.getElementById('panel-page-title');
    const iconEl = document.getElementById('header-icon');
    if (titleEl) titleEl.textContent = titles[pageId] || 'خانه';
    if (iconEl) iconEl.textContent = icons[pageId] || '🎓';
    
    if (pageId !== 'messages') {
        stopChatPolling();
        stopConversationPolling();
    }
    
    // 🆕 همیشه اول از کش نشون بده
    switch (pageId) {
        case 'home': 
            loadHomeData(); // این خودش cache-first هست
            break;
        case 'students': 
            renderStudentsFromCache().then(() => {
                if (!prefetchDone.students) loadStudents();
            });
            break;
        case 'rankings': 
            loadRankings(); // cache-first
            break;
        case 'messages': 
            loadClassMessagesFromCache();
            loadConversationsFromCache();
            startConversationPolling();
            break;
        case 'lessons': 
            loadLessonsPage(); // cache-first
            break;
        case 'calendar': 
            loadEventsFromCache().then(() => {
                if (!getCachedData(EVENTS_CACHE_KEY)) loadEvents();
            });
            break;
        case 'contests': 
            loadContestsFromCache().then(() => {
                if (!getCachedData(CONTESTS_CACHE_KEY)) loadContests();
            });
            break;
        case 'library': 
            loadLibraryFromCache().then(() => {
                if (!getCachedData(LIBRARY_CACHE_KEY)) loadLibrary();
            });
            break;
    }
}

function showPage(pageId) {
    navigateToPage(pageId, true);
}

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
// درخواست به API
// ============================================================
async function apiGet(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${TEACHER_API_URL}?${queryString}` : TEACHER_API_URL;
    
    try {
        const response = await fetch(url + '&t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP error');
        return await response.json();
    } catch (error) {
        console.error('API GET error:', error);
        throw error;
    }
}

async function apiPost(data) {
    try {
        await fetch(TEACHER_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        });
        return { success: true };
    } catch (error) {
        console.error('API POST error:', error);
        throw error;
    }
}

// ============================================================
// محاسبه کل unread
// ============================================================
function computeTotalUnread() {
    if (!currentConversations || currentConversations.length === 0) return 0;
    let total = 0;
    currentConversations.forEach(conv => {
        total += computeUnreadForConversation(conv);
    });
    return total;
}

// ============================================================
// آپدیت فوری Badge
// ============================================================
function updateHomeBadgesImmediately() {
    const cached = getCachedData(CONVERSATIONS_CACHE_KEY);
    if (!cached) return;
    
    currentConversations = cached;
    const totalUnread = computeTotalUnread();
    
    const msgStat = document.getElementById('home-stat-messages');
    if (msgStat) msgStat.textContent = toPersianNum(totalUnread);
    
    const badge = document.getElementById('home-badge-messages');
    if (badge) {
        if (totalUnread > 0) {
            badge.textContent = toPersianNum(totalUnread);
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
    
    const tabBadge = document.getElementById('personal-unread-badge');
    if (tabBadge) {
        if (totalUnread > 0) {
            tabBadge.textContent = toPersianNum(totalUnread);
            tabBadge.style.display = 'block';
        } else {
            tabBadge.style.display = 'none';
        }
    }
}

// ============================================================
// 🆕 صفحه خانه — Cache-First
// ============================================================
async function loadHomeData() {
    // ⚡ مرحله ۱: از کش (فوری)
    const cachedStudents = getCachedData(STUDENTS_CACHE_KEY);
    if (cachedStudents && cachedStudents.length > 0) {
        allStudents = cachedStudents;
        renderHomeStats(cachedStudents);
        renderHomeTopStudents(cachedStudents);
        updateHomeBadgesImmediately();
    }
    
    // ⚡ مرحله ۲: از سرور (پس‌زمینه) — فقط اگه Pre-Fetch انجام نشده
    if (!prefetchDone.students) {
        try {
            const response = await apiGet({ action: 'getAllStudents' });
            const students = response.data || [];
            allStudents = students;
            setCachedData(STUDENTS_CACHE_KEY, students);
            
            renderHomeStats(students);
            renderHomeTopStudents(students);
            
            if (!prefetchDone.conversations) {
                await updateHomeMessagesBadge();
            }
            
            prefetchDone.students = true;
        } catch (error) {
            console.error('Error loading home:', error);
        }
    }
}

function renderHomeStats(students) {
    const totalStudents = students.length;
    const totalLessons = students.reduce((sum, s) => sum + (parseInt(s.completed_lessons) || 0), 0);
    
    const studentsEl = document.getElementById('home-stat-students');
    const lessonsEl = document.getElementById('home-stat-lessons');
    if (studentsEl) studentsEl.textContent = toPersianNum(totalStudents);
    if (lessonsEl) lessonsEl.textContent = toPersianNum(totalLessons);
}

async function updateHomeMessagesBadge() {
    try {
        const response = await apiGet({ action: 'getStudentConversations' });
        const conversations = response.data || [];
        setCachedData(CONVERSATIONS_CACHE_KEY, conversations);
        currentConversations = conversations;
        
        const totalUnread = computeTotalUnread();
        
        const msgStat = document.getElementById('home-stat-messages');
        if (msgStat) msgStat.textContent = toPersianNum(totalUnread);
        
        const badge = document.getElementById('home-badge-messages');
        if (badge) {
            badge.textContent = toPersianNum(totalUnread);
            badge.style.display = totalUnread > 0 ? 'block' : 'none';
        }
        
        const tabBadge = document.getElementById('personal-unread-badge');
        if (tabBadge) {
            tabBadge.textContent = toPersianNum(totalUnread);
            tabBadge.style.display = totalUnread > 0 ? 'block' : 'none';
        }
    } catch (error) {}
}

function renderHomeTopStudents(students) {
    const container = document.getElementById('home-top-students');
    if (!container) return;
    
    const top = [...students]
        .sort((a, b) => (parseInt(b.total_points) || 0) - (parseInt(a.total_points) || 0))
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
            <div class="home-top-item" onclick="showStudentDetails('${student.student_id}')">
                <div class="home-top-rank">${medal}</div>
                <div class="home-top-avatar">${renderAvatarHTML(student)}</div>
                <div class="home-top-info">
                    <div class="home-top-name">${student.name || 'دانش‌آموز'}</div>
                    <div class="home-top-class">${getClassPersianName(student.class_name)}</div>
                </div>
                <div class="home-top-points">
                    <span>⭐</span>
                    <span>${toPersianNum(student.total_points || 0)}</span>
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
    
    document.querySelector(`.messages-tab-btn[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById('tab-' + tab)?.classList.add('active');
    
    if (tab === 'personal') {
        loadConversationsFromCache();
        startConversationPolling();
    } else if (tab === 'class') {
        loadClassMessagesFromCache();
        stopConversationPolling();
    }
}

// ============================================================
// 🆕 نمایش پیام‌های کلاسی از کش (فوری)
// ============================================================
function loadClassMessagesFromCache() {
    const cached = getCachedData(CLASS_MESSAGES_CACHE_KEY);
    if (cached && cached.length > 0) {
        renderClassMessages(cached);
    } else {
        const container = document.getElementById('class-messages-list');
        if (container) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
        }
    }
    
    // اگه Pre-Fetch انجام نشده، از سرور بگیر
    if (!prefetchDone.classMessages) {
        loadClassMessages();
    }
}

async function loadClassMessages() {
    try {
        const response = await apiGet({ action: 'getClassMessages' });
        const messages = response.data || [];
        setCachedData(CLASS_MESSAGES_CACHE_KEY, messages);
        renderClassMessages(messages);
        prefetchDone.classMessages = true;
    } catch (error) {}
}

function renderClassMessages(messages) {
    const container = document.getElementById('class-messages-list');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز پیام کلاسی ارسال نشده</div>';
        return;
    }
    
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const typeTexts = {
        info: 'ℹ️ اطلاعیه', warning: '⚠️ هشدار',
        success: '✅ تبریک', reminder: '🔔 یادآوری'
    };
    
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
// 🆕 نمایش مکالمات از کش (فوری)
// ============================================================
function loadConversationsFromCache() {
    const cached = getCachedData(CONVERSATIONS_CACHE_KEY);
    if (cached && cached.length > 0) {
        currentConversations = cached;
        currentConversations.forEach(conv => {
            conv.unread_count = computeUnreadForConversation(conv);
        });
        renderMessengerList(currentConversations);
    } else {
        const container = document.getElementById('messenger-list-items');
        if (container) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
        }
    }
}

async function loadStudentConversations() {
    try {
        const response = await apiGet({ action: 'getStudentConversations' });
        let conversations = response.data || [];
        
        conversations.forEach(conv => {
            conv.unread_count = computeUnreadForConversation(conv);
        });
        
        currentConversations = conversations;
        setCachedData(CONVERSATIONS_CACHE_KEY, conversations);
        prefetchDone.conversations = true;
        
        if (currentConversations.length === 0) {
            const container = document.getElementById('messenger-list-items');
            if (container) {
                container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز مکالمه‌ای وجود نداره</div>';
            }
            return;
        }
        
        renderMessengerList(currentConversations);
        await updateHomeMessagesBadge();
        
    } catch (error) {}
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
        
        let avatarHtml = '👤';
        if (conv.avatar_url) {
            if (conv.avatar_url.startsWith('emoji:')) {
                const emoji = conv.avatar_url.replace('emoji:', '');
                if (emoji && emoji !== '👤' && emoji !== '👦🏻') {
                    avatarHtml = emoji;
                } else {
                    avatarHtml = `<img src="https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png" alt="آواتار">`;
                }
            } else if (conv.avatar_url.startsWith('data:image') || conv.avatar_url.startsWith('http')) {
                avatarHtml = `<img src="${conv.avatar_url}" alt="آواتار" onerror="this.src='https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png'">`;
            }
        } else {
            avatarHtml = `<img src="https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png" alt="آواتار">`;
        }
        
        const unreadCount = conv.unread_count || 0;
        
        html += `
            <div class="messenger-item ${isActive ? 'active' : ''}" 
                 onclick="openChatWith('${conv.student_id}', '${conv.student_name}', '${conv.class_name}')">
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

// ============================================================
// Polling مکالمات
// ============================================================
function startConversationPolling() {
    stopConversationPolling();
    
    conversationPollingInterval = setInterval(async () => {
        if (isFetchingConversations) return;
        
        const activeScreen = document.querySelector('.page.active');
        if (!activeScreen || activeScreen.id !== 'page-messages') return;
        
        const activeTab = document.querySelector('.messages-tab-btn.active');
        if (!activeTab || activeTab.dataset.tab !== 'personal') return;
        
        if (currentChatStudent) return;
        
        isFetchingConversations = true;
        
        try {
            const response = await apiGet({ action: 'getStudentConversations' });
            const conversations = response.data || [];
            
            conversations.forEach(conv => {
                conv.unread_count = computeUnreadForConversation(conv);
            });
            
            const oldHash = JSON.stringify(currentConversations.map(c => 
                c.student_id + '_' + c.unread_count + '_' + c.last_message
            ));
            const newHash = JSON.stringify(conversations.map(c => 
                c.student_id + '_' + c.unread_count + '_' + c.last_message
            ));
            
            if (oldHash !== newHash) {
                currentConversations = conversations;
                setCachedData(CONVERSATIONS_CACHE_KEY, conversations);
                renderMessengerList(currentConversations);
                await updateHomeMessagesBadge();
                updateHomeBadgesImmediately();
            }
        } catch (error) {}
        
        isFetchingConversations = false;
    }, CONVERSATION_POLLING_INTERVAL);
}

function stopConversationPolling() {
    if (conversationPollingInterval) {
        clearInterval(conversationPollingInterval);
        conversationPollingInterval = null;
    }
}

// ============================================================
// ارسال پیام کلاسی
// ============================================================
async function sendClassMessage() {
    const className = document.getElementById('class-message-target').value;
    const title = document.getElementById('class-message-title').value.trim();
    const text = document.getElementById('class-message-text').value.trim();
    const type = document.getElementById('class-message-type').value;
    
    if (!title || !text) {
        showToast('لطفاً عنوان و متن پیام را وارد کنید', 'warning');
        return;
    }
    
    const messageData = {
        action: 'sendClassMessage',
        message_id: 'cls_' + Date.now(),
        class_name: className,
        title, text, type,
        date: new Date().toISOString(),
        date_persian: new Date().toLocaleDateString('fa-IR')
    };
    
    try {
        showToast('در حال ارسال...', 'info');
        await apiPost(messageData);
        showToast('پیام کلاسی ارسال شد! ✅', 'success');
        
        document.getElementById('class-message-title').value = '';
        document.getElementById('class-message-text').value = '';
        
        // 🆕 آپدیت کش (به‌جای پاک کردن)
        const cached = getCachedData(CLASS_MESSAGES_CACHE_KEY) || [];
        cached.unshift(messageData);
        setCachedData(CLASS_MESSAGES_CACHE_KEY, cached);
        renderClassMessages(cached);
        
    } catch (error) {
        showToast('خطا در ارسال پیام', 'error');
    }
}

// ============================================================
// باز کردن چت
// ============================================================
async function openChatWith(studentId, studentName, className) {
    currentChatStudent = {
        student_id: studentId,
        student_name: studentName,
        class_name: className
    };
    
    document.getElementById('messenger-empty').style.display = 'none';
    document.getElementById('messenger-list').style.display = 'none';
    document.getElementById('messenger-chat').style.display = 'flex';
    
    document.getElementById('messenger-chat-name').textContent = studentName;
    document.getElementById('messenger-chat-status').textContent = getClassPersianName(className);
    
    // آواتار
    const avatarEl = document.getElementById('messenger-chat-avatar');
    const conv = currentConversations.find(c => c.student_id === studentId);
    if (conv && conv.avatar_url) {
        if (conv.avatar_url.startsWith('emoji:')) {
            const emoji = conv.avatar_url.replace('emoji:', '');
            if (emoji && emoji !== '👤' && emoji !== '👦🏻') {
                avatarEl.innerHTML = emoji;
            } else {
                avatarEl.innerHTML = `<img src="https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png" alt="آواتار">`;
            }
        } else if (conv.avatar_url.startsWith('data:image') || conv.avatar_url.startsWith('http')) {
            avatarEl.innerHTML = `<img src="${conv.avatar_url}" alt="آواتار" onerror="this.src='https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png'">`;
        }
    } else {
        avatarEl.innerHTML = `<img src="https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png" alt="آواتار">`;
    }
    
    setReadTime(studentId);
    
    const convIndex = currentConversations.findIndex(c => c.student_id === studentId);
    if (convIndex >= 0) {
        currentConversations[convIndex].unread_count = 0;
        setCachedData(CONVERSATIONS_CACHE_KEY, currentConversations);
        renderMessengerList(currentConversations);
    }
    
    updateHomeBadgesImmediately();
    
    // 🆕 اول از کش نشون بده
    loadChatMessagesFromCache(studentId);
    
    // 🆕 بعد از سرور (پس‌زمینه)
    loadChatMessages(studentId);
    
    // 🆕 علامت‌گذاری سمت سرور
    try {
        await apiPost({
            action: 'markAllMessagesAsSeen',
            student_id: studentId,
            reader: 'teacher',
            timestamp: new Date().toISOString()
        });
    } catch (e) {}
    
    startChatPolling(studentId);
}

function loadChatMessagesFromCache(studentId) {
    const cacheKey = 'teacherMessagesCache_' + studentId;
    const cached = getCachedData(cacheKey);
    
    if (cached && cached.length > 0) {
        renderChatMessages(cached);
    } else {
        const container = document.getElementById('messenger-chat-messages');
        if (container) {
            container.innerHTML = '<div class="messenger-chat-messages-empty">در حال بارگذاری...</div>';
        }
    }
}

function closeMessengerChat() {
    document.getElementById('messenger-empty').style.display = 'flex';
    document.getElementById('messenger-list').style.display = 'flex';
    document.getElementById('messenger-chat').style.display = 'none';
    currentChatStudent = null;
    stopChatPolling();
    loadConversationsFromCache();
}

async function loadChatMessages(studentId) {
    try {
        const response = await apiGet({ 
            action: 'getPersonalMessages',
            student_id: studentId
        });
        const messages = response.data || [];
        
        const container = document.getElementById('messenger-chat-messages');
        
        if (messages.length === 0) {
            if (container) {
                container.innerHTML = '<div class="messenger-chat-messages-empty">هنوز پیامی رد و بدل نشده<br>اولین پیام رو بفرست!</div>';
            }
            return;
        }
        
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        setCachedData('teacherMessagesCache_' + studentId, messages);
        renderChatMessages(messages);
        
    } catch (error) {}
}

// ============================================================
// رندر پیام با تیک دوگانه
// ============================================================
function renderChatMessages(messages) {
    const container = document.getElementById('messenger-chat-messages');
    if (!container) return;
    
    let html = '';
    messages.forEach(msg => {
        const senderClass = msg.sender === 'teacher' ? 'teacher' : 'student';
        const time = msg.date_persian || '';
        
        let tickHtml = '';
        if (senderClass === 'teacher') {
            const isSeen = 
                msg.is_seen === true || 
                msg.is_seen === 'true' || 
                msg.is_seen === 1;
            
            tickHtml = isSeen 
                ? `<span class="chat-tick chat-tick-seen">✓✓</span>`
                : `<span class="chat-tick">✓</span>`;
        }
        
        html += `
            <div class="messenger-chat-message ${senderClass}">
                <div>${msg.text}</div>
                <div class="messenger-chat-message-time">
                    ${time}
                    ${tickHtml}
                </div>
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
        action: 'sendPersonalMessage',
        message_id: 'pm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        student_id: currentChatStudent.student_id,
        student_name: currentChatStudent.student_name,
        class_name: currentChatStudent.class_name,
        sender: 'teacher',
        text: text,
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
        msgEl.innerHTML = `
            <div>${text}</div>
            <div class="messenger-chat-message-time">
                ${time}
                <span class="chat-tick">✓</span>
            </div>
        `;
        container.appendChild(msgEl);
        container.scrollTop = container.scrollHeight;
        
        const cacheKey = 'teacherMessagesCache_' + currentChatStudent.student_id;
        const cached = getCachedData(cacheKey) || [];
        cached.push(messageData);
        setCachedData(cacheKey, cached);
        
        await apiPost(messageData);
        setReadTime(currentChatStudent.student_id);
        
    } catch (error) {
        showToast('خطا در ارسال پیام', 'error');
    }
}

// ============================================================
// Polling چت
// ============================================================
function startChatPolling(studentId) {
    stopChatPolling();
    
    chatPollingInterval = setInterval(async () => {
        if (isFetchingChat) return;
        if (!currentChatStudent || currentChatStudent.student_id !== studentId) return;
        
        isFetchingChat = true;
        
        try {
            const response = await apiGet({ 
                action: 'getPersonalMessages',
                student_id: studentId
            });
            const messages = response.data || [];
            
            if (messages.length === 0) {
                isFetchingChat = false;
                return;
            }
            
            messages.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const container = document.getElementById('messenger-chat-messages');
            const currentCount = container.querySelectorAll('.messenger-chat-message').length;
            
            const cached = getCachedData('teacherMessagesCache_' + studentId) || [];
            const cachedTicks = cached.filter(m => 
                m.sender === 'teacher' && (m.is_seen === true || m.is_seen === 'true')
            ).length;
            const newTicks = messages.filter(m => 
                m.sender === 'teacher' && (m.is_seen === true || m.is_seen === 'true')
            ).length;
            
            if (messages.length !== currentCount || cachedTicks !== newTicks) {
                renderChatMessages(messages);
                setCachedData('teacherMessagesCache_' + studentId, messages);
                
                const lastMsg = messages[messages.length - 1];
                if (lastMsg.sender === 'student' && messages.length !== currentCount) {
                    playDingSound();
                    setReadTime(studentId);
                    await updateHomeMessagesBadge();
                    updateHomeBadgesImmediately();
                    
                    try {
                        await fetch(TEACHER_API_URL, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({
                                action: 'markAllMessagesAsSeen',
                                student_id: studentId,
                                reader: 'teacher',
                                timestamp: new Date().toISOString()
                            })
                        });
                    } catch (e) {}
                }
            }
        } catch (error) {}
        
        isFetchingChat = false;
    }, CHAT_POLLING_INTERVAL);
}

function stopChatPolling() {
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
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
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.4);
        });
    } catch (e) {}
}

// ============================================================
// 🆕 دانش‌آموزان — از کش (فوری)
// ============================================================
async function renderStudentsFromCache() {
    const cached = getCachedData(STUDENTS_CACHE_KEY);
    if (cached && cached.length > 0) {
        allStudents = cached;
        renderStudents(cached);
    }
}

async function loadStudents() {
    try {
        const response = await apiGet({ action: 'getAllStudents' });
        allStudents = response.data || [];
        setCachedData(STUDENTS_CACHE_KEY, allStudents);
        renderStudents(allStudents);
        prefetchDone.students = true;
    } catch (error) {}
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
            <div class="student-card" onclick="showStudentDetails('${student.student_id}')">
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
                    <span>${toPersianNum(student.total_points || 0)}</span>
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
    
    if (classFilter !== 'all') {
        filtered = filtered.filter(s => s.class_name === classFilter);
    }
    
    if (query) {
        filtered = filtered.filter(s => 
            (s.name || '').toLowerCase().includes(query)
        );
    }
    
    renderStudents(filtered);
}

function renderAvatarHTML(student) {
    const avatarUrl = student.avatar_url || '';
    
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '');
        if (!emoji || emoji === '👤' || emoji === '👦🏻') {
            return `<img src="https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        }
        return `<span>${emoji}</span>`;
    }
    
    if (avatarUrl.startsWith('data:image') || avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="آواتار" onerror="this.src='https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png'">`;
    }
    
    return `<img src="https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
}

// ============================================================
// نمایش جزئیات دانش‌آموز
// ============================================================
function showStudentDetails(studentId) {
    const student = allStudents.find(s => s.student_id === studentId);
    if (!student) return;
    
    const modal = document.getElementById('student-modal');
    const content = document.getElementById('student-modal-content');
    
    content.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
            <div style="width:100px; height:100px; border-radius:50%; background:#f0f7ff; margin:0 auto 15px; display:flex; align-items:center; justify-content:center; overflow:hidden; border:4px solid #fff; box-shadow:0 8px 25px rgba(25,118,210,0.2);">
                ${renderAvatarHTML(student)}
            </div>
            <div style="font-size:20px; font-weight:900; color:#1a237e; margin-bottom:8px;">
                ${student.name || 'بدون نام'}
            </div>
            <div style="font-size:13px; color:#78909c; font-weight:bold; background:#f0f7ff; display:inline-block; padding:5px 16px; border-radius:20px;">
                ${getClassPersianName(student.class_name)}
            </div>
        </div>
        
        <div style="background:#f8fbff; border-radius:16px; padding:15px; margin-bottom:15px; border:1.5px solid #e3f2fd;">
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #e3f2fd;">
                <span style="color:#78909c; font-weight:bold;">امتیاز کل</span>
                <span style="color:#1976d2; font-weight:900;">${toPersianNum(student.total_points || 0)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #e3f2fd;">
                <span style="color:#78909c; font-weight:bold;">تکالیف انجام شده</span>
                <span style="color:#1976d2; font-weight:900;">${toPersianNum(student.completed_lessons || 0)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #e3f2fd;">
                <span style="color:#78909c; font-weight:bold;">میانگین درصد</span>
                <span style="color:#1976d2; font-weight:900;">${toPersianNum(student.avg_percent || 0)}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:10px 0;">
                <span style="color:#78909c; font-weight:bold;">روزهای متوالی</span>
                <span style="color:#1976d2; font-weight:900;">${toPersianNum(student.streak_days || 0)}</span>
            </div>
        </div>
        
        <button onclick="closeStudentModal(); goToChatWith('${student.student_id}', '${student.name}', '${student.class_name}')" 
                style="width:100%; padding:14px; background:linear-gradient(135deg,#1976d2,#1565c0); color:#fff; border:none; border-radius:50px; font-family:'Vazirmatn',sans-serif; font-size:15px; font-weight:900; cursor:pointer;">
            💬 چت با این دانش‌آموز
        </button>
    `;
    
    modal.classList.add('active');
}

function closeStudentModal() {
    document.getElementById('student-modal').classList.remove('active');
}

function goToChatWith(studentId, studentName, className) {
    navigateToPage('messages', true);
    
    setTimeout(() => {
        switchMessagesTab('personal');
        setTimeout(() => {
            openChatWith(studentId, studentName, className);
        }, 300);
    }, 200);
}

// ============================================================
// 🆕 رتبه‌بندی — از کش (فوری)
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
    
    // ⚡ از کش (فوری)
    const cachedStudents = getCachedData(STUDENTS_CACHE_KEY);
    if (cachedStudents && cachedStudents.length > 0) {
        const rankings = cachedStudents
            .filter(s => s.class_name === currentRankingClass)
            .sort((a, b) => (parseInt(b.total_points) || 0) - (parseInt(a.total_points) || 0));
        
        const countEl = document.getElementById('rankings-current-count');
        if (countEl) countEl.textContent = `${toPersianNum(rankings.length)} دانش‌آموز`;
        
        if (rankings.length > 0) {
            renderRankingsList(rankings);
        }
    }
    
    // ⚡ از سرور (اگه Pre-Fetch انجام نشده)
    if (!prefetchDone.students) {
        try {
            const response = await apiGet({ action: 'getAllStudents' });
            const students = response.data || [];
            setCachedData(STUDENTS_CACHE_KEY, students);
            allStudents = students;
            prefetchDone.students = true;
            
            const rankings = students
                .filter(s => s.class_name === currentRankingClass)
                .sort((a, b) => (parseInt(b.total_points) || 0) - (parseInt(a.total_points) || 0));
            
            const countEl = document.getElementById('rankings-current-count');
            if (countEl) countEl.textContent = `${toPersianNum(rankings.length)} دانش‌آموز`;
            
            renderRankingsList(rankings);
        } catch (error) {}
    }
}

function renderRankingsList(rankings) {
    const container = document.getElementById('rankings-list');
    if (!container) return;
    
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
            <div class="ranking-item ${rankClass}" onclick="showStudentDetails('${student.student_id}')">
                <div class="ranking-rank">${medal}</div>
                <div class="student-avatar" style="width:46px;height:46px;">${renderAvatarHTML(student)}</div>
                <div class="student-info">
                    <div class="student-name">${student.name || 'بدون نام'}</div>
                    <span class="student-class">${toPersianNum(student.completed_lessons || 0)} تکلیف • ${toPersianNum(student.avg_percent || 0)}%</span>
                </div>
                <div class="student-points">
                    <span>⭐</span>
                    <span>${toPersianNum(student.total_points || 0)}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================================
// مدیریت تکالیف
// ============================================================
async function loadLessonsPage() {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    
    const cached = getCachedData(LESSONS_CACHE_KEY, 3600000);
    if (cached && cached.length > 0) {
        renderLessonsList(cached);
    } else {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    }
    
    try {
        const response = await fetch('./lessons/index.json');
        const data = await response.json();
        const lessons = data.lessons || [];
        setCachedData(LESSONS_CACHE_KEY, lessons);
        renderLessonsList(lessons);
    } catch (error) {}
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
// 🆕 تقویم — Cache-First
// ============================================================
async function loadEventsFromCache() {
    const cached = getCachedData(EVENTS_CACHE_KEY);
    if (cached && cached.length > 0) {
        renderEvents(cached);
    }
}

async function addEvent() {
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value.trim();
    const cls = document.getElementById('event-class').value;
    const type = document.getElementById('event-type').value;
    const desc = document.getElementById('event-desc').value.trim();
    
    if (!title || !date) {
        showToast('لطفاً عنوان و تاریخ را وارد کنید', 'warning');
        return;
    }
    
    try {
        await apiPost({
            action: 'addEvent',
            event_id: 'evt_' + Date.now(),
            title, date, class_name: cls, type, description: desc,
            created_at: new Date().toISOString()
        });
        
        showToast('رویداد با موفقیت ثبت شد', 'success');
        
        document.getElementById('event-title').value = '';
        document.getElementById('event-date').value = '';
        document.getElementById('event-desc').value = '';
        
        // 🆕 آپدیت کش
        const cached = getCachedData(EVENTS_CACHE_KEY) || [];
        cached.unshift({ event_id: 'evt_' + Date.now(), title, date, class_name: cls, type, description: desc });
        setCachedData(EVENTS_CACHE_KEY, cached);
        renderEvents(cached);
        
    } catch (error) {
        showToast('خطا در ثبت رویداد', 'error');
    }
}

async function loadEvents() {
    try {
        const response = await apiGet({ action: 'getEvents' });
        const events = response.data || [];
        setCachedData(EVENTS_CACHE_KEY, events);
        renderEvents(events);
    } catch (error) {}
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
                    <div class="event-item-meta">
                        ${evt.date} • ${getClassPersianName(evt.class_name)}
                        ${evt.description ? ' • ' + evt.description : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================================
// 🆕 مسابقات — Cache-First
// ============================================================
async function loadContestsFromCache() {
    const cached = getCachedData(CONTESTS_CACHE_KEY);
    if (cached && cached.length > 0) {
        renderContests(cached);
    }
}

async function addContest() {
    const title = document.getElementById('contest-title').value.trim();
    const prize = document.getElementById('contest-prize').value.trim();
    const start = document.getElementById('contest-start').value.trim();
    const end = document.getElementById('contest-end').value.trim();
    const desc = document.getElementById('contest-desc').value.trim();
    
    if (!title || !start || !end) {
        showToast('لطفاً عنوان و تاریخ‌ها را وارد کنید', 'warning');
        return;
    }
    
    try {
        await apiPost({
            action: 'addContest',
            contest_id: 'cnt_' + Date.now(),
            title, prize, start_date: start, end_date: end,
            description: desc, created_at: new Date().toISOString()
        });
        
        showToast('مسابقه با موفقیت ایجاد شد', 'success');
        
        document.getElementById('contest-title').value = '';
        document.getElementById('contest-prize').value = '';
        document.getElementById('contest-start').value = '';
        document.getElementById('contest-end').value = '';
        document.getElementById('contest-desc').value = '';
        
        const cached = getCachedData(CONTESTS_CACHE_KEY) || [];
        cached.unshift({ contest_id: 'cnt_' + Date.now(), title, prize, start_date: start, end_date: end, description: desc });
        setCachedData(CONTESTS_CACHE_KEY, cached);
        renderContests(cached);
        
    } catch (error) {
        showToast('خطا در ایجاد مسابقه', 'error');
    }
}

async function loadContests() {
    try {
        const response = await apiGet({ action: 'getContests' });
        const contests = response.data || [];
        setCachedData(CONTESTS_CACHE_KEY, contests);
        renderContests(contests);
    } catch (error) {}
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
                    <div class="contest-item-meta">
                        🎁 ${c.prize || 'بدون جایزه'} • 
                        📅 از ${c.start_date} تا ${c.end_date}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================================
// 🆕 کتابخانه — Cache-First
// ============================================================
async function loadLibraryFromCache() {
    const cached = getCachedData(LIBRARY_CACHE_KEY);
    if (cached && cached.length > 0) {
        renderLibrary(cached);
    }
}

async function addLibraryItem() {
    const title = document.getElementById('lib-title').value.trim();
    const type = document.getElementById('lib-type').value;
    const url = document.getElementById('lib-url').value.trim();
    const desc = document.getElementById('lib-desc').value.trim();
    
    if (!title || !url) {
        showToast('لطفاً عنوان و لینک را وارد کنید', 'warning');
        return;
    }
    
    try {
        await apiPost({
            action: 'addLibrary',
            item_id: 'lib_' + Date.now(),
            title, type, url, description: desc,
            created_at: new Date().toISOString()
        });
        
        showToast('منبع با موفقیت اضافه شد', 'success');
        
        document.getElementById('lib-title').value = '';
        document.getElementById('lib-url').value = '';
        document.getElementById('lib-desc').value = '';
        
        const cached = getCachedData(LIBRARY_CACHE_KEY) || [];
        cached.unshift({ item_id: 'lib_' + Date.now(), title, type, url, description: desc });
        setCachedData(LIBRARY_CACHE_KEY, cached);
        renderLibrary(cached);
        
    } catch (error) {
        showToast('خطا در افزودن منبع', 'error');
    }
}

async function loadLibrary() {
    try {
        const response = await apiGet({ action: 'getLibrary' });
        const items = response.data || [];
        setCachedData(LIBRARY_CACHE_KEY, items);
        renderLibrary(items);
    } catch (error) {}
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
                    <div class="library-item-meta">
                        ${item.description || ''} • <a href="${item.url}" target="_blank" style="color:#1976d2;">باز کردن</a>
                    </div>
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
    if (allStudents.length === 0) {
        showToast('داده‌ای برای دانلود نیست', 'warning');
        return;
    }
    
    let csv = '\uFEFF';
    csv += 'نام,کلاس,امتیاز,تکالیف,درصد,روز متوالی\n';
    
    allStudents.forEach(s => {
        csv += `"${s.name}","${getClassPersianName(s.class_name)}",${s.total_points},${s.completed_lessons},${s.avg_percent},${s.streak_days || 0}\n`;
    });
    
    downloadFile(csv, 'دانش‌آموزان.csv', 'text/csv');
    showToast('فایل دانلود شد', 'success');
}

function downloadClassReport() {
    const cls = document.getElementById('report-class-filter').value;
    const filtered = cls === 'all' ? allStudents : allStudents.filter(s => s.class_name === cls);
    
    if (filtered.length === 0) {
        showToast('داده‌ای برای دانلود نیست', 'warning');
        return;
    }
    
    let csv = '\uFEFF';
    csv += 'نام,امتیاز,تکالیف,درصد\n';
    
    filtered.forEach(s => {
        csv += `"${s.name}",${s.total_points},${s.completed_lessons},${s.avg_percent}\n`;
    });
    
    const filename = cls === 'all' ? 'همه_کلاس‌ها.csv' : getClassPersianName(cls) + '.csv';
    downloadFile(csv, filename, 'text/csv');
    showToast('فایل دانلود شد', 'success');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function printStudentCertificates() {
    showToast('این قابلیت به‌زودی اضافه می‌شه', 'info');
}

function showTopStudentsReport() {
    const top = [...allStudents]
        .sort((a, b) => (parseInt(b.total_points) || 0) - (parseInt(a.total_points) || 0))
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
            <span style="color:#f57c00; font-weight:900;">${toPersianNum(s.total_points)} امتیاز</span>
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
    
    const totalPoints = filtered.reduce((sum, s) => sum + (parseInt(s.total_points) || 0), 0);
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
    } else if (newPassword) {
        showToast('رمز باید حداقل ۴ کاراکتر باشد', 'warning');
    }
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

// ============================================================
// شروع
// ============================================================
console.log('🎓 پنل معلم عربی هفتم - نسخه ۱۱.۰.۰');
console.log('⚡ Cache-First: نمایش فوری از کش');
console.log('🚀 Pre-Fetch: دریافت موازی همه داده‌ها');
console.log('🔄 Background Sync: آپدیت در پس‌زمینه');