// ============================================================
// rankings.js — سیستم رتبه‌بندی
// نسخه: ۲۰.۰.۰ — با مودال پروفایل جدید
// ============================================================

let currentRankings = [];
let currentRankingsClass = '';
let autoRefreshInterval = null;
let lastRankingsHash = '';
let isLoadingRankings = false;

// ============================================================
// بارگذاری صفحه رتبه‌بندی
// ============================================================
async function loadRankingsPage() {
    const container = document.getElementById('rankings-content');
    if (!container) return;
    
    const userClass = localStorage.getItem('userClass') || 'هفتم یک';
    const studentId = localStorage.getItem('studentUUID');
    const cacheKey = 'rankings_cache_' + userClass;
    
    let hasCachedData = false;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            if (parsed.data && parsed.data.length > 0) {
                currentRankings = parsed.data;
                currentRankingsClass = userClass;
                lastRankingsHash = getRankingsHash(currentRankings);
                container.innerHTML = renderRankingsList(currentRankings, userClass, studentId);
                hasCachedData = true;
            }
        } catch (e) {}
    }
    
    if (!hasCachedData) {
        container.innerHTML = `
            <div class="rankings-loading">
                <div class="rankings-spinner"></div>
                <div class="rankings-loading-text">در حال بارگذاری رتبه‌بندی...</div>
            </div>
        `;
    }
    
    setTimeout(async () => {
        try {
            currentRankingsClass = userClass;
            
            if (studentId && typeof saveRankingToSupabase === 'function') {
                saveRankingToSupabase().catch(e => console.warn('sync:', e));
            }
            
            const rankings = await getRankingsByClass(userClass);
            
            if (rankings && rankings.length > 0) {
                const newHash = getRankingsHash(rankings);
                
                if (newHash !== lastRankingsHash) {
                    currentRankings = rankings;
                    lastRankingsHash = newHash;
                    
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify({
                            data: currentRankings,
                            timestamp: Date.now()
                        }));
                    } catch (e) {}
                    
                    container.innerHTML = renderRankingsList(currentRankings, userClass, studentId);
                }
            } else if (!hasCachedData) {
                container.innerHTML = renderEmptyRankings();
            }
            
            startAutoRefresh();
            
        } catch (error) {
            console.error('❌ خطا:', error);
            if (!hasCachedData) {
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
    }, 2000);
}

// ============================================================
// hash رتبه‌بندی
// ============================================================
function getRankingsHash(rankings) {
    if (!rankings || rankings.length === 0) return '';
    return rankings.map(r => 
        `${r.student_id}_${r.total_points}_${r.completed_lessons}_${r.avg_percent}_${r.avatar_url || ''}`
    ).join('|');
}

