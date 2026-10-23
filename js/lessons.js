// ============================================================
// lessons.js — سیستم تکالیف
// نسخه: ۱۰.۰.۰ — رفع مشکل مخفی شدن تکلیف "همه کلاس‌ها"
// ============================================================

let allLessons = [];
let currentLesson = null;
let currentFilter = 'all';
let isPracticeMode = false;
let pendingLessonId = null;
let searchQuery = '';
let customLessonStatus = {}; 
let customClassStatus = {}; 

async function loadCustomLessonStatus() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        const userClass = localStorage.getItem('userClass');
        
        customLessonStatus = {};
        customClassStatus = {};
        
        if (!studentId || !userClass) return;
        
        const client = getSupabase();
        if (!client) return;
        
        const classNameSlug = classNameToSlug(userClass);
        
        // ۱. گرفتن وضعیت‌های شخصی
        if (typeof getStudentLessonStatus === 'function') {
            customLessonStatus = await getStudentLessonStatus(studentId);
        }
        
        // ۲. 🆕 گرفتن وضعیت‌های کلاسی (هم برای کلاس خودش، هم برای 'all')
        const { data: classData, error: classError } = await client
            .from('lesson_status')
            .select('*')
            .in('class_name', [classNameSlug, 'all']);
        
        if (!classError && classData) {
            classData.forEach(item => {
                // اگر رکورد برای 'all' باشد، آن را در customClassStatus ذخیره می‌کنیم
                // اگر برای کلاس خودش باشد، آن را هم ذخیره می‌کنیم (اولویت با کلاس خودش)
                if (item.class_name === 'all') {
                    if (!customClassStatus[item.lesson_id]) {
                        customClassStatus[item.lesson_id] = {
                            is_enabled: item.is_enabled !== false,
                            custom_due_date: item.custom_due_date || null
                        };
                    }
                } else if (item.class_name === classNameSlug) {
                    customClassStatus[item.lesson_id] = {
                        is_enabled: item.is_enabled !== false,
                        custom_due_date: item.custom_due_date || null
                    };
                }
            });
        }
        
        console.log('📋 وضعیت شخصی:', customLessonStatus);
        console.log('📋 وضعیت کلاسی:', customClassStatus);
        
    } catch (error) {
        console.error('خطا در loadCustomLessonStatus:', error);
    }
}

function isLessonEnabled(lesson) {
    const custom = customLessonStatus[lesson.id];
    if (custom) return custom.is_enabled !== false;
    
    const classCustom = customClassStatus[lesson.id];
    if (classCustom) return classCustom.is_enabled !== false;
    
    return true;
}

function getEffectiveDueDate(lesson) {
    const custom = customLessonStatus[lesson.id];
    if (custom && custom.custom_due_date) return custom.custom_due_date;
    
    const classCustom = customClassStatus[lesson.id];
    if (classCustom && classCustom.custom_due_date) return classCustom.custom_due_date;
    
    return lesson.dueDate || '۱۴۰۵/۰۹/۱۵';
}

function isLessonExpired(lesson) {
    return isExpired(getEffectiveDueDate(lesson));
}

async function loadLessonsList() {
    try {
        await loadCustomLessonStatus();
        const response = await fetch('./lessons/index.json');
        if (!response.ok) throw new Error('خطا');
        const data = await response.json();
        allLessons = data.lessons;
        renderLessonsList();
        checkNewLessons();
    } catch (error) {
        document.getElementById('lessons-list').innerHTML = `<div class="report-empty"><div class="report-empty-icon">📭</div><div class="report-empty-text">هنوز تکلیفی وجود ندارد</div></div>`;
    }
}

function filterLessons(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLessonsList();
}

function searchLessons(query) {
    searchQuery = query.toLowerCase().trim();
    renderLessonsList();
}

