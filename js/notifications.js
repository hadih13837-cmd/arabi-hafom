// ============================================================
// notifications.js — سیستم اعلان‌ها، پیام‌رسان و swipe
// نسخه: ۵.۰.۰ — نسخه نهایی قطعی
// ============================================================

// ============================================================
// توابع پایه اعلان
// ============================================================
function getNotifications() {
    return JSON.parse(localStorage.getItem('notifications') || '[]');
}

function saveNotifications(notifs) {
    localStorage.setItem('notifications', JSON.stringify(notifs));
}

function addNotification(type, title, text) {
    const notifs = getNotifications();
    const now = new Date();
    const newNotif = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        type, title, text,
        date: now.toLocaleDateString('fa-IR'),
        time: now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.getTime(),
        read: false
    };
    notifs.unshift(newNotif);
    if (notifs.length > 50) notifs.pop();
    saveNotifications(notifs);
    return newNotif;
}

function updateNotificationBadge() {
    const notifs = getNotifications();
    const unread = notifs.filter(n => !n.read);
    const badge = document.getElementById('notif-badge-dot');
    if (badge) {
        if (unread.length > 0) badge.classList.add('show');
        else badge.classList.remove('show');
    }
}

function getNotifIcon(type) {
    const icons = {
        lesson: '<svg viewBox="0 0 24 24"><path d="M18 8C18 4.68629 15.3137 2 12 2C8.68629 2 6 4.68629 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"/><path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"/></svg>',
        reminder: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        message: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        info: '<svg viewBox="0 0 24 24"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>',
        success: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        clip: '<svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
        warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        teacher: '<svg viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>'
    };
    return icons[type] || icons.info;
}

