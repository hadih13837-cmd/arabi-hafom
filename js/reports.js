// ============================================================
// reports.js — کارنامه، PDF، لیست کارنامه‌ها، ثبت امتیاز
// نسخه: ۸.۰.۰ — با ذخیره در Supabase برای پنل معلم
// ============================================================

// ============================================================
// متغیرهای پیش‌نمایش PDF
// ============================================================
let currentPreviewReport = null;
let currentPreviewFilename = '';
let currentPreviewSource = '';
let currentPreviewIndex = -1;

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
            
            <div class="report-card-buttons">
                <button class="report-btn report-btn-view" onclick="viewReportById(${index})">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        <circle cx="12" cy="12" r="3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                    <span>مشاهده</span>
                </button>
                <button class="report-btn report-btn-download" onclick="downloadReportById(${index})">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        <polyline points="7 10 12 15 17 10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        <line x1="12" y1="15" x2="12" y2="3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>دانلود</span>
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================================
// 🆕 ذخیره کارنامه (localStorage + Supabase)
// ============================================================
async function saveReport(report) {
    // ذخیره در localStorage (مثل قبل)
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    reports.push(report);
    localStorage.setItem('reports', JSON.stringify(reports));
    
    // 🆕 ذخیره در Supabase برای نمایش در پنل معلم
    try {
        const client = getSupabase();
        if (!client) {
            console.warn('⚠️ Supabase Client موجود نیست');
            return;
        }
        
        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) {
            console.warn('⚠️ studentUUID موجود نیست');
            return;
        }
        
        const payload = {
            student_id: studentId,
            lesson_id: report.lessonId,
            lesson_title: report.lessonTitle,
            percent: report.percent || 0,
            score: report.score || 0,
            total_points: report.totalPoints || 0,
            correct: report.correct || 0,
            wrong: report.wrong || 0,
            time_taken: report.timeTaken || 0,
            created_at: new Date().toISOString()
        };
        
        console.log('📤 ذخیره کارنامه در Supabase:', payload);
        
        const { data, error } = await client
            .from('reports')
            .insert(payload)
            .select();
        
        if (error) {
            console.error('❌ خطا در ذخیره کارنامه در Supabase:', error.message);
        } else {
            console.log('✅ کارنامه در Supabase ذخیره شد:', data);
        }
    } catch (e) {
        console.error('❌ خطا:', e);
    }
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
        <div class="report-graphic-container" style="background: #fff; padding: 25px 20px; border-radius: 20px; direction: rtl; font-family: 'Vazirmatn', sans-serif;">
            <div class="report-header-graphic" style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px dashed #e3f2fd;">
                <div class="report-header-title" style="font-size: 24px; font-weight: 900; color: #1976d2; margin-bottom: 5px;">کارنامه تکلیف</div>
                <div class="report-header-sub" style="font-size: 13px; color: #90a4ae; font-weight: bold;">عربی پایه هفتم</div>
            </div>
            <div class="report-student-card" style="background: #e3f2fd; border-radius: 18px; padding: 18px; display: flex; align-items: center; gap: 15px; margin-bottom: 20px; border: 2px solid #bbdefb;">
                <div class="report-student-avatar" style="width: 70px; height: 70px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 3px solid #fff; flex-shrink: 0;">
                    <img src="${avatar}" alt="دانش‌آموز" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="report-student-info" style="flex: 1;">
                    <div class="report-student-name" style="font-size: 18px; font-weight: 900; color: #1565c0; margin-bottom: 5px;">${report.studentName}</div>
                    <div class="report-student-class" style="font-size: 13px; color: #1976d2; font-weight: bold;">کلاس: ${report.studentClass}</div>
                </div>
            </div>
            <div class="report-info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <div class="report-info-item" style="background: #f8f9fa; border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 10px; border: 1.5px solid #e3f2fd;">
                    <div class="report-info-icon blue" style="width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #e3f2fd;">${bookIcon}</div>
                    <div class="report-info-content" style="flex: 1; min-width: 0;">
                        <div class="report-info-label" style="font-size: 11px; color: #78909c; font-weight: bold; margin-bottom: 3px;">تکلیف</div>
                        <div class="report-info-value" style="font-size: 15px; font-weight: 900; color: #333;">${report.lessonTitle}</div>
                    </div>
                </div>
                <div class="report-info-item" style="background: #f8f9fa; border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 10px; border: 1.5px solid #e3f2fd;">
                    <div class="report-info-icon purple" style="width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #f3e5f5;">${calendarIcon}</div>
                    <div class="report-info-content" style="flex: 1; min-width: 0;">
                        <div class="report-info-label" style="font-size: 11px; color: #78909c; font-weight: bold; margin-bottom: 3px;">تاریخ</div>
                        <div class="report-info-value" style="font-size: 15px; font-weight: 900; color: #333;">${report.date}</div>
                    </div>
                </div>
                <div class="report-info-item" style="background: #f8f9fa; border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 10px; border: 1.5px solid #e3f2fd;">
                    <div class="report-info-icon teal" style="width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #e0f2f1;">${clockIcon}</div>
                    <div class="report-info-content" style="flex: 1; min-width: 0;">
                        <div class="report-info-label" style="font-size: 11px; color: #78909c; font-weight: bold; margin-bottom: 3px;">زمان</div>
                        <div class="report-info-value" style="font-size: 15px; font-weight: 900; color: #333;">${toPersianNum(report.timeTaken)} دقیقه</div>
                    </div>
                </div>
                <div class="report-info-item" style="background: #f8f9fa; border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 10px; border: 1.5px solid #e3f2fd;">
                    <div class="report-info-icon yellow" style="width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #fff8e1;">${starIcon}</div>
                    <div class="report-info-content" style="flex: 1; min-width: 0;">
                        <div class="report-info-label" style="font-size: 11px; color: #78909c; font-weight: bold; margin-bottom: 3px;">امتیاز</div>
                        <div class="report-info-value" style="font-size: 15px; font-weight: 900; color: #333;">${toPersianNum(report.score)} از ${toPersianNum(report.totalPoints)}</div>
                    </div>
                </div>
                <div class="report-info-item" style="background: #f8f9fa; border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 10px; border: 1.5px solid #e3f2fd;">
                    <div class="report-info-icon green" style="width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #e8f5e9;">${checkIcon}</div>
                    <div class="report-info-content" style="flex: 1; min-width: 0;">
                        <div class="report-info-label" style="font-size: 11px; color: #78909c; font-weight: bold; margin-bottom: 3px;">پاسخ صحیح</div>
                        <div class="report-info-value" style="font-size: 15px; font-weight: 900; color: #333;">${toPersianNum(report.correct)}</div>
                    </div>
                </div>
                <div class="report-info-item" style="background: #f8f9fa; border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 10px; border: 1.5px solid #e3f2fd;">
                    <div class="report-info-icon red" style="width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #ffebee;">${xIcon}</div>
                    <div class="report-info-content" style="flex: 1; min-width: 0;">
                        <div class="report-info-label" style="font-size: 11px; color: #78909c; font-weight: bold; margin-bottom: 3px;">پاسخ غلط</div>
                        <div class="report-info-value" style="font-size: 15px; font-weight: 900; color: #333;">${toPersianNum(report.wrong)}</div>
                    </div>
                </div>
            </div>
            <div class="report-percent-circle" style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 20px auto; width: 140px; height: 140px; border-radius: 50%; border: 8px solid #1976d2; background: #f8f9fa;">
                <div class="report-percent-value" style="font-size: 36px; font-weight: 900; color: #1976d2;">${toPersianNum(report.percent)}%</div>
                <div class="report-percent-label" style="font-size: 12px; color: #78909c; font-weight: bold;">درصد موفقیت</div>
            </div>
            <div class="report-message" style="background: #fff8e1; border: 2px solid #ffc107; border-radius: 16px; padding: 16px; text-align: center; margin-top: 20px;">
                <div class="report-message-title" style="font-size: 15px; font-weight: 900; color: #e65100; margin-bottom: 6px;">پیام برای شما:</div>
                <div class="report-message-text" style="font-size: 13px; color: #bf360c; font-weight: bold; line-height: 1.6;">${message}</div>
            </div>
            ${report.surveyAnswer ? `
                <div class="report-survey-box" style="background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); border: 2px solid #66bb6a; border-radius: 16px; padding: 16px 20px; margin-top: 18px; text-align: right;">
                    <div class="report-survey-title" style="font-size: 14px; font-weight: 900; color: #2e7d32; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">💬 نظر دانش‌آموز:</div>
                    <div class="report-survey-text" style="font-size: 15px; font-weight: bold; color: #1b5e20; line-height: 1.9; background: rgba(255, 255, 255, 0.7); padding: 12px 14px; border-radius: 12px; border-right: 4px solid #4caf50;">${report.surveyAnswer}</div>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================
// مشاهده‌ی کارنامه
// ============================================================
function viewReportById(index) {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const report = reports[index];
    if (!report) return;
    
    const container = document.getElementById('report-view-content');
    container.innerHTML = generateGraphicReport(report);
    container.innerHTML += `
        <button class="btn-primary" style="margin-top: 15px;" onclick="downloadReportByData(${index})">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; margin-left: 8px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <polyline points="7 10 12 15 17 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            دانلود PDF
        </button>
        <button class="btn-primary" onclick="goToScreen('screen-reports')" style="margin-top: 10px; background: linear-gradient(135deg, #546e7a 0%, #37474f 100%);">بازگشت به کارنامه‌ها</button>
    `;
    goToScreen('screen-report-view');
}

// ============================================================
// باز کردن صفحه پیش‌نمایش PDF
// ============================================================
function openPdfPreview(report, filename, source, index = -1) {
    currentPreviewReport = report;
    currentPreviewFilename = filename;
    currentPreviewSource = source;
    currentPreviewIndex = index;
    
    const container = document.getElementById('pdf-preview-content');
    if (!container) {
        console.error('❌ کانتینر پیش‌نمایش پیدا نشد');
        return;
    }
    
    container.innerHTML = generateGraphicReport(report);
    goToScreen('screen-pdf-preview');
    container.scrollTop = 0;
    vibrate(15);
}

// ============================================================
// بستن صفحه پیش‌نمایش
// ============================================================
function closePdfPreview() {
    const source = currentPreviewSource;
    
    currentPreviewReport = null;
    currentPreviewFilename = '';
    currentPreviewSource = '';
    currentPreviewIndex = -1;
    
    const container = document.getElementById('pdf-preview-content');
    if (container) container.innerHTML = '';
    
    if (source === 'after-lesson') {
        goToScreen('screen-result', false);
    } else {
        goToScreen('screen-reports', false);
    }
}

// ============================================================
// دانلود PDF از صفحه پیش‌نمایش
// ============================================================
async function downloadPdfFromPreview() {
    if (!currentPreviewReport) {
        showModal('خطا', 'اطلاعات کارنامه پیدا نشد.', '❌');
        return;
    }
    
    const downloadBtn = document.querySelector('.pdf-preview-download-btn');
    if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 22px; height: 22px; animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/>
            </svg>
            <span>در حال آماده‌سازی...</span>
        `;
    }
    
    try {
        const success = await downloadReportFast(currentPreviewReport, currentPreviewFilename);
        
        if (success) {
            showModal('✅ دانلود موفق', 'کارنامه با موفقیت دانلود شد.', '✅');
        } else {
            showModal('❌ خطا', 'مشکلی در دانلود پیش آمد.\nلطفاً دوباره تلاش کنید.', '❌');
        }
    } catch (error) {
        console.error('❌ خطا:', error);
        showModal('❌ خطا', 'مشکلی در دانلود پیش آمد.', '❌');
    } finally {
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = `
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    <polyline points="7 10 12 15 17 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    <line x1="12" y1="15" x2="12" y2="3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>دانلود PDF</span>
            `;
        }
    }
}

