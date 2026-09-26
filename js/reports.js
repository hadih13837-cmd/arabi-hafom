// ============================================================
// reports.js — کارنامه، PDF، لیست کارنامه‌ها
// ============================================================

// ============================================================
// نمایش لیست کارنامه‌ها
// ============================================================
function loadReports() {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const container = document.getElementById('reports-list');
    if (reports.length === 0) {
        container.innerHTML = `<div class="report-empty"><div class="report-empty-icon">📋</div><div class="report-empty-text">هنوز کارنامه‌ای ندارید</div></div>`;
        return;
    }
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    container.innerHTML = reports.map((report, index) => `
        <div class="report-card">
            <div class="report-card-header">
                <div class="report-card-title">${report.lessonTitle}</div>
                <div class="report-card-date">${report.date}</div>
            </div>
            <div class="report-info-row"><span>درصد موفقیت:</span><span class="value blue">${toPersianNum(report.percent)}%</span></div>
            <div class="report-info-row"><span>پاسخ صحیح:</span><span class="value green">${toPersianNum(report.correct)}</span></div>
            <div class="report-info-row"><span>پاسخ غلط:</span><span class="value red">${toPersianNum(report.wrong)}</span></div>
            <div class="report-info-row"><span>امتیاز:</span><span class="value blue">${toPersianNum(report.score)} از ${toPersianNum(report.totalPoints)}</span></div>
            <button class="report-btn report-btn-download" onclick="downloadReportById(${index})">دانلود PDF</button>
        </div>
    `).join('');
}

// ============================================================
// ذخیره کارنامه
// ============================================================
function saveReport(report) {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    reports.push(report);
    localStorage.setItem('reports', JSON.stringify(reports));
}

