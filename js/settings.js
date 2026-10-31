// ============================================================
// settings.js — تنظیمات، پروفایل، ورود، ثبت‌نام
// نسخه: ۲۳.۰.۰ — رفع باگ‌های ورود و کد
// ============================================================

// ============================================================
// ثبت‌نام جدید
// ============================================================
async function saveUserInfo() {
    const name = document.getElementById('welcome-name').value.trim();
    const code = document.getElementById('welcome-code').value.trim();
    const cls = document.getElementById('welcome-class').value;
    const school = document.getElementById('welcome-school').value.trim();
    
    if (!name) { 
        showModal('خطا', 'لطفاً نام خود را وارد کنید.', '⚠️'); 
        return; 
    }
    
    if (!code) { 
        showModal('خطا', 'لطفاً کد ورود را وارد کنید.', '⚠️'); 
        return; 
    }
    
    if (!/^[0-9]{3}$/.test(code)) {
        showModal('خطا', 'کد ورود باید ۳ رقم باشه.\nمثال: 123', '⚠️'); 
        return; 
    }
    
    if (!cls) { 
        showModal('خطا', 'لطفاً کلاس خود را انتخاب کنید.', '⚠️'); 
        return; 
    }
    
    showModal('⏳ در حال بررسی...', 'لطفاً چند لحظه صبر کنید.', '🔄');
    
    try {
        const checkResult = await checkStudentCodeExists(code);
        
        if (checkResult.exists) {
            closeModal();
            showModal('❌ کد تکراری', 
                `کد <strong>${code}</strong> قبلاً استفاده شده.\n\n` +
                `لطفاً یه کد دیگه انتخاب کن.`, 
                '❌');
            return;
        }
        
        const newUUID = await generateUUIDFromCode(code);
        localStorage.setItem('studentUUID', newUUID);
        localStorage.setItem('userName', name);
        localStorage.setItem('userClass', cls);
        localStorage.setItem('userSchool', school || 'تعیین نشده');
        localStorage.setItem('userYear', '۱۴۰۵-۱۴۰۶');
        localStorage.setItem('studentCode', code);
        localStorage.setItem('userRegistered', 'true');
        localStorage.setItem('isReturningUser', 'false');
        
        console.log('🆕 کاربر جدید:', newUUID, 'کد:', code);
        
        closeModal();
        
        const success = await ensureRankingSaved(newUUID, name, cls, code);
        
        if (success) {
            showModal('🎉 خوش آمدی!', 
                `${name} جان، حسابت ساخته شد.\n\n` +
                `🔑 کد ورودت: <strong>${code}</strong>\n\n` +
                `⚠️ این کد رو یه جای امن نگه دار.\n` +
                `با این کد می‌تونی از هر مرورگری وارد بشی و کارنامه‌هات برگردن.`, 
                '✨');
            console.log('✅ ثبت‌نام کامل شد');
        } else {
            console.warn('⚠️ ثبت‌نام ناقص موند، ولی اطلاعات توی localStorage ذخیره شد');
            showModal('⚠️ توجه', 
                `حساب شما ساخته شد، ولی نتوانستیم اطلاعات رو در سرور ذخیره کنیم.\n\n` +
                `🔑 کد ورودت: <strong>${code}</strong>\n\n` +
                `لطفاً بعداً دوباره امتحان کن یا با معلم تماس بگیر.`, 
                '⚠️');
        }
        
        if (!localStorage.getItem('streakData')) {
            localStorage.setItem('streakData', JSON.stringify({
                lastDate: null,
                count: 0,
                dates: []
            }));
        }
        
        updateStreak();
        updateHomeUI();
        
        setTimeout(() => {
            const welcomeNameEl = document.getElementById('welcome-user-name');
            if (welcomeNameEl) welcomeNameEl.textContent = name;
            
            const welcomeModal = document.getElementById('welcome-graphic-modal');
            if (welcomeModal) welcomeModal.classList.add('active');
        }, 2000);
        
    } catch (error) {
        console.error('❌ خطا:', error);
        closeModal();
        showModal('خطا', 'مشکلی در ارتباط با سرور پیش آمد.\nلطفاً دوباره تلاش کنید.', '❌');
    }
}

