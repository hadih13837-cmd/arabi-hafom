// ============================================================
// teacher.js — منطق پنل معلم
// نسخه: ۲.۰.۰ — با پیام‌رسانی چت‌مانند
// ============================================================

// ============================================================
// تنظیمات
// ============================================================
const TEACHER_API_URL = 'https://script.google.com/macros/s/AKfycbwH6zsAVO-tzATU3_J8SvHkOpM1GJXQRxmqWDHxcXKxDKKJZImQf_58ekigtppjj-HWgw/exec';
const TEACHER_PASSWORD_KEY = 'teacherPassword';
const DEFAULT_PASSWORD = 'hadi1383';

let allStudents = [];
let allMessages = [];
let currentMessageTarget = 'all';
let currentConversations = [];
let currentChatStudent = null;
let chatPollingInterval = null;

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
// ورود (Login)
// ============================================================
function checkPassword() {
    const input = document.getElementById('login-password').value.trim();
    const savedPassword = localStorage.getItem(TEACHER_PASSWORD_KEY) || DEFAULT_PASSWORD;
    
    if (input === savedPassword) {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-panel').classList.add('active');
        localStorage.setItem('teacherLoggedIn', 'true');
        
        loadDashboard();
        loadStudents();
        
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
    }
}

window.addEventListener('load', () => {
    if (localStorage.getItem('teacherLoggedIn') === 'true') {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-panel').classList.add('active');
        loadDashboard();
        loadStudents();
        
        setTimeout(() => {
            const apiInput = document.getElementById('setting-api-url');
            if (apiInput) apiInput.value = TEACHER_API_URL;
        }, 500);
    }
    
    const loginInput = document.getElementById('login-password');
    if (loginInput) {
        loginInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
});

// ============================================================
// ناوبری منو
// ============================================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');
    
    document.querySelector(`.sidebar-item[data-page="${pageId}"]`)?.classList.add('active');
    
    toggleSidebar();
    
    const titles = {
        dashboard: 'داشبورد',
        students: 'دانش‌آموزان',
        rankings: 'رتبه‌بندی',
        messages: 'پیام‌رسانی',
        lessons: 'مدیریت تکالیف',
        calendar: 'تقویم',
        contests: 'مسابقات',
        library: 'کتابخانه',
        reports: 'گزارش‌ها',
        settings: 'تنظیمات'
    };
    document.getElementById('panel-page-title').textContent = titles[pageId] || 'داشبورد';
    
    // توقف polling چت
    if (pageId !== 'messages') {
        stopChatPolling();
    }
    
    switch (pageId) {
        case 'dashboard': loadDashboard(); break;
        case 'students': loadStudents(); break;
        case 'rankings': loadRankings(); break;
        case 'messages': 
            loadClassMessages();
            loadStudentConversations();
            updatePersonalUnreadBadge();
            break;
        case 'lessons': loadLessonsPage(); break;
        case 'calendar': loadEvents(); break;
        case 'contests': loadContests(); break;
        case 'library': loadLibrary(); break;
        case 'reports': break;
        case 'settings': break;
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
// تب‌های پیام‌رسانی
// ============================================================
function switchMessagesTab(tab) {
    document.querySelectorAll('.messages-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.messages-tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.messages-tab-btn[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById('tab-' + tab)?.classList.add('active');
    
    if (tab === 'personal') {
        loadStudentConversations();
        updatePersonalUnreadBadge();
    } else if (tab === 'class') {
        loadClassMessages();
    }
}

// ============================================================
// 🆕 ارسال پیام کلاسی (کارتی)
// ============================================================
async function sendClassMessage() {
    const className = document.getElementById('class-message-target').value;
    const title = document.getElementById('class-message-title').value.trim();
    const text = document.getElementById('class-message-text').value.trim();
    const type = document.getElementById('class-message-type').value;
    
    if (!title) {
        showToast('لطفاً عنوان پیام را وارد کنید', 'warning');
        return;
    }
    if (!text) {
        showToast('لطفاً متن پیام را وارد کنید', 'warning');
        return;
    }
    
    const messageData = {
        action: 'sendClassMessage',
        message_id: 'cls_' + Date.now(),
        class_name: className,
        title: title,
        text: text,
        type: type,
        date: new Date().toISOString(),
        date_persian: new Date().toLocaleDateString('fa-IR')
    };
    
    try {
        showToast('در حال ارسال...', 'info');
        await apiPost(messageData);
        
        showToast('پیام کلاسی ارسال شد! ✅', 'success');
        
        document.getElementById('class-message-title').value = '';
        document.getElementById('class-message-text').value = '';
        
        setTimeout(loadClassMessages, 1000);
        
    } catch (error) {
        console.error('Error:', error);
        showToast('خطا در ارسال پیام', 'error');
    }
}

// ============================================================
// 🆕 بارگذاری پیام‌های کلاسی
// ============================================================
async function loadClassMessages() {
    const container = document.getElementById('class-messages-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    
    try {
        const response = await apiGet({ action: 'getClassMessages' });
        const messages = response.data || [];
        
        if (messages.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز پیام کلاسی ارسال نشده</div>';
            return;
        }
        
        messages.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const typeTexts = {
            info: 'ℹ️ اطلاعیه',
            warning: '⚠️ هشدار',
            success: '✅ تبریک',
            reminder: '🔔 یادآوری'
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
        
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

// ============================================================
// 🆕 بارگذاری مکالمات (لیست دانش‌آموزان)
// ============================================================
async function loadStudentConversations() {
    const container = document.getElementById('conversations-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    
    try {
        const response = await apiGet({ action: 'getStudentConversations' });
        currentConversations = response.data || [];
        
        if (currentConversations.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز مکالمه‌ای وجود نداره</div>';
            return;
        }
        
        renderConversations(currentConversations);
        
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

function renderConversations(conversations) {
    const container = document.getElementById('conversations-list');
    if (!container) return;
    
    if (conversations.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">مکالمه‌ای یافت نشد</div>';
        return;
    }
    
    let html = '';
    conversations.forEach(conv => {
        const isActive = currentChatStudent && currentChatStudent.student_id === conv.student_id;
        
        html += `
            <div class="conversation-item ${isActive ? 'active' : ''}" onclick="openChatWith('${conv.student_id}', '${conv.student_name}', '${conv.class_name}')">
                <div class="conversation-avatar">
                    <span>👤</span>
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${conv.student_name}</div>
                    <div class="conversation-last-message">${conv.last_message || 'بدون پیام'}</div>
                </div>
                <div class="conversation-meta">
                    <div class="conversation-time">${conv.last_date_persian || ''}</div>
                    ${conv.unread_count > 0 ? `<div class="conversation-unread">${toPersianNum(conv.unread_count)}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================================
// 🆕 فیلتر مکالمات (جستجو)
// ============================================================
function filterConversations(query) {
    query = query.toLowerCase().trim();
    
    if (!query) {
        renderConversations(currentConversations);
        return;
    }
    
    const filtered = currentConversations.filter(c => 
        (c.student_name || '').toLowerCase().includes(query)
    );
    renderConversations(filtered);
}

// ============================================================
// 🆕 باز کردن چت با دانش‌آموز
// ============================================================
async function openChatWith(studentId, studentName, className) {
    currentChatStudent = {
        student_id: studentId,
        student_name: studentName,
        class_name: className
    };
    
    // نمایش پنجره چت
    document.getElementById('chat-empty-state').style.display = 'none';
    document.getElementById('chat-window').style.display = 'flex';
    
    // اطلاعات دانش‌آموز
    document.getElementById('chat-student-name').textContent = studentName;
    document.getElementById('chat-student-class').textContent = getClassPersianName(className);
    
    // آواتار
    const avatarEl = document.getElementById('chat-student-avatar');
    avatarEl.innerHTML = '<span>👤</span>';
    
    // بارگذاری پیام‌ها
    await loadChatMessages(studentId);
    
    // شروع polling (هر ۳ ثانیه)
    startChatPolling(studentId);
    
    // آپدیت لیست مکالمات (حذف unread)
    loadStudentConversations();
}

function closeChatWindow() {
    document.getElementById('chat-empty-state').style.display = 'flex';
    document.getElementById('chat-window').style.display = 'none';
    currentChatStudent = null;
    stopChatPolling();
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
}

// ============================================================
// 🆕 بارگذاری پیام‌های چت
// ============================================================
async function loadChatMessages(studentId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    try {
        const response = await apiGet({ 
            action: 'getPersonalMessages',
            student_id: studentId
        });
        const messages = response.data || [];
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="chat-messages-empty">هنوز پیامی رد و بدل نشده<br>اولین پیام رو بفرست!</div>';
            return;
        }
        
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let html = '';
        messages.forEach(msg => {
            const senderClass = msg.sender === 'teacher' ? 'teacher' : 'student';
            const time = msg.date_persian || '';
            
            html += `
                <div class="chat-message ${senderClass}">
                    <div>${msg.text}</div>
                    <div class="chat-message-time">${time}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // اسکرول به آخر
        container.scrollTop = container.scrollHeight;
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================================
// 🆕 ارسال پیام چت
// ============================================================
async function sendChatMessage() {
    if (!currentChatStudent) return;
    
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    const messageData = {
        action: 'sendPersonalMessage',
        message_id: 'pm_' + Date.now(),
        student_id: currentChatStudent.student_id,
        student_name: currentChatStudent.student_name,
        class_name: currentChatStudent.class_name,
        sender: 'teacher',
        text: text,
        date: new Date().toISOString(),
        date_persian: new Date().toLocaleDateString('fa-IR')
    };
    
    try {
        input.value = '';
        
        // نمایش فوری پیام در چت
        const container = document.getElementById('chat-messages');
        const time = messageData.date_persian;
        
        const emptyState = container.querySelector('.chat-messages-empty');
        if (emptyState) emptyState.remove();
        
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message teacher';
        msgEl.innerHTML = `
            <div>${text}</div>
            <div class="chat-message-time">${time}</div>
        `;
        container.appendChild(msgEl);
        container.scrollTop = container.scrollHeight;
        
        // ارسال به سرور
        await apiPost(messageData);
        
        console.log('✅ پیام ارسال شد');
        
    } catch (error) {
        console.error('Error:', error);
        showToast('خطا در ارسال پیام', 'error');
    }
}

// ============================================================
// 🆕 Polling برای چت (هر ۳ ثانیه)
// ============================================================
function startChatPolling(studentId) {
    stopChatPolling();
    
    chatPollingInterval = setInterval(async () => {
        if (!currentChatStudent || currentChatStudent.student_id !== studentId) return;
        
        try {
            const response = await apiGet({ 
                action: 'getPersonalMessages',
                student_id: studentId
            });
            const messages = response.data || [];
            
            if (messages.length === 0) return;
            
            messages.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const container = document.getElementById('chat-messages');
            const currentCount = container.querySelectorAll('.chat-message').length;
            
            // اگه تعداد پیام‌ها تغییر کرده، دوباره رندر کن
            if (messages.length !== currentCount) {
                let html = '';
                messages.forEach(msg => {
                    const senderClass = msg.sender === 'teacher' ? 'teacher' : 'student';
                    const time = msg.date_persian || '';
                    
                    html += `
                        <div class="chat-message ${senderClass}">
                            <div>${msg.text}</div>
                            <div class="chat-message-time">${time}</div>
                        </div>
                    `;
                });
                container.innerHTML = html;
                container.scrollTop = container.scrollHeight;
                
                // پخش صدای دینگ اگه پیام جدید از دانش‌آموز باشه
                const lastMsg = messages[messages.length - 1];
                if (lastMsg.sender === 'student') {
                    playDingSound();
                }
            }
            
        } catch (error) {
            console.warn('Polling error:', error);
        }
    }, 3000);
}

function stopChatPolling() {
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
}

// ============================================================
// 🆕 صدای دینگ
// ============================================================
function playDingSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        
        // دینگ دو نتی
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
    } catch (e) {
        console.warn('خطا در پخش صدا:', e);
    }
}

// ============================================================
// 🆕 آپدیت Badge پیام‌های نخوانده
// ============================================================
async function updatePersonalUnreadBadge() {
    try {
        const response = await apiGet({ action: 'getStudentConversations' });
        const conversations = response.data || [];
        
        const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        const badge = document.getElementById('personal-unread-badge');
        
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = toPersianNum(totalUnread);
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.warn('Error:', error);
    }
}

// ============================================================
// بارگذاری داشبورد
// ============================================================
async function loadDashboard() {
    try {
        const response = await apiGet({ action: 'getAllStudents' });
        const students = response.data || [];
        allStudents = students;
        
        const totalStudents = students.length;
        const totalLessons = students.reduce((sum, s) => sum + (parseInt(s.completed_lessons) || 0), 0);
        const avgPoints = totalStudents > 0 
            ? Math.round(students.reduce((sum, s) => sum + (parseInt(s.total_points) || 0), 0) / totalStudents)
            : 0;
        const avgPercent = totalStudents > 0
            ? Math.round(students.reduce((sum, s) => sum + (parseInt(s.avg_percent) || 0), 0) / totalStudents)
            : 0;
        
        document.getElementById('total-students').textContent = toPersianNum(totalStudents);
        document.getElementById('total-lessons-done').textContent = toPersianNum(totalLessons);
        document.getElementById('avg-points').textContent = toPersianNum(avgPoints);
        document.getElementById('avg-percent').textContent = toPersianNum(avgPercent) + '%';
        
        renderClassBars(students);
        renderTopStudents(students);
        renderRecentActivity(students);
        
        // آپدیت badge پیام‌ها
        updatePersonalUnreadBadge();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('خطا در بارگذاری داشبورد', 'error');
    }
}

function renderClassBars(students) {
    const container = document.getElementById('class-bars');
    if (!container) return;
    
    const classes = ['hafom-1', 'hafom-2', 'hafom-3', 'hafom-4', 'hafom-5'];
    const maxCount = Math.max(...classes.map(c => students.filter(s => s.class_name === c).length), 1);
    
    let html = '';
    classes.forEach(cls => {
        const count = students.filter(s => s.class_name === cls).length;
        const percent = (count / maxCount) * 100;
        
        html += `
            <div class="class-bar-item">
                <div class="class-bar-header">
                    <span class="class-bar-name">${getClassPersianName(cls)}</span>
                    <span class="class-bar-count">${toPersianNum(count)} دانش‌آموز</span>
                </div>
                <div class="class-bar-track">
                    <div class="class-bar-fill" style="width: ${percent}%;"></div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderTopStudents(students) {
    const container = document.getElementById('top-students');
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
            <div class="top-student-item" onclick="showStudentDetails('${student.student_id}')">
                <div class="top-student-rank">${medal}</div>
                <div class="top-student-avatar">${renderAvatarHTML(student)}</div>
                <div class="top-student-info">
                    <div class="top-student-name">${student.name || 'دانش‌آموز'}</div>
                    <div class="top-student-class">${getClassPersianName(student.class_name)}</div>
                </div>
                <div class="top-student-points">
                    <span>⭐</span>
                    <span>${toPersianNum(student.total_points)}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderRecentActivity(students) {
    const container = document.getElementById('recent-activity');
    if (!container) return;
    
    const recent = [...students]
        .filter(s => s.last_update)
        .sort((a, b) => new Date(b.last_update) - new Date(a.last_update))
        .slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">فعالیتی ثبت نشده</div>';
        return;
    }
    
    let html = '';
    recent.forEach(student => {
        const time = student.last_update ? new Date(student.last_update).toLocaleDateString('fa-IR') : 'نامشخص';
        
        html += `
            <div class="recent-activity-item">
                <div class="recent-activity-icon">📝</div>
                <div class="recent-activity-text">
                    <strong>${student.name}</strong> از ${getClassPersianName(student.class_name)} فعال بود
                </div>
                <div class="recent-activity-time">${time}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
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
// بارگذاری دانش‌آموزان
// ============================================================
async function loadStudents() {
    const container = document.getElementById('students-grid');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    
    try {
        const response = await apiGet({ action: 'getAllStudents' });
        allStudents = response.data || [];
        renderStudents(allStudents);
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
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
        
        <button onclick="closeStudentModal(); openChatFromModal('${student.student_id}', '${student.name}', '${student.class_name}')" 
                style="width:100%; padding:14px; background:linear-gradient(135deg,#1976d2,#1565c0); color:#fff; border:none; border-radius:50px; font-family:'Vazirmatn',sans-serif; font-size:15px; font-weight:900; cursor:pointer;">
            💬 چت با این دانش‌آموز
        </button>
    `;
    
    modal.classList.add('active');
}

function closeStudentModal() {
    document.getElementById('student-modal').classList.remove('active');
}

function openChatFromModal(studentId, studentName, className) {
    // برو به صفحه پیام‌رسانی
    showPage('messages');
    
    // تب شخصی رو فعال کن
    setTimeout(() => {
        switchMessagesTab('personal');
        // باز کردن چت
        setTimeout(() => {
            openChatWith(studentId, studentName, className);
        }, 500);
    }, 300);
}

// ============================================================
// رتبه‌بندی
// ============================================================
async function loadRankings() {
    const container = document.getElementById('rankings-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    
    try {
        const classFilter = document.getElementById('ranking-class-filter').value;
        const params = { action: 'getAllStudents' };
        
        if (classFilter !== 'all') {
            params.class_name = classFilter;
        }
        
        const response = await apiGet(params);
        const rankings = (response.data || []).sort((a, b) => 
            (parseInt(b.total_points) || 0) - (parseInt(a.total_points) || 0)
        );
        
        if (rankings.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">موردی یافت نشد</div>';
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
                        <span class="student-class">${getClassPersianName(student.class_name)}</span>
                    </div>
                    <div class="student-points">
                        <span>⭐</span>
                        <span>${toPersianNum(student.total_points || 0)}</span>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
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
        
        loadEvents();
    } catch (error) {
        showToast('خطا در ثبت رویداد', 'error');
    }
}

async function loadEvents() {
    const container = document.getElementById('events-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    
    try {
        const response = await apiGet({ action: 'getEvents' });
        const events = response.data || [];
        
        if (events.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز رویدادی ثبت نشده</div>';
            return;
        }
        
        const typeIcons = {
            exam: '📝',
            homework: '📚',
            holiday: '🎉',
            event: '📌'
        };
        
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
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
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
    
    if (!title || !start || !end) {
        showToast('لطفاً عنوان و تاریخ‌ها را وارد کنید', 'warning');
        return;
    }
    
    try {
        await apiPost({
            action: 'addContest',
            contest_id: 'cnt_' + Date.now(),
            title, prize, start_date: start, end_date: end,
            description: desc,
            created_at: new Date().toISOString()
        });
        
        showToast('مسابقه با موفقیت ایجاد شد', 'success');
        
        document.getElementById('contest-title').value = '';
        document.getElementById('contest-prize').value = '';
        document.getElementById('contest-start').value = '';
        document.getElementById('contest-end').value = '';
        document.getElementById('contest-desc').value = '';
        
        loadContests();
    } catch (error) {
        showToast('خطا در ایجاد مسابقه', 'error');
    }
}

async function loadContests() {
    const container = document.getElementById('contests-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    
    try {
        const response = await apiGet({ action: 'getContests' });
        const contests = response.data || [];
        
        if (contests.length === 0) {
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
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

// ============================================================
// کتابخانه
// ============================================================
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
        
        loadLibrary();
    } catch (error) {
        showToast('خطا در افزودن منبع', 'error');
    }
}

async function loadLibrary() {
    const container = document.getElementById('library-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    
    try {
        const response = await apiGet({ action: 'getLibrary' });
        const items = response.data || [];
        
        if (items.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#90a4ae; font-weight:bold;">هنوز منبعی اضافه نشده</div>';
            return;
        }
        
        const typeIcons = {
            video: '🎬', pdf: '📄', audio: '🎵', site: '🌐', book: '📚'
        };
        
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
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
}

// ============================================================
// مدیریت تکالیف
// ============================================================
async function loadLessonsPage() {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>';
    
    try {
        const response = await fetch('./lessons/index.json');
        const data = await response.json();
        const lessons = data.lessons || [];
        
        if (lessons.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">تکلیفی یافت نشد</div>';
            return;
        }
        
        const reports = JSON.parse(localStorage.getItem('reports') || '[]');
        const completedIds = reports.map(r => r.lessonId);
        
        let html = '';
        lessons.forEach(lesson => {
            const isCompleted = completedIds.includes(lesson.id);
            const statusClass = isCompleted ? 'active' : 'expired';
            const statusText = isCompleted ? 'انجام شده' : 'در انتظار';
            
            html += `
                <div class="lesson-item">
                    <div class="lesson-item-icon">📚</div>
                    <div class="lesson-item-info">
                        <div class="lesson-item-title">${lesson.title}</div>
                        <div class="lesson-item-meta">
                            <span>📅 مهلت: ${lesson.dueDate || 'نامشخص'}</span>
                            <span>📝 ${lesson.activityCount || 0} سوال</span>
                        </div>
                    </div>
                    <div class="lesson-item-status ${statusClass}">${statusText}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#c62828; font-weight:bold;">خطا در بارگذاری</div>';
    }
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
console.log('🎓 پنل معلم عربی هفتم - نسخه ۲.۰.۰ با پیام‌رسان');