// ============================================================
// ساخت HTML کارنامه گرافیکی
// ============================================================
function generateGraphicReport(report) {
    const avatar = localStorage.getItem('userAvatar') || 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';
    const message = report.percent >= 90 ? 'عالی بودی! ادامه بده 🌟' :
                    report.percent >= 70 ? 'خوب بود، کمی تلاش بیشتر نیاز داری 💪' :
                    report.percent >= 50 ? 'قابل قبول، اما نیاز به تمرین بیشتر داری 📚' :
                    'نیاز به تلاش بیشتر داری، ناامید نشو 🌱';
    const bookIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1976d2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5C4 18.1193 5.11929 17 6.5 17H20"/><path d="M6.5 2H20V22H6.5C5.11929 22 4 20.8807 4 19.5V4.5C4 3.11929 5.11929 2 6.5 2Z"/></svg>';
    const calendarIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#8e24aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    const clockIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#00897b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    const starIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#f57c00" stroke="#f57c00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    const checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const xIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#c62828" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    
    return `
        <div class="report-graphic-container">
            <div class="report-header-graphic">
                <div class="report-header-title">کارنامه تکلیف</div>
                <div class="report-header-sub">عربی پایه هفتم</div>
            </div>
            <div class="report-student-card">
                <div class="report-student-avatar"><img src="${avatar}" alt="دانش‌آموز"></div>
                <div class="report-student-info">
                    <div class="report-student-name">${report.studentName}</div>
                    <div class="report-student-class">کلاس: ${report.studentClass}</div>
                </div>
            </div>
            <div class="report-info-grid">
                <div class="report-info-item"><div class="report-info-icon blue">${bookIcon}</div><div class="report-info-content"><div class="report-info-label">تکلیف</div><div class="report-info-value">${report.lessonTitle}</div></div></div>
                <div class="report-info-item"><div class="report-info-icon purple">${calendarIcon}</div><div class="report-info-content"><div class="report-info-label">تاریخ</div><div class="report-info-value">${report.date}</div></div></div>
                <div class="report-info-item"><div class="report-info-icon teal">${clockIcon}</div><div class="report-info-content"><div class="report-info-label">زمان</div><div class="report-info-value">${toPersianNum(report.timeTaken)} دقیقه</div></div></div>
                <div class="report-info-item"><div class="report-info-icon yellow">${starIcon}</div><div class="report-info-content"><div class="report-info-label">امتیاز</div><div class="report-info-value">${toPersianNum(report.score)} از ${toPersianNum(report.totalPoints)}</div></div></div>
                <div class="report-info-item"><div class="report-info-icon green">${checkIcon}</div><div class="report-info-content"><div class="report-info-label">پاسخ صحیح</div><div class="report-info-value">${toPersianNum(report.correct)}</div></div></div>
                <div class="report-info-item"><div class="report-info-icon red">${xIcon}</div><div class="report-info-content"><div class="report-info-label">پاسخ غلط</div><div class="report-info-value">${toPersianNum(report.wrong)}</div></div></div>
            </div>
            <div class="report-percent-circle">
                <div class="report-percent-value">${toPersianNum(report.percent)}%</div>
                <div class="report-percent-label">درصد موفقیت</div>
            </div>
            <div class="report-message">
                <div class="report-message-title">پیام برای شما:</div>
                <div class="report-message-text">${message}</div>
            </div>
            ${report.surveyAnswer ? `
                <div class="report-survey-box">
                    <div class="report-survey-title">💬 نظر دانش‌آموز:</div>
                    <div class="report-survey-text">${report.surveyAnswer}</div>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================
// 🆕 دانلود کارنامه با تنظیمات بهینه (سریع‌تر)
// ============================================================
function downloadReportById(index) {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const report = reports[index];
    if (report) {
        const element = document.createElement('div');
        element.style.padding = '20px';
        element.style.direction = 'rtl';
        element.style.background = '#f0f7ff';
        element.style.fontFamily = 'Vazirmatn, sans-serif';
        element.style.width = '700px';  // 🆕 عرض ثابت برای کیفیت بهتر
        element.innerHTML = generateGraphicReport(report);
        const opt = {
            margin: 0.3,
            filename: `کارنامه_${report.lessonTitle}_${report.date.replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.85 },  // 🆕 کیفیت کمتر = سریع‌تر
            html2canvas: { 
                scale: 1.5,              // 🆕 scale کمتر = سریع‌تر
                useCORS: true, 
                backgroundColor: '#f0f7ff',
                logging: false,          // 🆕 لاگ نکن = سریع‌تر
                imageTimeout: 0,         // 🆕 منتظر تصاویر نمونه
                removeContainer: true    // 🆕 حذف کانتینر بعد از تولید
            },
            jsPDF: { 
                unit: 'in', 
                format: 'a4', 
                orientation: 'portrait',
                compress: true           // 🆕 PDF فشرده = سریع‌تر
            }
        };
        html2pdf().set(opt).from(element).save().then(() => {
            showModal('دانلود موفق', 'کارنامه با موفقیت دانلود شد.', '✅');
        });
    }
}

// ============================================================
// نمایش کارنامه بعد از تکلیف
// ============================================================
function showReportCard() {
    if (isPracticeMode) {
        showModal('توجه', 'این تکلیف در حالت تمرین انجام شده و کارنامه‌ای صادر نمی‌شود.', '⚠️');
        return;
    }
    const percent = Math.round((correctCount / currentLesson.questions.length) * 100);
    const timeTaken = Math.max(1, Math.round((endTime - startTime) / 60000));
    const now = new Date();
    const dateStr = now.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const lessonIndex = allLessons.findIndex(l => l.id === currentLesson.lessonId);
    const taskTitle = allLessons[lessonIndex] ? allLessons[lessonIndex].title : currentLesson.title;
    const lesson = allLessons[lessonIndex];
    const dueDate = lesson ? (lesson.dueDate || '۱۴۰۵/۰۹/۱۵') : null;
    const expired = isExpired(dueDate);
    if (expired) {
        showModal('توجه', 'مهلت این تکلیف گذشته و کارنامه‌ای صادر نمی‌شود.', '⚠️');
        return;
    }
    const report = {
        studentName: localStorage.getItem('userName'),
        studentClass: localStorage.getItem('userClass'),
        lessonId: currentLesson.lessonId,
        lessonTitle: taskTitle,
        date: dateStr,
        timestamp: now.toISOString(),
        percent, correct: correctCount, wrong: wrongCount,
        score, totalPoints: currentLesson.totalPoints, timeTaken,
        surveyAnswer: surveyAnswerText
    };
    saveReport(report);
    const container = document.getElementById('report-view-content');
    container.innerHTML = generateGraphicReport(report);
    container.innerHTML += `
        <button class="btn-primary" onclick="downloadCurrentReport()" style="margin-top: 15px;">دانلود کارنامه (PDF)</button>
        <button class="btn-primary" onclick="goToScreen('screen-home')" style="margin-top: 10px; background: linear-gradient(135deg, #546e7a 0%, #37474f 100%);">بازگشت به خانه</button>
    `;
    goToScreen('screen-report-view');
    addNotification('message', 'پیام معلم', `بازخورد تکلیف شما ثبت شد. آفرین!`);
    updateNotificationBadge();
    setTimeout(() => checkForNewMedals(), 1500);
}

// ============================================================
// 🆕 دانلود کارنامه فعلی با تنظیمات بهینه (سریع‌تر)
// ============================================================
function downloadCurrentReport() {
    const percent = Math.round((correctCount / currentLesson.questions.length) * 100);
    const timeTaken = Math.max(1, Math.round((endTime - startTime) / 60000));
    const now = new Date();
    const dateStr = now.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const lessonIndex = allLessons.findIndex(l => l.id === currentLesson.lessonId);
    const taskTitle = allLessons[lessonIndex] ? allLessons[lessonIndex].title : currentLesson.title;
    const report = {
        studentName: localStorage.getItem('userName'),
        studentClass: localStorage.getItem('userClass'),
        lessonTitle: taskTitle, date: dateStr,
        percent, correct: correctCount, wrong: wrongCount,
        score, totalPoints: currentLesson.totalPoints, timeTaken,
        surveyAnswer: surveyAnswerText
    };
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.direction = 'rtl';
    element.style.background = '#f0f7ff';
    element.style.fontFamily = 'Vazirmatn, sans-serif';
    element.style.width = '700px';  // 🆕 عرض ثابت
    element.innerHTML = generateGraphicReport(report);
    const opt = {
        margin: 0.3,
        filename: `کارنامه_${taskTitle}_${dateStr.replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.85 },  // 🆕
        html2canvas: { 
            scale: 1.5,              // 🆕
            useCORS: true, 
            backgroundColor: '#f0f7ff',
            logging: false,          // 🆕
            imageTimeout: 0,         // 🆕
            removeContainer: true    // 🆕
        },
        jsPDF: { 
            unit: 'in', 
            format: 'a4', 
            orientation: 'portrait',
            compress: true           // 🆕
        }
    };
    html2pdf().set(opt).from(element).save().then(() => {
        showModal('دانلود موفق', 'کارنامه با موفقیت دانلود شد.', '✅');
    });
}