// ============================================================
// اطمینان از ثبت کاربر در rankings
// ============================================================
async function ensureRankingSaved(studentId, name, cls, code) {
    try {
        const client = getSupabase();
        if (!client) {
            console.warn('⚠️ Supabase client آماده نیست');
            return false;
        }
        
        const { data: existing, error: checkError } = await client
            .from('rankings')
            .select('student_id, name, class_name, custom_completed_lessons')
            .eq('student_id', studentId)
            .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('❌ خطا در چک رکورد:', checkError.message);
            if (!checkError.message.includes('custom_completed_lessons')) {
                return false;
            }
        }
        
        if (existing) {
            console.log('ℹ️ رکورد قبلاً وجود داره، آپدیت میشه');
            
            const updatePayload = {
                name: name,
                class_name: classNameToSlug(cls),
                student_code: code,
                last_update: new Date().toISOString()
            };
            
            const { error } = await client
                .from('rankings')
                .update(updatePayload)
                .eq('student_id', studentId);
            
            if (error) {
                console.error('❌ خطا در آپدیت رکورد:', error.message);
                return false;
            }
            
            console.log('✅ رکورد آپدیت شد');
            return true;
        }
        
        const payload = {
            student_id: studentId,
            name: name,
            class_name: classNameToSlug(cls),
            total_points: 0,
            completed_lessons: 0,
            custom_completed_lessons: 0,
            custom_points_added: 0,
            custom_total_points: 0,
            avg_percent: 0,
            streak_days: 0,
            avatar_url: 'default',
            student_code: code,
            last_update: new Date().toISOString()
        };
        
        console.log('📤 ارسال به rankings:', payload);
        
        const { error } = await client
            .from('rankings')
            .insert(payload);
        
        if (error) {
            console.error('❌ خطا در درج رکورد:', error.message);
            
            if (error.message.includes('custom_completed_lessons')) {
                console.warn('⚠️ ستون custom_completed_lessons وجود نداره، بدون اون تلاش می‌کنم');
                
                const fallbackPayload = { ...payload };
                delete fallbackPayload.custom_completed_lessons;
                
                const { error: retryError } = await client
                    .from('rankings')
                    .insert(fallbackPayload);
                
                if (retryError) {
                    console.error('❌ خطا در تلاش دوم:', retryError.message);
                    return false;
                }
                
                console.log('✅ رکورد بدون custom_completed_lessons ثبت شد');
                return true;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const { error: retryError } = await client
                .from('rankings')
                .insert(payload);
            
            if (retryError) {
                console.error('❌ خطا در تلاش دوم:', retryError.message);
                return false;
            }
            
            console.log('✅ رکورد در تلاش دوم ثبت شد');
            return true;
        }
        
        console.log('✅ رکورد جدید در rankings ثبت شد');
        return true;
        
    } catch (error) {
        console.error('❌ خطا در ensureRankingSaved:', error);
        return false;
    }
}
// ============================================================
// ورود با کد
// ============================================================
async function loginWithCode() {
    const code = document.getElementById('login-code').value.trim();
    
    if (!code) {
        showModal('خطا', 'لطفاً کد ورود را وارد کنید.', '⚠️');
        return;
    }
    
    if (!/^[0-9]{3}$/.test(code)) {
        showModal('خطا', 'کد ورود باید ۳ رقم باشه.\nمثال: 123', '⚠️');
        return;
    }
    
    showModal('⏳ در حال بررسی...', 'لطفاً چند لحظه صبر کنید.', '🔄');
    
    try {
        const checkResult = await checkStudentCodeExists(code);
        
        if (!checkResult.exists) {
            closeModal();
            showModal('❌ کد پیدا نشد', 
                `کدی با شماره <strong>${code}</strong> پیدا نشد.\n\n` +
                `لطفاً مطمئن شو کدت درسته، یا از دکمه <strong>«ثبت‌نام»</strong> استفاده کن.`, 
                '❌');
            return;
        }
        
        const studentId = checkResult.studentId;
        const name = checkResult.name;
        const className = slugToClassName(checkResult.className);
        
        // 🆕 پاک کردن کش‌های موقت (قبل از ورود)
        clearTempCachesBeforeLogin();
        
        localStorage.setItem('studentUUID', studentId);
        localStorage.setItem('userName', name);
        localStorage.setItem('userClass', className);
        localStorage.setItem('studentCode', code);
        localStorage.setItem('userRegistered', 'true');
        localStorage.setItem('isReturningUser', 'true');
        
        console.log('✅ کاربر برگشتی:', name, studentId);
        
        closeModal();
        showModal('⏳ در حال بازیابی...', 'داریم اطلاعاتت رو برمی‌گردونیم...', '🔄');
        
        const recovered = await recoverAllDataFromSupabase();
        
        // 🆕 استفاده از نسخه notifications.js (کامل‌تر)
        if (typeof markAllAsSeenForReturningUser === 'function') {
            await markAllAsSeenForReturningUser();
        }
        
        await ensureRankingSaved(studentId, name, className, code);
        
        if (recovered) {
            const reports = JSON.parse(localStorage.getItem('reports') || '[]');
            const totalPoints = reports.reduce((sum, r) => sum + (r.score || 0), 0);
            
            showModal('✅ خوش برگشتی!', 
                `${name} جان، خوش برگشتی! 🎉\n\n` +
                `📚 تعداد تکالیف: ${toPersianNum(reports.length)}\n` +
                `⭐ امتیاز کل: ${toPersianNum(totalPoints)}\n\n` +
                `همه چیز همون قبلیه 😉`, 
                '🎉');
        } else {
            showModal('✅ خوش برگشتی!', 
                `${name} جان، خوش برگشتی! 🎉`, 
                '🎉');
        }
        
        if (!localStorage.getItem('streakData')) {
            localStorage.setItem('streakData', JSON.stringify({
                lastDate: null,
                count: 0,
                dates: []
            }));
        }
        
        updateStreak();
        updateHomeUI();
        
        setTimeout(async () => {
            if (typeof transferLocalDataToSupabase === 'function') {
                await transferLocalDataToSupabase();
            }
            if (typeof saveRankingToSupabase === 'function') {
                await saveRankingToSupabase();
            }
        }, 500);
        
        setTimeout(() => {
            const welcomeNameEl = document.getElementById('welcome-user-name');
            if (welcomeNameEl) welcomeNameEl.textContent = name;
            
            goToScreen('screen-home', false);
        }, 2000);
        
    } catch (error) {
        console.error('❌ خطا:', error);
        closeModal();
        showModal('خطا', 'مشکلی در ارتباط با سرور پیش آمد.\nلطفاً دوباره تلاش کنید.', '❌');
    }
}

