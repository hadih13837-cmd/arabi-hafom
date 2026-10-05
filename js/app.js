// ============================================================
// app.js — نقطه شروع برنامه (باید آخرین فایل لود بشه)
// نسخه: ۴.۰.۰ — با Badge polling و auto-sync
// ============================================================

// ============================================================
// متغیر سراسری برای حالت انتشار
// ============================================================
let isPublished = true;

// ============================================================
// 🆕 تابع مرکزی برای همگام‌سازی خودکار
// ============================================================
function autoSyncRanking(reason = 'unknown') {
    if (localStorage.getItem('userRegistered') !== 'true') return;
    if (typeof saveRankingToSupabase !== 'function') return;
    
    console.log(`🔄 همگام‌سازی خودکار (دلیل: ${reason})`);
    
    setTimeout(async () => {
        try {
            const success = await saveRankingToSupabase();
            if (success) console.log(`✅ همگام‌سازی موفق (${reason})`);
        } catch (e) {
            console.error(`❌ خطا در همگام‌سازی (${reason}):`, e);
        }
    }, 500);
}

// ============================================================
// بررسی حالت بروزرسانی و وضعیت انتشار
// ============================================================
async function checkMaintenanceMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('admin') === ADMIN_CODE;
    
    if (isAdmin) console.log('👑 حالت ادمین فعال - ورود به برنامه');
    
    try {
        const response = await fetch('./maintenance.json?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) return false;
        const data = await response.json();
        
        isPublished = (data.published !== false);
        console.log('📢 وضعیت انتشار:', isPublished ? 'منتشر شده ✅' : 'منتشر نشده 🔒');
        
        if (isAdmin) return false;
        return data.maintenance === true;
    } catch(e) {
        console.error('خطا در خواندن maintenance.json:', e);
        return false;
    }
}

// ============================================================
// شروع برنامه (StartApp)
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
            
            // 🆕 شروع Badge polling
            if (typeof startBadgePolling === 'function') {
                startBadgePolling();
            }
            
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
// 🆕 ساخت UUID برای کاربر
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
// PWA — نصب اپلیکیشن + آپدیت خودکار
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('✅ Service Worker ثبت شد');

            setInterval(() => {
                registration.update();
            }, 30000);

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('🔄 نسخه‌ی جدید پیدا شد');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('✅ نسخه‌ی جدید آماده - در حال بارگذاری...');
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                        showUpdateNotification();
                    }
                });
            });

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    console.log('🔄 بارگذاری مجدد برای اعمال تغییرات...');
                    window.location.reload();
                }
            });

        } catch (e) {
            console.log('⚠️ خطا در ثبت Service Worker:', e);
        }
    });
}