// ============================================================
// بارگذاری اعلان‌ها (ترکیب اعلان‌های محلی + پیام‌های کلاسی)
// ============================================================
async function loadNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">⏳</div><div class="report-empty-text">در حال بارگذاری...</div></div>';
    
    // ۱. اعلان‌های محلی
    const localNotifs = getNotifications();
    
    // ۲. پیام‌های کلاسی از Sheets
    let classMessages = [];
    try {
        const userClass = localStorage.getItem('userClass') || 'هفتم یک';
        const classSlug = typeof classNameToSlug === 'function' ? classNameToSlug(userClass) : userClass;
        
        if (typeof TEACHER_API_URL !== 'undefined') {
            const response = await fetch(TEACHER_API_URL + '?action=getClassMessages&class_name=' + classSlug + '&t=' + Date.now(), {
                cache: 'no-store'
            });
            const result = await response.json();
            
            if (result.success && result.data) {
                classMessages = result.data;
                console.log('📢 پیام‌های کلاسی دریافت شد:', classMessages.length);
            }
        }
    } catch (error) {
        console.warn('خطا در دریافت پیام‌های کلاسی:', error);
    }
    
    // ۳. ترکیب و مرتب‌سازی
    const seenClassIds = JSON.parse(localStorage.getItem('seenClassMessages') || '[]');
    
    const allNotifications = [
        ...classMessages.map(m => ({
            id: m.message_id,
            type: m.type || 'info',
            title: m.title,
            text: m.text,
            date: m.date_persian || '',
            time: '',
            timestamp: new Date(m.date).getTime(),
            read: seenClassIds.includes(m.message_id),
            isClassMessage: true
        })),
        ...localNotifs
    ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    if (allNotifications.length === 0) {
        container.innerHTML = `
            <div class="report-empty">
                <div class="report-empty-icon">🔔</div>
                <div class="report-empty-text">هنوز اعلانی ندارید</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = allNotifications.map(n => `
        <div class="notif-card ${n.read ? '' : 'unread'} ${n.isClassMessage ? 'teacher-message' : ''}" 
             onclick="markNotifRead('${n.id}')">
            <div class="notif-icon-wrapper notif-icon-${n.isClassMessage ? 'teacher' : n.type}">
                ${getNotifIcon(n.isClassMessage ? 'teacher' : n.type)}
            </div>
            <div class="notif-content">
                <div class="notif-title">
                    ${n.isClassMessage ? '📢 ' : ''}${n.title}
                </div>
                <div class="notif-text">${n.text}</div>
                <div class="notif-date">${n.time} ${n.date}</div>
            </div>
        </div>
    `).join('');
}

function markNotifRead(id) {
    if (id.startsWith('cls_')) {
        const seenIds = JSON.parse(localStorage.getItem('seenClassMessages') || '[]');
        if (!seenIds.includes(id)) {
            seenIds.push(id);
            localStorage.setItem('seenClassMessages', JSON.stringify(seenIds));
        }
        loadNotifications();
        updateNotificationBadge();
        if (typeof updateTeacherMessagesBadge === 'function') {
            updateTeacherMessagesBadge();
        }
        return;
    }
    
    const notifs = getNotifications();
    const notif = notifs.find(n => n.id === id);
    if (notif) {
        notif.read = true;
        saveNotifications(notifs);
        loadNotifications();
        updateNotificationBadge();
    }
}

// ============================================================
// بارگذاری تکالیف برای اعلان
// ============================================================
async function loadLessonsListForNotification() {
    try {
        const response = await fetch('./lessons/index.json');
        if (!response.ok) throw new Error('خطا');
        const data = await response.json();
        allLessons = data.lessons;
        checkAndAddLessonNotifications();
    } catch (error) {
        console.error('خطا در لود تکالیف:', error);
        allLessons = [];
    }
}

function checkAndAddLessonNotifications() {
    if (typeof isPublished !== 'undefined' && !isPublished) return;
    
    const seenLessonsForNotif = JSON.parse(localStorage.getItem('seenLessonsForNotif') || '[]');
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const completedIds = reports.map(r => r.lessonId);
    const newLessons = allLessons.filter(l => {
        if (seenLessonsForNotif.includes(l.id)) return false;
        if (completedIds.includes(l.id)) return false;
        const dueDate = l.dueDate || '۱۴۰۵/۰۹/۱۵';
        if (isExpired(dueDate)) return false;
        return true;
    });
    newLessons.forEach(lesson => {
        addNotification('lesson', 'تکلیف جدید', `${lesson.title}${lesson.subtitle ? ' - ' + lesson.subtitle : ''}`);
    });
    if (newLessons.length > 0) {
        const allIds = allLessons.map(l => l.id);
        localStorage.setItem('seenLessonsForNotif', JSON.stringify(allIds));
    }
}

// ============================================================
// اعلان ویدیوی جدید
// ============================================================
function checkVideoNotification() {
    if (typeof isPublished !== 'undefined' && !isPublished) {
        const notification = document.getElementById('video-notification');
        if (notification) notification.classList.remove('show');
        return;
    }
    
    const seenVideos = JSON.parse(localStorage.getItem('seenVideos') || '[]');
    const currentVideos = ['video_1'];
    const newVideos = currentVideos.filter(id => !seenVideos.includes(id));
    const notification = document.getElementById('video-notification');
    const subText = document.getElementById('video-notification-sub-text');
    if (newVideos.length > 0 && notification) {
        subText.textContent = `${toPersianNum(newVideos.length)} ویدیوی جدید در انتظار شماست`;
        repositionNotifications();
        setTimeout(() => notification.classList.add('show'), 800);
        const notifs = getNotifications();
        const videoNotifExists = notifs.some(n => n.type === 'clip' && n.title.includes('ویدیوی جدید'));
        if (!videoNotifExists) {
            addNotification('clip', 'ویدیوی جدید', 'موشن گرافیک جدید در بخش کلیپ‌ها اضافه شد');
            updateNotificationBadge();
        }
    } else if (notification) {
        notification.classList.remove('show');
    }
}

function dismissVideoNotification() {
    const notif = document.getElementById('video-notification');
    if (!notif) return;
    notif.classList.add('swiping');
    notif.style.transform = 'translateY(-200%)';
    notif.style.opacity = '0';
    setTimeout(() => {
        notif.classList.remove('show', 'swiping');
        notif.style.transform = '';
        notif.style.opacity = '';
        localStorage.setItem('seenVideos', JSON.stringify(['video_1']));
        repositionNotifications();
    }, 300);
}

function goToClipsFromNotification() {
    dismissVideoNotification();
    setTimeout(() => openClipsPage(), 200);
}

// ============================================================
// اعلان تکالیف در انتظار
// ============================================================
function checkAndShowNotification() {
    if (typeof isPublished !== 'undefined' && !isPublished) {
        const notification = document.getElementById('new-lesson-notification');
        if (notification) notification.classList.remove('show');
        return;
    }
    
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const completedIds = reports.map(r => r.lessonId);
    const pendingLessons = allLessons.filter(l => {
        if (completedIds.includes(l.id)) return false;
        const dueDate = l.dueDate || '۱۴۰۵/۰۹/۱۵';
        if (isExpired(dueDate)) return false;
        return true;
    });
    const notification = document.getElementById('new-lesson-notification');
    const subText = document.getElementById('notification-sub-text');
    if (pendingLessons.length > 0 && allLessons.length > 0) {
        subText.textContent = `${toPersianNum(pendingLessons.length)} تکلیف در انتظار شماست`;
        notification.classList.add('show');
    } else {
        notification.classList.remove('show');
    }
    checkNewLessons();
}

// ============================================================
// هشدار مهلت
// ============================================================
function checkDeadlineWarning() {
    if (typeof isPublished !== 'undefined' && !isPublished) {
        const deadlineNotif = document.getElementById('deadline-notification');
        if (deadlineNotif) deadlineNotif.classList.remove('show');
        return;
    }
    
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const completedIds = reports.map(r => r.lessonId);
    const urgentLessons = allLessons.filter(l => {
        if (completedIds.includes(l.id)) return false;
        const dueDate = l.dueDate || '۱۴۰۵/۰۹/۱۵';
        return isDeadlineNear(dueDate);
    });
    const deadlineNotif = document.getElementById('deadline-notification');
    const subText = document.getElementById('deadline-notification-sub-text');
    if (urgentLessons.length > 0 && deadlineNotif) {
        subText.textContent = `${toPersianNum(urgentLessons.length)} تکلیف مهلتش داره تموم میشه!`;
        setTimeout(() => deadlineNotif.classList.add('show'), 600);
        const today = getPersianDate();
        const lastDeadlineNotifDate = localStorage.getItem('lastDeadlineNotifDate');
        if (lastDeadlineNotifDate !== today) {
            urgentLessons.forEach(lesson => {
                const daysLeft = getDaysDiff(lesson.dueDate);
                let timeText = daysLeft === 0 ? 'امروز' : daysLeft === 1 ? 'فردا' : `${toPersianNum(daysLeft)} روز دیگه`;
                addNotification('warning', '⚠️ هشدار مهلت', `مهلت تکلیف «${lesson.title}» ${timeText} تموم میشه!`);
            });
            localStorage.setItem('lastDeadlineNotifDate', today);
            updateNotificationBadge();
        }
    } else if (deadlineNotif) {
        deadlineNotif.classList.remove('show');
    }
    repositionNotifications();
}

function dismissDeadlineNotification() {
    const notif = document.getElementById('deadline-notification');
    if (!notif) return;
    notif.classList.add('swiping');
    notif.style.transform = 'translateY(-200%)';
    notif.style.opacity = '0';
    setTimeout(() => {
        notif.classList.remove('show', 'swiping');
        notif.style.transform = '';
        notif.style.opacity = '';
        repositionNotifications();
    }, 300);
}

function goToDeadlineLesson() {
    dismissDeadlineNotification();
    setTimeout(() => goToScreen('screen-lessons'), 200);
}

// ============================================================
// بستن اعلان تکلیف جدید
// ============================================================
function dismissNotification() {
    const notif = document.getElementById('new-lesson-notification');
    notif.classList.add('swiping');
    notif.style.transform = 'translateY(-200%)';
    notif.style.opacity = '0';
    setTimeout(() => {
        notif.classList.remove('show', 'swiping');
        notif.style.transform = '';
        notif.style.opacity = '';
        repositionNotifications();
    }, 300);
}

function goToNewLesson() {
    document.getElementById('new-lesson-notification').classList.remove('show');
    goToScreen('screen-lessons');
}

// ============================================================
// بج «جدید» روی دکمه تکالیف
// ============================================================
function checkNewLessons() {
    if (allLessons.length === 0) return;
    
    if (typeof isPublished !== 'undefined' && !isPublished) {
        const badge = document.getElementById('new-lesson-badge');
        if (badge) badge.style.display = 'none';
        return;
    }
    
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const completedIds = reports.map(r => r.lessonId);
    const pendingLessons = allLessons.filter(l => {
        if (completedIds.includes(l.id)) return false;
        const dueDate = l.dueDate || '۱۴۰۵/۰۹/۱۵';
        if (isExpired(dueDate)) return false;
        return true;
    });
    const badge = document.getElementById('new-lesson-badge');
    if (pendingLessons.length > 0 && badge) badge.style.display = 'inline-block';
    else if (badge) badge.style.display = 'none';
}

// ============================================================
// جابه‌جایی اعلان‌ها روی هم
// ============================================================
function repositionNotifications() {
    const lessonNotif = document.getElementById('new-lesson-notification');
    const deadlineNotif = document.getElementById('deadline-notification');
    const videoNotif = document.getElementById('video-notification');
    let topPos = 15;
    if (lessonNotif && lessonNotif.classList.contains('show')) {
        lessonNotif.style.top = topPos + 'px';
        topPos += 80;
    }
    if (deadlineNotif && deadlineNotif.classList.contains('show')) {
        deadlineNotif.style.top = topPos + 'px';
        topPos += 80;
    }
    if (videoNotif && videoNotif.classList.contains('show')) {
        videoNotif.style.top = topPos + 'px';
    }
}

// ============================================================
// Swipe روی اعلان‌ها
// ============================================================
let notifSwipeStartX = 0, notifSwipeStartY = 0, notifCurrentX = 0;
let notifIsDragging = false, notifSwipeDirection = null;
let currentSwipeNotifId = null;

function initNotificationSwipe() {
    ['new-lesson-notification', 'video-notification', 'deadline-notification'].forEach(id => {
        const notif = document.getElementById(id);
        if (!notif) return;
        notif.addEventListener('touchstart', (e) => handleNotifTouchStart(e, id), { passive: true });
        notif.addEventListener('touchmove', handleNotifTouchMove, { passive: false });
        notif.addEventListener('touchend', handleNotifTouchEnd, { passive: true });
        notif.addEventListener('mousedown', (e) => handleNotifMouseDown(e, id));
    });
}

function handleNotifTouchStart(e, id) {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    notifSwipeStartX = touch.clientX;
    notifSwipeStartY = touch.clientY;
    notifCurrentX = 0;
    notifIsDragging = true;
    notifSwipeDirection = null;
    currentSwipeNotifId = id;
    const notif = document.getElementById(id);
    notif.classList.add('dragging');
    notif.classList.remove('swiping');
}

function handleNotifTouchMove(e) {
    if (!notifIsDragging || !currentSwipeNotifId) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - notifSwipeStartX;
    const diffY = touch.clientY - notifSwipeStartY;
    if (!notifSwipeDirection) {
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
            notifSwipeDirection = Math.abs(diffX) > Math.abs(diffY) ? 'horizontal' : 'vertical';
        }
    }
    if (notifSwipeDirection === 'horizontal') {
        e.preventDefault();
        notifCurrentX = diffX;
        const notif = document.getElementById(currentSwipeNotifId);
        notif.style.transform = `translate(${diffX}px, ${diffY * 0.3}px)`;
        notif.style.opacity = Math.max(0.3, 1 - Math.abs(diffX) / 300);
    } else if (notifSwipeDirection === 'vertical') {
        notifIsDragging = false;
        const notif = document.getElementById(currentSwipeNotifId);
        notif.classList.remove('dragging');
        notif.style.transform = '';
        notif.style.opacity = '';
    }
}

function handleNotifTouchEnd() {
    if (!notifIsDragging || !currentSwipeNotifId) return;
    notifIsDragging = false;
    const notif = document.getElementById(currentSwipeNotifId);
    if (!notif) return;
    notif.classList.remove('dragging');
    const id = currentSwipeNotifId;
    if (notifSwipeDirection === 'horizontal' && Math.abs(notifCurrentX) > 80) {
        notif.classList.add('swiping');
        const direction = notifCurrentX > 0 ? 1 : -1;
        notif.style.transform = `translate(${direction * 400}px, 0)`;
        notif.style.opacity = '0';
        setTimeout(() => {
            notif.classList.remove('show', 'swiping');
            notif.style.transform = '';
            notif.style.opacity = '';
            if (id === 'new-lesson-notification') {
                if (allLessons.length > 0) {
                    const allIds = allLessons.map(l => l.id);
                    localStorage.setItem('seenLessons', JSON.stringify(allIds));
                    const badge = document.getElementById('new-lesson-badge');
                    if (badge) badge.style.display = 'none';
                }
            } else if (id === 'video-notification') {
                localStorage.setItem('seenVideos', JSON.stringify(['video_1']));
            }
            repositionNotifications();
        }, 300);
    } else {
        notif.classList.add('swiping');
        notif.style.transform = '';
        notif.style.opacity = '';
        setTimeout(() => notif.classList.remove('swiping'), 300);
    }
    notifCurrentX = 0;
    notifSwipeDirection = null;
    currentSwipeNotifId = null;
}

function handleNotifMouseDown(e, id) {
    if (e.target.closest('.notification-btn') || e.target.closest('.notification-close')) return;
    notifSwipeStartX = e.clientX;
    notifSwipeStartY = e.clientY;
    notifCurrentX = 0;
    notifIsDragging = true;
    notifSwipeDirection = null;
    currentSwipeNotifId = id;
    const notif = document.getElementById(id);
    notif.classList.add('dragging');
    const onMove = (ev) => {
        if (!notifIsDragging) return;
        const diffX = ev.clientX - notifSwipeStartX;
        const diffY = ev.clientY - notifSwipeStartY;
        if (!notifSwipeDirection) {
            if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
                notifSwipeDirection = Math.abs(diffX) > Math.abs(diffY) ? 'horizontal' : 'vertical';
            }
        }
        if (notifSwipeDirection === 'horizontal') {
            notifCurrentX = diffX;
            notif.style.transform = `translate(${diffX}px, ${diffY * 0.3}px)`;
            notif.style.opacity = Math.max(0.3, 1 - Math.abs(diffX) / 300);
        }
    };
    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        handleNotifTouchEnd();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

// ============================================================
// پیام‌رسان دانش‌آموز
// ============================================================

let studentChatPollingInterval = null;
let currentStudentTab = 'class';
let lastChatMessageCount = 0;

// ============================================================
// رفتن به صفحه پیام‌های معلم
// ============================================================
function goToTeacherMessages() {
    vibrate(15);
    goToScreen('screen-teacher-messages');
    loadStudentMessages();
}

// ============================================================
// بارگذاری پیام‌های دانش‌آموز
// ============================================================
async function loadStudentMessages() {
    const activeTab = document.querySelector('.student-messages-tab.active');
    const tab = activeTab ? activeTab.dataset.tab : 'class';
    
    if (tab === 'class') {
        await loadStudentClassMessages();
    } else {
        await loadStudentChat();
        startStudentChatPolling();
    }
}

// ============================================================
// تغییر تب
// ============================================================
function switchStudentMessagesTab(tab) {
    currentStudentTab = tab;
    
    document.querySelectorAll('.student-messages-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.student-messages-tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.student-messages-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById('student-tab-' + tab)?.classList.add('active');
    
    if (tab === 'class') {
        stopStudentChatPolling();
        loadStudentClassMessages();
    } else {
        loadStudentChat();
        startStudentChatPolling();
    }
}

// ============================================================
// بارگذاری پیام‌های کلاسی
// ============================================================
async function loadStudentClassMessages() {
    const container = document.getElementById('student-class-messages-content');
    if (!container) return;
    
    container.innerHTML = `
        <div class="rankings-loading">
            <div class="rankings-spinner"></div>
            <div class="rankings-loading-text">در حال بارگذاری...</div>
        </div>
    `;
    
    try {
        const userClass = localStorage.getItem('userClass') || 'هفتم یک';
        const classSlug = typeof classNameToSlug === 'function' ? classNameToSlug(userClass) : userClass;
        
        if (typeof TEACHER_API_URL === 'undefined') {
            container.innerHTML = renderStudentEmpty('⚠️', 'اتصال برقرار نشد', 'لطفاً اینترنت خود را چک کنید');
            return;
        }
        
        const response = await fetch(TEACHER_API_URL + '?action=getClassMessages&class_name=' + classSlug + '&t=' + Date.now(), {
            cache: 'no-store'
        });
        const result = await response.json();
        
        if (!result.success || !result.data || result.data.length === 0) {
            container.innerHTML = renderStudentEmpty('📢', 'هنوز پیام کلاسی نیست', 'وقتی معلم پیامی برای کلاس بفرسته، اینجا نمایش داده میشه');
            updateClassBadge(0);
            updateChatBadge();
            updateMessagesFab(0);
            return;
        }
        
        const messages = result.data.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 🆕 ذخیره به عنوان خوانده‌شده
        const seenIds = JSON.parse(localStorage.getItem('seenClassMessages') || '[]');
        const allMessageIds = messages.map(m => m.message_id);
        const mergedSeen = [...new Set([...seenIds, ...allMessageIds])];
        localStorage.setItem('seenClassMessages', JSON.stringify(mergedSeen));
        
        const typeIcons = {
            info: 'ℹ️',
            warning: '⚠️',
            success: '✅',
            reminder: '🔔'
        };
        
        const typeTexts = {
            info: 'اطلاعیه',
            warning: 'هشدار',
            success: 'تبریک',
            reminder: 'یادآوری'
        };
        
        let html = '';
        messages.forEach(msg => {
            html += `
                <div class="student-class-message-card type-${msg.type || 'info'}">
                    <div class="student-class-message-header">
                        <div class="student-class-message-icon">${typeIcons[msg.type] || '📩'}</div>
                        <div class="student-class-message-info">
                            <div class="student-class-message-title">${msg.title}</div>
                            <div class="student-class-message-meta">
                                <span>📅 ${msg.date_persian || ''}</span>
                                <span class="student-class-message-type-badge ${msg.type || 'info'}">
                                    ${typeTexts[msg.type] || 'پیام'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="student-class-message-text">${msg.text}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // 🆕 آپدیت badge و FAB بعد از خواندن
        updateClassBadge(0);
        updateChatBadge();
        updateMessagesFab(0);
        
    } catch (error) {
        console.error('خطا در بارگذاری پیام‌های کلاسی:', error);
        container.innerHTML = renderStudentEmpty('⚠️', 'خطا در بارگذاری', 'لطفاً اینترنت خود را چک کنید');
    }
}

// ============================================================
// بارگذاری چت با معلم
// ============================================================
async function loadStudentChat() {
    const container = document.getElementById('student-chat-messages');
    if (!container) return;
    
    container.innerHTML = '<div class="student-chat-empty"><div class="student-chat-empty-icon">💬</div>در حال بارگذاری...</div>';
    
    try {
        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) {
            container.innerHTML = renderStudentEmpty('⚠️', 'خطا', 'اطلاعات کاربری پیدا نشد');
            return;
        }
        
        if (typeof TEACHER_API_URL === 'undefined') {
            container.innerHTML = renderStudentEmpty('⚠️', 'اتصال برقرار نشد', 'لطفاً اینترنت خود را چک کنید');
            return;
        }
        
        const response = await fetch(TEACHER_API_URL + '?action=getPersonalMessages&student_id=' + studentId + '&t=' + Date.now(), {
            cache: 'no-store'
        });
        const result = await response.json();
        
        if (!result.success) {
            container.innerHTML = renderStudentEmpty('⚠️', 'خطا', 'لطفاً دوباره تلاش کنید');
            return;
        }
        
        const messages = (result.data || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 🆕 ذخیره به عنوان خوانده‌شده — همه پیام‌های معلم
        const seenIds = JSON.parse(localStorage.getItem('seenChatMessages') || '[]');
        const teacherMessageIds = messages.filter(m => m.sender === 'teacher').map(m => m.message_id);
        const mergedSeen = [...new Set([...seenIds, ...teacherMessageIds])];
        localStorage.setItem('seenChatMessages', JSON.stringify(mergedSeen));
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="student-chat-empty">
                    <div class="student-chat-empty-icon">💬</div>
                    هنوز پیامی رد و بدل نشده<br>
                    <span style="font-size: 12px; opacity: 0.7;">می‌تونی اولین پیام رو بفرستی</span>
                </div>
            `;
            lastChatMessageCount = 0;
            updateChatBadge();
            updateClassBadge();
            updateMessagesFab();
            return;
        }
        
        let html = '';
        messages.forEach(msg => {
            const senderClass = msg.sender === 'teacher' ? 'teacher' : 'student';
            const time = msg.date_persian || '';
            
            html += `
                <div class="student-chat-message ${senderClass}">
                    <div>${msg.text}</div>
                    <div class="student-chat-message-time">${time}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
        lastChatMessageCount = messages.length;
        
        // 🆕 آپدیت badge و FAB بعد از خواندن
        updateChatBadge();
        updateClassBadge();
        updateMessagesFab();
        
    } catch (error) {
        console.error('خطا در بارگذاری چت:', error);
        container.innerHTML = renderStudentEmpty('⚠️', 'خطا در بارگذاری', 'لطفاً اینترنت خود را چک کنید');
    }
}

// ============================================================
// ارسال پیام به معلم
// ============================================================
async function sendStudentMessage() {
    const input = document.getElementById('student-chat-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    const studentId = localStorage.getItem('studentUUID');
    const studentName = localStorage.getItem('userName');
    const userClass = localStorage.getItem('userClass');
    const classSlug = typeof classNameToSlug === 'function' ? classNameToSlug(userClass) : userClass;
    
    if (!studentId || !studentName) {
        showModal('خطا', 'اطلاعات کاربری پیدا نشد.', '❌');
        return;
    }
    
    const messageData = {
        action: 'sendPersonalMessage',
        message_id: 'pm_' + Date.now(),
        student_id: studentId,
        student_name: studentName,
        class_name: classSlug,
        sender: 'student',
        text: text,
        date: new Date().toISOString(),
        date_persian: new Date().toLocaleDateString('fa-IR')
    };
    
    try {
        input.value = '';
        
        // نمایش فوری
        const container = document.getElementById('student-chat-messages');
        
        const emptyState = container.querySelector('.student-chat-empty');
        if (emptyState) emptyState.remove();
        
        const time = messageData.date_persian;
        const msgEl = document.createElement('div');
        msgEl.className = 'student-chat-message student';
        msgEl.innerHTML = `
            <div>${text}</div>
            <div class="student-chat-message-time">${time}</div>
        `;
        container.appendChild(msgEl);
        container.scrollTop = container.scrollHeight;
        lastChatMessageCount++;
        
        // ارسال به سرور
        await fetch(TEACHER_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(messageData)
        });
        
        vibrate(15);
        console.log('✅ پیام ارسال شد');
        
    } catch (error) {
        console.error('خطا در ارسال پیام:', error);
        showModal('خطا', 'خطا در ارسال پیام. لطفاً دوباره تلاش کنید.', '❌');
    }
}

// ============================================================
// Polling برای چت دانش‌آموز
// ============================================================
function startStudentChatPolling() {
    stopStudentChatPolling();
    
    studentChatPollingInterval = setInterval(async () => {
        const activeScreen = document.querySelector('.screen.active');
        if (!activeScreen || activeScreen.id !== 'screen-teacher-messages') return;
        
        const activeTab = document.querySelector('.student-messages-tab.active');
        if (!activeTab || activeTab.dataset.tab !== 'chat') return;
        
        try {
            const studentId = localStorage.getItem('studentUUID');
            if (!studentId) return;
            
            const response = await fetch(TEACHER_API_URL + '?action=getPersonalMessages&student_id=' + studentId + '&t=' + Date.now(), {
                cache: 'no-store'
            });
            const result = await response.json();
            
            if (!result.success || !result.data) return;
            
            const messages = result.data.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            if (messages.length > lastChatMessageCount) {
                const lastMsg = messages[messages.length - 1];
                
                if (lastMsg.sender === 'teacher') {
                    playStudentDingSound();
                    vibrate([30, 50, 30]);
                }
                
                const container = document.getElementById('student-chat-messages');
                if (container) {
                    let html = '';
                    messages.forEach(msg => {
                        const senderClass = msg.sender === 'teacher' ? 'teacher' : 'student';
                        const time = msg.date_persian || '';
                        
                        html += `
                            <div class="student-chat-message ${senderClass}">
                                <div>${msg.text}</div>
                                <div class="student-chat-message-time">${time}</div>
                            </div>
                        `;
                    });
                    container.innerHTML = html;
                    container.scrollTop = container.scrollHeight;
                }
                
                lastChatMessageCount = messages.length;
                
                // 🆕 mark as read
                const seenIds = JSON.parse(localStorage.getItem('seenChatMessages') || '[]');
                const teacherMessageIds = messages.filter(m => m.sender === 'teacher').map(m => m.message_id);
                const mergedSeen = [...new Set([...seenIds, ...teacherMessageIds])];
                localStorage.setItem('seenChatMessages', JSON.stringify(mergedSeen));
            }
        } catch (error) {
            console.warn('Polling error:', error);
        }
    }, 3000);
}

function stopStudentChatPolling() {
    if (studentChatPollingInterval) {
        clearInterval(studentChatPollingInterval);
        studentChatPollingInterval = null;
    }
}

// ============================================================
// صدای دینگ برای دانش‌آموز
// ============================================================
function playStudentDingSound() {
    if (localStorage.getItem('soundsEnabled') === 'false') return;
    
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
    } catch (e) {
        console.warn('خطا در پخش صدا:', e);
    }
}