// ============================================================
// 🆕 پاک کردن کش‌های موقت (با کلیدهای dismissed)
// ============================================================
function clearTempCachesBeforeLogin() {
    const tempKeys = [
        'studentClassMessagesCache',
        'notifications',
        'lessonsListCache',
        // 🆕 کلیدهای dismissed (تا کاربر جدید پیام‌های جدید ببیند)
        'dismissedNewMessageNotif',
        'dismissedNewJozveNotif',
        'dismissedDeadlineNotif',
        'seenChatMessages',
        'seenClassMessages',
        'seenLessonsForNotif',
        'seenLessons',
        'seenVideos',
        'seenJozveIds',
        'lastStreakMessageShown',
        'lastDeadlineNotifDate',
        // 🆕 کش رتبه‌بندی
        'rankings_cache_hafom-1',
        'rankings_cache_hafom-2',
        'rankings_cache_hafom-3',
        'rankings_cache_hafom-4',
        'rankings_cache_hafom-5',
        // 🆕 کش استوری‌ها
        'viewedStories',
        'likedStories',
        'storiesCache',
        'seenChallenges',
        'seenStories'
    ];
    
    tempKeys.forEach(key => {
        try { localStorage.removeItem(key); } catch (e) {}
    });
    
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('studentChatCache_') || key.startsWith('rankings_cache_'))) {
                localStorage.removeItem(key);
            }
        }
    } catch (e) {}
}

// ============================================================
// توابع کمکی کد
// ============================================================
async function generateUniqueCodeForOldUser() {
    try {
        const client = getSupabase();
        if (!client) return null;
        
        for (let attempt = 0; attempt < 20; attempt++) {
            const code = String(Math.floor(100 + Math.random() * 900));
            const { data, error } = await client
                .from('rankings')
                .select('student_id')
                .eq('student_code', code)
                .maybeSingle();
            
            if (!error && !data) return code;
        }
        return null;
    } catch (error) { 
        return null; 
    }
}

async function assignCodeToOldUser() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        const existingCode = localStorage.getItem('studentCode');
        
        if (existingCode && /^[0-9]{3}$/.test(existingCode)) return existingCode;
        if (!studentId) return null;
        
        const newCode = await generateUniqueCodeForOldUser();
        if (!newCode) return null;
        
        localStorage.setItem('studentCode', newCode);
        
        const client = getSupabase();
        if (client) {
            await client
                .from('rankings')
                .update({ student_code: newCode })
                .eq('student_id', studentId);
        }
        return newCode;
    } catch (error) { 
        return null; 
    }
}

async function showCodeModalToOldUser(code) {
    const name = localStorage.getItem('userName') || 'دانش‌آموز';
    const existing = document.getElementById('code-assigned-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'code-assigned-modal';
    modal.className = 'change-code-overlay active';
    modal.innerHTML = `
        <div class="change-code-box">
            <div class="change-code-header" style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);">
                <div class="change-code-icon">🔑</div>
                <div class="change-code-title">کد ورود شما</div>
                <div class="change-code-subtitle">یه کد ورود برای شما ساخته شد</div>
            </div>
            <div class="change-code-body" style="text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #455a64; margin-bottom: 16px;">
                    ${name} جان، کد ورودت اینه:
                </div>
                <div style="background: linear-gradient(135deg, #e3f2fd, #bbdefb);border: 3px dashed #1976d2;border-radius: 20px;padding: 20px;margin: 0 auto 16px auto;display: inline-block;min-width: 180px;">
                    <div style="font-size: 52px;font-weight: 900;color: #1976d2;letter-spacing: 12px;font-family: 'Courier New', monospace;direction: ltr;text-align: center;padding-left: 12px;">${code}</div>
                </div>
                <div style="background: linear-gradient(135deg, #fff8e1, #ffecb3);border: 2px solid #ffc107;border-radius: 14px;padding: 12px 14px;font-size: 12px;font-weight: bold;color: #e65100;line-height: 1.8;text-align: right;">
                    ⚠️ <strong>مهم:</strong> این کد رو یه جای امن نگه دار.<br>با این کد می‌تونی از هر مرورگری وارد بشی و کارنامه‌هات برگردن.
                </div>
            </div>
            <div class="change-code-footer">
                <button class="change-code-btn change-code-btn-save" style="background: linear-gradient(135deg, #4caf50, #2e7d32);" onclick="closeCodeModal()">
                    ✅ متوجه شدم
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeCodeModal() {
    const modal = document.getElementById('code-assigned-modal');
    if (modal) modal.remove();
}

function loadStudentCodeInProfile() {
    const code = localStorage.getItem('studentCode');
    const codeEl = document.getElementById('profile-code');
    if (codeEl) {
        if (code && /^[0-9]{3}$/.test(code)) codeEl.textContent = code;
        else codeEl.textContent = '---';
    }
}

function openChangeCodeModal() {
    const currentCode = localStorage.getItem('studentCode') || '---';
    const existing = document.getElementById('change-code-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'change-code-modal';
    modal.className = 'change-code-overlay active';
    modal.innerHTML = `
        <div class="change-code-box">
            <button class="change-code-close" onclick="closeChangeCodeModal()">✕</button>
            <div class="change-code-header">
                <div class="change-code-icon">✏️</div>
                <div class="change-code-title">تغییر کد ورود</div>
                <div class="change-code-subtitle">کد فعلی: <span class="current-code-badge">${currentCode}</span></div>
            </div>
            <div class="change-code-body">
                <label class="change-code-label">کد جدید (۳ رقم):</label>
                <input type="text" id="new-code-input" class="change-code-input" placeholder="123" inputmode="numeric" maxlength="3" dir="ltr">
                <div class="change-code-warning">
                    ⚠️ اگه کدت رو تغییر بدی، از این به بعد باید با کد جدید وارد بشی.
                </div>
            </div>
            <div class="change-code-footer">
                <button class="change-code-btn change-code-btn-cancel" onclick="closeChangeCodeModal()">انصراف</button>
                <button class="change-code-btn change-code-btn-save" onclick="saveNewCode()">✅ ذخیره</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const input = document.getElementById('new-code-input');
        if (input) {
            input.focus();
            input.addEventListener('input', (e) => e.target.value = e.target.value.replace(/[^0-9]/g, ''));
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveNewCode(); });
        }
    }, 300);
}

