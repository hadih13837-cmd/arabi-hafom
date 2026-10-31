// ============================================================
// notifications.js — نسخه ۲۱.۰.۰
// رفع باگ isPublished و تکرار markAllAsSeenForReturningUser
// ============================================================

const MESSAGES_CACHE_DURATION = 1800000;
const BADGE_CACHE_KEY = 'studentBadgeCache';
const SEEN_CHAT_KEY = 'seenChatMessages';
const SEEN_CLASS_KEY = 'seenClassMessages';

let isFetchingBadge = false;
let isFetchingChat = false;

let personalMessagesChannel = null;
let classMessagesChannel = null;
let isRealtimeStarted = false;

let seenSaveTimeout = null;

function debouncedSaveSeenData() {
    if (localStorage.getItem('isReturningUser') === 'true') {
        return;
    }
    
    if (seenSaveTimeout) clearTimeout(seenSaveTimeout);
    seenSaveTimeout = setTimeout(async () => {
        if (typeof saveSeenDataToSupabase === 'function') {
            try {
                await saveSeenDataToSupabase();
            } catch (e) {
                console.warn('⚠️ خطا در ذخیره seen_data:', e);
            }
        }
    }, 2000);
}

// ============================================================
// 🆕 markAllAsSeenForReturningUser — نسخه واحد (از settings.js حذف شود)
// ============================================================
async function markAllAsSeenForReturningUser() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) return;
        
        console.log('🔇 علامت‌گذاری همه اعلان‌ها...');
        
        const client = getSupabase();
        if (!client) return;
        
        // چت شخصی
        try {
            const { data: personalMsgs } = await client
                .from('personal_messages')
                .select('message_id')
                .eq('student_id', studentId)
                .eq('sender', 'teacher');
            
            if (personalMsgs && personalMsgs.length > 0) {
                const seenChat = personalMsgs.map(m => m.message_id);
                localStorage.setItem('seenChatMessages', JSON.stringify(seenChat));
                console.log('✅ چت seen شد:', seenChat.length);
            }
        } catch (e) { 
            console.warn('خطا در چت:', e); 
        }
        
        // پیام کلاسی
        try {
            const userClass = localStorage.getItem('userClass');
            const classSlug = classNameToSlug(userClass);
            const { data: classMsgs } = await client
                .from('class_messages')
                .select('message_id')
                .or(`class_name.eq.${classSlug},class_name.eq.all`);
            
            if (classMsgs && classMsgs.length > 0) {
                const seenClass = classMsgs.map(m => m.message_id);
                localStorage.setItem('seenClassMessages', JSON.stringify(seenClass));
                console.log('✅ پیام کلاسی seen شد:', seenClass.length);
            }
        } catch (e) { 
            console.warn('خطا در کلاسی:', e); 
        }
        
        // تکالیف
        try {
            const response = await fetch('./lessons/index.json?t=' + Date.now());
            const data = await response.json();
            const lessons = data.lessons || [];
            const seenLessons = lessons.map(l => l.id);
            localStorage.setItem('seenLessonsForNotif', JSON.stringify(seenLessons));
            localStorage.setItem('seenLessons', JSON.stringify(seenLessons));
            console.log('✅ تکالیف seen شد:', seenLessons.length);
        } catch (e) { 
            console.warn('خطا در تکالیف:', e); 
        }
        
        // جزوه‌ها
        try {
            const response = await fetch('./jozve/index.json?t=' + Date.now());
            const data = await response.json();
            const items = data.items || [];
            const seenJozve = items.map(item => item.id);
            localStorage.setItem('seenJozveIds', JSON.stringify(seenJozve));
            console.log('✅ جزوه‌ها seen شد:', seenJozve.length);
        } catch (e) { 
            console.warn('خطا در جزوه:', e); 
        }
        
        // سایر flags
        localStorage.setItem('seenVideos', JSON.stringify(['video_1', 'video_2']));
        localStorage.setItem('dismissedNewMessageNotif', 'true');
        localStorage.setItem('dismissedNewJozveNotif', 'true');
        
        if (typeof UPDATE_VERSION !== 'undefined') {
            localStorage.setItem('seenUpdateVersion', UPDATE_VERSION);
        }
        
        localStorage.setItem('hasSeenRankingsGuide', 'true');
        localStorage.setItem('guideCompleted', 'true');
        localStorage.setItem('lessonsGuideShown', 'true');
        localStorage.setItem('welcomeShown', 'true');
        
        const today = getPersianDate();
        localStorage.setItem('lastStreakMessageShown', today);
        localStorage.setItem('lastDeadlineNotifDate', today);
        
        console.log('✅ همه اعلان‌ها seen شدن');
        
    } catch (error) {
        console.error('❌ خطا در seen:', error);
    }
}

