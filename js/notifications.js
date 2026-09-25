// ============================================================
// notifications.js — سیستم اعلان‌ها و مدیریت swipe
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
        warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    return icons[type] || icons.info;
}

function loadNotifications() {
    const notifs = getNotifications();
    const container = document.getElementById('notifications-list');
    if (notifs.length === 0) {
        container.innerHTML = `<div class="report-empty"><div class="report-empty-icon">🔔</div><div class="report-empty-text">هنوز اعلانی ندارید</div></div>`;
        return;
    }
    container.innerHTML = notifs.map(n => `
        <div class="notif-card ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
            <div class="notif-icon-wrapper notif-icon-${n.type}">${getNotifIcon(n.type)}</div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-text">${n.text}</div>
                <div class="notif-date">${n.time} - ${n.date}</div>
            </div>
        </div>
    `).join('');
}

function markNotifRead(id) {
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
// بارگذاری تکالیف برای اعلان (بدون رندر لیست)
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
// جابه‌جایی اعلان‌ها روی هم (اگه چند تا فعال باشن)
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
// Swipe روی اعلان‌ها (لمس و ماوس)
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