function closeChangeCodeModal() {
    const modal = document.getElementById('change-code-modal');
    if (modal) modal.remove();
}

async function saveNewCode() {
    const input = document.getElementById('new-code-input');
    const newCode = input ? input.value.trim() : '';
    
    if (!newCode) { 
        showModal('خطا', 'کد جدید را وارد کنید.', '⚠️'); 
        return; 
    }
    
    if (!/^[0-9]{3}$/.test(newCode)) { 
        showModal('خطا', 'کد باید ۳ رقم باشه.', '⚠️'); 
        return; 
    }
    
    const currentCode = localStorage.getItem('studentCode');
    if (newCode === currentCode) { 
        showModal('توجه', 'کد جدید با کد فعلی یکیه.', '⚠️'); 
        return; 
    }
    
    showModal('⏳ در حال بررسی...', 'لطفاً صبر کنید...', '🔄');
    
    try {
        const checkResult = await checkStudentCodeExists(newCode);
        
        if (checkResult.exists) {
            closeModal();
            showModal('❌ کد تکراری', `کد <strong>${newCode}</strong> قبلاً استفاده شده.`, '❌');
            return;
        }
        
        localStorage.setItem('studentCode', newCode);
        
        const studentId = localStorage.getItem('studentUUID');
        const client = getSupabase();
        
        if (client && studentId) {
            const { error } = await client
                .from('rankings')
                .update({ student_code: newCode })
                .eq('student_id', studentId);
            
            if (error) throw error;
        }
        
        const codeEl = document.getElementById('profile-code');
        if (codeEl) codeEl.textContent = newCode;
        
        closeModal();
        closeChangeCodeModal();
        showModal('✅ موفق', `کد ورودت به <strong>${newCode}</strong> تغییر کرد.`, '✅');
        vibrate(30);
    } catch (error) {
        closeModal();
        showModal('خطا', 'مشکلی پیش آمد.', '❌');
    }
}
async function transferLocalDataToSupabase() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) return false;
        
        const client = getSupabase();
        if (!client) return false;
        
        const reports = JSON.parse(localStorage.getItem('reports') || '[]');
        
        if (reports.length > 0) {
            const { data: existingReports } = await client
                .from('reports')
                .select('lesson_id')
                .eq('student_id', studentId);
            
            const existingLessonIds = new Set((existingReports || []).map(r => r.lesson_id));
            const newReports = reports.filter(r => !existingLessonIds.has(r.lessonId));
            
            for (const report of newReports) {
                const safePercent = isNaN(report.percent) ? 0 : (report.percent || 0);
                const safeScore = isNaN(report.score) ? 0 : (report.score || 0);
                const safeTotalPoints = isNaN(report.totalPoints) ? 0 : (report.totalPoints || 0);
                const safeCorrect = isNaN(report.correct) ? 0 : (report.correct || 0);
                const safeWrong = isNaN(report.wrong) ? 0 : (report.wrong || 0);
                const safeTimeTaken = isNaN(report.timeTaken) ? 1 : (report.timeTaken || 1);
                
                const payload = {
                    student_id: studentId,
                    lesson_id: report.lessonId,
                    lesson_title: report.lessonTitle || 'تکلیف',
                    percent: safePercent,
                    score: safeScore,
                    total_points: safeTotalPoints,
                    correct: safeCorrect,
                    wrong: safeWrong,
                    time_taken: safeTimeTaken,
                    created_at: report.timestamp || new Date().toISOString()
                };
                await client.from('reports').insert(payload);
            }
        }
        
        if (typeof saveRankingToSupabase === 'function') {
            await saveRankingToSupabase();
        }
        
        return true;
    } catch (error) { 
        console.warn('⚠️ خطا در transferLocalDataToSupabase:', error);
        return false; 
    }
}

