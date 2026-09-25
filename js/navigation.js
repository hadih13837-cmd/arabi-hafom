// ============================================================
// navigation.js — ناوبری، منو، مودال‌ها، راهنما، تم
// ============================================================

// ============================================================
// مودال عمومی
// ============================================================
function showModal(title, text, icon = 'ℹ️') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-text').textContent = text;
    document.getElementById('modal-icon').textContent = icon;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// ============================================================
// رفتن به صفحه کلیپ‌ها (خارج از برنامه)
// ============================================================
function openClipsPage() {
    sessionStorage.setItem('cameFromClips', 'true');
    window.location.href = './clips.html';
}

// ============================================================
// ناوبری بین صفحات
// ============================================================
function pushHistory(screenId) {
    history.pushState({ screen: screenId }, '', '');
}

function goBackToHome() {
    goToScreen('screen-home', false);
    pushHistory('screen-home');
}

window.addEventListener('popstate', function(event) {
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return;
    const activeId = activeScreen.id;
    if (activeId !== 'screen-home' && activeId !== 'screen-splash' && activeId !== 'screen-welcome') {
        goToScreen('screen-home', false);
        pushHistory('screen-home');
    }
});

function goToScreen(screenId, addToHistory = true) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.bottom-nav').forEach(nav => {
        const items = nav.querySelectorAll('.bottom-nav-item');
        if (screenId === 'screen-home' && items[0]) items[0].classList.add('active');
        if (screenId === 'screen-medals' && items[1]) items[1].classList.add('active');
        if (screenId === 'screen-settings' && items[2]) items[2].classList.add('active');
        if (screenId === 'screen-profile' && items[3]) items[3].classList.add('active');
    });
    if (addToHistory) pushHistory(screenId);
    if (['screen-quiz', 'screen-feedback', 'screen-result'].includes(screenId)) {
        if (bgMusic && !bgMusic.paused) bgMusic.pause();
    } else {
        if (musicStarted && !isMuted && localStorage.getItem('musicEnabled') !== 'false') {
            bgMusic.play().catch(e => console.log(e));
        }
    }
    if (screenId === 'screen-lessons') {
        loadLessonsList();
        showLessonsGuide();
    }
    if (screenId === 'screen-reports') loadReports();
    if (screenId === 'screen-profile') loadProfileData();
    if (screenId === 'screen-medals') loadMedals();
    if (screenId === 'screen-notifications') loadNotifications();
    if (screenId === 'screen-calendar') {
        calendarCurrentMonth = null;
        renderCalendar();
    }
    if (screenId === 'screen-home') {
        typeMotivation();
        if (allLessons.length === 0) {
            loadLessonsListForNotification().then(() => {
                checkAndShowNotification();
                updateNotificationBadge();
                checkDeadlineWarning();
            });
        } else {
            checkAndShowNotification();
            updateNotificationBadge();
            checkDeadlineWarning();
        }
        checkVideoNotification();
        displayStreak();
    }
}

// ============================================================
// منوی کناری
// ============================================================
function openSideMenu() {
    document.getElementById('side-menu-overlay').classList.add('active');
    document.getElementById('side-menu').classList.add('active');
}

function closeSideMenu() {
    document.getElementById('side-menu-overlay').classList.remove('active');
    document.getElementById('side-menu').classList.remove('active');
}

// ============================================================
// راهنمای برنامه (Guide)
// ============================================================
let currentGuideStep = 0;

function startGuide() {
    document.getElementById('welcome-graphic-modal').classList.remove('active');
    localStorage.setItem('welcomeShown', 'true');
    setTimeout(() => { currentGuideStep = 0; showGuideStep(); }, 400);
}