// ============================================================
// دانلود PDF — با html2canvas + jsPDF مستقیم
// ============================================================
async function downloadReportFast(report, filename) {
    let container = null;
    try {
        container = document.createElement('div');
        container.id = 'pdf-render-container';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '-9999px';
        container.style.width = '794px';
        container.style.background = '#ffffff';
        container.style.direction = 'rtl';
        container.style.fontFamily = 'Vazirmatn, sans-serif';
        container.style.padding = '30px';
        container.style.boxSizing = 'border-box';
        container.style.zIndex = '1';
        container.style.overflow = 'visible';
        
        container.innerHTML = generateGraphicReport(report);
        document.body.appendChild(container);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const images = container.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
            if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 4000);
            });
        }));
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('🎨 شروع رندر با html2canvas...');
        
        container.style.left = '0';
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 10000,
            removeContainer: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: 794,
            windowHeight: container.scrollHeight,
            width: 794,
            height: container.scrollHeight,
            x: 0,
            y: 0
        });
        
        console.log('✅ canvas ساخته شد:', canvas.width, 'x', canvas.height);
        
        container.style.left = '-9999px';
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        const { jsPDF } = window.jspdf;
        
        const pdfWidth = 595.28;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: [pdfWidth, pdfHeight],
            compress: true
        });
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(filename);
        
        console.log('✅ PDF با موفقیت ساخته شد');
        
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        
        return true;
    } catch (error) {
        console.error('❌ خطا در دانلود:', error);
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        return false;
    }
}