// 🆕 نمایش پیام «نسخه‌ی جدید در حال بارگذاری»
function showUpdateNotification() {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #4caf50, #2e7d32);
        color: #fff;
        padding: 12px 20px;
        border-radius: 50px;
        font-family: 'Vazirmatn', sans-serif;
        font-size: 13px;
        font-weight: 900;
        z-index: 999999;
        box-shadow: 0 8px 25px rgba(76, 175, 80, 0.5);
        animation: slideDownUpdate 0.5s ease;
        display: flex;
        align-items: center;
        gap: 8px;
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
// PWA — نصب بنر
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
// 🆕 بارگذاری مسابقات فعال در صفحه خانه
// ============================================================
async function loadHomeContests() {
    const section = document.getElementById('home-contests-section');
    const list = document.getElementById('home-contests-list');
    
    if (!section || !list) return;
    
    try {
        if (typeof TEACHER_API_URL === 'undefined') return;
        
        const response = await fetch(TEACHER_API_URL + '?action=getContests&t=' + Date.now(), {
            cache: 'no-store'
        });
        const result = await response.json();
        
        if (!result.success || !result.data || result.data.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        const today = getPersianDate();
        const activeContests = result.data.filter(c => {
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
        console.warn('خطا در مسابقات:', error);
        section.style.display = 'none';
    }
}

// ============================================================
// 🆕 بارگذاری کتابخانه در صفحه خانه
// ============================================================
async function loadHomeLibrary() {
    const section = document.getElementById('home-library-section');
    const list = document.getElementById('home-library-list');
    
    if (!section || !list) return;
    
    try {
        if (typeof TEACHER_API_URL === 'undefined') return;
        
        const response = await fetch(TEACHER_API_URL + '?action=getLibrary&t=' + Date.now(), {
            cache: 'no-store'
        });
        const result = await response.json();
        
        if (!result.success || !result.data || result.data.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        const typeIcons = { video: '🎬', pdf: '📄', audio: '🎵', site: '🌐', book: '📚' };
        
        list.innerHTML = result.data.slice(0, 4).map(item => `
            <a href="${item.url}" target="_blank" class="home-library-item">
                <div class="home-library-icon">${typeIcons[item.type] || '📄'}</div>
                <div class="home-library-info">
                    <div class="home-library-title">${item.title}</div>
                </div>
            </a>
        `).join('');
        
        section.style.display = 'block';
        
    } catch (error) {
        console.warn('خطا در کتابخانه:', error);
        section.style.display = 'none';
    }
}

// ============================================================
// 🆕 چک کردن پیام جدید از معلم
// ============================================================
async function checkTeacherMessages() {
    try {
        const userClass = localStorage.getItem('userClass') || 'هفتم یک';
        const studentId = localStorage.getItem('studentUUID');
        const classSlug = typeof classNameToSlug === 'function' ? classNameToSlug(userClass) : userClass;
        
        if (typeof TEACHER_API_URL === 'undefined') return;
        
        const response = await fetch(TEACHER_API_URL + '?action=getMessages&t=' + Date.now(), {
            cache: 'no-store'
        });
        const result = await response.json();
        
        if (!result.success || !result.data) return;
        
        const myMessages = result.data.filter(msg => {
            if (msg.target_type === 'all') return true;
            if (msg.target_type === 'class' && msg.target_value === classSlug) return true;
            if (msg.target_type === 'student' && msg.target_value === studentId) return true;
            return false;
        });
        
        const seenMessages = JSON.parse(localStorage.getItem('seenTeacherMessages') || '[]');
        const newMessages = myMessages.filter(m => !seenMessages.includes(m.message_id));
        
        if (newMessages.length > 0) {
            console.log('📬 پیام جدید از معلم:', newMessages.length);
            
            const badge = document.getElementById('notif-badge-dot');
            if (badge) badge.classList.add('show');
            
            showTeacherMessageNotification(newMessages[0]);
        }
        
        const allIds = myMessages.map(m => m.message_id);
        localStorage.setItem('seenTeacherMessages', JSON.stringify(allIds));
        
    } catch (error) {
        console.warn('خطا در چک پیام‌های معلم:', error);
    }
}

// ============================================================
// 🆕 نمایش اعلان پیام معلم
// ============================================================
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
            <div class="notification-sub">${message.title}</div>
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
// بارگذاری اولیه (Window Load)
// ============================================================
window.addEventListener('load', async () => {
    // ۱. بررسی حالت بروزرسانی
    const isMaintenance = await checkMaintenanceMode();
    if (isMaintenance) {
        window.location.replace('./maintenance.html');
        return;
    }

    // ۲. بارگذاری اطلاعات و تنظیمات
    loadUserInfo();
    loadTheme();

    // ۳. اگه کاربر ثبت‌نام کرده ولی UUID نداره، بسازش
    if (localStorage.getItem('userRegistered') === 'true' && !localStorage.getItem('studentUUID')) {
        console.log('🆕 کاربر قدیمی - ساخت UUID...');
        const newUUID = generateUUID();
        localStorage.setItem('studentUUID', newUUID);
        console.log('✅ UUID ساخته شد:', newUUID);
    }

    // ۴. همگام‌سازی خودکار بعد از ورود به برنامه
    if (localStorage.getItem('userRegistered') === 'true') {
        autoSyncRanking('ورود به برنامه');
    }

    if (localStorage.getItem('soundsEnabled') === 'false') {
        document.getElementById('setting-sounds').checked = false;
    }
    if (localStorage.getItem('musicEnabled') === 'false') {
        document.getElementById('setting-music').checked = false;
    }
    if (localStorage.getItem('darkMode') === 'true') {
        const settingEl = document.getElementById('setting-dark-mode');
        if (settingEl) settingEl.checked = true;
        document.body.classList.add('dark-mode');
    }

    // ۵. فعال‌سازی swipe روی اعلان‌ها
    initNotificationSwipe();

    // ۶. تصمیم‌گیری درباره صفحه اولیه
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
                
                // 🆕 شروع Badge polling
                if (typeof startBadgePolling === 'function') {
                    startBadgePolling();
                }
                
                setTimeout(() => showStreakMessage(), 800);
            }, 300);
        } else {
            goToScreen('screen-welcome', false);
        }
    } else {
        pushHistory('screen-splash');
        setTimeout(typeMotivation, 500);
    }

    // ۷. 🆕 شروع Badge polling (برای کاربران ثبت‌نام‌شده)
    if (isRegistered) {
        setTimeout(() => {
            if (typeof startBadgePolling === 'function') {
                startBadgePolling();
                console.log('✅ Badge polling شروع شد');
            }
        }, 2000);
    }

    // ۸. بارگذاری مسابقات و کتابخانه
    setTimeout(() => {
        if (localStorage.getItem('userRegistered') === 'true') {
            loadHomeContests();
            loadHomeLibrary();
        }
    }, 3000);
});

// ============================================================
// 🆕 همگام‌سازی خودکار وقتی کاربر برگشت به برنامه
// ============================================================
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (localStorage.getItem('userRegistered') === 'true') {
            autoSyncRanking('بازگشت به برنامه');
            
            // 🆕 یک بار Badge رو آپدیت کن
            if (typeof fetchAndUpdateBadge === 'function') {
                fetchAndUpdateBadge();
            }
        }
    }
});