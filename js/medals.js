// ============================================================
// medals.js — سیستم مدال‌ها و آمار کاربر
// ============================================================

// ============================================================
// محاسبه آمار کلی کاربر
// ============================================================
function getUserStats() {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const totalPoints = reports.reduce((sum, r) => sum + (r.score || 0), 0);
    const completedLessons = reports.length;
    const avgPercent = reports.length > 0
        ? Math.round(reports.reduce((sum, r) => sum + (r.percent || 0), 0) / reports.length)
        : 0;
    const perfectScores = reports.filter(r => r.percent === 100).length;
    const highScores = reports.filter(r => r.percent >= 90).length;
    const fastLessons = reports.filter(r => r.timeTaken <= 3).length;
    const activityDates = [...new Set(reports.map(r => r.date))].sort();
    let streakDays = activityDates.length;
    const dateCounts = {};
    reports.forEach(r => { dateCounts[r.date] = (dateCounts[r.date] || 0) + 1; });
    const maxInOneDay = Math.max(0, ...Object.values(dateCounts));
    return {
        totalPoints, completedLessons, avgPercent,
        perfectScores, highScores, fastLessons,
        streakDays, maxInOneDay,
        unlockedMedals: getUnlockedMedals({
            totalPoints, completedLessons, avgPercent,
            perfectScores, highScores, fastLessons,
            streakDays, maxInOneDay
        })
    };
}

// ============================================================
// بررسی مدال‌های باز شده
// ============================================================
function getUnlockedMedals(stats) {
    return MEDALS_LIST.filter(m => m.condition(stats)).map(m => m.id);
}

function getMedalsWithStatus() {
    const stats = getUserStats();
    const baseStats = {
        totalPoints: stats.totalPoints,
        completedLessons: stats.completedLessons,
        avgPercent: stats.avgPercent,
        perfectScores: stats.perfectScores,
        highScores: stats.highScores,
        fastLessons: stats.fastLessons,
        streakDays: stats.streakDays,
        maxInOneDay: stats.maxInOneDay
    };
    return MEDALS_LIST.map(m => ({ ...m, unlocked: m.condition(baseStats) }));
}

// ============================================================
// نمایش صفحه مدال‌ها
// ============================================================
function loadMedals() {
    const medals = getMedalsWithStatus();
    const container = document.getElementById('medals-grid');
    container.innerHTML = medals.map(m => `
        <div class="medal-card ${m.unlocked ? '' : 'locked'}">
            ${m.unlocked ? '' : '<span class="medal-lock">🔒</span>'}
            <span class="medal-icon">${m.icon}</span>
            <div class="medal-title">${m.title}</div>
            <div class="medal-desc">${m.desc}</div>
        </div>
    `).join('');
}

// ============================================================
// بررسی مدال‌های جدید و نمایش ترتیبی
// ============================================================
let medalsQueue = [];
let currentMedalIndex = 0;

function checkForNewMedals() {
    const previousMedals = JSON.parse(localStorage.getItem('unlockedMedals') || '[]');
    const currentStats = getUserStats();
    const currentMedals = currentStats.unlockedMedals;
    const newMedals = currentMedals.filter(id => !previousMedals.includes(id));
    localStorage.setItem('unlockedMedals', JSON.stringify(currentMedals));
    if (newMedals.length > 0) {
        showMedalsSequence(newMedals);
        return true;
    }
    return false;
}

function showMedalsSequence(medalIds) {
    medalsQueue = medalIds.map(id => MEDALS_LIST.find(m => m.id === id)).filter(Boolean);
    currentMedalIndex = 0;
    if (medalsQueue.length > 0) {
        showConfetti();
        vibrate([30, 50, 30, 50, 30]);
        setTimeout(() => showMedalModal(medalsQueue[currentMedalIndex]), 500);
    }
}

function showMedalModal(medal) {
    document.getElementById('medal-modal-icon').textContent = medal.icon;
    document.getElementById('medal-modal-name').textContent = medal.title;
    document.getElementById('medal-modal-desc').textContent = medal.desc;
    document.getElementById('medal-modal').classList.add('active');
    playMedalSound();
    addNotification('success', 'مدال جدید', `شما مدال «${medal.title}» را دریافت کردید!`);
    updateNotificationBadge();
}

function closeMedalModal() {
    document.getElementById('medal-modal').classList.remove('active');
    currentMedalIndex++;
    if (currentMedalIndex < medalsQueue.length) {
        setTimeout(() => {
            showConfetti();
            vibrate([30, 50, 30]);
            showMedalModal(medalsQueue[currentMedalIndex]);
        }, 400);
    } else {
        medalsQueue = [];
        currentMedalIndex = 0;
    }
}

// ============================================================
// صدای مدال
// ============================================================
function playMedalSound() {
    if (localStorage.getItem('soundsEnabled') === 'false') return;
    try {
        initAudio();
        const now = audioContext.currentTime;
        [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.4);
        });
    } catch(e) {}
}