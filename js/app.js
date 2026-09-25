// ============================================================
// app.js — نقطه شروع برنامه (باید آخرین فایل لود بشه)
// ============================================================

// ============================================================
// متغیر سراسری برای حالت انتشار
// ============================================================
let isPublished = true; // پیش‌فرض true (اگه published توی JSON نبود)

// ============================================================
// بررسی حالت بروزرسانی و وضعیت انتشار
// ============================================================
async function checkMaintenanceMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('admin') === ADMIN_CODE;
    
    if (isAdmin) {
        console.log('👑 حالت ادمین فعال - ورود به برنامه');
    }
    
    try {
        const response = await fetch('./maintenance.json?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) return false;
        const data = await response.json();
        
        // 🆕 ذخیره وضعیت انتشار در متغیر سراسری
        // اگه published توی JSON نبود، پیش‌فرض true
        isPublished = (data.published !== false);
        
        console.log('📢 وضعیت انتشار:', isPublished ? 'منتشر شده ✅' : 'منتشر نشده 🔒');
        
        // اگه ادمین بود، هیچ‌وقت به maintenance.html نره
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
// PWA — نصب اپلیکیشن
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(e => console.log(e));
    });
}

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
// بارگذاری اولیه (Window Load)
// ============================================================
window.addEventListener('load', async () => {
    // ۱. بررسی حالت بروزرسانی (و ذخیره وضعیت انتشار)
    const isMaintenance = await checkMaintenanceMode();
    if (isMaintenance) {
        window.location.replace('./maintenance.html');
        return;
    }

    // ۲. بارگذاری اطلاعات و تنظیمات
    loadUserInfo();
    loadTheme();

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

    // ۳. فعال‌سازی swipe روی اعلان‌ها
    initNotificationSwipe();

    // ۴. تصمیم‌گیری درباره صفحه اولیه
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
                setTimeout(() => showStreakMessage(), 800);
            }, 300);
        } else {
            goToScreen('screen-welcome', false);
        }
    } else {
        pushHistory('screen-splash');
        setTimeout(typeMotivation, 500);
    }
});