async function recoverAllDataFromSupabase() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) return false;
        
        const client = getSupabase();
        if (!client) return false;
        
        // 🆕 دریافت گزارش‌ها
        const reports = await getReportsFromSupabase(studentId);
        
        if (reports && reports.length > 0) {
            const userName = localStorage.getItem('userName') || '';
            const userClass = localStorage.getItem('userClass') || '';
            
            const localReports = reports.map(r => ({
                studentName: userName,
                studentClass: userClass,
                lessonId: r.lesson_id,
                lessonTitle: r.lesson_title,
                date: new Date(r.created_at).toLocaleDateString('fa-IR', { 
                    year: 'numeric', month: '2-digit', day: '2-digit' 
                }),
                timestamp: r.created_at,
                percent: r.percent || 0,
                correct: r.correct || 0,
                wrong: r.wrong || 0,
                score: r.score || 0,
                totalPoints: r.total_points || 0,
                timeTaken: r.time_taken || 0,
                surveyAnswer: ''
            }));
            
            // 🆕 فقط اگر reports محلی خالی بود، از Supabase بنویس
            const existingLocalReports = JSON.parse(localStorage.getItem('reports') || '[]');
            if (existingLocalReports.length === 0) {
                localStorage.setItem('reports', JSON.stringify(localReports));
            } else {
                // 🆕 ادغام: هر گزارش که در Supabase هست ولی در لوکال نیست، اضافه کن
                const mergedMap = {};
                existingLocalReports.forEach(r => {
                    if (r.lessonId) mergedMap[r.lessonId] = r;
                });
                localReports.forEach(r => {
                    if (r.lessonId && !mergedMap[r.lessonId]) {
                        mergedMap[r.lessonId] = r;
                    }
                });
                localStorage.setItem('reports', JSON.stringify(Object.values(mergedMap)));
            }
        }
        
        // 🆕 دریافت rankings
        const { data: rankingData } = await client
            .from('rankings')
            .select('*')
            .eq('student_id', studentId)
            .maybeSingle();
        
        if (rankingData) {
            if (rankingData.name) localStorage.setItem('userName', rankingData.name);
            if (rankingData.class_name) {
                localStorage.setItem('userClass', slugToClassName(rankingData.class_name));
            }
            if (rankingData.student_code) {
                localStorage.setItem('studentCode', rankingData.student_code);
            }
            if (rankingData.avatar_url) {
                const avatarUrl = String(rankingData.avatar_url).trim();
                if (avatarUrl.startsWith('emoji:')) {
                    const emoji = avatarUrl.replace('emoji:', '');
                    if (emoji && emoji !== '👤' && emoji !== '👦🏻' && emoji !== '👦') {
                        localStorage.setItem('userAvatarEmoji', emoji);
                        localStorage.removeItem('userAvatar');
                    }
                } else if (avatarUrl.startsWith('data:image') || avatarUrl.startsWith('http')) {
                    localStorage.setItem('userAvatar', avatarUrl);
                    localStorage.removeItem('userAvatarEmoji');
                }
            }
            if (rankingData.streak_days) {
                const streakData = JSON.parse(localStorage.getItem('streakData') || '{}');
                if (!streakData.count || streakData.count < rankingData.streak_days) {
                    streakData.count = rankingData.streak_days;
                    streakData.lastDate = new Date().toLocaleDateString('fa-IR');
                    if (!streakData.dates) streakData.dates = [];
                    localStorage.setItem('streakData', JSON.stringify(streakData));
                }
            }
            localStorage.setItem('customPointsAdded', rankingData.custom_points_added || 0);
            localStorage.setItem('customTotalPoints', rankingData.custom_total_points || 0);
        }
        
        // 🆕 دریافت وضعیت تکالیف
        const status = await getStudentLessonStatus(studentId);
        localStorage.setItem('lessonStatusCache', JSON.stringify({ 
            data: status, 
            timestamp: Date.now() 
        }));
        
        // 🆕 بازیابی seen_data
        if (typeof recoverSeenDataFromSupabase === 'function') {
            await recoverSeenDataFromSupabase(studentId);
        }
        
        return true;
    } catch (error) { 
        console.warn('⚠️ خطا در recoverAllDataFromSupabase:', error);
        return false; 
    }
}

// ============================================================
// 🆕 updateHomeUI
// ============================================================
function updateHomeUI() {
    const name = localStorage.getItem('userName');
    if (name) {
        const homeNameEl = document.getElementById('home-student-name');
        if (homeNameEl) homeNameEl.textContent = `سلام، ${name} جان`;
    }
    
    // 🆕 آپدیت آواتار
    if (typeof applyAvatarToElements === 'function') {
        applyAvatarToElements();
    }
}

function loadUserInfo() {
    const name = localStorage.getItem('userName');
    if (name) {
        updateHomeUI();
        if (typeof applyAvatarToElements === 'function') applyAvatarToElements();
    }
}

function loadProfileData() {
    const name = localStorage.getItem('userName') || 'دانش‌آموز';
    const cls = localStorage.getItem('userClass') || 'هفتم';
    const school = localStorage.getItem('userSchool') || 'تعیین نشده';
    const year = localStorage.getItem('userYear') || '۱۴۰۵-۱۴۰۶';
    
    const nameEl = document.getElementById('profile-name-display');
    const gradeEl = document.getElementById('profile-grade-display');
    const fullnameEl = document.getElementById('profile-fullname');
    const classEl = document.getElementById('profile-class');
    const schoolEl = document.getElementById('profile-school');
    const yearEl = document.getElementById('profile-year');
    
    if (nameEl) nameEl.textContent = name;
    if (gradeEl) gradeEl.textContent = `پایه ${cls}`;
    if (fullnameEl) fullnameEl.textContent = name;
    if (classEl) classEl.textContent = cls;
    if (schoolEl) schoolEl.textContent = school;
    if (yearEl) yearEl.textContent = year;
    
    loadStudentCodeInProfile();
    
    if (typeof applyAvatarToElements === 'function') applyAvatarToElements();
    
    loadProfileStatsFromSupabase();
}

