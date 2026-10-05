// ============================================================
// settings.js — تنظیمات، پروفایل، موسیقی، صداها، UUID، بروزرسانی
// نسخه: ۸.۰.۰ — حفظ کامل داده‌ها در بروزرسانی
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
    
    getOrCreateStudentUUID();
    
    updateStreak();
    updateHomeUI();
    document.getElementById('welcome-user-name').textContent = name;
    setTimeout(() => {
        document.getElementById('welcome-graphic-modal').classList.add('active');
    }, 400);
    
    if (typeof autoSyncRanking === 'function') {
        autoSyncRanking('ثبت‌نام جدید');
    } else if (typeof saveRankingToSupabase === 'function') {
        setTimeout(() => saveRankingToSupabase(), 1500);
    }
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
// 🆕 بروزرسانی اطلاعات — نسخه نهایی (حفظ کامل داده‌ها)
// ============================================================
function openUpdateDataModal() {
    document.getElementById('update-data-modal').classList.add('active');
}

function closeUpdateDataModal() {
    document.getElementById('update-data-modal').classList.remove('active');
}

async function confirmUpdateData() {
    closeUpdateDataModal();
    showModal('⏳ در حال بروزرسانی...', 'لطفاً چند لحظه صبر کنید.\nاطلاعات شما حفظ می‌شود.', '🔄');

    try {
        // ═══════════════════════════════════════════════════════════
        // ۱. ذخیره‌ی همه‌ی داده‌های مهم در یک آبجکت
        // ═══════════════════════════════════════════════════════════
        const savedData = {};
        const savedKeys = [];
        
        // ذخیره‌ی همه‌ی کلیدهای موجود (به‌جز کلیدهای موقت)
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            
            // کلیدهای موقت که نیازی به حفظ ندارن
            const tempKeys = [
                'temp_data',
                'cache_temp',
                'lastUpdateCheck'
            ];
            
            if (tempKeys.includes(key)) continue;
            
            savedData[key] = localStorage.getItem(key);
            savedKeys.push(key);
        }
        
        console.log('💾 ذخیره‌شده:', savedKeys.length, 'کلید');
        console.log('📋 کلیدها:', savedKeys);

        // ═══════════════════════════════════════════════════════════
        // ۲. پاک کردن Cache Storage (فقط فایل‌های PWA)
        // ═══════════════════════════════════════════════════════════
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('🗑️ Cache Storage پاک شد');
            } catch (cacheError) {
                console.warn('⚠️ خطا در پاک کردن Cache Storage:', cacheError);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // ۳. Unregister کردن Service Worker (برای دریافت نسخه جدید)
        // ═══════════════════════════════════════════════════════════
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
                console.log('🗑️ Service Worker حذف شد');
            } catch (swError) {
                console.warn('⚠️ خطا در حذف Service Worker:', swError);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // ۴. اطمینان از حفظ داده‌ها (بازنویسی)
        // ═══════════════════════════════════════════════════════════
        // چون فقط Cache Storage و Service Worker رو پاک کردیم،
        // localStorage دست نخورده باقی مونده. ولی برای اطمینان:
        Object.keys(savedData).forEach(key => {
            if (savedData[key] !== null && savedData[key] !== undefined) {
                try {
                    localStorage.setItem(key, savedData[key]);
                } catch (e) {
                    console.warn('⚠️ خطا در بازنویسی:', key);
                }
            }
        });
        
        console.log('✅ همه‌ی داده‌ها حفظ شدند');

        showModal('✅ بروزرسانی موفق', 'اطلاعات شما با موفقیت حفظ شد.\nبرنامه در حال بارگذاری مجدد...', '✅');

        // ═══════════════════════════════════════════════════════════
        // ۵. رفرش کامل صفحه
        // ═══════════════════════════════════════════════════════════
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('updated', Date.now());
            window.location.href = url.toString();
        }, 1500);

    } catch (error) {
        console.error('❌ خطا در بروزرسانی:', error);
        showModal('⚠️ خطا', 'مشکلی در بروزرسانی پیش آمد.\nصفحه دوباره بارگذاری می‌شود.', '⚠️');
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('updated', Date.now());
            window.location.href = url.toString();
        }, 1500);
    }
}

