// ============================================================
// app.js — نقطه شروع برنامه
// نسخه: ۷.۰.۰ — با مودال بروزرسانی، راهنمای رتبه‌بندی و نوتیفیکیشن پیام
// ============================================================

// ============================================================
// متغیر سراسری
// ============================================================
let isPublished = true;
const UPDATE_VERSION = 'v2.0.0';

// ============================================================
// مودال بروزرسانی
// ============================================================
function checkAndShowUpdateModal() {
    const seenVersion = localStorage.getItem('seenUpdateVersion');
    
    if (seenVersion === UPDATE_VERSION) return;
    if (localStorage.getItem('userRegistered') !== 'true') return;
    
    setTimeout(() => showUpdateModal(), 2500);
}

function showUpdateModal() {
    const modal = document.getElementById('update-modal');
    if (modal) {
        modal.classList.add('active');
        console.log('🎉 مودال بروزرسانی نشون داده شد');
    }
}

function closeUpdateModal() {
    const modal = document.getElementById('update-modal');
    if (modal) modal.classList.remove('active');
    
    localStorage.setItem('seenUpdateVersion', UPDATE_VERSION);
    localStorage.setItem('seenUpdateDate', new Date().toISOString());
    
    vibrate(20);
    console.log('✅ بروزرسانی دیده شد');
}

// ============================================================
// راهنمای رتبه‌بندی
// ============================================================
let rankingsGuideStep = 0;

const RANKINGS_GUIDE_STEPS = [
    {
        icon: '🏆',
        title: 'رتبه‌بندی کلاس',
        subtitle: 'با دوستات رقابت کن!',
        text: 'اینجا می‌تونی <strong>رتبه‌ت رو در کلاس</strong> ببینی. هر کسی که امتیاز بیشتری داشته باشه، بالاتر قرار می‌گیره.'
    },
    {
        icon: '🥇',
        title: 'سکوی قهرمانی',
        subtitle: 'سه نفر اول',
        text: 'سه نفر اول کلاس با <strong>مدال طلا، نقره و برنز</strong> نشون داده میشن. سعی کن به این سه نفر برسی!'
    },
    {
        icon: '👆',
        title: 'کارت پروفایل',
        subtitle: 'اطلاعات کامل',
        text: 'با کلیک روی هر دانش‌آموز، <strong>کارت پروفایلش</strong> باز میشه و می‌تونی اطلاعات کامل و مدال‌هاش رو ببینی.'
    },
    {
        icon: '⭐',
        title: 'امتیاز بگیر',
        subtitle: 'تکالیف رو انجام بده',
        text: 'برای بالا رفتن در رتبه‌بندی، <strong>تکالیفت رو انجام بده</strong> و امتیاز جمع کن. هر چه امتیاز بیشتر، رتبه بالاتر!'
    }
];

function checkAndShowRankingsGuide() {
    const hasSeen = localStorage.getItem('hasSeenRankingsGuide') === 'true';
    if (hasSeen) return false;
    
    setTimeout(() => showRankingsGuide(), 800);
    return true;
}

function showRankingsGuide() {
    rankingsGuideStep = 0;
    updateRankingsGuideStep();
    
    const overlay = document.getElementById('rankings-guide');
    if (overlay) overlay.classList.add('active');
}

