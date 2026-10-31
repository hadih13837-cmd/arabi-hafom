// ============================================================
// navigation.js — ناوبری، منو، مودال‌ها، راهنما، تم
// نسخه: ۱۲.۰.۰ — با قابلیت نمایش اعلان پیام‌ها به محض ورود
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

function openClipsPage() {
    sessionStorage.setItem('cameFromClips', 'true');
    window.location.href = './clips.html';
}

function openJozvePage() {
    sessionStorage.setItem('cameFromClips', 'true');
    window.location.href = './jozve.html';
}

function pushHistory(screenId) {
    history.pushState({ screen: screenId }, '', '');
}

function goBackToHome() {
    goToScreen('screen-home', true);
}

window.addEventListener('popstate', function(event) {
    const storyOverlay = document.getElementById('story-viewer-overlay');
    if (storyOverlay && storyOverlay.classList.contains('active')) {
        const video = document.getElementById('story-viewer-video');
        const progress = document.getElementById('story-viewer-progress-bar');
        if (video) { video.pause(); video.src = ''; }
        if (progress) { progress.style.transition = 'none'; progress.style.width = '0%'; }
        storyOverlay.classList.remove('active');
        if (typeof renderStories === 'function') renderStories();
        return;
    }

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
    
    if (screenId !== 'screen-rankings' && typeof stopAutoRefresh === 'function') {
        stopAutoRefresh();
    }
    
    if (screenId === 'screen-rankings' && typeof startAutoRefresh === 'function') {
        setTimeout(() => {
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen && activeScreen.id === 'screen-rankings') {
                startAutoRefresh();
            }
        }, 500);
    }
    
    document.querySelectorAll('.bottom-nav').forEach(nav => {
        const items = nav.querySelectorAll('.bottom-nav-item');
        if (screenId === 'screen-medals' && items[0]) items[0].classList.add('active');
        if (screenId === 'screen-rankings' && items[1]) items[1].classList.add('active');
        if (screenId === 'screen-home' && items[2]) items[2].classList.add('active');
        if (screenId === 'screen-settings' && items[3]) items[3].classList.add('active');
        if (screenId === 'screen-profile' && items[4]) items[4].classList.add('active');
    });
    
    if (addToHistory) pushHistory(screenId);
    
    try {
        if (typeof bgMusic !== 'undefined' && bgMusic) {
            if (['screen-quiz', 'screen-feedback', 'screen-result'].includes(screenId)) {
                if (!bgMusic.paused) bgMusic.pause();
            } else {
                if (typeof musicStarted !== 'undefined' && musicStarted && 
                    typeof isMuted !== 'undefined' && !isMuted && 
                    localStorage.getItem('musicEnabled') !== 'false') {
                    bgMusic.play().catch(e => console.log(e));
                }
            }
        }
    } catch (e) {
        console.warn('⚠️ خطا در مدیریت موسیقی:', e);
    }
    
    if (screenId === 'screen-lessons') {
        if (typeof loadLessonsList === 'function') loadLessonsList();
        if (typeof showLessonsGuide === 'function') showLessonsGuide();
    }
    if (screenId === 'screen-reports') {
        if (typeof loadReports === 'function') loadReports();
    }
    if (screenId === 'screen-profile') {
        if (typeof loadProfileData === 'function') loadProfileData();
    }
    if (screenId === 'screen-medals') {
        if (typeof loadMedals === 'function') loadMedals();
    }
    if (screenId === 'screen-notifications') {
        if (typeof loadNotifications === 'function') loadNotifications();
    }
    
    if (screenId === 'screen-rankings') {
        if (typeof loadRankingsPage === 'function') loadRankingsPage();
        if (typeof checkAndShowRankingsGuide === 'function') {
            setTimeout(() => checkAndShowRankingsGuide(), 1500);
        }
    }
    
    // صفحه پیام‌های معلم
    if (screenId === 'screen-teacher-messages') {
        if (typeof switchStudentMessagesTab === 'function') {
            switchStudentMessagesTab('class');
        }
        const fab = document.getElementById('home-messages-fab');
        if (fab) fab.style.display = 'none';
    }
    
    if (screenId === 'screen-calendar') {
        calendarCurrentMonth = null;
        if (typeof renderCalendar === 'function') renderCalendar();
    }
    
    // صفحه خانه: مدیریت صحیح اعلان‌ها
    if (screenId === 'screen-home') {
        const fab = document.getElementById('home-messages-fab');
        if (fab) fab.style.display = 'flex';
        
        typeMotivation();
        displayStreak();
        
        if (typeof updateStudentMessageBadges === 'function') {
            updateStudentMessageBadges();
        }
        
        const lastCheck = localStorage.getItem('lastNotificationCheck');
        const now = Date.now();
        const shouldCheck = !lastCheck || (now - parseInt(lastCheck)) > 30000;
        
        if (shouldCheck) {
            localStorage.setItem('lastNotificationCheck', now.toString());
            
            setTimeout(() => {
                if (allLessons.length === 0) {
                    if (typeof loadLessonsListForNotification === 'function') {
                        loadLessonsListForNotification().then(() => {
                            if (typeof checkAndShowNotification === 'function') checkAndShowNotification();
                            if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
                            if (typeof checkDeadlineWarning === 'function') checkDeadlineWarning();
                        });
                    }
                } else {
                    if (typeof checkAndShowNotification === 'function') checkAndShowNotification();
                    if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
                    if (typeof checkDeadlineWarning === 'function') checkDeadlineWarning();
                }
            }, 300);
            
            setTimeout(() => {
                if (typeof checkVideoNotification === 'function') checkVideoNotification();
            }, 600);
            
            // 🆕 چک کردن پیام‌های جدید به محض ورود (بدون شرط isReturningUser)
            setTimeout(async () => {
                if (typeof checkAndShowNewMessageNotification === 'function') {
                    await checkAndShowNewMessageNotification();
                }
            }, 800);
            
            setTimeout(() => {
                if (typeof repositionNotifications === 'function') repositionNotifications();
            }, 1500);
        } else {
            if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
            if (typeof checkNewLessons === 'function') checkNewLessons();
        }
    }
}
function openSideMenu() {
    const overlay = document.getElementById('side-menu-overlay');
    const menu = document.getElementById('side-menu');
    if (overlay) overlay.classList.add('active');
    if (menu) menu.classList.add('active');
}

