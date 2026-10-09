// ============================================================
// settings.js — تنظیمات، پروفایل، ثبت‌نام، ویرایش آیدی
// نسخه: ۹.۰.۰ — با سیستم ورود با آیدی
// ============================================================

// ============================================================
// اطلاعات کاربر (Welcome — ثبت‌نام جدید)
// ============================================================
async function saveUserInfo() {
    const name = document.getElementById('welcome-name').value.trim();
    const cls = document.getElementById('welcome-class').value;
    const school = document.getElementById('welcome-school').value.trim();
    
    if (!name) { 
        showModal('خطا', 'لطفاً نام خود را وارد کنید.', '⚠️'); 
        return; 
    }
    if (!cls) { 
        showModal('خطا', 'لطفاً کلاس خود را انتخاب کنید.', '⚠️'); 
        return; 
    }
    
    // نمایش لودینگ
    const btn = document.querySelector('.welcome-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'در حال ثبت‌نام...';
    }
    
    try {
        // ثبت‌نام در Supabase
        const result = await registerNewStudent(name, cls, school || 'تعیین نشده');
        
        if (!result.success) {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'ثبت‌نام و ورود 🚀';
            }
            showModal('خطا در ثبت‌نام', result.error || 'مشکلی پیش اومد.', '❌');
            return;
        }
        
        // ✅ ثبت‌نام موفق — ذخیره اطلاعات
        const studentData = result.data;
        await handleSuccessfulLogin(studentData);
        
    } catch (error) {
        console.error('خطا:', error);
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'ثبت‌نام و ورود 🚀';
        }
        showModal('خطا', 'مشکلی پیش اومد. دوباره تلاش کن.', '❌');
    }
}

// ============================================================
// به‌روزرسانی UI صفحه خانه
// ============================================================
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
// پروفایل (بارگذاری اطلاعات)
// ============================================================
function loadProfileData() {
    const name = localStorage.getItem('userName') || 'دانش‌آموز';
    const cls = localStorage.getItem('userClass') || 'هفتم';
    const school = localStorage.getItem('userSchool') || 'تعیین نشده';
    const year = localStorage.getItem('userYear') || '۱۴۰۵-۱۴۰۶';
    const userId = localStorage.getItem('userId') || '-';
    
    // اطلاعات پایه
    const nameDisplay = document.getElementById('profile-name-display');
    const gradeDisplay = document.getElementById('profile-grade-display');
    const fullnameEl = document.getElementById('profile-fullname');
    const classEl = document.getElementById('profile-class');
    const schoolEl = document.getElementById('profile-school');
    const yearEl = document.getElementById('profile-year');
    const userIdEl = document.getElementById('profile-userid-display');
    
    if (nameDisplay) nameDisplay.textContent = name;
    if (gradeDisplay) gradeDisplay.textContent = `پایه ${cls}`;
    if (fullnameEl) fullnameEl.textContent = name;
    if (classEl) classEl.textContent = cls;
    if (schoolEl) schoolEl.textContent = school;
    if (yearEl) yearEl.textContent = year;
    if (userIdEl) userIdEl.textContent = userId;
    
    // آواتار
    if (typeof applyAvatarToElements === 'function') {
        applyAvatarToElements();
    }
    
    // آمار
    loadProfileStatsFromSupabase();
}