// ============================================================
// Auto-refresh
// ============================================================
function startAutoRefresh() {
    stopAutoRefresh();
    
    autoRefreshInterval = setInterval(async () => {
        if (isLoadingRankings) return;
        
        const activeScreen = document.querySelector('.screen.active');
        if (!activeScreen || activeScreen.id !== 'screen-rankings') return;
        
        const anyModalOpen = document.querySelector('.profile-card-overlay.active, .user-medals-overlay.active, .exit-modal-overlay.active, .modal-overlay.active');
        if (anyModalOpen) return;
        
        isLoadingRankings = true;
        
        try {
            const userClass = localStorage.getItem('userClass') || 'هفتم یک';
            const studentId = localStorage.getItem('studentUUID');
            
            const rankings = await getRankingsByClass(userClass);
            
            if (!rankings || rankings.length === 0) {
                isLoadingRankings = false;
                return;
            }
            
            const newHash = getRankingsHash(rankings);
            
            if (newHash !== lastRankingsHash) {
                currentRankings = rankings;
                lastRankingsHash = newHash;
                
                try {
                    localStorage.setItem('rankings_cache_' + userClass, JSON.stringify({
                        data: currentRankings,
                        timestamp: Date.now()
                    }));
                } catch (e) {}
                
                const container = document.getElementById('rankings-content');
                if (container) {
                    container.innerHTML = renderRankingsList(currentRankings, userClass, studentId);
                }
            }
        } catch (error) {}
        
        isLoadingRankings = false;
    }, 15000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// ============================================================
// رندر لیست رتبه‌بندی
// ============================================================
function renderRankingsList(rankings, userClass, studentId) {
    let html = '';
    
    const myIndex = studentId ? rankings.findIndex(r => r.student_id === studentId) : -1;
    
    if (rankings.length >= 3) {
        const first = rankings[0];
        const second = rankings[1];
        const third = rankings[2];
        
        const isFirstMe = first.student_id === studentId;
        const isSecondMe = second.student_id === studentId;
        const isThirdMe = third.student_id === studentId;
        
        html += `
            <div class="lb-podium-vector-wrapper">
                <img src="https://cdn.imgurl.ir/uploads/w806666_ChatGPT_Image_Oct_4_2026_02_49_35_PM.png" 
                     alt="سکوی قهرمانی" 
                     class="lb-podium-vector-bg">
                
                <div class="lb-podium-people">
                    <div class="lb-podium-person lb-person-2 ${isSecondMe ? 'lb-is-me' : ''}" 
                         onclick="openProfileCard('${second.student_id}')">
                        <div class="lb-person-avatar ${getAvatarClass(second)}">
                            ${renderAvatar(second)}
                        </div>
                        <div class="lb-person-info">
                            <div class="lb-person-name">${truncateName(second.name)}</div>
                            <div class="lb-person-points">
                                <span>⭐</span>
                                <span>${toPersianNum(second.total_points)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="lb-podium-person lb-person-1 ${isFirstMe ? 'lb-is-me' : ''}" 
                         onclick="openProfileCard('${first.student_id}')">
                        <div class="lb-person-crown">👑</div>
                        <div class="lb-person-avatar ${getAvatarClass(first)}">
                            ${renderAvatar(first)}
                        </div>
                        <div class="lb-person-info">
                            <div class="lb-person-name">${truncateName(first.name)}</div>
                            <div class="lb-person-points">
                                <span>⭐</span>
                                <span>${toPersianNum(first.total_points)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="lb-podium-person lb-person-3 ${isThirdMe ? 'lb-is-me' : ''}" 
                         onclick="openProfileCard('${third.student_id}')">
                        <div class="lb-person-avatar ${getAvatarClass(third)}">
                            ${renderAvatar(third)}
                        </div>
                        <div class="lb-person-info">
                            <div class="lb-person-name">${truncateName(third.name)}</div>
                            <div class="lb-person-points">
                                <span>⭐</span>
                                <span>${toPersianNum(third.total_points)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += `<div class="lb-list">`;
    
    rankings.forEach((ranking, index) => {
        const rank = index + 1;
        const isMe = ranking.student_id === studentId;
        
        let medalEmoji = '';
        if (rank === 1) medalEmoji = '🥇';
        else if (rank === 2) medalEmoji = '🥈';
        else if (rank === 3) medalEmoji = '🥉';
        
        const classPersian = getClassPersianName(ranking.class_name);
        
        html += `
            <div class="lb-row ${isMe ? 'lb-row-me' : ''}" onclick="openProfileCard('${ranking.student_id}')">
                <div class="lb-row-rank">
                    ${medalEmoji 
                        ? `<span class="lb-row-medal">${medalEmoji}</span>` 
                        : `<span class="lb-row-num">${toPersianNum(rank)}</span>`
                    }
                </div>
                
                <div class="lb-row-info">
                    <div class="lb-row-name">
                        ${ranking.name}
                        ${isMe ? '<span class="lb-row-you">شما</span>' : ''}
                    </div>
                    <div class="lb-row-class">${classPersian}</div>
                </div>
                
                <div class="lb-row-points">
                    <span class="lb-row-star">⭐</span>
                    <span class="lb-row-points-value">${toPersianNum(ranking.total_points)}</span>
                </div>
                
                <div class="lb-row-avatar ${getAvatarClass(ranking)}">
                    ${renderAvatar(ranking)}
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
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

function getClassPersianName(slug) {
    const map = {
        'hafom-1': 'پایه هفتم یک',
        'hafom-2': 'پایه هفتم دو',
        'hafom-3': 'پایه هفتم سه',
        'hafom-4': 'پایه هفتم چهار',
        'hafom-5': 'پایه هفتم پنج'
    };
    return map[slug] || 'پایه هفتم';
}

function getAvatarClass(ranking) {
    const avatarUrl = (ranking && ranking.avatar_url) ? String(ranking.avatar_url).trim() : '';
    
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '').trim();
        if (emoji && emoji !== '👤' && emoji !== '👦🏻' && emoji !== '👦') {
            return 'lb-avatar-emoji-mode';
        }
    }
    
    return 'lb-avatar-image-mode';
}

function renderAvatar(ranking) {
    const DEFAULT_AVATAR_URL = 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';
    const avatarUrl = (ranking && ranking.avatar_url) ? String(ranking.avatar_url).trim() : '';
    
    if (!avatarUrl || avatarUrl === '' || avatarUrl === 'null' || avatarUrl === 'default' || avatarUrl === 'undefined') {
        return `<img src="${DEFAULT_AVATAR_URL}" alt="" class="lb-avatar-img">`;
    }
    
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '').trim();
        if (!emoji || emoji === '👤' || emoji === '👦🏻' || emoji === '👦') {
            return `<img src="${DEFAULT_AVATAR_URL}" alt="" class="lb-avatar-img">`;
        }
        return `<span class="lb-avatar-emoji">${emoji}</span>`;
    }
    
    if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="" class="lb-avatar-img">`;
    }
    
    if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="" class="lb-avatar-img" onerror="this.src='${DEFAULT_AVATAR_URL}'">`;
    }
    
    return `<img src="${DEFAULT_AVATAR_URL}" alt="" class="lb-avatar-img">`;
}