function updateRankingsGuideStep() {
    const step = RANKINGS_GUIDE_STEPS[rankingsGuideStep];
    if (!step) return;
    
    const stepEl = document.getElementById('rankings-guide-step');
    const iconEl = document.getElementById('rankings-guide-icon');
    const titleEl = document.getElementById('rankings-guide-title');
    const subtitleEl = document.getElementById('rankings-guide-subtitle');
    const textEl = document.getElementById('rankings-guide-text');
    const nextBtn = document.getElementById('rankings-guide-next');
    const dotsEl = document.getElementById('rankings-guide-dots');
    
    if (stepEl) stepEl.textContent = `گام ${toPersianNum(rankingsGuideStep + 1)} از ${toPersianNum(RANKINGS_GUIDE_STEPS.length)}`;
    if (iconEl) iconEl.textContent = step.icon;
    if (titleEl) titleEl.textContent = step.title;
    if (subtitleEl) subtitleEl.textContent = step.subtitle;
    if (textEl) textEl.innerHTML = step.text;
    
    if (nextBtn) {
        nextBtn.textContent = (rankingsGuideStep === RANKINGS_GUIDE_STEPS.length - 1) 
            ? 'شروع! 🎯' 
            : 'فهمیدم';
    }
    
    if (dotsEl) {
        let dotsHTML = '';
        for (let i = 0; i < RANKINGS_GUIDE_STEPS.length; i++) {
            dotsHTML += `<div class="rankings-guide-dot ${i === rankingsGuideStep ? 'active' : ''}"></div>`;
        }
        dotsEl.innerHTML = dotsHTML;
    }
}

function nextRankingsGuide() {
    vibrate(15);
    rankingsGuideStep++;
    
    if (rankingsGuideStep >= RANKINGS_GUIDE_STEPS.length) {
        closeRankingsGuide();
    } else {
        updateRankingsGuideStep();
    }
}

function skipRankingsGuide() {
    vibrate(15);
    closeRankingsGuide();
}

function closeRankingsGuide() {
    const overlay = document.getElementById('rankings-guide');
    if (overlay) overlay.classList.remove('active');
    
    localStorage.setItem('hasSeenRankingsGuide', 'true');
    localStorage.setItem('rankingsGuideSeenDate', new Date().toISOString());
    console.log('✅ راهنمای رتبه‌بندی دیده شد');
}

// ============================================================
// نوتیفیکیشن پیام‌های معلم در صفحه خانه
// ============================================================
function checkAndShowNewMessageNotification() {
    const dismissed = localStorage.getItem('dismissedNewMessageNotif') === 'true';
    if (dismissed) return;
    
    const studentId = localStorage.getItem('studentUUID');
    if (!studentId) return;
    
    const cachedChat = getCachedData('studentChatCache_' + studentId);
    const cachedClass = getCachedData('studentClassMessagesCache');
    
    if (!cachedChat && !cachedClass) return;
    
    const seenChat = JSON.parse(localStorage.getItem('seenChatMessages') || '[]');
    const seenClass = JSON.parse(localStorage.getItem('seenClassMessages') || '[]');
    
    let unreadChat = 0;
    let unreadClass = 0;
    
    if (cachedChat && cachedChat.length > 0) {
        unreadChat = cachedChat.filter(m => m.sender === 'teacher' && !seenChat.includes(m.message_id)).length;
    }
    
    if (cachedClass && cachedClass.length > 0) {
        unreadClass = cachedClass.filter(m => !seenClass.includes(m.message_id)).length;
    }
    
    const totalUnread = unreadChat + unreadClass;
    
    if (totalUnread > 0) {
        const notif = document.getElementById('new-message-notification');
        const subText = document.getElementById('new-message-notification-sub');
        
        if (notif && subText) {
            let text = '';
            if (unreadChat > 0 && unreadClass > 0) {
                text = `${toPersianNum(unreadChat)} پیام شخصی و ${toPersianNum(unreadClass)} پیام کلاسی جدید`;
            } else if (unreadChat > 0) {
                text = unreadChat === 1 ? 'یک پیام شخصی جدید داری' : `${toPersianNum(unreadChat)} پیام شخصی جدید داری`;
            } else {
                text = unreadClass === 1 ? 'یک پیام کلاسی جدید داری' : `${toPersianNum(unreadClass)} پیام کلاسی جدید داری`;
            }
            
            subText.textContent = text;
            repositionNotifications();
            
            setTimeout(() => {
                notif.classList.add('show');
            }, 1200);
        }
    }
}

function dismissNewMessageNotification() {
    const notif = document.getElementById('new-message-notification');
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
    
    localStorage.setItem('dismissedNewMessageNotif', 'true');
}

function goToTeacherMessagesFromNotification() {
    dismissNewMessageNotification();
    setTimeout(() => {
        goToScreen('screen-teacher-messages');
    }, 200);
}

