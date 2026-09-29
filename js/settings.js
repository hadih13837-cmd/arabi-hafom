// ============================================================
// settings.js — تنظیمات، پروفایل، موسیقی، صداها، UUID، بروزرسانی
// ============================================================

// ============================================================
// اطلاعات کاربر (Welcome) — با UUID
// ============================================================
function saveUserInfo() {
    const name = document.getElementById('welcome-name').value.trim();
    const cls = document.getElementById('welcome-class').value;
    const school = document.getElementById('welcome-school').value.trim();
    if (!name) { showModal('خطا', 'لطفاً نام خود را وارد کنید.', '⚠️'); return; }
    if (!cls) { showModal('خطا', 'لطفاً کلاس خود را انتخاب کنید.', '⚠️'); return; }
    
    localStorage.setItem('userName', name);
    localStorage.setItem('userClass', cls);
    localStorage.setItem('userSchool', school || 'تعیین نشده');
    localStorage.setItem('userYear', '۱۴۰۵-۱۴۰۶');
    localStorage.setItem('userRegistered', 'true');
    
    // ساخت UUID یکتا برای این کاربر
    getOrCreateStudentUUID();
    
    updateStreak();
    updateHomeUI();
    document.getElementById('welcome-user-name').textContent = name;
    setTimeout(() => {
        document.getElementById('welcome-graphic-modal').classList.add('active');
    }, 400);
    
    // بعد از ثبت‌نام، امتیاز اولیه ثبت کن
    setTimeout(() => {
        saveRankingToSupabase();
    }, 2000);
}

function updateHomeUI() {
    const name = localStorage.getItem('userName');
    if (name) {
        const homeNameEl = document.getElementById('home-student-name');
        if (homeNameEl) homeNameEl.textContent = `سلام، ${name} جان`;
    }
}

function loadUserInfo() {
    const name = localStorage.getItem('userName');
    if (name) {
        updateHomeUI();
        // اعمال آواتار (عکس یا ایموجی)
        if (typeof applyAvatarToElements === 'function') {
            applyAvatarToElements();
        }
    }
}

// ============================================================
// پروفایل
// ============================================================
function loadProfileData() {
    const name = localStorage.getItem('userName') || 'دانش‌آموز';
    const cls = localStorage.getItem('userClass') || 'هفتم';
    const school = localStorage.getItem('userSchool') || 'تعیین نشده';
    const year = localStorage.getItem('userYear') || '۱۴۰۵-۱۴۰۶';
    
    document.getElementById('profile-name-display').textContent = name;
    document.getElementById('profile-grade-display').textContent = `پایه ${cls}`;
    document.getElementById('profile-fullname').textContent = name;
    document.getElementById('profile-class').textContent = cls;
    document.getElementById('profile-school').textContent = school;
    document.getElementById('profile-year').textContent = year;
    
    // اعمال آواتار (عکس یا ایموجی)
    if (typeof applyAvatarToElements === 'function') {
        applyAvatarToElements();
    }
    
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const totalPoints = reports.reduce((sum, r) => sum + (r.score || 0), 0);
    const completedLessons = reports.length;
    const avgPercent = reports.length > 0
        ? Math.round(reports.reduce((sum, r) => sum + (r.percent || 0), 0) / reports.length)
        : 0;
    const stats = getUserStats();
    document.getElementById('stat-points').textContent = toPersianNum(totalPoints);
    document.getElementById('stat-medals').textContent = toPersianNum(stats.unlockedMedals.length);
    document.getElementById('stat-completed').textContent = toPersianNum(completedLessons);
    document.getElementById('stat-percent').textContent = toPersianNum(avgPercent) + '%';
}

// ============================================================
// تنظیمات: حالت شب
// ============================================================
function toggleDarkMode(el) {
    if (el.checked) {
        localStorage.setItem('darkMode', 'true');
        document.body.classList.add('dark-mode');
    } else {
        localStorage.setItem('darkMode', 'false');
        document.body.classList.remove('dark-mode');
    }
}

// ============================================================
// تنظیمات: موسیقی
// ============================================================
function toggleMusicSetting(el) {
    if (el.checked) {
        localStorage.setItem('musicEnabled', 'true');
        bgMusic.volume = 0.9;
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && !['screen-quiz', 'screen-feedback', 'screen-result'].includes(activeScreen.id)) {
            bgMusic.play().catch(e => console.log(e));
        }
    } else {
        localStorage.setItem('musicEnabled', 'false');
        bgMusic.pause();
    }
}

// ============================================================
// تنظیمات: صداها
// ============================================================
function toggleSoundsSetting(el) {
    localStorage.setItem('soundsEnabled', el.checked ? 'true' : 'false');
}

// ============================================================
// موسیقی پس‌زمینه
// ============================================================
const bgMusic = document.getElementById('bg-music');
let musicStarted = false;
let isMuted = false;

function startMusic() {
    if (musicStarted && !isMuted) return;
    if (localStorage.getItem('musicEnabled') === 'false') return;
    bgMusic.volume = 0.9;
    bgMusic.play().then(() => { musicStarted = true; }).catch(e => console.log(e));
}

document.addEventListener('click', () => { if (!isMuted) startMusic(); }, { once: true });
document.addEventListener('touchstart', () => { if (!isMuted) startMusic(); }, { once: true });

// ============================================================
// AudioContext برای صداهای پاسخ
// ============================================================
let audioContext = null;

function initAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
}

function playCorrectSound() {
    if (localStorage.getItem('soundsEnabled') === 'false') return;
    try {
        initAudio();
        const now = audioContext.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    } catch(e) {}
}

function playWrongSound() {
    if (localStorage.getItem('soundsEnabled') === 'false') return;
    try {
        initAudio();
        const now = audioContext.currentTime;
        [400, 300, 200].forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.25);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.25);
        });
    } catch(e) {}
}