async function loadProfileStatsFromSupabase() {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const completedLessons = reports.length;
    const avgPercent = reports.length > 0 
        ? Math.round(reports.reduce((sum, r) => sum + (r.percent || 0), 0) / reports.length) 
        : 0;
    const stats = typeof getUserStats === 'function' ? getUserStats() : { unlockedMedals: [] };
    
    const pointsEl = document.getElementById('stat-points');
    const medalsEl = document.getElementById('stat-medals');
    const completedEl = document.getElementById('stat-completed');
    const percentEl = document.getElementById('stat-percent');
    
    try {
        const client = getSupabase();
        if (!client) {
            const localPoints = reports.reduce((sum, r) => sum + (r.score || 0), 0);
            if (pointsEl) pointsEl.textContent = toPersianNum(localPoints);
            if (medalsEl) medalsEl.textContent = toPersianNum(stats.unlockedMedals.length);
            if (completedEl) completedEl.textContent = toPersianNum(completedLessons);
            if (percentEl) percentEl.textContent = toPersianNum(avgPercent) + '%';
            return;
        }
        
        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) return;
        
        const { data, error } = await client
            .from('rankings')
            .select('total_points, custom_points_added, custom_total_points, student_code')
            .eq('student_id', studentId)
            .maybeSingle();
            
        if (error || !data) {
            const localPoints = reports.reduce((sum, r) => sum + (r.score || 0), 0);
            if (pointsEl) pointsEl.textContent = toPersianNum(localPoints);
            if (medalsEl) medalsEl.textContent = toPersianNum(stats.unlockedMedals.length);
            if (completedEl) completedEl.textContent = toPersianNum(completedLessons);
            if (percentEl) percentEl.textContent = toPersianNum(avgPercent) + '%';
            return;
        }
        
        const basePoints = parseInt(data.total_points) || 0;
        const challengePoints = parseInt(data.custom_points_added) || 0;
        const manualPoints = parseInt(data.custom_total_points) || 0;
        
        const finalTotalPoints = Math.max(0, basePoints + challengePoints + manualPoints);
        
        if (pointsEl) pointsEl.textContent = toPersianNum(finalTotalPoints);
        if (medalsEl) medalsEl.textContent = toPersianNum(stats.unlockedMedals.length);
        if (completedEl) completedEl.textContent = toPersianNum(completedLessons);
        if (percentEl) percentEl.textContent = toPersianNum(avgPercent) + '%';
        
        if (data.student_code && !localStorage.getItem('studentCode')) {
            localStorage.setItem('studentCode', data.student_code);
            loadStudentCodeInProfile();
        }
        
    } catch (e) {
        const localPoints = reports.reduce((sum, r) => sum + (r.score || 0), 0);
        if (pointsEl) pointsEl.textContent = toPersianNum(localPoints);
        if (medalsEl) medalsEl.textContent = toPersianNum(stats.unlockedMedals.length);
        if (completedEl) completedEl.textContent = toPersianNum(completedLessons);
        if (percentEl) percentEl.textContent = toPersianNum(avgPercent) + '%';
    }
}
function toggleDarkMode(el) {
    if (el.checked) { 
        localStorage.setItem('darkMode', 'true'); 
        document.body.classList.add('dark-mode'); 
    } else { 
        localStorage.setItem('darkMode', 'false'); 
        document.body.classList.remove('dark-mode'); 
    }
}

function toggleMusicSetting(el) {
    if (el.checked) {
        localStorage.setItem('musicEnabled', 'true');
        if (typeof bgMusic !== 'undefined' && bgMusic) {
            bgMusic.volume = 0.9;
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen && !['screen-quiz', 'screen-feedback', 'screen-result'].includes(activeScreen.id)) {
                bgMusic.play().catch(e => console.log(e));
            }
        }
    } else {
        localStorage.setItem('musicEnabled', 'false');
        if (typeof bgMusic !== 'undefined' && bgMusic) bgMusic.pause();
    }
}

function toggleSoundsSetting(el) {
    localStorage.setItem('soundsEnabled', el.checked ? 'true' : 'false');
}

const bgMusic = document.getElementById('bg-music');
let musicStarted = false;
let isMuted = false;

function startMusic() {
    if (musicStarted && !isMuted) return;
    if (localStorage.getItem('musicEnabled') === 'false') return;
    if (!bgMusic) return;
    bgMusic.volume = 0.9;
    bgMusic.play().then(() => { musicStarted = true; }).catch(e => console.log(e));
}

document.addEventListener('click', () => { if (!isMuted) startMusic(); }, { once: true });
document.addEventListener('touchstart', () => { if (!isMuted) startMusic(); }, { once: true });

let audioContext = null;

function initAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
}

function playCorrectSound() {
    if (localStorage.getItem('soundsEnabled') === 'false') return;
    try {
        initAudio();
        const now = audioContext.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.3);
        });
    } catch(e) {}
}

function playWrongSound() {
    if (localStorage.getItem('soundsEnabled') === 'false') return;
    try {
        initAudio();
        const now = audioContext.currentTime;
        [400, 300, 200].forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.25);
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.start(now + i * 0.15); osc.stop(now + i * 0.15 + 0.25);
        });
    } catch(e) {}
}

let motivationTimer = null;

