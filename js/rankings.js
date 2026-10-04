// ============================================================
// rankings.js — سیستم رتبه‌بندی (طراحی سه‌بعدی)
// نسخه: ۵.۱.۰ — با نمایش آواتار واقعی کاربر
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
// رندر لیست رتبه‌بندی
// ============================================================
function renderRankingsList(rankings, userClass, studentId) {
    let html = '';
    
    const myIndex = studentId ? rankings.findIndex(r => r.student_id === studentId) : -1;
    
    // ═══════════════════════════════════════════════════
    // ۱. هدر آبی با تاج
    // ═══════════════════════════════════════════════════
    html += `
        <div class="lb-header">
            <div class="lb-header-crown">👑</div>
            <div class="lb-header-title">رتبه‌بندی</div>
            <div class="lb-header-sub">${userClass}</div>
        </div>
    `;
    
    // ═══════════════════════════════════════════════════
    // ۲. سکوی قهرمانی سه‌بعدی (نفرات ۱-۲-۳)
    // ═══════════════════════════════════════════════════
    if (rankings.length >= 3) {
        const first = rankings[0];
        const second = rankings[1];
        const third = rankings[2];
        const isFirstMe = first.student_id === studentId;
        const isSecondMe = second.student_id === studentId;
        const isThirdMe = third.student_id === studentId;
        
        html += `
            <div class="lb-podium-wrapper">
                <!-- نفر دوم - سمت راست -->
                <div class="lb-podium-item lb-podium-2 ${isSecondMe ? 'lb-is-me' : ''}">
                    <div class="lb-podium-avatar">
                        ${renderAvatar(second)}
                    </div>
                    <div class="lb-podium-name">${truncateName(second.name)}</div>
                    <div class="lb-podium-points">
                        <span class="lb-podium-star">⭐</span>
                        <span>${toPersianNum(second.total_points)}</span>
                    </div>
                    <div class="lb-podium-base lb-base-2">
                        <span class="lb-podium-rank">۲</span>
                    </div>
                </div>
                
                <!-- نفر اول - وسط (بلندتر) -->
                <div class="lb-podium-item lb-podium-1 ${isFirstMe ? 'lb-is-me' : ''}">
                    <div class="lb-podium-crown">👑</div>
                    <div class="lb-podium-avatar">
                        ${renderAvatar(first)}
                    </div>
                    <div class="lb-podium-name">${truncateName(first.name)}</div>
                    <div class="lb-podium-points">
                        <span class="lb-podium-star">⭐</span>
                        <span>${toPersianNum(first.total_points)}</span>
                    </div>
                    <div class="lb-podium-base lb-base-1">
                        <span class="lb-podium-rank">۱</span>
                    </div>
                </div>
                
                <!-- نفر سوم - سمت چپ -->
                <div class="lb-podium-item lb-podium-3 ${isThirdMe ? 'lb-is-me' : ''}">
                    <div class="lb-podium-avatar">
                        ${renderAvatar(third)}
                    </div>
                    <div class="lb-podium-name">${truncateName(third.name)}</div>
                    <div class="lb-podium-points">
                        <span class="lb-podium-star">⭐</span>
                        <span>${toPersianNum(third.total_points)}</span>
                    </div>
                    <div class="lb-podium-base lb-base-3">
                        <span class="lb-podium-rank">۳</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ═══════════════════════════════════════════════════
    // ۳. لیست ردیفی (از نفر ۱ تا آخر)
    // ═══════════════════════════════════════════════════
    html += `<div class="lb-list">`;
    
    rankings.forEach((ranking, index) => {
        const rank = index + 1;
        const isMe = ranking.student_id === studentId;
        
        // مدال برای نفرات اول تا سوم
        let medalEmoji = '';
        if (rank === 1) medalEmoji = '🥇';
        else if (rank === 2) medalEmoji = '🥈';
        else if (rank === 3) medalEmoji = '🥉';
        
        // کلاس (مثلاً «پایه هفتم - کلاس ۱»)
        const classNum = getClassNumberFromSlug(ranking.class_name);
        
        html += `
            <div class="lb-row ${isMe ? 'lb-row-me' : ''}">
                <!-- رتبه -->
                <div class="lb-row-rank">
                    ${medalEmoji 
                        ? `<span class="lb-row-medal">${medalEmoji}</span>` 
                        : `<span class="lb-row-num">${toPersianNum(rank)}</span>`
                    }
                </div>
                
                <!-- آواتار -->
                <div class="lb-row-avatar">
                    ${renderAvatar(ranking)}
                </div>
                
                <!-- اطلاعات -->
                <div class="lb-row-info">
                    <div class="lb-row-name">
                        ${ranking.name}
                        ${isMe ? '<span class="lb-row-you">شما</span>' : ''}
                    </div>
                    <div class="lb-row-class">پایه هفتم - کلاس ${classNum}</div>
                </div>
                
                <!-- امتیاز -->
                <div class="lb-row-points">
                    <span class="lb-row-star">⭐</span>
                    <span class="lb-row-points-value">${toPersianNum(ranking.total_points)}</span>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // اگه کاربر توی لیست نیست
    if (studentId && myIndex === -1) {
        html += `
            <div class="lb-not-in-list">
                <div class="lb-not-in-icon">📝</div>
                <div class="lb-not-in-text">
                    شما هنوز توی رتبه‌بندی نیستید!<br>
                    <span style="font-size: 12px;">با انجام اولین تکلیف، وارد لیست می‌شید.</span>
                </div>
            </div>
        `;
    }
    
    return html;
}

// ============================================================
// گرفتن شماره کلاس از slug
// ============================================================
function getClassNumberFromSlug(slug) {
    const map = {
        'hafom-1': '۱',
        'hafom-2': '۲',
        'hafom-3': '۳',
        'hafom-4': '۴',
        'hafom-5': '۵'
    };
    return map[slug] || '؟';
}

// ============================================================
// 🆕 رندر آواتار (پشتیبانی از ایموجی، عکس base64، و URL)
// ============================================================
function renderAvatar(ranking) {
    const avatarUrl = ranking.avatar_url || 'emoji:👤';
    
    // حالت ایموجی
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '');
        return `<span class="lb-avatar-emoji">${emoji}</span>`;
    }
    
    // حالت عکس base64 (کاربر آپلود کرده)
    if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="آواتار" class="lb-avatar-img">`;
    }
    
    // حالت URL عکس
    if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="آواتار" class="lb-avatar-img" crossorigin="anonymous">`;
    }
    
    // حالت پیش‌فرض
    return `<span class="lb-avatar-emoji">👤</span>`;
}

// ============================================================
// کوتاه کردن اسم
// ============================================================
function truncateName(fullName) {
    if (!fullName) return 'دانش‌آموز';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
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