function resetNewMessageNotification() {
    localStorage.removeItem('dismissedNewMessageNotif');
}

// ============================================================
// همگام‌سازی خودکار
// ============================================================
function autoSyncRanking(reason = 'unknown') {
    if (localStorage.getItem('userRegistered') !== 'true') return;
    if (typeof saveRankingToSupabase !== 'function') return;
    
    setTimeout(async () => {
        try {
            await saveRankingToSupabase();
        } catch (e) {}
    }, 500);
}

// ============================================================
// بررسی حالت بروزرسانی
// ============================================================
async function checkMaintenanceMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('admin') === ADMIN_CODE;
    
    try {
        const response = await fetch('./maintenance.json?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) return false;
        const data = await response.json();
        
        isPublished = (data.published !== false);
        if (isAdmin) return false;
        return data.maintenance === true;
    } catch(e) {
        return false;
    }
}

// ============================================================
// شروع برنامه
// ============================================================
async function startApp() {
    const isRegistered = localStorage.getItem('userRegistered') === 'true';
    if (isRegistered) {
        updateStreak();
        await loadLessonsListForNotification();
        goToScreen('screen-home');
        setTimeout(() => {
            checkAndShowNotification();
            checkDeadlineWarning();
            updateNotificationBadge();
            checkVideoNotification();
            
            if (typeof checkTeacherMessagesBadge === 'function') {
                checkTeacherMessagesBadge();
            }
            
            if (typeof startRealtimeSubscriptions === 'function' && 
                typeof isRealtimeStarted !== 'undefined' && 
                !isRealtimeStarted) {
                setTimeout(() => startRealtimeSubscriptions(), 500);
            }
            
            checkAndShowUpdateModal();
            
            setTimeout(() => {
                checkAndShowNewMessageNotification();
            }, 2500);
            
            if (localStorage.getItem('guideCompleted') !== 'true') {
                currentGuideStep = 0;
                showGuideStep();
            } else {
                showStreakMessage();
            }
        }, 500);
    } else {
        goToScreen('screen-welcome');
    }
}

// ============================================================
// UUID
// ============================================================
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================================
// PWA — Service Worker
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('✅ Service Worker ثبت شد');

            setInterval(() => registration.update(), 60000);

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                        showUpdateNotification();
                    }
                });
            });

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        } catch (e) {
            console.log('⚠️ خطا در Service Worker:', e);
        }
    });
}