function typeMotivation() {
    const el = document.getElementById('home-motivation-text');
    if (!el) return;
    if (motivationTimer) clearTimeout(motivationTimer);
    const text = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
    let index = 0;
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    el.appendChild(cursor);
    
    function type() {
        if (index < text.length) {
            cursor.before(document.createTextNode(text[index]));
            index++;
            motivationTimer = setTimeout(type, 35);
        } else {
            motivationTimer = setTimeout(() => { if (cursor.parentNode) cursor.remove(); }, 2000);
        }
    }
    type();
}

function openUpdateDataModal() {
    const modal = document.getElementById('update-data-modal');
    if (modal) modal.classList.add('active');
}

function closeUpdateDataModal() {
    const modal = document.getElementById('update-data-modal');
    if (modal) modal.classList.remove('active');
}

async function confirmUpdateData() {
    closeUpdateDataModal();
    showModal('⏳ در حال بروزرسانی...', 'لطفاً چند لحظه صبر کنید.', '🔄');
    
    try {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) await registration.unregister();
        }
        
        showModal('✅ بروزرسانی موفق', 'اطلاعات شما حفظ شد.', '✅');
        
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('updated', Date.now());
            window.location.href = url.toString();
        }, 1500);
    } catch (error) { 
        setTimeout(() => location.reload(), 1500); 
    }
}

// ============================================================
// آواتار
// ============================================================
function changeAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) { 
        showModal('خطا', 'حجم عکس باید کمتر از ۵ مگابایت باشد.', '⚠️'); 
        return; 
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 300;
                let width = img.width, height = img.height;
                
                if (width > height) { 
                    if (width > MAX_SIZE) { 
                        height = Math.round((height * MAX_SIZE) / width); 
                        width = MAX_SIZE; 
                    } 
                } else { 
                    if (height > MAX_SIZE) { 
                        width = Math.round((width * MAX_SIZE) / height); 
                        height = MAX_SIZE; 
                    } 
                }
                
                canvas.width = width; 
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true; 
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                let compressedData = canvas.toDataURL('image/jpeg', 0.85);
                if (compressedData.length > 45000) {
                    compressedData = canvas.toDataURL('image/jpeg', 0.6);
                }
                
                localStorage.setItem('userAvatar', compressedData);
                localStorage.removeItem('userAvatarEmoji');
                
                if (typeof applyAvatarToElements === 'function') applyAvatarToElements();
                
                showModal('موفق', 'عکس پروفایل تغییر کرد.', '✅');
                
                if (typeof saveRankingToSupabase === 'function') {
                    setTimeout(() => saveRankingToSupabase(), 800);
                }
            } catch (err) { 
                showModal('خطا', 'مشکلی در پردازش عکس.', '❌'); 
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function openAvatarOptionsModal() {
    const modal = document.getElementById('avatar-options-modal');
    if (modal) modal.classList.add('active');
}

function closeAvatarOptionsModal() {
    const modal = document.getElementById('avatar-options-modal');
    if (modal) modal.classList.remove('active');
}

function chooseEmojiOption() {
    closeAvatarOptionsModal();
    setTimeout(() => { 
        if (typeof openEmojiPicker === 'function') openEmojiPicker(); 
    }, 250);
}

function chooseGalleryOption() {
    closeAvatarOptionsModal();
    setTimeout(() => { 
        const fileInput = document.getElementById('avatar-input'); 
        if (fileInput) fileInput.click(); 
    }, 250);
}

// ============================================================
// پروفایل
// ============================================================
function openEditProfile() {
    const nameEl = document.getElementById('edit-name');
    const classEl = document.getElementById('edit-class');
    const schoolEl = document.getElementById('edit-school');
    const yearEl = document.getElementById('edit-year');
    
    if (nameEl) nameEl.value = localStorage.getItem('userName') || '';
    if (classEl) classEl.value = localStorage.getItem('userClass') || 'هفتم یک';
    if (schoolEl) schoolEl.value = localStorage.getItem('userSchool') || '';
    if (yearEl) yearEl.value = '۱۴۰۵-۱۴۰۶';
    
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.add('active');
}

function closeEditProfile() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.remove('active');
}

function saveProfileChanges() {
    const newName = document.getElementById('edit-name').value.trim();
    const newClass = document.getElementById('edit-class').value;
    const newSchool = document.getElementById('edit-school').value.trim();
    
    if (!newName) { 
        showModal('خطا', 'لطفاً نام خود را وارد کنید.', '⚠️'); 
        return; 
    }
    
    localStorage.setItem('userName', newName);
    localStorage.setItem('userClass', newClass);
    localStorage.setItem('userSchool', newSchool || 'تعیین نشده');
    
    updateHomeUI();
    loadProfileData();
    closeEditProfile();
    showModal('موفق', 'اطلاعات شما ذخیره شد.', '✅');
    
    if (typeof saveRankingToSupabase === 'function') {
        setTimeout(() => saveRankingToSupabase(), 800);
    }
}