function saveBadgeCount(count) {
    try {
        localStorage.setItem(BADGE_CACHE_KEY, JSON.stringify({
            count: Math.max(0, count),
            timestamp: Date.now()
        }));
    } catch(e) {}
}

function getBadgeCount() {
    try {
        const cached = JSON.parse(localStorage.getItem(BADGE_CACHE_KEY) || '{}');
        return cached.count || 0;
    } catch (e) {
        return 0;
    }
}

function getSeenChat() {
    try {
        return JSON.parse(localStorage.getItem(SEEN_CHAT_KEY) || '[]');
    } catch(e) { return []; }
}

function getSeenClass() {
    try {
        return JSON.parse(localStorage.getItem(SEEN_CLASS_KEY) || '[]');
    } catch(e) { return []; }
}

function markChatMessageAsSeen(messageId) {
    const seen = getSeenChat();
    if (!seen.includes(messageId)) {
        seen.push(messageId);
        try {
            localStorage.setItem(SEEN_CHAT_KEY, JSON.stringify(seen));
            debouncedSaveSeenData();
        } catch(e) {}
    }
}

function markAllChatMessagesAsSeen(messages) {
    const seen = getSeenChat();
    const newIds = messages.filter(m => m.sender === 'teacher' && !seen.includes(m.message_id)).map(m => m.message_id);
    if (newIds.length > 0) {
        const merged = [...new Set([...seen, ...newIds])];
        try {
            localStorage.setItem(SEEN_CHAT_KEY, JSON.stringify(merged));
            debouncedSaveSeenData();
        } catch(e) {}
        return true;
    }
    return false;
}

function markClassMessageAsSeen(messageId) {
    const seen = getSeenClass();
    if (!seen.includes(messageId)) {
        seen.push(messageId);
        try {
            localStorage.setItem(SEEN_CLASS_KEY, JSON.stringify(seen));
            debouncedSaveSeenData();
        } catch(e) {}
    }
}

function markAllClassMessagesAsSeen(messages) {
    const seen = getSeenClass();
    const newIds = messages.filter(m => !seen.includes(m.message_id)).map(m => m.message_id);
    if (newIds.length > 0) {
        const merged = [...new Set([...seen, ...newIds])];
        try {
            localStorage.setItem(SEEN_CLASS_KEY, JSON.stringify(merged));
            debouncedSaveSeenData();
        } catch(e) {}
        return true;
    }
    return false;
}

function computeBadgeFromLocal() {
    let total = 0;
    
    try {
        const cachedClass = getCachedData('studentClassMessagesCache');
        if (cachedClass && cachedClass.length > 0) {
            const seenClass = getSeenClass();
            total += cachedClass.filter(m => !seenClass.includes(m.message_id)).length;
        }
        
        const studentId = localStorage.getItem('studentUUID');
        if (studentId) {
            const cachedChat = getCachedData('studentChatCache_' + studentId);
            if (cachedChat && cachedChat.length > 0) {
                const seenChat = getSeenChat();
                total += cachedChat.filter(m => m.sender === 'teacher' && !seenChat.includes(m.message_id)).length;
            }
        }
    } catch(e) {}
    
    return total;
}

function updateBadgeImmediately() {
    const count = computeBadgeFromLocal();
    saveBadgeCount(count);
    
    const fab = document.getElementById('home-messages-fab');
    const badge = document.getElementById('home-messages-fab-badge');
    
    if (fab) {
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && activeScreen.id === 'screen-teacher-messages') {
            fab.style.display = 'none';
        } else {
            fab.style.display = 'flex';
        }
    }
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '۹+' : toPersianNum(count);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
    
    return count;
}

function getCachedData(key, duration = MESSAGES_CACHE_DURATION) {
    try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (cached && (Date.now() - cached.timestamp < duration)) {
            return cached.data;
        }
        return null;
    } catch (e) { return null; }
}