function renderAvatarInRanking(ranking) {
    return renderAvatar(ranking);
}

function truncateName(fullName) {
    if (!fullName) return 'دانش‌آموز';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

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

async function refreshRankings() {
    vibrate(20);
    
    const refreshBtn = document.querySelector('.rankings-refresh-btn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.5';
        const svg = refreshBtn.querySelector('svg');
        if (svg) svg.style.animation = 'spin 1s linear infinite';
    }
    
    try {
        if (typeof saveRankingToSupabase === 'function') {
            saveRankingToSupabase().catch(e => console.warn('sync:', e));
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const userClass = localStorage.getItem('userClass') || 'هفتم یک';
        const studentId = localStorage.getItem('studentUUID');
        
        const rankings = await getRankingsByClass(userClass);
        
        if (rankings && rankings.length > 0) {
            currentRankings = rankings;
            currentRankingsClass = userClass;
            lastRankingsHash = getRankingsHash(currentRankings);
            
            try {
                localStorage.setItem('rankings_cache_' + userClass, JSON.stringify({
                    data: currentRankings,
                    timestamp: Date.now()
                }));
            } catch (e) {}
            
            const container = document.getElementById('rankings-content');
            if (container) {
                container.innerHTML = renderRankingsList(currentRankings, userClass, studentId);
            }
        }
    } catch (error) {
        console.error('❌ خطا:', error);
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.style.opacity = '1';
            const svg = refreshBtn.querySelector('svg');
            if (svg) svg.style.animation = '';
        }
    }
}

// ============================================================
// 🆕 باز کردن کارت پروفایل — نسخه جدید (کاور بالا)
// ============================================================
// ============================================================
// 🆕 باز کردن کارت پروفایل — مدال کنار اسم
// ============================================================
function openProfileCard(studentId) {
    const ranking = currentRankings.find(r => r.student_id === studentId);
    if (!ranking) return;
    
    vibrate(15);
    
    const rank = currentRankings.findIndex(r => r.student_id === studentId) + 1;
    const modal = document.getElementById('profile-card-modal');
    const content = document.getElementById('profile-card-content');
    
    if (!modal || !content) return;
    
    const classPersian = getClassPersianName(ranking.class_name);
    const isMe = studentId === localStorage.getItem('studentUUID');
    const medalCount = getUserEarnedMedals(ranking).length;
    
    // 🆕 تشخیص نوع آواتار
    const avatarUrl = (ranking && ranking.avatar_url) ? String(ranking.avatar_url).trim() : '';
    const DEFAULT_AVATAR_URL = 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';
    
    let isEmoji = false;
    let emojiValue = '';
    let imageUrl = '';
    
    // چک ایموجی
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '').trim();
        if (emoji && emoji !== '👤' && emoji !== '👦🏻' && emoji !== '👦') {
            isEmoji = true;
            emojiValue = emoji;
        }
    }
    
    // چک عکس
    if (!isEmoji) {
        if (avatarUrl.startsWith('data:image')) {
            imageUrl = avatarUrl;
        } else if (avatarUrl.startsWith('http')) {
            imageUrl = avatarUrl;
        } else {
            imageUrl = DEFAULT_AVATAR_URL;
        }
    }
    
    // 🆕 ساخت کاور (بالای کارت)
    let coverHTML = '';
    if (isEmoji) {
        coverHTML = `
            <div class="pc-cover-wrapper emoji-cover">
                <span class="pc-emoji-big">${emojiValue}</span>
            </div>
        `;
    } else {
        coverHTML = `
            <div class="pc-cover-wrapper">
                <img src="${imageUrl}" alt="" class="pc-cover-image" onerror="this.src='${DEFAULT_AVATAR_URL}'">
            </div>
        `;
    }
    
    // 🆕 مدال کنار اسم
    let medalHTML = '';
    if (rank === 1) medalHTML = '🥇';
    else if (rank === 2) medalHTML = '🥈';
    else if (rank === 3) medalHTML = '🥉';
    
    content.innerHTML = `
        <div class="pc-modal-card">
            <button class="pc-close-btn" onclick="closeProfileCard()">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            
            ${coverHTML}
            
            <div class="pc-modal-inner">
                <div class="pc-main-info">
                    <div class="pc-modal-name">
                        ${medalHTML ? `<span class="pc-rank-inline">${medalHTML}</span>` : ''}
                        ${ranking.name}
                        ${isMe ? '<span class="pc-modal-you-badge">شما</span>' : ''}
                    </div>
                    <div class="pc-modal-class">${classPersian}</div>
                </div>
                
                <div class="pc-modal-info-table">
                    <div class="pc-modal-info-row">
                        <span class="pc-modal-info-label">رتبه</span>
                        <span class="pc-modal-info-value">${toPersianNum(rank)} از ${toPersianNum(currentRankings.length)}</span>
                    </div>
                    <div class="pc-modal-info-row">
                        <span class="pc-modal-info-label">امتیاز کل</span>
                        <span class="pc-modal-info-value">${toPersianNum(ranking.total_points)}</span>
                    </div>
                    <div class="pc-modal-info-row">
                        <span class="pc-modal-info-label">پایه</span>
                        <span class="pc-modal-info-value">هفتم</span>
                    </div>
                    <div class="pc-modal-info-row">
                        <span class="pc-modal-info-label">کلاس</span>
                        <span class="pc-modal-info-value">${classPersian.replace('پایه هفتم ', '')}</span>
                    </div>
                </div>
                
                <div class="pc-modal-stats-title">آمار کلی</div>
                
                <div class="pc-modal-stats-grid-v2">
                    <div class="pc-modal-stat-card-v2 pc-modal-stat-yellow">
                        <div class="pc-modal-stat-icon-v2">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                            </svg>
                        </div>
                        <div class="pc-modal-stat-content-v2">
                            <div class="pc-modal-stat-label-v2">امتیاز کل</div>
                            <div class="pc-modal-stat-value-v2">${toPersianNum(ranking.total_points)}</div>
                        </div>
                    </div>
                    
                    <div class="pc-modal-stat-card-v2 pc-modal-stat-orange" onclick="openMedalsPage('${ranking.student_id}')">
                        <div class="pc-modal-stat-icon-v2">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="8" r="6"/>
                                <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                            </svg>
                        </div>
                        <div class="pc-modal-stat-content-v2">
                            <div class="pc-modal-stat-label-v2">مدال‌ها</div>
                            <div class="pc-modal-stat-value-v2">${toPersianNum(medalCount)}</div>
                        </div>
                        <div class="pc-modal-stat-arrow">›</div>
                    </div>
                    
                    <div class="pc-modal-stat-card-v2 pc-modal-stat-teal">
                        <div class="pc-modal-stat-icon-v2">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 11L12 14L22 4"/>
                                <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16"/>
                            </svg>
                        </div>
                        <div class="pc-modal-stat-content-v2">
                            <div class="pc-modal-stat-label-v2">تکالیف انجام شده</div>
                            <div class="pc-modal-stat-value-v2">${toPersianNum(ranking.completed_lessons)}</div>
                        </div>
                    </div>
                    
                    <div class="pc-modal-stat-card-v2 pc-modal-stat-purple">
                        <div class="pc-modal-stat-icon-v2">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                            </svg>
                        </div>
                        <div class="pc-modal-stat-content-v2">
                            <div class="pc-modal-stat-label-v2">درصد موفقیت</div>
                            <div class="pc-modal-stat-value-v2">${toPersianNum(ranking.avg_percent)}%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

// ============================================================
// باز کردن صفحه مدال‌ها
// ============================================================
function openMedalsPage(studentId) {
    const ranking = currentRankings.find(r => r.student_id === studentId);
    if (!ranking) return;
    
    vibrate(15);
    
    const modal = document.getElementById('user-medals-modal');
    const content = document.getElementById('user-medals-content');
    
    if (!modal || !content) return;
    
    const userMedals = getUserEarnedMedals(ranking);
    
    content.innerHTML = `
        <div class="um-modal-card">
            <button class="um-close-btn" onclick="closeUserMedals()">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            
            <div class="um-modal-header">
                <div class="um-modal-header-icon">🏆</div>
                <div class="um-modal-header-title">مدال‌های ${ranking.name}</div>
                <div class="um-modal-header-sub">${toPersianNum(userMedals.length)} مدال گرفته شده</div>
            </div>
            
            ${userMedals.length === 0 ? `
                <div class="um-modal-empty">
                    <div class="um-modal-empty-icon">🔒</div>
                    <div class="um-modal-empty-title">هنوز مدالی نگرفته!</div>
                    <div class="um-modal-empty-text">با انجام تکالیف و کسب امتیاز، مدال بگیر</div>
                </div>
            ` : `
                <div class="um-modal-medals-list">
                    ${userMedals.map(medal => `
                        <div class="um-modal-medal-item">
                            <div class="um-modal-medal-icon">${medal.icon}</div>
                            <div class="um-modal-medal-info">
                                <div class="um-modal-medal-title">${medal.title}</div>
                                <div class="um-modal-medal-desc">${medal.desc}</div>
                            </div>
                            <div class="um-modal-medal-check">✓</div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
    
    modal.classList.add('active');
}

