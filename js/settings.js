// ============================================================
// settings.js — تنظیمات، پروفایل، موسیقی، صداها
// ============================================================

// ============================================================
// اطلاعات کاربر (Welcome)
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
    updateStreak();
    updateHomeUI();
    document.getElementById('welcome-user-name').textContent = name;
    setTimeout(() => {
        document.getElementById('welcome-graphic-modal').classList.add('active');
    }, 400);
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
        const avatar = localStorage.getItem('userAvatar');
        if (avatar) {
            const homeAvatarImg = document.getElementById('home-avatar-img');
            const profileAvatarImg = document.getElementById('profile-avatar-img');
            if (homeAvatarImg) homeAvatarImg.src = avatar;
            if (profileAvatarImg) profileAvatarImg.src = avatar;
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
    const avatar = localStorage.getItem('userAvatar');
    document.getElementById('profile-name-display').textContent = name;
    document.getElementById('profile-grade-display').textContent = `پایه ${cls}`;
    document.getElementById('profile-fullname').textContent = name;
    document.getElementById('profile-class').textContent = cls;
    document.getElementById('profile-school').textContent = school;
    document.getElementById('profile-year').textContent = year;
    if (avatar) document.getElementById('profile-avatar-img').src = avatar;
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