function showGuideStep() {
    const overlay = document.getElementById('guide-overlay');
    const tooltip = document.getElementById('guide-tooltip');
    const highlight = document.getElementById('guide-highlight');
    const icon = document.getElementById('guide-icon');
    const title = document.getElementById('guide-title');
    const text = document.getElementById('guide-text');
    const indicator = document.getElementById('guide-indicator');
    const nextBtn = document.getElementById('guide-next-btn');
    if (currentGuideStep >= GUIDE_STEPS.length) { endGuide(); return; }
    const step = GUIDE_STEPS[currentGuideStep];
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id !== 'screen-home') {
        goToScreen('screen-home', false);
        setTimeout(() => showGuideStep(), 400);
        return;
    }
    overlay.classList.add('active');
    tooltip.style.display = 'block';
    icon.textContent = step.icon;
    title.textContent = step.title;
    text.textContent = step.text;
    nextBtn.textContent = (currentGuideStep === GUIDE_STEPS.length - 1) ? 'تمام! 🎉' : 'فهمیدم!';
    let indicatorHTML = '';
    for (let i = 0; i < GUIDE_STEPS.length; i++) {
        indicatorHTML += `<div class="guide-step-dot ${i === currentGuideStep ? 'active' : ''}"></div>`;
    }
    indicator.innerHTML = indicatorHTML;
    if (step.element) {
        const el = document.getElementById(step.element);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                const rect = el.getBoundingClientRect();
                const padding = 8;
                const holeLeft = rect.left - padding;
                const holeTop = rect.top - padding;
                const holeRight = rect.right + padding;
                const holeBottom = rect.bottom + padding;
                highlight.style.display = 'block';
                highlight.style.top = holeTop + 'px';
                highlight.style.left = holeLeft + 'px';
                highlight.style.width = (rect.width + padding * 2) + 'px';
                highlight.style.height = (rect.height + padding * 2) + 'px';
                applyClipPathHole(overlay, holeLeft, holeTop, holeRight, holeBottom, 20);
                positionGuideTooltip(rect);
            }, 400);
        } else {
            highlight.style.display = 'none';
            clearClipPath(overlay);
            positionCenterTooltip();
        }
    } else {
        highlight.style.display = 'none';
        clearClipPath(overlay);
        positionCenterTooltip();
    }
}

function applyClipPathHole(overlay, left, top, right, bottom, radius) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const outerPath = `M 0 0 L ${vw} 0 L ${vw} ${vh} L 0 ${vh} Z`;
    const r = Math.min(radius, (right - left) / 2, (bottom - top) / 2);
    const innerPath = `M ${left + r} ${top} L ${right - r} ${top} Q ${right} ${top} ${right} ${top + r} L ${right} ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} L ${left + r} ${bottom} Q ${left} ${bottom} ${left} ${bottom - r} L ${left} ${top + r} Q ${left} ${top} ${left + r} ${top} Z`;
    overlay.style.clipPath = `path(evenodd, "${outerPath} ${innerPath}")`;
    overlay.style.webkitClipPath = `path(evenodd, "${outerPath} ${innerPath}")`;
}

function clearClipPath(overlay) {
    overlay.style.clipPath = '';
    overlay.style.webkitClipPath = '';
}

function positionCenterTooltip() {
    const tooltip = document.getElementById('guide-tooltip');
    tooltip.style.top = '50%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
}

function positionGuideTooltip(rect) {
    const tooltip = document.getElementById('guide-tooltip');
    tooltip.style.transform = 'none';
    const tooltipWidth = Math.min(320, window.innerWidth - 40);
    const tooltipHeight = 240;
    const padding = 16;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    let top, left;
    if (rect.bottom + tooltipHeight + padding < viewportH) top = rect.bottom + padding;
    else if (rect.top - tooltipHeight - padding > 0) top = rect.top - tooltipHeight - padding;
    else top = viewportH / 2 - tooltipHeight / 2;
    left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (left < 15) left = 15;
    if (left + tooltipWidth > viewportW - 15) left = viewportW - tooltipWidth - 15;
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
}

function nextGuideStep() {
    currentGuideStep++;
    if (currentGuideStep >= GUIDE_STEPS.length) endGuide();
    else showGuideStep();
}

function skipGuide() {
    endGuide();
}

function endGuide() {
    const overlay = document.getElementById('guide-overlay');
    overlay.classList.remove('active');
    clearClipPath(overlay);
    document.getElementById('guide-highlight').style.display = 'none';
    document.getElementById('guide-tooltip').style.display = 'none';
    localStorage.setItem('guideCompleted', 'true');
    currentGuideStep = 0;
    setTimeout(() => { showStreakMessage(); }, 500);
}

function restartGuide() {
    currentGuideStep = 0;
    goToScreen('screen-home');
    setTimeout(() => showGuideStep(), 400);
}

function showLessonsGuide() {
    const lessonsGuideShown = localStorage.getItem('lessonsGuideShown');
    if (lessonsGuideShown === 'true') return;
    setTimeout(() => {
        showModal('📚 راهنمای تکالیف',
            'اینجا معلمت تکالیف رو قرار می‌ده.\n\n' +
            '✅ با انجام هر تکلیف، نمره و امتیاز می‌گیری\n' +
            '📊 کارنامه‌ات صادر می‌شه و می‌تونی دانلودش کنی\n' +
            '📤 بعد از انجام، باید نتیجه رو برای معلمت ارسال کنی\n' +
            '🔥 هر روز که وارد برنامه بشی، امتیاز استریک می‌گیری\n' +
            '🏆 با کسب امتیاز، مدال‌های مختلف می‌گیری\n\n' +
            'موفق باشی! 🌟', '📚');
        localStorage.setItem('lessonsGuideShown', 'true');
    }, 800);
}