function getUserEarnedMedals(ranking) {
    const points = ranking.total_points || 0;
    const lessons = ranking.completed_lessons || 0;
    const avg = ranking.avg_percent || 0;
    const streak = ranking.streak_days || 0;
    
    const allMedals = [
        { id: 'first', icon: '🥇', title: 'اولین قدم', desc: 'اولین تکلیف را انجام بده', check: () => lessons >= 1 },
        { id: 'diamond', icon: '💎', title: 'الماس', desc: 'تکمیل ۵ تکلیف', check: () => lessons >= 5 },
        { id: 'king', icon: '👑', title: 'پادشاه', desc: 'تکمیل ۱۰ تکلیف', check: () => lessons >= 10 },
        { id: 'accurate', icon: '🎯', title: 'دقیق', desc: 'میانگین درصد بالای ۸۰%', check: () => avg >= 80 && lessons >= 2 },
        { id: 'brilliant', icon: '🌟', title: 'درخشان', desc: 'میانگین درصد ۱۰۰%', check: () => avg >= 100 && lessons >= 3 },
        { id: 'star', icon: '⭐', title: 'ستاره', desc: 'کسب ۱۰۰ امتیاز', check: () => points >= 100 },
        { id: 'champion', icon: '🏆', title: 'قهرمان', desc: 'کسب ۳۰۰ امتیاز', check: () => points >= 300 },
        { id: 'genius', icon: '💠', title: 'نابغه', desc: 'کسب ۶۰۰ امتیاز', check: () => points >= 600 },
        { id: 'rocket', icon: '🚀', title: 'موشک', desc: 'کسب ۱۰۰۰ امتیاز', check: () => points >= 1000 },
        { id: 'smart', icon: '🧠', title: 'زیرک', desc: '۵ تکلیف با درصد ۱۰۰%', check: () => lessons >= 5 && avg >= 100 },
        { id: 'invincible', icon: '🛡️', title: 'شکست‌ناپذیر', desc: '۱۰ تکلیف با درصد بالای ۹۰%', check: () => lessons >= 10 && avg >= 90 },
        { id: 'fast', icon: '⚡', title: 'سریع', desc: 'تکمیل تکلیف زیر ۳ دقیقه', check: () => lessons >= 1 },
        { id: 'loyal', icon: '🎖️', title: 'سرباز فداکار', desc: 'فعالیت در ۷ روز مختلف', check: () => streak >= 7 },
        { id: 'beginner', icon: '🌱', title: 'تازه‌کار', desc: 'اولین امتیازت رو بگیر', check: () => points >= 10 },
        { id: 'diligent', icon: '📚', title: 'کوشا', desc: 'تکمیل ۳ تکلیف', check: () => lessons >= 3 },
        { id: 'expert', icon: '🎓', title: 'متخصص', desc: 'تکمیل ۷ تکلیف', check: () => lessons >= 7 },
        { id: 'flawless', icon: '✨', title: 'بی‌نقص', desc: '۳ تکلیف با درصد ۱۰۰%', check: () => avg >= 100 && lessons >= 3 },
        { id: 'persistent', icon: '🔥', title: 'پیگیر', desc: 'فعالیت در ۳ روز مختلف', check: () => streak >= 3 },
        { id: 'dedicated', icon: '💪', title: 'با اراده', desc: 'فعالیت در ۱۵ روز مختلف', check: () => streak >= 15 },
        { id: 'legend', icon: '🌈', title: 'افسانه', desc: 'کسب ۲۰۰۰ امتیاز', check: () => points >= 2000 }
    ];
    
    return allMedals.filter(m => m.check());
}

function closeUserMedals() {
    const modal = document.getElementById('user-medals-modal');
    if (modal) modal.classList.remove('active');
}

function closeProfileCard() {
    const modal = document.getElementById('profile-card-modal');
    if (modal) modal.classList.remove('active');
}