// ============================================================
// بارگذاری آمار پروفایل از Supabase
// ============================================================
async function loadProfileStatsFromSupabase() {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    let totalPoints = reports.reduce((sum, r) => sum + (r.score || 0), 0);
    const completedLessons = reports.length;
    const avgPercent = reports.length > 0
        ? Math.round(reports.reduce((sum, r) => sum + (r.percent || 0), 0) / reports.length)
        : 0;
    
    // نمایش اولیه
    const stats = typeof getUserStats === 'function' ? getUserStats() : { unlockedMedals: [] };
    const statPointsEl = document.getElementById('stat-points');
    const statMedalsEl = document.getElementById('stat-medals');
    const statCompletedEl = document.getElementById('stat-completed');
    const statPercentEl = document.getElementById('stat-percent');
    
    if (statPointsEl) statPointsEl.textContent = toPersianNum(totalPoints);
    if (statMedalsEl) statMedalsEl.textContent = toPersianNum(stats.unlockedMedals.length);
    if (statCompletedEl) statCompletedEl.textContent = toPersianNum(completedLessons);
    if (statPercentEl) statPercentEl.textContent = toPersianNum(avgPercent) + '%';
    
    // 🆕 دریافت امتیاز دستی معلم از Supabase
    try {
        const client = getSupabase();
        if (!client) return;
        
        const studentUUID = localStorage.getItem('userUUID') || localStorage.getItem('studentUUID');
        if (!studentUUID) return;
        
        const { data, error } = await client
            .from('rankings')
            .select('custom_points_added, custom_total_points')
            .eq('student_id', studentUUID)
            .maybeSingle();
        
        if (error) {
            console.warn('⚠️ خطا در گرفتن امتیاز از Supabase:', error.message);
            return;
        }
        
        if (data) {
            const customAdded = data.custom_points_added || 0;
            const customTotal = data.custom_total_points || 0;
            const finalTotalPoints = totalPoints + customAdded + customTotal;
            
            console.log('📊 آمار پروفایل:', {
                base: totalPoints,
                customAdded: customAdded,
                customTotal: customTotal,
                final: finalTotalPoints
            });
            
            if (statPointsEl) statPointsEl.textContent = toPersianNum(finalTotalPoints);
            
            // ذخیره برای استفاده‌های بعدی
            localStorage.setItem('customPointsAdded', customAdded);
            localStorage.setItem('customTotalPoints', customTotal);
        }
    } catch (e) {
        console.warn('⚠️ خطا:', e);
    }
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
        const bgMusic = document.getElementById('bg-music');
        if (bgMusic) {
            bgMusic.volume = 0.9;
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen && !['screen-quiz', 'screen-feedback', 'screen-result'].includes(activeScreen.id)) {
                bgMusic.play().catch(e => console.log(e));
            }
        }
    } else {
        localStorage.setItem('musicEnabled', 'false');
        const bgMusic = document.getElementById('bg-music');
        if (bgMusic) bgMusic.pause();
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
let musicStarted = false;
let isMuted = false;

function startMusic() {
    if (musicStarted && !isMuted) return;
    if (localStorage.getItem('musicEnabled') === 'false') return;
    const bgMusic = document.getElementById('bg-music');
    if (!bgMusic) return;
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
    
    const MOTIVATIONS = typeof window.MOTIVATIONS !== 'undefined' ? window.MOTIVATIONS : [
        "امروز روز یادگیریه، بیا شروع کنیم!",
        "تو می‌تونی، فقط باورت کن!",
        "هر روز یه قدم به موفقیت نزدیک‌تر!",
        "بیا با هم عربی رو حرفه‌ای یاد بگیریم!"
    ];
    
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
// بروزرسانی اطلاعات — نسخه نهایی
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
        const savedData = {};
        const savedKeys = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            const tempKeys = ['temp_data', 'cache_temp', 'lastUpdateCheck'];
            if (tempKeys.includes(key)) continue;
            savedData[key] = localStorage.getItem(key);
            savedKeys.push(key);
        }
        
        console.log('💾 ذخیره‌شده:', savedKeys.length, 'کلید');

        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (cacheError) {}
        }

        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            } catch (swError) {}
        }

        Object.keys(savedData).forEach(key => {
            if (savedData[key] !== null && savedData[key] !== undefined) {
                try { localStorage.setItem(key, savedData[key]); } catch (e) {}
            }
        });

        showModal('✅ بروزرسانی موفق', 'اطلاعات شما با موفقیت حفظ شد.\nبرنامه در حال بارگذاری مجدد...', '✅');

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
// تغییر آواتار (عکس از گالری)
// ============================================================
function changeAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

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
                
                // آپدیت در Supabase
                updateAvatarInSupabase('data:image/jpeg;base64,' + compressedData.split(',')[1]);
                
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
// 🆕 آپدیت آواتار در Supabase
// ============================================================
async function updateAvatarInSupabase(avatarData) {
    try {
        const client = getSupabase();
        if (!client) return;
        
        const uuid = localStorage.getItem('userUUID') || localStorage.getItem('studentUUID');
        if (!uuid) return;
        
        await client
            .from('students')
            .update({ avatar_url: avatarData })
            .eq('uuid', uuid);
            
        console.log('✅ آواتار در Supabase آپدیت شد');
    } catch (e) {
        console.warn('خطا در آپدیت آواتار:', e);
    }
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
    document.getElementById('edit-profile-modal').classList.add('active');
}

function closeEditProfile() {
    document.getElementById('edit-profile-modal').classList.remove('active');
}

async function saveProfileChanges() {
    const newName = document.getElementById('edit-name').value.trim();
    const newClass = document.getElementById('edit-class').value;
    const newSchool = document.getElementById('edit-school').value.trim();
    
    if (!newName) {
        showModal('خطا', 'لطفاً نام خود را وارد کنید.', '⚠️');
        return;
    }
    
    const oldName = localStorage.getItem('userName');
    
    // اگه نام تغییر کرده، چک کن تکراری نباشه
    if (newName !== oldName) {
        const exists = await checkFullNameExists(newName);
        if (exists) {
            showModal('نام تکراری', 'این نام قبلاً استفاده شده. لطفاً نام دیگه‌ای وارد کن.', '⚠️');
            return;
        }
    }
    
    // ذخیره در localStorage
    localStorage.setItem('userName', newName);
    localStorage.setItem('userClass', newClass);
    localStorage.setItem('userSchool', newSchool || 'تعیین نشده');
    
    // آپدیت در Supabase
    try {
        const uuid = localStorage.getItem('userUUID') || localStorage.getItem('studentUUID');
        if (uuid) {
            const client = getSupabase();
            if (client) {
                await client
                    .from('students')
                    .update({
                        full_name: newName,
                        class_name: newClass,
                        school: newSchool || 'تعیین نشده'
                    })
                    .eq('uuid', uuid);
                
                // آپدیت در rankings
                await client
                    .from('rankings')
                    .update({
                        name: newName,
                        class_name: classNameToSlug(newClass)
                    })
                    .eq('student_id', uuid);
            }
        }
    } catch (e) {
        console.warn('خطا در آپدیت Supabase:', e);
    }
    
    updateHomeUI();
    loadProfileData();
    closeEditProfile();
    showModal('موفق', 'اطلاعات شما با موفقیت ذخیره شد.', '✅');
}

console.log('⚙️ settings.js بارگذاری شد');