function showUpdateNotification() {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #4caf50, #2e7d32);
        color: #fff; padding: 12px 20px; border-radius: 50px;
        font-family: 'Vazirmatn', sans-serif; font-size: 13px; font-weight: 900;
        z-index: 999999; box-shadow: 0 8px 25px rgba(76, 175, 80, 0.5);
        display: flex; align-items: center; gap: 8px;
    `;
    notif.innerHTML = '🎉 نسخه‌ی جدید در حال بارگذاری...';
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.transition = 'opacity 0.3s ease';
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 300);
    }, 2000);
}

// ============================================================
// PWA — نصب
// ============================================================
let deferredPrompt = null;
const installBanner = document.getElementById('install-banner');

function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function wasDismissed() {
    return localStorage.getItem('installBannerDismissed') === 'true';
}

function dismissInstallBanner() {
    installBanner.classList.remove('show');
    localStorage.setItem('installBannerDismissed', 'true');
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isAppInstalled() && !wasDismissed()) {
        setTimeout(() => installBanner.classList.add('show'), 3000);
    }
});

setTimeout(() => {
    if (!isAppInstalled() && !wasDismissed() && !deferredPrompt) {
        installBanner.classList.add('show');
    }
}, 3000);

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            installBanner.classList.remove('show');
            localStorage.setItem('installBannerDismissed', 'true');
        }
        deferredPrompt = null;
    } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        alert(isIOS
            ? 'برای نصب در آیفون:\n\n۱. دکمه Share را بزنید.\n۲. Add to Home Screen را انتخاب کنید.'
            : 'برای نصب:\n\nمنوی مرورگر → Add to home screen یا نصب برنامه');
    }
}

window.addEventListener('appinstalled', () => {
    installBanner.classList.remove('show');
    localStorage.setItem('installBannerDismissed', 'true');
});

// ============================================================
// بارگذاری مسابقات
// ============================================================
async function loadHomeContests() {
    const section = document.getElementById('home-contests-section');
    const list = document.getElementById('home-contests-list');
    if (!section || !list) return;
    
    try {
        if (typeof getContestsFromSupabase !== 'function') return;
        const contests = await getContestsFromSupabase();
        
        if (!contests || contests.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        const today = getPersianDate();
        const activeContests = contests.filter(c => {
            const endNum = persianDateToNumber(c.end_date);
            const todayNum = persianDateToNumber(today);
            return endNum >= todayNum;
        });
        
        if (activeContests.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        list.innerHTML = activeContests.slice(0, 3).map(c => `
            <div class="home-contest-item">
                <div class="home-contest-icon">🏆</div>
                <div class="home-contest-info">
                    <div class="home-contest-title">${c.title}</div>
                    <div class="home-contest-meta">🎁 ${c.prize || 'بدون جایزه'} • تا ${c.end_date}</div>
                </div>
            </div>
        `).join('');
        
        section.style.display = 'block';
    } catch (error) {
        section.style.display = 'none';
    }
}

// ============================================================
// بارگذاری کتابخانه
// ============================================================
async function loadHomeLibrary() {
    const section = document.getElementById('home-library-section');
    const list = document.getElementById('home-library-list');
    if (!section || !list) return;
    
    try {
        if (typeof getLibraryFromSupabase !== 'function') return;
        const items = await getLibraryFromSupabase();
        
        if (!items || items.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        const typeIcons = { video: '🎬', pdf: '📄', audio: '🎵', site: '🌐', book: '📚' };
        
        list.innerHTML = items.slice(0, 4).map(item => `
            <a href="${item.url}" target="_blank" class="home-library-item">
                <div class="home-library-icon">${typeIcons[item.type] || '📄'}</div>
                <div class="home-library-info">
                    <div class="home-library-title">${item.title}</div>
                </div>
            </a>
        `).join('');
        
        section.style.display = 'block';
    } catch (error) {
        section.style.display = 'none';
    }
}

// ============================================================
// چک پیام جدید از معلم
// ============================================================
async function checkTeacherMessages() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        if (typeof getPersonalMessages !== 'function') return;
        
        const messages = await getPersonalMessages(studentId);
        if (!messages || messages.length === 0) return;
        
        const seenMessages = JSON.parse(localStorage.getItem('seenTeacherMessages') || '[]');
        const newMessages = messages.filter(m => m.sender === 'teacher' && !seenMessages.includes(m.message_id));
        
        if (newMessages.length > 0) {
            const badge = document.getElementById('notif-badge-dot');
            if (badge) badge.classList.add('show');
            showTeacherMessageNotification(newMessages[0]);
        }
        
        localStorage.setItem('seenTeacherMessages', JSON.stringify(messages.map(m => m.message_id)));
    } catch (error) {}
}

function showTeacherMessageNotification(message) {
    const dismissed = JSON.parse(localStorage.getItem('dismissedTeacherMessages') || '[]');
    if (dismissed.includes(message.message_id)) return;
    
    const notif = document.createElement('div');
    notif.className = 'teacher-message-notification';
    notif.innerHTML = `
        <button class="notification-close" onclick="dismissTeacherNotification('${message.message_id}', this)">✕</button>
        <div class="notification-icon">👨‍🏫</div>
        <div class="notification-text">
            <div class="notification-title">پیام از معلم</div>
            <div class="notification-sub">${message.text ? message.text.substring(0, 40) : 'پیام جدید'}</div>
        </div>
        <button class="notification-btn" onclick="goToTeacherMessage()">مشاهده</button>
    `;
    
    const container = document.getElementById('app-container');
    if (container) container.appendChild(notif);
    
    setTimeout(() => notif.classList.add('show'), 100);
}

function dismissTeacherNotification(messageId, btn) {
    const notif = btn.closest('.teacher-message-notification');
    if (notif) {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 300);
    }
    
    const dismissed = JSON.parse(localStorage.getItem('dismissedTeacherMessages') || '[]');
    if (!dismissed.includes(messageId)) {
        dismissed.push(messageId);
        localStorage.setItem('dismissedTeacherMessages', JSON.stringify(dismissed));
    }
}

function goToTeacherMessage() {
    document.querySelectorAll('.teacher-message-notification').forEach(n => n.remove());
    goToScreen('screen-teacher-messages');
}

// ============================================================
// بارگذاری اولیه
// ============================================================
window.addEventListener('load', async () => {
    const isMaintenance = await checkMaintenanceMode();
    if (isMaintenance) {
        window.location.replace('./maintenance.html');
        return;
    }

    loadUserInfo();
    loadTheme();

    if (localStorage.getItem('userRegistered') === 'true' && !localStorage.getItem('studentUUID')) {
        const newUUID = generateUUID();
        localStorage.setItem('studentUUID', newUUID);
    }

    if (localStorage.getItem('soundsEnabled') === 'false') {
        const el = document.getElementById('setting-sounds');
        if (el) el.checked = false;
    }
    if (localStorage.getItem('musicEnabled') === 'false') {
        const el = document.getElementById('setting-music');
        if (el) el.checked = false;
    }
    if (localStorage.getItem('darkMode') === 'true') {
        const settingEl = document.getElementById('setting-dark-mode');
        if (settingEl) settingEl.checked = true;
        document.body.classList.add('dark-mode');
    }

    initNotificationSwipe();

    const cameFromClips = sessionStorage.getItem('cameFromClips') === 'true';
    const isRegistered = localStorage.getItem('userRegistered') === 'true';

    if (cameFromClips || window.location.hash === '#home') {
        sessionStorage.removeItem('cameFromClips');
        history.replaceState({ screen: 'screen-home' }, '', '');
        if (isRegistered) {
            updateStreak();
            goToScreen('screen-home', false);
            setTimeout(() => {
                if (allLessons.length === 0) {
                    loadLessonsListForNotification().then(() => {
                        checkAndShowNotification();
                        checkDeadlineWarning();
                        updateNotificationBadge();
                    });
                } else {
                    checkAndShowNotification();
                    checkDeadlineWarning();
                    updateNotificationBadge();
                }
                checkVideoNotification();
                
                if (typeof checkTeacherMessagesBadge === 'function') {
                    checkTeacherMessagesBadge();
                }
                
                if (typeof startRealtimeSubscriptions === 'function' && 
                    typeof isRealtimeStarted !== 'undefined' && 
                    !isRealtimeStarted) {
                    setTimeout(() => startRealtimeSubscriptions(), 1000);
                }
                
                checkAndShowUpdateModal();
                
                setTimeout(() => {
                    checkAndShowNewMessageNotification();
                }, 3000);
                
                setTimeout(() => showStreakMessage(), 800);
            }, 300);
        } else {
            goToScreen('screen-welcome', false);
        }
    } else {
        pushHistory('screen-splash');
        setTimeout(typeMotivation, 500);
    }

    if (isRegistered) {
        setTimeout(() => autoSyncRanking('ورود به برنامه'), 1500);
    }

    setTimeout(() => {
        if (isRegistered) {
            loadHomeContests();
            loadHomeLibrary();
        }
    }, 3000);
});

// ============================================================
// همگام‌سازی خودکار
// ============================================================
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (localStorage.getItem('userRegistered') === 'true') {
            autoSyncRanking('بازگشت به برنامه');
            
            if (typeof startRealtimeSubscriptions === 'function' && 
                typeof isRealtimeStarted !== 'undefined' && 
                !isRealtimeStarted) {
                setTimeout(() => startRealtimeSubscriptions(), 1000);
            }
            
            setTimeout(() => {
                checkAndShowNewMessageNotification();
            }, 2000);
        }
    }
});