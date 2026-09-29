// ============================================================
// rankings.js — منطق رتبه‌بندی و نمایش
// ============================================================

// متغیر سراسری برای ذخیره‌ی رتبه‌بندی
let currentRankings = [];
let currentRankingFilter = 'my-class'; // 'my-class' یا 'all'

// ============================================================
// بارگذاری و نمایش صفحه‌ی رتبه‌بندی
// ============================================================
async function loadRankingsPage() {
    const container = document.getElementById('rankings-content');
    if (!container) return;

    // نمایش لودینگ
    container.innerHTML = `
        <div class="rankings-loading">
            <div class="rankings-spinner"></div>
            <div class="rankings-loading-text">در حال بارگذاری رتبه‌بندی...</div>
        </div>
    `;

    try {
        const userClass = localStorage.getItem('userClass') || 'هفتم یک';
        const studentId = localStorage.getItem('studentUUID');

        // گرفتن رتبه‌بندی کلاس خودم
        currentRankings = await getRankingsByClass(userClass);

        // اگه خالی بود
        if (!currentRankings || currentRankings.length === 0) {
            container.innerHTML = renderEmptyRankings();
            return;
        }

        // نمایش رتبه‌بندی
        container.innerHTML = renderRankingsList(currentRankings, userClass, studentId);

    } catch (error) {
        console.error('❌ خطا در بارگذاری رتبه‌بندی:', error);
        container.innerHTML = `
            <div class="report-empty">
                <div class="report-empty-icon">⚠️</div>
                <div class="report-empty-text">
                    خطا در بارگذاری رتبه‌بندی<br>
                    <span style="font-size: 13px; color: #90a4ae;">لطفاً اینترنت خود را چک کنید</span>
                </div>
            </div>
        `;
    }
}

// ============================================================
// رندر لیست رتبه‌بندی
// ============================================================
function renderRankingsList(rankings, userClass, studentId) {
    let html = '';

    // هدر با اطلاعات کلاس
    html += `
        <div class="rankings-header">
            <div class="rankings-header-icon">🏆</div>
            <div class="rankings-header-text">
                <div class="rankings-header-title">رتبه‌بندی ${userClass}</div>
                <div class="rankings-header-sub">${toPersianNum(rankings.length)} دانش‌آموز در این کلاس</div>
            </div>
        </div>
    `;

    // کارت‌های ۳ نفر اول (سکوی قهرمانی)
    if (rankings.length >= 3) {
        html += renderTopThree(rankings);
    }

    // لیست بقیه (از رتبه ۱ یا ۴ به بعد)
    const startIndex = rankings.length >= 3 ? 3 : 0;
    html += `<div class="rankings-list">`;

    if (startIndex === 0) {
        // کمتر از ۳ نفر
        rankings.forEach((r, index) => {
            html += renderRankingCard(r, index + 1, studentId);
        });
    } else {
        // ۳ نفر اول توی سکو هستن، بقیه توی لیست
        for (let i = startIndex; i < rankings.length; i++) {
            html += renderRankingCard(rankings[i], i + 1, studentId);
        }
    }

    html += `</div>`;

    // اگه کاربر خودش توی رتبه‌بندی نیست
    if (studentId) {
        const myIndex = rankings.findIndex(r => r.student_id === studentId);
        if (myIndex === -1) {
            html += `
                <div class="rankings-not-in-list">
                    <div class="rankings-not-in-icon">📝</div>
                    <div class="rankings-not-in-text">
                        شما هنوز توی رتبه‌بندی نیستید!<br>
                        <span style="font-size: 12px;">با انجام اولین تکلیف، وارد لیست می‌شید.</span>
                    </div>
                </div>
            `;
        }
    }

    return html;
}