// ============================================================
// رفرش صفحه پیام‌ها
// ============================================================
async function refreshTeacherMessages() {
    vibrate(15);
    
    const activeTab = document.querySelector('.student-messages-tab.active');
    const tab = activeTab ? activeTab.dataset.tab : 'class';
    
    if (tab === 'class') {
        await loadStudentClassMessages();
    } else {
        await loadStudentChat();
    }
    
    showModal('✅', 'پیام‌ها بروزرسانی شد', '✅');
}

// ============================================================
// 🆕 آپدیت Badge تب کلاس
// ============================================================
function updateClassBadge(count) {
    const badge = document.getElementById('class-unread-badge');
    if (!badge) return;
    
    if (count === undefined) {
        // خودش محاسبه کن
        count = 0;
    }
    
    if (count > 0) {
        badge.textContent = toPersianNum(count);
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// ============================================================
// 🆕 آپدیت Badge تب چت
// ============================================================
async function updateChatBadge() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) return;
        
        if (typeof TEACHER_API_URL === 'undefined') return;
        
        const response = await fetch(TEACHER_API_URL + '?action=getPersonalMessages&student_id=' + studentId + '&t=' + Date.now(), {
            cache: 'no-store'
        });
        const result = await response.json();
        
        if (!result.success || !result.data) return;
        
        const seenIds = JSON.parse(localStorage.getItem('seenChatMessages') || '[]');
        const unreadCount = result.data.filter(m => m.sender === 'teacher' && !seenIds.includes(m.message_id)).length;
        
        const badge = document.getElementById('chat-unread-badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = toPersianNum(unreadCount);
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
// 🆕 آپدیت FAB صفحه خانه
// ============================================================
async function updateMessagesFab(forcedCount) {
    const fab = document.getElementById('home-messages-fab');
    const badge = document.getElementById('home-messages-fab-badge');
    
    if (!fab || !badge) return;
    
    // 🆕 اگه توی صفحه پیام‌ها هستیم، FAB مخفی
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'screen-teacher-messages') {
        fab.style.display = 'none';
        return;
    }
    
    let totalUnread = forcedCount;
    
    // اگه عدد صریح داده نشده، خودش حساب کن
    if (totalUnread === undefined) {
        totalUnread = 0;
        
        try {
            const studentId = localStorage.getItem('studentUUID');
            const userClass = localStorage.getItem('userClass') || 'هفتم یک';
            const classSlug = typeof classNameToSlug === 'function' ? classNameToSlug(userClass) : userClass;
            
            if (typeof TEACHER_API_URL === 'undefined' || !studentId) {
                fab.style.display = 'none';
                return;
            }
            
            // پیام‌های کلاسی
            try {
                const classResponse = await fetch(TEACHER_API_URL + '?action=getClassMessages&class_name=' + classSlug + '&t=' + Date.now(), {
                    cache: 'no-store'
                });
                const classResult = await classResponse.json();
                if (classResult.success && classResult.data) {
                    const seenClassIds = JSON.parse(localStorage.getItem('seenClassMessages') || '[]');
                    totalUnread += classResult.data.filter(m => !seenClassIds.includes(m.message_id)).length;
                }
            } catch (e) {}
            
            // چت شخصی
            try {
                const chatResponse = await fetch(TEACHER_API_URL + '?action=getPersonalMessages&student_id=' + studentId + '&t=' + Date.now(), {
                    cache: 'no-store'
                });
                const chatResult = await chatResponse.json();
                if (chatResult.success && chatResult.data) {
                    const seenChatIds = JSON.parse(localStorage.getItem('seenChatMessages') || '[]');
                    totalUnread += chatResult.data.filter(m => m.sender === 'teacher' && !seenChatIds.includes(m.message_id)).length;
                }
            } catch (e) {}
        } catch (e) {
            console.warn('Error:', e);
        }
    }
    
    if (totalUnread > 0) {
        fab.style.display = 'flex';
        badge.textContent = totalUnread > 9 ? '۹+' : toPersianNum(totalUnread);
        badge.style.display = 'flex';
    } else {
        fab.style.display = 'none';
    }
}

// ============================================================
// 🆕 چک کردن پیام‌های جدید (برای FAB)
// ============================================================
async function checkTeacherMessagesBadge() {
    await updateMessagesFab();
    
    // آپدیت badge تب‌ها اگه توی صفحه پیام‌ها هستیم
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'screen-teacher-messages') {
        await updateChatBadge();
    }
}

// ============================================================
// 🆕 رندر حالت خالی
// ============================================================
function renderStudentEmpty(icon, title, text) {
    return `
        <div class="student-messages-empty">
            <div class="student-messages-empty-icon">${icon}</div>
            <div class="student-messages-empty-title">${title}</div>
            <div class="student-messages-empty-text">${text}</div>
        </div>
    `;
}