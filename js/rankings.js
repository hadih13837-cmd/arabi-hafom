// ============================================================
// rankings.js — سیستم رتبه‌بندی (طراحی Duolingo)
// نسخه: ۴.۰.۰
// ============================================================

let currentRankings = [];
let currentRankingsClass = '';
let rankingsRefreshInterval = null;

// ============================================================
// بارگذاری صفحه رتبه‌بندی
// ============================================================
async function loadRankingsPage() {
    const container = document.getElementById('rankings-content');
    if (!container) return;
    
    container.innerHTML = `
        <div class="rankings-loading">
            <div class="rankings-spinner"></div>
            <div class="rankings-loading-text">در حال بارگذاری رتبه‌بندی...</div>
        </div>
    `;
    
    try {
        const userClass = localStorage.getItem('userClass') || 'هفتم یک';
        const studentId = localStorage.getItem('studentUUID');
        
        currentRankingsClass = userClass;
        
        if (studentId && typeof autoSyncRanking === 'function') {
            autoSyncRanking('ورود به صفحه رتبه‌بندی');
        }
        
        await new Promise(resolve => setTimeout(resolve, 700));
        
        const rankings = await getRankingsByClass(userClass);
        currentRankings = rankings || [];
        
        if (currentRankings.length === 0) {
            container.innerHTML = renderEmptyRankings();
            return;
        }
        
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
// 🆕 رندر لیست رتبه‌بندی (طراحی Duolingo)
// ============================================================
function renderRankingsList(rankings, userClass, studentId) {
    let html = '';
    
    // پیدا کردن رتبه‌ی کاربر
    const myIndex = studentId ? rankings.findIndex(r => r.student_id === studentId) : -1;
    const myRank = myIndex >= 0 ? myIndex + 1 : null;
    
    // هدر Duolingo-style
    html += `
        <div class="dl-leaderboard-header">
            <div class="dl-header-icon">🏆</div>
            <div class="dl-header-title">لیگ ${userClass}</div>
            <div class="dl-header-sub">${toPersianNum(rankings.length)} دانش‌آموز</div>
        </div>
    `;
    
    // Zone Promotion (نفرات ۱-۳)
    if (rankings.length >= 3) {
        html += `<div class="dl-zone-label dl-zone-promotion">
            <span>⬆️ منطقه‌ی صعود</span>
        </div>`;
    }
    
    html += `<div class="dl-leaderboard-list">`;
    
    rankings.forEach((ranking, index) => {
        const rank = index + 1;
        const isMe = ranking.student_id === studentId;
        const isTop3 = rank <= 3;
        
        // بعد از نفر ۳، خط جداکننده
        if (index === 3 && rankings.length > 3) {
            html += `</div><div class="dl-zone-divider"></div><div class="dl-leaderboard-list">`;
        }
        
        // مدال برای سه نفر اول
        let medalHTML = '';
        let rankClass = 'dl-rank-default';
        if (rank === 1) {
            medalHTML = '<span class="dl-medal">🥇</span>';
            rankClass = 'dl-rank-1';
        } else if (rank === 2) {
            medalHTML = '<span class="dl-medal">🥈</span>';
            rankClass = 'dl-rank-2';
        } else if (rank === 3) {
            medalHTML = '<span class="dl-medal">🥉</span>';
            rankClass = 'dl-rank-3';
        }
        
        html += `
            <div class="dl-rank-row ${isMe ? 'dl-is-me' : ''} ${isTop3 ? 'dl-top-rank' : ''}">
                <div class="dl-rank-number ${rankClass}">
                    ${medalHTML || toPersianNum(rank)}
                </div>
                <div class="dl-avatar">
                    ${renderAvatar(ranking)}
                </div>
                <div class="dl-info">
                    <div class="dl-name">
                        ${ranking.name}
                        ${isMe ? '<span class="dl-you-badge">شما</span>' : ''}
                    </div>
                    <div class="dl-stats">
                        <span class="dl-stat-item">📚 ${toPersianNum(ranking.completed_lessons)} تکلیف</span>
                        <span class="dl-stat-item">📊 ${toPersianNum(ranking.avg_percent)}%</span>
                    </div>
                </div>
                <div class="dl-points">
                    <span class="dl-points-value">${toPersianNum(ranking.total_points)}</span>
                    <span class="dl-points-icon">⭐</span>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // اگه کاربر توی لیست نیست
    if (studentId && myIndex === -1) {
        html += `
            <div class="dl-not-in-list">
                <div class="dl-not-in-icon">📝</div>
                <div class="dl-not-in-text">
                    شما هنوز توی لیگ نیستید!<br>
                    <span style="font-size: 12px;">با انجام اولین تکلیف، وارد لیگ می‌شید.</span>
                </div>
            </div>
        `;
    }
    
    // Zone Demotion (آخرین ۲ نفر)
    if (rankings.length >= 5) {
        html += `<div class="dl-zone-label dl-zone-demotion">
            <span>⬇️ منطقه‌ی سقوط</span>
        </div>`;
    }
    
    return html;
}

// ============================================================
// رندر کارت رتبه‌بندی (ساده - بدون استفاده)
// ============================================================
function renderRankingCard(ranking, rank, myStudentId) {
    // این تابع دیگه استفاده نمی‌شه
    return '';
}

// ============================================================
// رندر آواتار
// ============================================================
function renderAvatar(ranking) {
    const avatarUrl = ranking.avatar_url || 'emoji:👤';
    
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '');
        return `<span class="dl-avatar-emoji">${emoji}</span>`;
    } else if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="آواتار" class="dl-avatar-img">`;
    } else if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="آواتار" class="dl-avatar-img" crossorigin="anonymous">`;
    } else {
        return `<span class="dl-avatar-emoji">👤</span>`;
    }
}

// ============================================================
// رندر حالت خالی
// ============================================================
function renderEmptyRankings() {
    return `
        <div class="rankings-empty">
            <div class="rankings-empty-icon">🏆</div>
            <div class="rankings-empty-title">هنوز لیگی وجود نداره!</div>
            <div class="rankings-empty-text">
                با انجام اولین تکلیف، اولین نفر توی لیگ کلاس می‌شی!
            </div>
        </div>
    `;
}

// ============================================================
// رفرش
// ============================================================
async function refreshRankings() {
    vibrate(20);
    
    if (typeof autoSyncRanking === 'function') {
        autoSyncRanking('رفرش دستی');
        await new Promise(resolve => setTimeout(resolve, 700));
    }
    
    await loadRankingsPage();
}