// ============================================================
// 🆕 بازیابی رتبه‌بندی (راه‌حل جایگزین)
// ============================================================
async function recoverRankings() {
    showModal('⏳ در حال بازیابی...', 'لطفاً چند لحظه صبر کنید.', '🔄');
    
    try {
        const classes = ['هفتم یک', 'هفتم دو', 'هفتم سه', 'هفتم چهار', 'هفتم پنج'];
        let totalRecovered = 0;
        
        for (const cls of classes) {
            const classSlug = classNameToSlug(cls);
            
            try {
                const response = await fetch(
                    TEACHER_API_URL + '?action=getRankings&class_name=' + classSlug + '&t=' + Date.now(),
                    { cache: 'no-store' }
                );
                const result = await response.json();
                
                if (result.success && result.data && result.data.length > 0) {
                    localStorage.setItem('rankings_cache_' + cls, JSON.stringify({
                        data: result.data,
                        timestamp: Date.now()
                    }));
                    totalRecovered += result.data.length;
                    console.log('✅ کش پر شد:', cls, '-', result.data.length, 'نفر');
                }
            } catch (e) {
                console.warn('❌ خطا در', cls, ':', e.message);
            }
        }
        
        if (totalRecovered > 0) {
            showModal('✅ بازیابی موفق', `${toPersianNum(totalRecovered)} رتبه بازیابی شد.\nصفحه دوباره بارگذاری می‌شود.`, '✅');
            setTimeout(() => location.reload(), 1500);
        } else {
            showModal('⚠️ توجه', 'داده‌ای برای بازیابی پیدا نشد.\nلطفاً اتصال اینترنت خود را چک کنید.', '⚠️');
        }
    } catch (error) {
        console.error('❌ خطا:', error);
        showModal('❌ خطا', 'مشکلی در بازیابی پیش آمد.', '❌');
    }
}

// ============================================================
// 🆕 بازیابی کامل داده‌ها از سرور (روش نهایی)
// ============================================================
async function fullDataRecovery() {
    showModal('⏳ در حال بازیابی کامل...', 'این ممکن است چند ثانیه طول بکشد.', '🔄');
    
    try {
        let recovered = 0;
        
        // ۱. بازیابی رتبه‌بندی
        const classes = ['هفتم یک', 'هفتم دو', 'هفتم سه', 'هفتم چهار', 'هفتم پنج'];
        for (const cls of classes) {
            const classSlug = classNameToSlug(cls);
            try {
                const response = await fetch(
                    TEACHER_API_URL + '?action=getRankings&class_name=' + classSlug + '&t=' + Date.now(),
                    { cache: 'no-store' }
                );
                const result = await response.json();
                if (result.success && result.data && result.data.length > 0) {
                    localStorage.setItem('rankings_cache_' + cls, JSON.stringify({
                        data: result.data,
                        timestamp: Date.now()
                    }));
                    recovered++;
                }
            } catch (e) {}
        }
        
        // ۲. بازیابی دانش‌آموزان (برای پنل معلم)
        try {
            const response = await fetch(
                TEACHER_API_URL + '?action=getAllStudents&t=' + Date.now(),
                { cache: 'no-store' }
            );
            const result = await response.json();
            if (result.success && result.data) {
                localStorage.setItem('teacherStudentsCache', JSON.stringify({
                    data: result.data,
                    timestamp: Date.now()
                }));
                recovered++;
            }
        } catch (e) {}
        
        // ۳. بازیابی پیام‌های کلاسی
        try {
            const response = await fetch(
                TEACHER_API_URL + '?action=getClassMessages&t=' + Date.now(),
                { cache: 'no-store' }
            );
            const result = await response.json();
            if (result.success && result.data) {
                localStorage.setItem('teacherClassMessagesCache', JSON.stringify({
                    data: result.data,
                    timestamp: Date.now()
                }));
                recovered++;
            }
        } catch (e) {}
        
        // ۴. بازیابی مسابقات
        try {
            const response = await fetch(
                TEACHER_API_URL + '?action=getContests&t=' + Date.now(),
                { cache: 'no-store' }
            );
            const result = await response.json();
            if (result.success && result.data) {
                localStorage.setItem('teacherContestsCache', JSON.stringify({
                    data: result.data,
                    timestamp: Date.now()
                }));
                recovered++;
            }
        } catch (e) {}
        
        // ۵. بازیابی کتابخانه
        try {
            const response = await fetch(
                TEACHER_API_URL + '?action=getLibrary&t=' + Date.now(),
                { cache: 'no-store' }
            );
            const result = await response.json();
            if (result.success && result.data) {
                localStorage.setItem('teacherLibraryCache', JSON.stringify({
                    data: result.data,
                    timestamp: Date.now()
                }));
                recovered++;
            }
        } catch (e) {}
        
        if (recovered > 0) {
            showModal('✅ بازیابی موفق', `${toPersianNum(recovered)} بخش بازیابی شد.\nصفحه دوباره بارگذاری می‌شود.`, '✅');
            setTimeout(() => location.reload(), 1500);
        } else {
            showModal('⚠️ توجه', 'داده‌ای پیدا نشد.\nاتصال اینترنت را چک کنید.', '⚠️');
        }
    } catch (error) {
        console.error('❌ خطا:', error);
        showModal('❌ خطا', 'مشکلی در بازیابی پیش آمد.', '❌');
    }
}