function closeSideMenu() {
    const overlay = document.getElementById('side-menu-overlay');
    const menu = document.getElementById('side-menu');
    if (overlay) overlay.classList.remove('active');
    if (menu) menu.classList.remove('active');
}

// ============================================================
// راهنمای برنامه (Guide)
// ============================================================
let currentGuideStep = 0;

function startGuide() {
    const welcomeModal = document.getElementById('welcome-graphic-modal');
    if (welcomeModal) welcomeModal.classList.remove('active');
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
    
    if (!overlay || !tooltip) return;
    
    if (currentGuideStep >= GUIDE_STEPS.length) { 
        endGuide(); 
        return; 
    }
    
    const step = GUIDE_STEPS[currentGuideStep];
    const activeScreen = document.querySelector('.screen.active');
    
    if (activeScreen && activeScreen.id !== 'screen-home') {
        goToScreen('screen-home', false);
        setTimeout(() => showGuideStep(), 400);
        return;
    }
    
    overlay.classList.add('active');
    tooltip.style.display = 'block';
    
    if (icon) icon.textContent = step.icon;
    if (title) title.textContent = step.title;
    if (text) text.textContent = step.text;
    if (nextBtn) nextBtn.textContent = (currentGuideStep === GUIDE_STEPS.length - 1) ? 'تمام! 🎉' : 'فهمیدم!';
    
    if (indicator) {
        let indicatorHTML = '';
        for (let i = 0; i < GUIDE_STEPS.length; i++) {
            indicatorHTML += `<div class="guide-step-dot ${i === currentGuideStep ? 'active' : ''}"></div>`;
        }
        indicator.innerHTML = indicatorHTML;
    }
    
    if (step.element) {
        const el = document.getElementById(step.element);
        if (el && highlight) {
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
            if (highlight) highlight.style.display = 'none';
            clearClipPath(overlay);
            positionCenterTooltip();
        }
    } else {
        if (highlight) highlight.style.display = 'none';
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
    if (!overlay) return;
    overlay.style.clipPath = '';
    overlay.style.webkitClipPath = '';
}

function positionCenterTooltip() {
    const tooltip = document.getElementById('guide-tooltip');
    if (!tooltip) return;
    tooltip.style.top = '50%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
}

function positionGuideTooltip(rect) {
    const tooltip = document.getElementById('guide-tooltip');
    if (!tooltip) return;
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
    const highlight = document.getElementById('guide-highlight');
    const tooltip = document.getElementById('guide-tooltip');
    
    if (overlay) {
        overlay.classList.remove('active');
        clearClipPath(overlay);
    }
    if (highlight) highlight.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
    
    localStorage.setItem('guideCompleted', 'true');
    currentGuideStep = 0;
    setTimeout(() => { if (typeof showStreakMessage === 'function') showStreakMessage(); }, 500);
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
    if (typeof vibrate === 'function') vibrate(20);
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
    const modal = document.getElementById('exit-modal');
    if (modal) modal.classList.add('active');
}

function closeExitModal() {
    const modal = document.getElementById('exit-modal');
    if (modal) modal.classList.remove('active');
}

function confirmExit() {
    closeExitModal();
    setTimeout(() => window.history.go(-1), 100);
}

// ============================================================
// مودال تکرار تکلیف
// ============================================================
function closeRepeatModal() {
    const modal = document.getElementById('repeat-modal');
    if (modal) modal.classList.remove('active');
    if (typeof pendingLessonId !== 'undefined') pendingLessonId = null;
}

async function confirmRepeatLesson() {
    const modal = document.getElementById('repeat-modal');
    if (modal) modal.classList.remove('active');
    if (typeof pendingLessonId !== 'undefined' && pendingLessonId) {
        await runLesson(pendingLessonId, true, 0);
        pendingLessonId = null;
    }
}

// ============================================================
// مودال حذف حساب کاربری
// ============================================================
function openDeleteAccountModal() {
    const modal = document.getElementById('delete-account-modal');
    if (modal) modal.classList.add('active');
}

function closeDeleteAccountModal() {
    const modal = document.getElementById('delete-account-modal');
    if (modal) modal.classList.remove('active');
}

function confirmDeleteAccount() {
    localStorage.clear();
    
    if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(reg => reg.unregister());
        });
    }
    
    closeDeleteAccountModal();
    setTimeout(() => location.reload(), 300);
}