// ============================================================
// رندر سکوی قهرمانی (۳ نفر اول)
// ============================================================
function renderTopThree(rankings) {
    const first = rankings[0];
    const second = rankings[1];
    const third = rankings[2];

    return `
        <div class="rankings-podium">
            <!-- نفر دوم (سمت چپ) -->
            <div class="podium-item podium-2">
                <div class="podium-avatar-wrap">
                    <div class="podium-avatar">${renderAvatar(first, second)}</div>
                    <div class="podium-medal">🥈</div>
                </div>
                <div class="podium-name">${truncateName(second.name)}</div>
                <div class="podium-points">${toPersianNum(second.total_points)} ⭐</div>
                <div class="podium-base podium-base-2">
                    <span class="podium-rank-num">۲</span>
                </div>
            </div>

            <!-- نفر اول (وسط) -->
            <div class="podium-item podium-1">
                <div class="podium-avatar-wrap">
                    <div class="podium-avatar">${renderAvatar(first, first)}</div>
                    <div class="podium-medal">🥇</div>
                </div>
                <div class="podium-name">${truncateName(first.name)}</div>
                <div class="podium-points">${toPersianNum(first.total_points)} ⭐</div>
                <div class="podium-base podium-base-1">
                    <span class="podium-rank-num">۱</span>
                </div>
            </div>

            <!-- نفر سوم (سمت راست) -->
            <div class="podium-item podium-3">
                <div class="podium-avatar-wrap">
                    <div class="podium-avatar">${renderAvatar(first, third)}</div>
                    <div class="podium-medal">🥉</div>
                </div>
                <div class="podium-name">${truncateName(third.name)}</div>
                <div class="podium-points">${toPersianNum(third.total_points)} ⭐</div>
                <div class="podium-base podium-base-3">
                    <span class="podium-rank-num">۳</span>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// رندر کارت رتبه‌بندی (برای رتبه‌های ۴ به بعد)
// ============================================================
function renderRankingCard(ranking, rank, myStudentId) {
    const isMe = (ranking.student_id === myStudentId);
    const meClass = isMe ? 'is-me' : '';

    return `
        <div class="ranking-card ${meClass}">
            <div class="ranking-rank">${toPersianNum(rank)}</div>
            <div class="ranking-avatar">
                ${renderAvatar(ranking, ranking)}
            </div>
            <div class="ranking-info">
                <div class="ranking-name">
                    ${truncateName(ranking.name)}
                    ${isMe ? '<span class="ranking-me-badge">شما</span>' : ''}
                </div>
                <div class="ranking-stats">
                    <span>📚 ${toPersianNum(ranking.completed_lessons)} تکلیف</span>
                    <span>📊 ${toPersianNum(ranking.avg_percent)}%</span>
                </div>
            </div>
            <div class="ranking-points">
                <div class="ranking-points-value">${toPersianNum(ranking.total_points)}</div>
                <div class="ranking-points-label">امتیاز</div>
            </div>
        </div>
    `;
}

// ============================================================
// رندر آواتار (عکس یا ایموجی)
// ============================================================
function renderAvatar(ranking, fallback) {
    const avatarUrl = ranking.avatar_url || 'emoji:👤';

    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '');
        return `<span class="avatar-emoji">${emoji}</span>`;
    } else if (avatarUrl.startsWith('data:image')) {
        // عکس Base64
        return `<img src="${avatarUrl}" alt="آواتار" class="avatar-img">`;
    } else if (avatarUrl.startsWith('http')) {
        // URL عکس
        return `<img src="${avatarUrl}" alt="آواتار" class="avatar-img">`;
    } else {
        return `<span class="avatar-emoji">👤</span>`;
    }
}

// ============================================================
// کوتاه کردن اسم (اسم + حرف اول فامیل)
// ============================================================
function truncateName(fullName) {
    if (!fullName) return 'دانش‌آموز';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    // اسم اول + حرف اول فامیل
    const firstName = parts[0];
    const lastNameInitial = parts[parts.length - 1].charAt(0);
    return `${firstName} ${lastNameInitial}.`;
}

// ============================================================
// رندر حالت خالی
// ============================================================
function renderEmptyRankings() {
    return `
        <div class="rankings-empty">
            <div class="rankings-empty-icon">🏆</div>
            <div class="rankings-empty-title">هنوز رتبه‌بندی‌ای نیست!</div>
            <div class="rankings-empty-text">
                با انجام اولین تکلیف، اولین نفر توی لیست رتبه‌بندی کلاس می‌شی!
            </div>
        </div>
    `;
}

// ============================================================
// رفرش کردن رتبه‌بندی (با کشیدن به پایین)
// ============================================================
async function refreshRankings() {
    vibrate(20);
    await loadRankingsPage();
}