function setCachedData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data: data, timestamp: Date.now() }));
    } catch (e) {}
}
function repositionNotifications() {
    const lessonNotif = document.getElementById('new-lesson-notification');
    const videoNotif = document.getElementById('video-notification');
    const messageNotif = document.getElementById('new-message-notification');
    const jozveNotif = document.getElementById('new-jozve-notification');
    const deadlineNotif = document.getElementById('deadline-notification');
    
    let topPos = 15;
    const gap = 85;
    
    if (lessonNotif && lessonNotif.classList.contains('show')) {
        lessonNotif.style.top = topPos + 'px';
        topPos += gap;
    }
    
    if (videoNotif && videoNotif.classList.contains('show')) {
        videoNotif.style.top = topPos + 'px';
        topPos += gap;
    }
    
    if (messageNotif && messageNotif.classList.contains('show')) {
        messageNotif.style.top = topPos + 'px';
        topPos += gap;
    }
    
    if (jozveNotif && jozveNotif.classList.contains('show')) {
        jozveNotif.style.top = topPos + 'px';
        topPos += gap;
    }
    
    if (deadlineNotif && deadlineNotif.classList.contains('show')) {
        deadlineNotif.style.top = topPos + 'px';
        topPos += gap;
    }
}

// ============================================================
// Real-time
// ============================================================
function startRealtimeSubscriptions() {
    if (isRealtimeStarted) {
        console.log('📡 Realtime قبلاً شروع شده');
        return;
    }
    
    const studentId = localStorage.getItem('studentUUID');
    if (!studentId) return;
    
    const userClass = localStorage.getItem('userClass') || 'هفتم یک';
    
    isRealtimeStarted = true;
    console.log('📡 شروع Realtime...');
    
    try {
        if (typeof subscribeToPersonalMessages === 'function') {
            personalMessagesChannel = subscribeToPersonalMessages(studentId, async (payload) => {
                console.log('📨 Realtime: پیام شخصی جدید', payload.eventType);
                
                const messages = await getPersonalMessages(studentId);
                setCachedData('studentChatCache_' + studentId, messages);
                
                const activeScreen = document.querySelector('.screen.active');
                if (activeScreen && activeScreen.id === 'screen-teacher-messages') {
                    const activeTab = document.querySelector('.student-messages-tab.active');
                    if (activeTab && activeTab.dataset.tab === 'chat') {
                        renderStudentChatMessages(messages);
                        markAllChatMessagesAsSeen(messages);
                        if (typeof markAllMessagesAsSeenSupabase === 'function') {
                            markAllMessagesAsSeenSupabase(studentId, 'student').catch(() => {});
                        }
                    }
                } else {
                    if (payload.eventType === 'INSERT' && payload.new && payload.new.sender === 'teacher') {
                        playStudentDingSound();
                        vibrate([30, 50, 30]);
                        showStudentInAppNotification('پیام جدید از معلم', payload.new.text || '');
                    }
                }
                
                updateBadgeImmediately();
            });
        }
    } catch(e) {
        console.warn('خطا در Realtime پیام‌های شخصی:', e);
    }
    
    setTimeout(() => {
        try {
            if (typeof subscribeToClassMessages === 'function') {
                classMessagesChannel = subscribeToClassMessages(userClass, async (payload) => {
                    if (!payload.new) return;
                    const msgClass = payload.new.class_name;
                    const userClassSlug = classNameToSlug(userClass);
                    if (msgClass !== userClassSlug && msgClass !== 'all') {
                        console.log('⏭️ پیام برای کلاس دیگر، نادیده گرفته شد');
                        return;
                    }
                    
                    console.log('📢 Realtime: پیام کلاسی جدید', payload.eventType);
                    
                    const messages = await getClassMessagesFromSupabase(userClass);
                    setCachedData('studentClassMessagesCache', messages);
                    
                    const activeScreen = document.querySelector('.screen.active');
                    if (activeScreen && activeScreen.id === 'screen-teacher-messages') {
                        const activeTab = document.querySelector('.student-messages-tab.active');
                        if (activeTab && activeTab.dataset.tab === 'class') {
                            renderStudentClassMessages(messages);
                            markAllClassMessagesAsSeen(messages);
                        }
                    } else {
                        playStudentDingSound();
                        vibrate([30, 50, 30]);
                        showStudentInAppNotification('📢 پیام جدید کلاسی', payload.new?.title || 'پیام جدید');
                    }
                    
                    updateBadgeImmediately();
                });
            }
        } catch(e) {
            console.warn('خطا در Realtime پیام‌های کلاسی:', e);
        }
    }, 500);
}