function renderLessonsList() {
    const container = document.getElementById('lessons-list');
    if (allLessons.length === 0) {
        container.innerHTML = `<div class="report-empty"><div class="report-empty-icon">📭</div><div class="report-empty-text">هنوز تکلیفی وجود ندارد</div></div>`;
        return;
    }
    
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const completedLessonIds = reports.map(r => r.lessonId);
    const currentProgress = getCurrentProgress();
    
    let lessonsToShow = allLessons.map((lesson, index) => {
        const isCompleted = completedLessonIds.includes(lesson.id);
        const isPaused = currentProgress && currentProgress.lessonId === lesson.id;
        const lessonDueDate = getEffectiveDueDate(lesson);
        const expired = isExpired(lessonDueDate);
        const isNearDeadline = !expired && !isCompleted && isDeadlineNear(lessonDueDate);
        const isEnabled = isLessonEnabled(lesson);
        
        return {
            ...lesson, isCompleted, isPaused, isExpired: expired, isNearDeadline,
            isEnabled,
            colorIndex: index % 6,
            taskTitle: lesson.title || LESSON_TITLES[index] || `تکلیف ${toPersianNum(index + 1)}`,
            dueDate: lessonDueDate
        };
    });
    
    // 🆕 فیلتر کردن تکالیف غیرفعال
    lessonsToShow = lessonsToShow.filter(l => l.isEnabled || l.isCompleted);
    
    if (currentFilter === 'completed') lessonsToShow = lessonsToShow.filter(l => l.isCompleted);
    else if (currentFilter === 'in-progress') lessonsToShow = lessonsToShow.filter(l => !l.isCompleted);
    
    if (searchQuery) {
        lessonsToShow = lessonsToShow.filter(l =>
            l.taskTitle.toLowerCase().includes(searchQuery) ||
            (l.subtitle && l.subtitle.toLowerCase().includes(searchQuery))
        );
    }
    
    if (lessonsToShow.length === 0) {
        container.innerHTML = `<div class="report-empty"><div class="report-empty-icon">🔍</div><div class="report-empty-text">موردی یافت نشد</div></div>`;
        return;
    }
    
    container.innerHTML = lessonsToShow.map((lesson) => {
        let progressPercent = 0, btnClass = '', btnText = 'مشاهده';
        if (lesson.isCompleted) { progressPercent = 100; btnClass = 'completed'; btnText = 'مشاهده'; }
        else if (lesson.isPaused && currentProgress) { progressPercent = Math.round((currentProgress.questionIndex / currentProgress.totalQuestions) * 100); btnClass = 'paused'; btnText = 'ادامه'; }
        else if (lesson.isExpired) { progressPercent = 0; btnClass = 'expired'; btnText = 'انجام تکلیف'; }
        else if (lesson.isNearDeadline) { progressPercent = 0; btnClass = 'warning'; btnText = 'عجله کن!'; }
        
        const circumference = 2 * Math.PI * 20;
        const dashOffset = circumference * (1 - progressPercent / 100);
        const bookData = BOOK_VECTORS[lesson.colorIndex];
        
        let badgeHTML = '';
        if (lesson.isCompleted) badgeHTML = `<div class="lesson-completed-badge"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>`;
        else if (lesson.isExpired && !lesson.isCompleted) badgeHTML = `<div class="lesson-expired-badge"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`;
        else if (lesson.isNearDeadline) badgeHTML = `<div class="lesson-warning-badge"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>`;
        
        let deadlineClass = '', deadlineText = `مهلت: ${lesson.dueDate}`;
        if (lesson.isExpired && !lesson.isCompleted) { deadlineClass = 'expired'; deadlineText = `مهلت گذشته: ${lesson.dueDate}`; }
        else if (lesson.isNearDeadline) { deadlineClass = 'warning'; const daysLeft = getDaysDiff(lesson.dueDate); deadlineText = daysLeft === 0 ? `⏰ مهلت امروز!` : `⏰ فقط ${toPersianNum(daysLeft)} روز مونده!`; }
        
        return `
            <div class="lesson-card" style="border-color: ${bookData.color}44;">
                <div class="lesson-card-book" style="background: ${bookData.colorLight}; border: 1.5px solid ${bookData.color}44;">
                    <img src="${bookData.url}" alt="کتاب">${badgeHTML}
                </div>
                <div class="lesson-card-info">
                    <div class="lesson-card-title" style="color: ${bookData.color};">${lesson.taskTitle}${lesson.subtitle ? ' - ' + lesson.subtitle : ''}</div>
                    <div class="lesson-card-deadline ${deadlineClass}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>${deadlineText}</span></div>
                    <button class="lesson-view-btn ${btnClass}" onclick="event.stopPropagation(); openLessonDetail('${lesson.id}')">${btnText}</button>
                </div>
                <div class="lesson-progress-circle">
                    <svg viewBox="0 0 50 50"><circle class="lesson-progress-bg" cx="25" cy="25" r="20"></circle><circle class="lesson-progress-bar ${lesson.isCompleted ? 'completed' : (lesson.isPaused ? 'paused' : '')}" cx="25" cy="25" r="20" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"></circle></svg>
                    <div class="lesson-progress-text ${progressPercent === 100 ? 'full-progress' : ''}" style="color: ${progressPercent === 100 ? '#2e7d32' : bookData.color};">${toPersianNum(progressPercent)}%</div>
                </div>
            </div>
        `;
    }).join('');
}

// (توابع openLessonDetail, saveCurrentProgress, startLesson, showExitLessonModal, ... بدون تغییر از نسخه قبلی کپی کن)