// ============================================================
// تغییر تم رنگی
// ============================================================
function changeTheme(theme, element) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
    if (element) element.classList.add('active');
    vibrate(20);
}

function loadTheme() {
    const theme = localStorage.getItem('theme') || 'blue';
    if (theme !== 'blue') document.body.setAttribute('data-theme', theme);
    setTimeout(() => {
        document.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === theme);
        });
    }, 100);
}

// ============================================================
// خروج از برنامه
// ============================================================
function openExitModal() {
    document.getElementById('exit-modal').classList.add('active');
}

function closeExitModal() {
    document.getElementById('exit-modal').classList.remove('active');
}

function confirmExit() {
    closeExitModal();
    setTimeout(() => window.history.go(-1), 100);
}

// ============================================================
// مودال تکرار تکلیف
// ============================================================
function closeRepeatModal() {
    document.getElementById('repeat-modal').classList.remove('active');
    pendingLessonId = null;
}

async function confirmRepeatLesson() {
    document.getElementById('repeat-modal').classList.remove('active');
    if (pendingLessonId) {
        await runLesson(pendingLessonId, true, 0);
        pendingLessonId = null;
    }
}

// ============================================================
// مودال حذف حساب کاربری
// ============================================================
function openDeleteAccountModal() {
    document.getElementById('delete-account-modal').classList.add('active');
}

function closeDeleteAccountModal() {
    document.getElementById('delete-account-modal').classList.remove('active');
}

function confirmDeleteAccount() {
    localStorage.clear();
    caches.keys().then(names => names.forEach(name => caches.delete(name)));
    closeDeleteAccountModal();
    setTimeout(() => location.reload(), 300);
}

// ============================================================
// مودال بازگشت تنظیمات به حالت اول
// ============================================================
function openResetSettingsModal() {
    document.getElementById('reset-settings-modal').classList.add('active');
}

function closeResetSettingsModal() {
    document.getElementById('reset-settings-modal').classList.remove('active');
}

function confirmResetSettings() {
    localStorage.removeItem('darkMode');
    localStorage.removeItem('soundsEnabled');
    localStorage.removeItem('musicEnabled');
    localStorage.removeItem('theme');
    document.getElementById('setting-dark-mode').checked = false;
    document.getElementById('setting-sounds').checked = true;
    document.getElementById('setting-music').checked = true;
    document.body.classList.remove('dark-mode');
    document.body.removeAttribute('data-theme');
    bgMusic.volume = 0.9;
    if (!isMuted) bgMusic.play().catch(e => console.log(e));
    closeResetSettingsModal();
    showModal('موفق', 'تنظیمات به حالت اولیه بازگشت.', '✅');
}

// ============================================================
// مودال ویرایش پروفایل
// ============================================================
function openEditProfile() {
    document.getElementById('edit-name').value = localStorage.getItem('userName') || '';
    document.getElementById('edit-class').value = localStorage.getItem('userClass') || 'هفتم یک';
    document.getElementById('edit-school').value = localStorage.getItem('userSchool') || '';
    document.getElementById('edit-year').value = '۱۴۰۵-۱۴۰۶';
    document.getElementById('edit-profile-modal').classList.add('active');
}

function closeEditProfile() {
    document.getElementById('edit-profile-modal').classList.remove('active');
}

function saveProfileChanges() {
    const newName = document.getElementById('edit-name').value.trim();
    const newClass = document.getElementById('edit-class').value;
    const newSchool = document.getElementById('edit-school').value.trim();
    if (!newName) {
        showModal('خطا', 'لطفاً نام خود را وارد کنید.', '⚠️');
        return;
    }
    localStorage.setItem('userName', newName);
    localStorage.setItem('userClass', newClass);
    localStorage.setItem('userSchool', newSchool || 'تعیین نشده');
    updateHomeUI();
    loadProfileData();
    closeEditProfile();
    showModal('موفق', 'اطلاعات شما با موفقیت ذخیره شد.', '✅');
}

// ============================================================
// تغییر آواتار
// ============================================================
function changeAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const avatarData = e.target.result;
        localStorage.setItem('userAvatar', avatarData);
        document.getElementById('profile-avatar-img').src = avatarData;
        document.getElementById('home-avatar-img').src = avatarData;
        showModal('موفق', 'عکس پروفایل با موفقیت تغییر کرد.', '✅');
    };
    reader.readAsDataURL(file);
}