// ============================================================
// lessons.js — سیستم تکالیف (لیست، فیلتر، جزئیات، شروع)
// ============================================================

// متغیرهای سراسری تکالیف
let allLessons = [];
let currentLesson = null;
let currentFilter = 'all';
let isPracticeMode = false;
let pendingLessonId = null;
let searchQuery = '';

// ============================================================
// بارگذاری لیست تکالیف
// ============================================================
async function loadLessonsList() {
    try {
        const response = await fetch('./lessons/index.json');
        if (!response.ok) throw new Error('خطا در بارگذاری');
        const data = await response.json();
        allLessons = data.lessons;
        renderLessonsList();
        checkNewLessons();
    } catch (error) {
        console.error('خطا:', error);
        document.getElementById('lessons-list').innerHTML = `
            <div class="report-empty">
                <div class="report-empty-icon">📭</div>
                <div class="report-empty-text">هنوز تکلیفی وجود ندارد</div>
            </div>
        `;
    }
}

// ============================================================
// فیلتر تکالیف
// ============================================================
function filterLessons(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLessonsList();
}

// ============================================================
// جستجو در تکالیف
// ============================================================
function searchLessons(query) {
    searchQuery = query.toLowerCase().trim();
    renderLessonsList();
}

// ============================================================
// رندر لیست تکالیف
// ============================================================
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
        const lessonDueDate = lesson.dueDate || '۱۴۰۵/۰۹/۱۵';
        const expired = isExpired(lessonDueDate);
        const isNearDeadline = !expired && !isCompleted && isDeadlineNear(lessonDueDate);
        return {
            ...lesson, isCompleted, isPaused, isExpired: expired, isNearDeadline,
            colorIndex: index % 6,
            taskTitle: lesson.title || LESSON_TITLES[index] || `تکلیف ${toPersianNum(index + 1)}`,
            dueDate: lessonDueDate
        };
    });
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
        let progressPercent = 0;
        let btnClass = '';
        let btnText = 'مشاهده';
        if (lesson.isCompleted) {
            progressPercent = 100; btnClass = 'completed'; btnText = 'مشاهده';
        } else if (lesson.isPaused && currentProgress) {
            progressPercent = Math.round((currentProgress.questionIndex / currentProgress.totalQuestions) * 100);
            btnClass = 'paused'; btnText = 'ادامه';
        } else if (lesson.isExpired) {
            progressPercent = 0; btnClass = 'expired'; btnText = 'انجام تکلیف';
        } else if (lesson.isNearDeadline) {
            progressPercent = 0; btnClass = 'warning'; btnText = 'عجله کن!';
        } else {
            progressPercent = 0; btnText = 'مشاهده';
        }
        const circumference = 2 * Math.PI * 20;
        const dashOffset = circumference * (1 - progressPercent / 100);
        const bookData = BOOK_VECTORS[lesson.colorIndex];
        let badgeHTML = '';
        if (lesson.isCompleted) {
            badgeHTML = `<div class="lesson-completed-badge"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>`;
        } else if (lesson.isExpired && !lesson.isCompleted) {
            badgeHTML = `<div class="lesson-expired-badge"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`;
        } else if (lesson.isNearDeadline) {
            badgeHTML = `<div class="lesson-warning-badge"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>`;
        }
        const borderColor = bookData.color + '44';
        const bgColor = bookData.colorLight;
        const progressTextColor = progressPercent === 100 ? '#2e7d32' : bookData.color;
        const progressTextClass = progressPercent === 100 ? 'full-progress' : '';
        let deadlineClass = '';
        let deadlineText = `مهلت: ${lesson.dueDate}`;
        if (lesson.isExpired && !lesson.isCompleted) {
            deadlineClass = 'expired';
            deadlineText = `مهلت گذشته: ${lesson.dueDate}`;
        } else if (lesson.isNearDeadline) {
            deadlineClass = 'warning';
            const daysLeft = getDaysDiff(lesson.dueDate);
            deadlineText = daysLeft === 0 ? `⏰ مهلت امروز!` : `⏰ فقط ${toPersianNum(daysLeft)} روز مونده!`;
        }
        return `
            <div class="lesson-card" style="border-color: ${borderColor};">
                <div class="lesson-card-book" style="background: ${bgColor}; border: 1.5px solid ${borderColor};">
                    <img src="${bookData.url}" alt="کتاب">
                    ${badgeHTML}
                </div>
                <div class="lesson-card-info">
                    <div class="lesson-card-title" style="color: ${bookData.color};">${lesson.taskTitle}${lesson.subtitle ? ' - ' + lesson.subtitle : ''}</div>
                    <div class="lesson-card-deadline ${deadlineClass}">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>${deadlineText}</span>
                    </div>
                    <button class="lesson-view-btn ${btnClass}" onclick="event.stopPropagation(); openLessonDetail('${lesson.id}')">
                        ${btnText}
                    </button>
                </div>
                <div class="lesson-progress-circle">
                    <svg viewBox="0 0 50 50">
                        <circle class="lesson-progress-bg" cx="25" cy="25" r="20"></circle>
                        <circle class="lesson-progress-bar ${lesson.isCompleted ? 'completed' : (lesson.isPaused ? 'paused' : '')}" cx="25" cy="25" r="20"
                            stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"></circle>
                    </svg>
                    <div class="lesson-progress-text ${progressTextClass}" style="color: ${progressTextColor};">${toPersianNum(progressPercent)}%</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// باز کردن جزئیات تکلیف
// ============================================================
function openLessonDetail(lessonId) {
    const lesson = allLessons.find(l => l.id === lessonId);
    if (!lesson) return;
    const lessonIndex = allLessons.findIndex(l => l.id === lessonId);
    const colorIndex = lessonIndex % 6;
    const bookData = BOOK_VECTORS[colorIndex];
    const taskTitle = lesson.title || LESSON_TITLES[lessonIndex] || `تکلیف ${toPersianNum(lessonIndex + 1)}`;
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const isCompleted = reports.some(r => r.lessonId === lessonId);
    const currentProgress = getCurrentProgress();
    const isPaused = currentProgress && currentProgress.lessonId === lessonId;
    const dueDate = lesson.dueDate || '۱۴۰۵/۰۹/۱۵';
    const expired = isExpired(dueDate);
    const isNearDeadline = !expired && !isCompleted && isDeadlineNear(dueDate);
    const activityCount = lesson.activityCount || 10;
    const estimatedTime = lesson.estimatedTime || 10;
    const description = lesson.description || 'در این تکلیف، با واژگان جدید، ترجمه و عبارات مهم درس اول آشنا می‌شوید. موفق باشید!';
    let expiredWarningHTML = '';
    if (expired && !isCompleted) {
        expiredWarningHTML = `
            <div class="expired-warning">
                <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div class="expired-warning-text">
                    <div class="expired-warning-title">مهلت این تکلیف گذشته!</div>
                    <div class="expired-warning-desc">شما می‌توانید تکلیف را برای تمرین انجام دهید، اما نمره و کارنامه‌ای صادر نمی‌شود.</div>
                </div>
            </div>
        `;
    } else if (isNearDeadline) {
        const daysLeft = getDaysDiff(dueDate);
        const timeText = daysLeft === 0 ? 'امروز' : daysLeft === 1 ? 'فردا' : `${toPersianNum(daysLeft)} روز دیگه`;
        expiredWarningHTML = `
            <div class="deadline-warning-box">
                <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div class="deadline-warning-text">
                    <div class="deadline-warning-title">⚠️ مهلت داره تموم میشه!</div>
                    <div class="deadline-warning-desc">فقط ${timeText} مونده تا مهلت این تکلیف تموم بشه. سریع انجامش بده!</div>
                </div>
            </div>
        `;
    }
    let startBtnHTML = '';
    if (isCompleted) {
        startBtnHTML = `<button class="lesson-start-btn" style="background: linear-gradient(135deg, ${bookData.color}, ${bookData.color}dd); box-shadow: 0 6px 20px ${bookData.color}66;" onclick="startLesson('${lessonId}')"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>مشاهده دوباره (تمرین)</span></button>`;
    } else if (expired) {
        startBtnHTML = `<button class="lesson-start-btn" style="background: linear-gradient(135deg, #ef5350, #c62828); box-shadow: 0 6px 20px rgba(198, 40, 40, 0.4);" onclick="startLesson('${lessonId}')"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>انجام تمرینی (بدون نمره)</span></button>`;
    } else if (isPaused) {
        startBtnHTML = `<button class="lesson-start-btn" style="background: linear-gradient(135deg, #ff9800, #f57c00); box-shadow: 0 6px 20px rgba(245, 124, 0, 0.4);" onclick="startLesson('${lessonId}')"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>ادامه تکلیف</span></button>`;
    } else {
        startBtnHTML = `<button class="lesson-start-btn" style="background: linear-gradient(135deg, ${bookData.color}, ${bookData.color}dd); box-shadow: 0 6px 20px ${bookData.color}66;" onclick="startLesson('${lessonId}')"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>شروع تکلیف</span></button>`;
    }
    const content = document.getElementById('lesson-detail-content');
    content.innerHTML = `
        <div class="lesson-detail-banner" style="background: ${bookData.colorLight}; border: 2px solid ${bookData.color}44;">
            <div class="lesson-detail-banner-content">
                <div class="lesson-detail-book"><img src="${bookData.url}" alt="کتاب"></div>
                <div class="lesson-detail-title" style="color: ${bookData.color};">${taskTitle}</div>
                <div class="lesson-detail-subtitle" style="color: ${bookData.color};">${lesson.subtitle || ''}</div>
            </div>
        </div>
        ${expiredWarningHTML}
        <div class="lesson-info-card">
            <div class="lesson-info-row">
                <div class="lesson-info-right">
                    <div class="lesson-info-icon green"><svg viewBox="0 0 24 24"><path d="M9 11L12 14L22 4"/><path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16"/></svg></div>
                    <span>تعداد فعالیت‌ها:</span>
                </div>
                <span class="lesson-info-value">${toPersianNum(activityCount)}</span>
            </div>
            <div class="lesson-info-row">
                <div class="lesson-info-right">
                    <div class="lesson-info-icon orange"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                    <span>مدت زمان تقریبی:</span>
                </div>
                <span class="lesson-info-value">${toPersianNum(estimatedTime)} دقیقه</span>
            </div>
            <div class="lesson-info-row">
                <div class="lesson-info-right">
                    <div class="lesson-info-icon purple"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                    <span>مهلت انجام:</span>
                </div>
                <span class="lesson-info-value">${dueDate}</span>
            </div>
        </div>
        <div class="lesson-description">${description}</div>
        ${startBtnHTML}
    `;
    goToScreen('screen-lesson-detail');
}

// ============================================================
// ذخیره و بازیابی پیشرفت تکلیف
// ============================================================
function saveCurrentProgress() {
    if (!currentLesson) return;
    const progress = {
        lessonId: currentLesson.lessonId,
        questionIndex: currentQuestionIndex,
        score, correctCount, wrongCount,
        isPracticeMode,
        startTime: startTime ? startTime.getTime() : Date.now(),
        totalQuestions: currentLesson.questions.length,
        lessonTitle: currentLesson.title
    };
    localStorage.setItem('currentLessonProgress', JSON.stringify(progress));
}

function getCurrentProgress() {
    const data = localStorage.getItem('currentLessonProgress');
    if (!data) return null;
    try { return JSON.parse(data); } catch(e) { return null; }
}

function clearCurrentProgress() {
    localStorage.removeItem('currentLessonProgress');
}

// ============================================================
// شروع تکلیف
// ============================================================
async function startLesson(lessonId) {
    const lesson = allLessons.find(l => l.id === lessonId);
    const dueDate = lesson ? (lesson.dueDate || '۱۴۰۵/۰۹/۱۵') : null;
    const expired = isExpired(dueDate);
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const alreadyDone = reports.some(r => r.lessonId === lessonId);
    if (expired && !alreadyDone) {
        await runLesson(lessonId, true, 0, true);
        return;
    }
    const progress = getCurrentProgress();
    if (progress && progress.lessonId === lessonId && !alreadyDone) {
        await runLesson(lessonId, progress.isPracticeMode, progress.questionIndex);
        return;
    }
    if (alreadyDone) {
        pendingLessonId = lessonId;
        document.getElementById('repeat-modal').classList.add('active');
        return;
    }
    await runLesson(lessonId, false, 0);
}

// ============================================================
// اجرای تکلیف
// ============================================================
async function runLesson(lessonId, practiceMode, startFromIndex = 0, forcePracticeMode = false) {
    try {
        const lessonMeta = allLessons.find(l => l.id === lessonId);
        if (!lessonMeta) return;
        const response = await fetch('./lessons/' + lessonMeta.file);
        if (!response.ok) throw new Error('خطا در بارگذاری');
        currentLesson = await response.json();
        const lessonIndex = allLessons.findIndex(l => l.id === lessonId);
        const taskTitle = lessonMeta.title || LESSON_TITLES[lessonIndex] || `تکلیف ${toPersianNum(lessonIndex + 1)}`;
        if (startFromIndex > 0 && !practiceMode) {
            const progress = getCurrentProgress();
            if (progress && progress.lessonId === lessonId) {
                currentQuestionIndex = progress.questionIndex;
                score = progress.score;
                correctCount = progress.correctCount;
                wrongCount = progress.wrongCount;
                isPracticeMode = progress.isPracticeMode;
                startTime = new Date(progress.startTime);
            } else {
                currentQuestionIndex = 0;
                score = 0;
                correctCount = 0;
                wrongCount = 0;
                isPracticeMode = practiceMode || forcePracticeMode;
                startTime = new Date();
            }
        } else {
            currentQuestionIndex = startFromIndex;
            score = 0;
            correctCount = 0;
            wrongCount = 0;
            isPracticeMode = practiceMode || forcePracticeMode;
            startTime = new Date();
        }
        document.getElementById('quiz-lesson-title').textContent = taskTitle;
        goToScreen('screen-quiz');
        renderQuestion();
    } catch (error) {
        console.error('خطا:', error);
        showModal('خطا', 'مشکلی در بارگذاری تکلیف پیش آمد.', '❌');
    }
}