function stopRealtimeSubscriptions() {
    isRealtimeStarted = false;
    
    try {
        const client = getSupabase();
        if (client) {
            client.removeAllChannels();
        }
    } catch(e) {}
    
    personalMessagesChannel = null;
    classMessagesChannel = null;
    
    console.log('📴 Realtime قطع شد');
}

// ============================================================
// اعلان‌ها
// ============================================================
function getNotifications() {
    try {
        return JSON.parse(localStorage.getItem('notifications') || '[]');
    } catch(e) { return []; }
}

function saveNotifications(notifs) {
    try {
        localStorage.setItem('notifications', JSON.stringify(notifs));
    } catch(e) {}
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
        warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        teacher: '<svg viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>',
        jozve: '<svg viewBox="0 0 24 24"><path d="M4 19.5C4 18.1193 5.11929 17 6.5 17H20"/><path d="M6.5 2H20V22H6.5C5.11929 22 4 20.8807 4 19.5V4.5C4 3.11929 5.11929 2 6.5 2Z"/></svg>'
    };
    return icons[type] || icons.info;
}

async function loadNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    const cachedClass = getCachedData('studentClassMessagesCache');
    
    if (cachedClass && cachedClass.length > 0) {
        renderNotifications(cachedClass);
    } else {
        container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">⏳</div><div class="report-empty-text">در حال بارگذاری...</div></div>';
    }
    
    try {
        const userClass = localStorage.getItem('userClass') || 'هفتم یک';
        const messages = await getClassMessagesFromSupabase(userClass);
        setCachedData('studentClassMessagesCache', messages);
        renderNotifications(messages);
    } catch (error) {}
}