// ============================================================
// 🆕 رفرش امن (فقط کش‌های موقت)
// ============================================================
function safeRefresh() {
    // فقط کش‌های موقت رو پاک کن، نه داده‌های کاربر
    const tempKeys = [
        'notifications',
        'temp_data',
        'cache_temp'
    ];
    
    tempKeys.forEach(key => {
        localStorage.removeItem(key);
    });
    
    console.log('✅ کش‌های موقت پاک شدند');
    location.reload();
}

// ============================================================
// 🆕 تغییر آواتار (عکس از گالری) — نسخه نهایی
// ============================================================
function changeAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📸 فایل انتخاب شد:', file.name, Math.round(file.size / 1024), 'KB');

    if (file.size > 5 * 1024 * 1024) {
        showModal('خطا', 'حجم عکس باید کمتر از ۵ مگابایت باشد.', '⚠️');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 300;
                
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height = Math.round((height * MAX_SIZE) / width);
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width = Math.round((width * MAX_SIZE) / height);
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                let compressedData = canvas.toDataURL('image/jpeg', 0.85);
                
                console.log('📸 حجم عکس فشرده:', Math.round(compressedData.length / 1024), 'KB');
                
                if (compressedData.length > 45000) {
                    compressedData = canvas.toDataURL('image/jpeg', 0.6);
                }
                
                if (compressedData.length > 45000) {
                    const MAX_SIZE_2 = 200;
                    if (width > height) {
                        if (width > MAX_SIZE_2) {
                            height = Math.round((height * MAX_SIZE_2) / width);
                            width = MAX_SIZE_2;
                        }
                    } else {
                        if (height > MAX_SIZE_2) {
                            width = Math.round((width * MAX_SIZE_2) / height);
                            height = MAX_SIZE_2;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    compressedData = canvas.toDataURL('image/jpeg', 0.5);
                }
                
                localStorage.setItem('userAvatar', compressedData);
                localStorage.removeItem('userAvatarEmoji');
                
                if (typeof applyAvatarToElements === 'function') {
                    applyAvatarToElements();
                }
                
                showModal('موفق', 'عکس پروفایل با موفقیت تغییر کرد.', '✅');
                
                if (typeof autoSyncRanking === 'function') {
                    autoSyncRanking('تغییر آواتار');
                } else if (typeof saveRankingToSupabase === 'function') {
                    setTimeout(() => saveRankingToSupabase(), 800);
                }
            } catch (err) {
                console.error('❌ خطا در پردازش عکس:', err);
                showModal('خطا', 'مشکلی در پردازش عکس پیش آمد.', '❌');
            }
        };
        img.onerror = function() {
            showModal('خطا', 'عکس انتخاب‌شده معتبر نیست.', '❌');
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        showModal('خطا', 'خطا در خواندن فایل.', '❌');
    };
    reader.readAsDataURL(file);

    event.target.value = '';
}

// ============================================================
// مودال انتخاب نوع آواتار
// ============================================================
function openAvatarOptionsModal() {
    if (typeof openAvatarOptionsModalGlobal === 'function') {
        openAvatarOptionsModalGlobal();
    } else {
        const modal = document.getElementById('avatar-options-modal');
        if (modal) modal.classList.add('active');
    }
}

function closeAvatarOptionsModal() {
    const modal = document.getElementById('avatar-options-modal');
    if (modal) modal.classList.remove('active');
}

function chooseEmojiOption() {
    console.log('🎨 انتخاب گزینه ایموجی');
    closeAvatarOptionsModal();
    setTimeout(() => {
        if (typeof openEmojiPicker === 'function') {
            openEmojiPicker();
        }
    }, 250);
}

function chooseGalleryOption() {
    console.log('🖼️ انتخاب گزینه گالری');
    closeAvatarOptionsModal();
    setTimeout(() => {
        const fileInput = document.getElementById('avatar-input');
        if (fileInput) fileInput.click();
    }, 250);
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

    if (typeof autoSyncRanking === 'function') {
        autoSyncRanking('ویرایش پروفایل');
    } else if (typeof saveRankingToSupabase === 'function') {
        setTimeout(() => saveRankingToSupabase(), 800);
    }
}