// ============================================================
// 🆕 مودال تاریخچه امتیازات (برای صفحه پروفایل)
// ============================================================
async function openPointsHistoryModal() {
    if (navigator.vibrate) navigator.vibrate(15);
    
    let existing = document.getElementById('points-history-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'points-history-modal';
    modal.className = 'points-history-modal active';
    modal.innerHTML = `
        <div class="points-history-box" id="points-history-content">
            <button class="points-history-close" onclick="closePointsHistoryModal()">✕</button>
            <div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>
        </div>
    `;
    document.body.appendChild(modal);
    
    let historyHTML = '';
    let totalPoints = 0;

    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    reports.forEach(r => {
        totalPoints += (r.score || 0);
        historyHTML += `
            <div class="points-history-item lesson-item">
                <div class="points-history-icon lesson">📚</div>
                <div class="points-history-info">
                    <div class="points-history-title">${r.lessonTitle || 'تکلیف'}</div>
                    <div class="points-history-date">${r.date || ''}</div>
                </div>
                <div class="points-history-value">+${toPersianNum(r.score || 0)}</div>
            </div>
        `;
    });

    try {
        const chalRes = await fetch('./challenges.json?t=' + Date.now());
        if (chalRes.ok) {
            const chalData = await chalRes.json();
            const challenges = chalData.challenges || [];
            
            challenges.forEach(c => {
                if (localStorage.getItem('quizCompleted_' + c.id) === 'true') {
                    const score = parseInt(localStorage.getItem('quizScore_' + c.id)) || 0;
                    totalPoints += score;
                    historyHTML += `
                        <div class="points-history-item challenge-item">
                            <div class="points-history-icon challenge">🏆</div>
                            <div class="points-history-info">
                                <div class="points-history-title">${c.title}</div>
                                <div class="points-history-date">چالش هفتگی</div>
                            </div>
                            <div class="points-history-value">+${toPersianNum(score)}</div>
                        </div>
                    `;
                }
            });
        }
    } catch(e) {
        console.warn('خطا در دریافت لیست چالش‌ها:', e);
    }

    const container = document.getElementById('points-history-content');
    if (!container) return;
    
    if (historyHTML === '') {
        historyHTML = `<div class="points-history-empty">هنوز هیچ امتیازی کسب نکرده‌اید.<br>با انجام تکالیف و چالش‌ها، امتیاز بگیرید!</div>`;
    }

    container.innerHTML = `
        <button class="points-history-close" onclick="closePointsHistoryModal()">✕</button>
        <div class="points-history-header">
            <h2>تاریخچه امتیازات</h2>
            <div class="points-history-total">
                ${toPersianNum(totalPoints)} <span>امتیاز</span>
            </div>
        </div>
        <div style="padding-bottom: 10px;">
            ${historyHTML}
        </div>
    `;
}

// ============================================================
// 🆕 مودال تاریخچه امتیازات برای سایر کاربران
// ============================================================
async function openPointsHistoryModalForUser(studentId) {
    if (navigator.vibrate) navigator.vibrate(15);
    
    let existing = document.getElementById('points-history-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'points-history-modal';
    modal.className = 'points-history-modal active';
    modal.innerHTML = `
        <div class="points-history-box" id="points-history-content">
            <button class="points-history-close" onclick="closePointsHistoryModal()">✕</button>
            <div style="text-align:center; padding:40px; color:#90a4ae; font-weight:bold;">در حال بارگذاری...</div>
        </div>
    `;
    document.body.appendChild(modal);
    
    let historyHTML = '';
    let totalPoints = 0;

    try {
        const client = getSupabase();
        if (client) {
            // ۱. مجموع امتیازات تکالیف
            const { data: reports } = await client
                .from('reports')
                .select('score')
                .eq('student_id', studentId);
            
            let totalLessonPoints = 0;
            if (reports && reports.length > 0) {
                reports.forEach(r => {
                    totalLessonPoints += (r.score || 0);
                });
            }
            
            if (totalLessonPoints > 0) {
                totalPoints += totalLessonPoints;
                historyHTML += `
                    <div class="points-history-item lesson-item">
                        <div class="points-history-icon lesson">📚</div>
                        <div class="points-history-info">
                            <div class="points-history-title">مجموع امتیاز تکالیف</div>
                            <div class="points-history-date">از دیتابیس</div>
                        </div>
                        <div class="points-history-value">+${toPersianNum(totalLessonPoints)}</div>
                    </div>
                `;
            }

            // ۲. امتیازات چالش هفتگی
            const { data: rankingData } = await client
                .from('rankings')
                .select('custom_points_added')
                .eq('student_id', studentId)
                .maybeSingle();
            
            if (rankingData && rankingData.custom_points_added > 0) {
                const chalPoints = rankingData.custom_points_added;
                totalPoints += chalPoints;
                historyHTML += `
                    <div class="points-history-item challenge-item">
                        <div class="points-history-icon challenge">🏆</div>
                        <div class="points-history-info">
                            <div class="points-history-title">مجموع چالش‌های هفتگی</div>
                            <div class="points-history-date">از دیتابیس</div>
                        </div>
                        <div class="points-history-value">+${toPersianNum(chalPoints)}</div>
                    </div>
                `;
            }
        }
    } catch(e) {
        console.warn('خطا در دریافت تاریخچه امتیازات:', e);
    }

    const container = document.getElementById('points-history-content');
    if (!container) return;
    
    if (historyHTML === '') {
        historyHTML = `<div class="points-history-empty">این کاربر هنوز هیچ امتیازی کسب نکرده است.</div>`;
    }

    container.innerHTML = `
        <button class="points-history-close" onclick="closePointsHistoryModal()">✕</button>
        <div class="points-history-header">
            <h2>تاریخچه امتیازات</h2>
            <div class="points-history-total">
                ${toPersianNum(totalPoints)} <span>امتیاز</span>
            </div>
        </div>
        <div style="padding-bottom: 10px;">
            ${historyHTML}
        </div>
    `;
}

function closePointsHistoryModal() {
    const modal = document.getElementById('points-history-modal');
    if (modal) modal.remove();
}