function renderNotifications(classMessages) {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    const localNotifs = getNotifications();
    const seenClassIds = getSeenClass();
    
    const allNotifications = [
        ...(classMessages || []).map(m => ({
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
             onclick="markNotifRead('${escapeHTML(n.id)}')">
            <div class="notif-icon-wrapper notif-icon-${n.isClassMessage ? 'teacher' : n.type}">
                ${getNotifIcon(n.isClassMessage ? 'teacher' : n.type)}
            </div>
            <div class="notif-content">
                <div class="notif-title">
                    ${n.isClassMessage ? '📢 ' : ''}${escapeHTML(n.title)}
                </div>
                <div class="notif-text">${escapeHTML(n.text)}</div>
                <div class="notif-date">${n.time} ${n.date}</div>
            </div>
        </div>
    `).join('');
}

function markNotifRead(id) {
    if (id.startsWith('cls_') || id.startsWith('msg_')) {
        markClassMessageAsSeen(id);
        updateBadgeImmediately();
        loadNotifications();
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
async function loadLessonsListForNotification() {
    try {
        const cached = getCachedData('lessonsListCache', 600000);
        if (cached) {
            allLessons = cached;
            checkAndAddLessonNotifications();
            return;
        }
        
        const response = await fetch('./lessons/index.json');
        if (!response.ok) throw new Error('خطا');
        const data = await response.json();
        allLessons = data.lessons;
        setCachedData('lessonsListCache', allLessons);
        checkAndAddLessonNotifications();
    } catch (error) {
        allLessons = [];
    }
}

// 🆕 checkAndAddLessonNotifications — با بررسی isPublished
function checkAndAddLessonNotifications() {
    if (typeof isPublished !== 'undefined' && !isPublished) {
        console.log('ℹ️ برنامه منتشر نشده - اعلان تکالیف ساخته نمی‌شود');
        return;
    }
    
    if (localStorage.getItem('isReturningUser') === 'true') {
        return;
    }
    
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
        debouncedSaveSeenData();
    }
}

function checkVideoNotification() {
    if (typeof isPublished !== 'undefined' && !isPublished) {
        const notification = document.getElementById('video-notification');
        if (notification) notification.classList.remove('show');
        return;
    }
    
    if (localStorage.getItem('isReturningUser') === 'true') {
        return;
    }
    
    const seenVideos = JSON.parse(localStorage.getItem('seenVideos') || '[]');
    const currentVideos = ['video_1', 'video_2'];
    const newVideos = currentVideos.filter(id => !seenVideos.includes(id));
    const notification = document.getElementById('video-notification');
    const subText = document.getElementById('video-notification-sub-text');
    
    if (newVideos.length > 0 && notification) {
        subText.textContent = `${toPersianNum(newVideos.length)} ویدیوی جدید در انتظار شماست`;
        repositionNotifications();
        setTimeout(() => {
            notification.classList.add('show');
            repositionNotifications();
        }, 600);
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
        localStorage.setItem('seenVideos', JSON.stringify(['video_1', 'video_2']));
        debouncedSaveSeenData();
        repositionNotifications();
    }, 300);
}

function goToClipsFromNotification() {
    dismissVideoNotification();
    setTimeout(() => openClipsPage(), 200);
}

function checkAndShowNotification() {
    if (typeof isPublished !== 'undefined' && !isPublished) {
        const notification = document.getElementById('new-lesson-notification');
        if (notification) notification.classList.remove('show');
        return;
    }
    
    if (localStorage.getItem('isReturningUser') === 'true') {
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
        repositionNotifications();
    } else {
        notification.classList.remove('show');
    }
    checkNewLessons();
}

function checkDeadlineWarning() {
    if (typeof isPublished !== 'undefined' && !isPublished) {
        const deadlineNotif = document.getElementById('deadline-notification');
        if (deadlineNotif) deadlineNotif.classList.remove('show');
        return;
    }
    
    if (localStorage.getItem('isReturningUser') === 'true') {
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
        setTimeout(() => {
            deadlineNotif.classList.add('show');
            repositionNotifications();
        }, 800);
        
        const today = getPersianDate();
        const lastDeadlineNotifDate = localStorage.getItem('lastDeadlineNotifDate');
        
        if (lastDeadlineNotifDate !== today) {
            urgentLessons.forEach(lesson => {
                const daysLeft = getDaysDiff(lesson.dueDate);
                let timeText = daysLeft === 0 ? 'امروز' : daysLeft === 1 ? 'فردا' : `${toPersianNum(daysLeft)} روز دیگه`;
                addNotification('warning', '⚠️ هشدار مهلت', `مهلت تکلیف «${lesson.title}» ${timeText} تموم میشه!`);
            });
            localStorage.setItem('lastDeadlineNotifDate', today);
            debouncedSaveSeenData();
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
        localStorage.setItem('dismissedDeadlineNotif', 'true');
        debouncedSaveSeenData();
        repositionNotifications();
    }, 300);
}

function goToDeadlineLesson() {
    dismissDeadlineNotification();
    setTimeout(() => goToScreen('screen-lessons'), 200);
}

function dismissNotification() {
    const notif = document.getElementById('new-lesson-notification');
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

function goToNewLesson() {
    document.getElementById('new-lesson-notification').classList.remove('show');
    goToScreen('screen-lessons');
}

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
// Swipe برای اعلان‌ها
// ============================================================
let notifSwipeStartX = 0, notifSwipeStartY = 0, notifCurrentX = 0;
let notifIsDragging = false, notifSwipeDirection = null;
let currentSwipeNotifId = null;

function initNotificationSwipe() {
    ['new-lesson-notification', 'video-notification', 'new-message-notification', 'new-jozve-notification', 'deadline-notification'].forEach(id => {
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
                    localStorage.setItem('seenLessons', JSON.stringify(allLessons.map(l => l.id)));
                    debouncedSaveSeenData();
                }
            } else if (id === 'video-notification') {
                localStorage.setItem('seenVideos', JSON.stringify(['video_1', 'video_2']));
                debouncedSaveSeenData();
            } else if (id === 'new-message-notification') {
                localStorage.setItem('dismissedNewMessageNotif', 'true');
                debouncedSaveSeenData();
            } else if (id === 'new-jozve-notification') {
                if (typeof saveJozveSeen === 'function') {
                    saveJozveSeen();
                }
            } else if (id === 'deadline-notification') {
                localStorage.setItem('dismissedDeadlineNotif', 'true');
                debouncedSaveSeenData();
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