// ============================================================
// دانلود کارنامه با index
// ============================================================
async function downloadReportById(index) {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const report = reports[index];
    if (!report) return;
    
    const filename = `کارنامه_${report.lessonTitle}_${report.date.replace(/\//g, '-')}.pdf`;
    openPdfPreview(report, filename, 'list', index);
}

// ============================================================
// دانلود از توی صفحه‌ی مشاهده
// ============================================================
async function downloadReportByData(index) {
    await downloadReportById(index);
}

// ============================================================
// نمایش کارنامه بعد از تکلیف + ثبت امتیاز
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
    
    // 🆕 ذخیره در localStorage + Supabase
    saveReport(report);
    
    const container = document.getElementById('report-view-content');
    container.innerHTML = generateGraphicReport(report);
    container.innerHTML += `
        <button class="btn-primary" onclick="downloadCurrentReport()" style="margin-top: 15px;">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; margin-left: 8px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <polyline points="7 10 12 15 17 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            دانلود کارنامه (PDF)
        </button>
        <button class="btn-primary" onclick="goToScreen('screen-home')" style="margin-top: 10px; background: linear-gradient(135deg, #546e7a 0%, #37474f 100%);">بازگشت به خانه</button>
    `;
    
    goToScreen('screen-report-view');
    addNotification('message', 'پیام معلم', `بازخورد تکلیف شما ثبت شد. آفرین!`);
    updateNotificationBadge();
    
    setTimeout(() => checkForNewMedals(), 1500);
    
    if (typeof autoSyncRanking === 'function') {
        autoSyncRanking('ثبت کارنامه جدید');
    } else if (typeof saveRankingToSupabase === 'function') {
        setTimeout(() => saveRankingToSupabase(), 1000);
    }
}

// ============================================================
// دانلود کارنامه فعلی
// ============================================================
async function downloadCurrentReport() {
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
    
    const filename = `کارنامه_${taskTitle}_${dateStr.replace(/\//g, '-')}.pdf`;
    openPdfPreview(report, filename, 'after-lesson', -1);
}