// ============================================================
// مودال بازگشت تنظیمات
// ============================================================
function openResetSettingsModal() {
    const modal = document.getElementById('reset-settings-modal');
    if (modal) modal.classList.add('active');
}

function closeResetSettingsModal() {
    const modal = document.getElementById('reset-settings-modal');
    if (modal) modal.classList.remove('active');
}

function confirmResetSettings() {
    localStorage.removeItem('darkMode');
    localStorage.removeItem('soundsEnabled');
    localStorage.removeItem('musicEnabled');
    localStorage.removeItem('theme');
    
    const darkModeEl = document.getElementById('setting-dark-mode');
    const soundsEl = document.getElementById('setting-sounds');
    const musicEl = document.getElementById('setting-music');
    
    if (darkModeEl) darkModeEl.checked = false;
    if (soundsEl) soundsEl.checked = true;
    if (musicEl) musicEl.checked = true;
    
    document.body.classList.remove('dark-mode');
    document.body.removeAttribute('data-theme');
    
    try {
        if (typeof bgMusic !== 'undefined' && bgMusic) {
            bgMusic.volume = 0.9;
            if (typeof isMuted !== 'undefined' && !isMuted) {
                bgMusic.play().catch(e => console.log(e));
            }
        }
    } catch (e) {}
    
    closeResetSettingsModal();
    showModal('موفق', 'تنظیمات به حالت اولیه بازگشت.', '✅');
}

// ============================================================
// مودال ویرایش پروفایل
// ============================================================
function openEditProfile() {
    const nameEl = document.getElementById('edit-name');
    const classEl = document.getElementById('edit-class');
    const schoolEl = document.getElementById('edit-school');
    const yearEl = document.getElementById('edit-year');
    
    if (nameEl) nameEl.value = localStorage.getItem('userName') || '';
    if (classEl) classEl.value = localStorage.getItem('userClass') || 'هفتم یک';
    if (schoolEl) schoolEl.value = localStorage.getItem('userSchool') || '';
    if (yearEl) yearEl.value = '۱۴۰۵-۱۴۰۶';
    
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.add('active');
}

function closeEditProfile() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.remove('active');
}

function saveProfileChanges() {
    const nameEl = document.getElementById('edit-name');
    const classEl = document.getElementById('edit-class');
    const schoolEl = document.getElementById('edit-school');
    
    const newName = nameEl ? nameEl.value.trim() : '';
    const newClass = classEl ? classEl.value : '';
    const newSchool = schoolEl ? schoolEl.value.trim() : '';
    
    if (!newName) {
        showModal('خطا', 'لطفاً نام خود را وارد کنید.', '⚠️');
        return;
    }
    
    localStorage.setItem('userName', newName);
    localStorage.setItem('userClass', newClass);
    localStorage.setItem('userSchool', newSchool || 'تعیین نشده');
    
    if (typeof updateHomeUI === 'function') updateHomeUI();
    if (typeof loadProfileData === 'function') loadProfileData();
    
    closeEditProfile();
    showModal('موفق', 'اطلاعات شما با موفقیت ذخیره شد.', '✅');
    
    setTimeout(() => {
        if (typeof saveRankingToSupabase === 'function') {
            saveRankingToSupabase();
        }
    }, 500);
}