// ============================================================
// جملات انگیزشی (تایپ تدریجی)
// ============================================================
let motivationTimer = null;

function typeMotivation() {
    const el = document.getElementById('home-motivation-text');
    if (!el) return;
    if (motivationTimer) clearTimeout(motivationTimer);
    const text = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
    let index = 0;
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    el.appendChild(cursor);
    function type() {
        if (index < text.length) {
            cursor.before(document.createTextNode(text[index]));
            index++;
            motivationTimer = setTimeout(type, 35);
        } else {
            motivationTimer = setTimeout(() => { if (cursor.parentNode) cursor.remove(); }, 2000);
        }
    }
    type();
}

// ============================================================
// 🆕 بروزرسانی اطلاعات (با حفظ اطلاعات کاربر + بدون خطا)
// ============================================================
function openUpdateDataModal() {
    document.getElementById('update-data-modal').classList.add('active');
}

function closeUpdateDataModal() {
    document.getElementById('update-data-modal').classList.remove('active');
}

async function confirmUpdateData() {
    closeUpdateDataModal();

    // نمایش پیام لودینگ
    showModal('⏳ در حال بروزرسانی...', 'لطفاً چند لحظه صبر کنید.\nاطلاعات شما حفظ می‌شود.', '🔄');

    try {
        // ۱. ذخیره‌ی همه‌ی اطلاعات مهم کاربر (حتی استریک و موارد دیده‌شده)
        const userData = {
            // اطلاعات کاربری
            userName: localStorage.getItem('userName'),
            userClass: localStorage.getItem('userClass'),
            userSchool: localStorage.getItem('userSchool'),
            userYear: localStorage.getItem('userYear'),
            userRegistered: localStorage.getItem('userRegistered'),
            userAvatar: localStorage.getItem('userAvatar'),
            userAvatarEmoji: localStorage.getItem('userAvatarEmoji'),
            studentUUID: localStorage.getItem('studentUUID'),

            // دستاوردها
            reports: localStorage.getItem('reports'),
            streakData: localStorage.getItem('streakData'),
            unlockedMedals: localStorage.getItem('unlockedMedals'),

            // تنظیمات
            theme: localStorage.getItem('theme'),
            darkMode: localStorage.getItem('darkMode'),
            soundsEnabled: localStorage.getItem('soundsEnabled'),
            musicEnabled: localStorage.getItem('musicEnabled'),

            // 🆕 موارد مربوط به اعلان‌ها و استریک (نگه داشته می‌شن تا دوباره نیاد)
            welcomeShown: localStorage.getItem('welcomeShown'),
            guideCompleted: localStorage.getItem('guideCompleted'),
            lessonsGuideShown: localStorage.getItem('lessonsGuideShown'),
            installBannerDismissed: localStorage.getItem('installBannerDismissed'),
            lastStreakMessageShown: localStorage.getItem('lastStreakMessageShown'),
            seenVideos: localStorage.getItem('seenVideos'),
            seenLessons: localStorage.getItem('seenLessons'),
            seenLessonsForNotif: localStorage.getItem('seenLessonsForNotif'),
            lastDeadlineNotifDate: localStorage.getItem('lastDeadlineNotifDate')
        };

        // ۲. پاک کردن کل localStorage
        localStorage.clear();

        // ۳. برگرداندن اطلاعات کاربر
        Object.keys(userData).forEach(key => {
            if (userData[key] !== null && userData[key] !== undefined) {
                localStorage.setItem(key, userData[key]);
            }
        });

        // ۴. پاک کردن کش‌های Service Worker
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(name => {
                        console.log('🗑️ حذف کش:', name);
                        return caches.delete(name);
                    })
                );
            } catch (cacheError) {
                console.warn('⚠️ خطا در پاک کردن کش:', cacheError);
                // ادامه می‌دیم، مهم نیست
            }
        }

        // ۵. Unregister کردن Service Worker قدیمی
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                    console.log('🗑️ Service Worker حذف شد');
                }
            } catch (swError) {
                console.warn('⚠️ خطا در حذف Service Worker:', swError);
                // ادامه می‌دیم، مهم نیست
            }
        }

        // ۶. پیام موفقیت
        showModal('✅ بروزرسانی موفق', 'اطلاعات شما با موفقیت حفظ شد.\nبرنامه در حال بارگذاری مجدد...', '✅');

        // ۷. بارگذاری مجدد صفحه بعد از ۱.۵ ثانیه
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('updated', Date.now());
            window.location.href = url.toString();
        }, 1500);

    } catch (error) {
        console.error('❌ خطا در بروزرسانی:', error);
        // 🆕 حتی اگه خطا داد، بازم رفرش کن (چون اطلاعات حفظ شدن)
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('updated', Date.now());
            window.location.href = url.toString();
        }, 1000);
    }
}

// ============================================================
// تغییر آواتار (عکس)
// ============================================================
function changeAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    // محدودیت حجم: ۵۰۰ کیلوبایت
    if (file.size > 500 * 1024) {
        showModal('خطا', 'حجم عکس باید کمتر از ۵۰۰ کیلوبایت باشد.', '⚠️');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const avatarData = e.target.result;
        localStorage.setItem('userAvatar', avatarData);
        // حذف ایموجی قبلی
        localStorage.removeItem('userAvatarEmoji');

        // اعمال
        if (typeof applyAvatarToElements === 'function') {
            applyAvatarToElements();
        }

        showModal('موفق', 'عکس پروفایل با موفقیت تغییر کرد.', '✅');

        // آپدیت رتبه‌بندی
        if (typeof saveRankingToSupabase === 'function') {
            saveRankingToSupabase();
        }
    };
    reader.readAsDataURL(file);
}