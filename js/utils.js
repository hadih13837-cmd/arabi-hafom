// ============================================================
// utils.js — توابع کمکی، تاریخ، فصل‌ها، کانفتی، استریک
// ============================================================

// ============================================================
// توابع اعداد فارسی
// ============================================================
function toPersianNum(num) {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/\d/g, x => persianDigits[parseInt(x)]);
}

function fromPersianNum(str) {
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

// ============================================================
// تاریخ شمسی
// ============================================================
function getPersianDate() {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function getPersianDateFull() {
    return new Intl.DateTimeFormat('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
}

function getPersianWeekday() {
    return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(new Date());
}

function getPersianMonth() {
    return new Intl.DateTimeFormat('fa-IR', { month: 'long' }).format(new Date());
}

function getPersianYear() {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(new Date());
}

function getPersianDay() {
    return new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(new Date());
}

function getPersianMonthNum() {
    const num = new Intl.DateTimeFormat('fa-IR', { month: 'numeric' }).format(new Date());
    return parseInt(fromPersianNum(num));
}

function persianDateToNumber(dateStr) {
    if (!dateStr) return 0;
    const normalized = fromPersianNum(dateStr);
    const parts = normalized.split(/[\/\-]/);
    if (parts.length !== 3) return 0;
    return parseInt(parts[0]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[2]);
}

function isExpired(dueDate) {
    if (!dueDate) return false;
    return persianDateToNumber(getPersianDate()) > persianDateToNumber(dueDate);
}

function isDeadlineNear(dueDate) {
    if (!dueDate) return false;
    const due = persianDateToNumber(dueDate);
    const today = persianDateToNumber(getPersianDate());
    const diff = due - today;
    return diff >= 0 && diff <= 1;
}

function getDaysDiff(dueDate) {
    if (!dueDate) return 999;
    const due = persianDateToNumber(dueDate);
    const today = persianDateToNumber(getPersianDate());
    return due - today;
}

// ============================================================
// فصل جاری
// ============================================================
function getCurrentSeason() {
    const m = getPersianMonthNum();
    const info = MONTHS_INFO.find(mi => mi.num === m);
    return info ? info.season : 'spring';
}

// ============================================================
// ویبره
// ============================================================
function vibrate(pattern = 30) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

// ============================================================
// کانفتی (جشن و شادی)
// ============================================================
function showConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    container.classList.add('active');
    container.innerHTML = '';
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    for (let i = 0; i < 60; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
        piece.style.animationDelay = (Math.random() * 0.5) + 's';
        piece.style.width = (Math.random() * 8 + 6) + 'px';
        piece.style.height = (Math.random() * 8 + 6) + 'px';
        if (Math.random() > 0.5) piece.style.borderRadius = '50%';
        container.appendChild(piece);
    }
    setTimeout(() => {
        container.classList.remove('active');
        container.innerHTML = '';
    }, 4000);
}

// ============================================================
// استریک (تعداد روزهای متوالی)
// ============================================================
function updateStreak() {
    const today = getPersianDate();
    let streakData = JSON.parse(localStorage.getItem('streakData') || '{}');
    if (!streakData.lastDate) {
        streakData = { lastDate: today, count: 1, dates: [today] };
    } else if (streakData.lastDate !== today) {
        const lastNum = persianDateToNumber(streakData.lastDate);
        const todayNum = persianDateToNumber(today);
        if (todayNum - lastNum === 1) streakData.count += 1;
        else if (todayNum - lastNum > 1) streakData.count = 1;
        streakData.lastDate = today;
        if (!streakData.dates) streakData.dates = [];
        streakData.dates.push(today);
        if (streakData.dates.length > 400) streakData.dates = streakData.dates.slice(-400);
    }
    localStorage.setItem('streakData', JSON.stringify(streakData));
    displayStreak();
}

function displayStreak() {
    const streakData = JSON.parse(localStorage.getItem('streakData') || '{}');
    const badge = document.getElementById('streak-badge');
    const count = document.getElementById('streak-count');
    const dateInfo = document.getElementById('streak-date');
    if (badge && count && dateInfo && streakData.count > 0) {
        count.textContent = `${toPersianNum(streakData.count)} روز`;
        dateInfo.textContent = `${getPersianWeekday()}، ${getPersianDay()} ${getPersianMonth()} ${getPersianYear()}`;
        badge.style.display = 'flex';
    }
}

function getVisitedDates() {
    const streakData = JSON.parse(localStorage.getItem('streakData') || '{}');
    return streakData.dates || [];
}

// ============================================================
// پیام استریک
// ============================================================
function showStreakMessage() {
    const today = getPersianDate();
    const lastShown = localStorage.getItem('lastStreakMessageShown');
    if (lastShown === today) return;
    const streakData = JSON.parse(localStorage.getItem('streakData') || '{}');
    const count = streakData.count || 1;
    const season = getCurrentSeason();
    const seasonInfo = SEASONS_INFO[season];
    const overlay = document.getElementById('streak-message-overlay');
    const card = document.getElementById('streak-message-card');
    const emoji = document.getElementById('streak-emoji');
    const title = document.getElementById('streak-title');
    const text = document.getElementById('streak-text');
    const countBadge = document.getElementById('streak-count-badge');
    card.classList.remove('spring', 'summer', 'autumn', 'winter');
    card.classList.add(season);
    let titleText = '';
    let textMain = '';
    if (count === 1) {
        titleText = `${seasonInfo.icon} خوش آمدی!`;
        textMain = `اولین روزت در برنامه است. امیدواریم این مسیر پر از یادگیری و موفقیت باشه! 🌟`;
    } else if (count < 7) {
        titleText = `${seasonInfo.icon} آفرین!`;
        textMain = `تو داری مسیر یادگیری رو ادامه میدی. همین‌طور ادامه بده تا به هدفت برسی! 💪`;
    } else if (count < 30) {
        titleText = `${seasonInfo.icon} فوق‌العاده!`;
        textMain = `یک هفته‌ست که هر روز وارد برنامه میشی! واقعاً عالیه! به تلاشت افتخار می‌کنیم 🏆`;
    } else {
        titleText = `${seasonInfo.icon} قهرمان!`;
        textMain = `تو یه قهرمان واقعی هستی! ${toPersianNum(count)} روز متوالیه که داری یاد می‌گیری. بهت افتخار می‌کنیم! 👑`;
    }
    emoji.textContent = seasonInfo.emoji;
    title.textContent = titleText;
    text.innerHTML = textMain + `<br><br>${seasonInfo.name}ه و ${seasonInfo.desc} ${seasonInfo.icon}`;
    countBadge.textContent = `🔥 ${toPersianNum(count)} روز متوالی`;
    localStorage.setItem('lastStreakMessageShown', today);
    overlay.classList.add('active');
    vibrate([30, 50, 30]);
}

function closeStreakMessage() {
    const overlay = document.getElementById('streak-message-overlay');
    const card = document.getElementById('streak-message-card');
    card.classList.add('shrinking');
    setTimeout(() => {
        overlay.classList.remove('active');
        card.classList.remove('shrinking');
    }, 800);
}

// ============================================================
// تقویم
// ============================================================
let calendarCurrentMonth = null;

function initCalendarMonth() {
    if (calendarCurrentMonth) return;
    const y = parseInt(fromPersianNum(getPersianYear()));
    const m = getPersianMonthNum();
    calendarCurrentMonth = { year: y, month: m };
}

function persianToGregorianJS(jy, jm, jd) {
    jy += 1595;
    let days = -355668 + (365 * jy) + (~~(jy / 33) * 8) + ~~(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * ~~(days / 146097);
    days %= 146097;
    if (days > 36524) {
        gy += 100 * ~~(--days / 36524);
        days %= 36524;
        if (days >= 365) days++;
    }
    gy += 4 * ~~(days / 1461);
    days %= 1461;
    if (days > 365) {
        gy += ~~((days - 1) / 365);
        days = (days - 1) % 365;
    }
    let gd = days + 1;
    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0;
    for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return new Date(gy, gm - 1, gd);
}

function getFirstDayOfWeek(year, month) {
    const gDate = persianToGregorianJS(year, month, 1);
    const jsDay = gDate.getDay();
    const map = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
    return map[jsDay];
}

function renderCalendar() {
    const container = document.getElementById('calendar-content');
    const screen = document.getElementById('screen-calendar');
    if (!container) return;
    initCalendarMonth();
    const today = getPersianDate();
    const todayNum = persianDateToNumber(today);
    const visitedDates = getVisitedDates();
    const visitedNums = visitedDates.map(d => persianDateToNumber(d));
    const { year, month } = calendarCurrentMonth;
    const monthInfo = MONTHS_INFO.find(mi => mi.num === month);
    const season = monthInfo.season;
    const seasonInfo = SEASONS_INFO[season];
    screen.classList.remove('season-spring', 'season-summer', 'season-autumn', 'season-winter');
    screen.classList.add(`season-${season}`);
    const daysInMonth = monthInfo.days;
    const firstDayOfWeek = getFirstDayOfWeek(year, month);
    const canGoPrev = !(year === 1405 && month === 7);
    const canGoNext = !(year === 1406 && month === 3);
    let html = `
        <div class="calendar-season-banner ${season}">
            <div class="calendar-season-icon">${seasonInfo.icon}</div>
            <div class="calendar-season-text">
                <div class="calendar-season-name">${seasonInfo.name}</div>
                <div class="calendar-season-desc">${seasonInfo.desc} - امروز: ${getPersianDateFull()}</div>
            </div>
        </div>
        <div class="calendar-month-card ${season}">
            <div class="calendar-month-header">
                <button class="calendar-nav-btn" onclick="changeCalendarMonth(-1)" ${!canGoPrev ? 'disabled' : ''} title="ماه قبل">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <div class="calendar-month-name">
                    <span class="calendar-month-icon">${monthInfo.icon}</span>
                    <span>${monthInfo.name}</span>
                </div>
                <button class="calendar-nav-btn" onclick="changeCalendarMonth(1)" ${!canGoNext ? 'disabled' : ''} title="ماه بعد">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
            </div>
            <div class="calendar-month-year" style="text-align: center; margin-bottom: 12px; font-size: 14px; color: #78909c; font-weight: bold;">
                سال ${toPersianNum(year)}
            </div>
            <div class="calendar-weekdays">
                <div class="calendar-weekday">شنبه</div>
                <div class="calendar-weekday">یک‌شنبه</div>
                <div class="calendar-weekday">دوشنبه</div>
                <div class="calendar-weekday">سه‌شنبه</div>
                <div class="calendar-weekday">چهارشنبه</div>
                <div class="calendar-weekday">پنج‌شنبه</div>
                <div class="calendar-weekday">جمعه</div>
            </div>
            <div class="calendar-days-grid">
    `;
    for (let i = 0; i < firstDayOfWeek; i++) html += `<div class="calendar-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dayNum = year * 10000 + month * 100 + d;
        const isToday = (dayNum === todayNum);
        const isVisited = visitedNums.includes(dayNum);
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (isVisited) classes += ' visited';
        html += `<div class="${classes}"><span>${toPersianNum(d)}</span></div>`;
    }
    html += `
            </div>
        </div>
        <div class="calendar-legend">
            <div class="calendar-legend-item"><div class="calendar-legend-circle"></div><span>روزهای ورود شما</span></div>
            <div class="calendar-legend-item"><div class="calendar-legend-today"></div><span>امروز</span></div>
        </div>
    `;
    container.innerHTML = html;
}

function changeCalendarMonth(delta) {
    if (!calendarCurrentMonth) initCalendarMonth();
    let { year, month } = calendarCurrentMonth;
    month += delta;
    if (month > 12) { month = 1; year += 1; }
    if (month < 1) { month = 12; year -= 1; }
    const startNum = 1405 * 100 + 7;
    const endNum = 1406 * 100 + 3;
    const currentNum = year * 100 + month;
    if (currentNum < startNum || currentNum > endNum) return;
    calendarCurrentMonth = { year, month };
    vibrate(15);
    renderCalendar();
}