// ============================================================
// auth.js — سیستم ورود با آیدی
// نسخه: ۱.۰.۰
// ============================================================

// ============================================================
// ورود با آیدی
// ============================================================
async function loginWithUserId() {
    const input = document.getElementById('login-userid');
    const userId = input.value.trim();

    if (!userId) {
        showModal('خطا', 'لطفاً آیدی خودت رو وارد کن.', '⚠️');
        return;
    }

    // نمایش لودینگ
    const btn = document.querySelector('.login-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'در حال بررسی...';
    }

    try {
        const client = getSupabase();
        if (!client) {
            showModal('خطا', 'اتصال به سرور برقرار نیست. لطفاً اینترنتت رو چک کن.', '❌');
            resetLoginButton();
            return;
        }

        // جستجو در جدول students
        const { data, error } = await client
            .from('students')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('خطا در جستجو:', error);
            showModal('خطا', 'مشکلی در اتصال پیش اومد. دوباره تلاش کن.', '❌');
            resetLoginButton();
            return;
        }

        if (!data) {
            showModal('آیدی پیدا نشد', 'این آیدی در سیستم وجود نداره. لطفاً آیدی درست رو وارد کن یا از معلمت بپرس.', '🔍');
            resetLoginButton();
            return;
        }

        // ✅ ورود موفق
        console.log('✅ ورود موفق:', data);
        await handleSuccessfulLogin(data);

    } catch (error) {
        console.error('خطا:', error);
        showModal('خطا', 'مشکلی پیش اومد. دوباره تلاش کن.', '❌');
        resetLoginButton();
    }
}

function resetLoginButton() {
    const btn = document.querySelector('.login-btn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'ورود به برنامه 🚀';
    }
}

// ============================================================
// ذخیره اطلاعات کاربر بعد از ورود
// ============================================================
async function handleSuccessfulLogin(studentData) {
    // ذخیره اطلاعات در localStorage
    localStorage.setItem('userUUID', studentData.uuid);       // UUID داخلی
    localStorage.setItem('studentUUID', studentData.uuid);    // برای سازگاری با کدهای قدیمی
    localStorage.setItem('userId', studentData.user_id);      // آیدی ورود
    localStorage.setItem('userName', studentData.full_name);
    localStorage.setItem('userClass', studentData.class_name || 'هفتم یک');
    localStorage.setItem('userSchool', studentData.school || 'تعیین نشده');
    localStorage.setItem('userRegistered', 'true');

    // ذخیره آواتار
    if (studentData.avatar_url && studentData.avatar_url !== 'default') {
        if (studentData.avatar_url.startsWith('emoji:')) {
            localStorage.setItem('userAvatarEmoji', studentData.avatar_url.replace('emoji:', ''));
            localStorage.removeItem('userAvatar');
        } else {
            localStorage.setItem('userAvatar', studentData.avatar_url);
            localStorage.removeItem('userAvatarEmoji');
        }
    }

    // به‌روزرسانی last_login در Supabase
    try {
        const client = getSupabase();
        if (client) {
            await client
                .from('students')
                .update({ last_login: new Date().toISOString() })
                .eq('uuid', studentData.uuid);
        }
    } catch (e) {
        console.warn('خطا در آپدیت last_login:', e);
    }

    // 🆕 بارگذاری کارنامه‌ها و امتیازها از Supabase به localStorage
    await syncStudentDataFromSupabase(studentData.uuid);

    // به‌روزرسانی UI
    if (typeof updateHomeUI === 'function') updateHomeUI();
    if (typeof updateStreak === 'function') updateStreak();

    // نمایش خوش‌آمدگویی
    const welcomeName = document.getElementById('welcome-user-name');
    if (welcomeName) welcomeName.textContent = studentData.full_name;

    // رفتن به صفحه خانه
    if (typeof goToScreen === 'function') {
        goToScreen('screen-home', false);
    }

    // نمایش خوش‌آمد بعد از کمی تاخیر
    setTimeout(() => {
        if (typeof loadLessonsListForNotification === 'function') {
            loadLessonsListForNotification();
        }
        if (typeof checkAndShowNotification === 'function') checkAndShowNotification();
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
        
        // خوش‌آمدگویی
        if (localStorage.getItem('guideCompleted') !== 'true') {
            if (typeof showGuideStep === 'function') {
                if (typeof currentGuideStep !== 'undefined') currentGuideStep = 0;
                showGuideStep();
            }
        } else {
            if (typeof showStreakMessage === 'function') showStreakMessage();
        }
    }, 500);

    vibrate([30, 50, 30]);
}

// ============================================================
// همگام‌سازی اطلاعات دانش‌آموز از Supabase
// ============================================================
async function syncStudentDataFromSupabase(uuid) {
    try {
        const client = getSupabase();
        if (!client) return;

        console.log('🔄 همگام‌سازی اطلاعات از Supabase...');

        // ۱. بارگذاری کارنامه‌ها
        const { data: reports, error: reportsError } = await client
            .from('reports')
            .select('*')
            .eq('student_id', uuid)
            .order('created_at', { ascending: false });

        if (reportsError) {
            console.warn('خطا در بارگذاری کارنامه‌ها:', reportsError);
        } else if (reports && reports.length > 0) {
            // تبدیل فرمت Supabase به فرمت localStorage
            const formattedReports = reports.map(r => ({
                studentName: localStorage.getItem('userName'),
                studentClass: localStorage.getItem('userClass'),
                lessonId: r.lesson_id,
                lessonTitle: r.lesson_title,
                date: new Date(r.created_at).toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                timestamp: r.created_at,
                percent: r.percent,
                correct: r.correct,
                wrong: r.wrong,
                score: r.score,
                totalPoints: r.total_points,
                timeTaken: r.time_taken
            }));
            localStorage.setItem('reports', JSON.stringify(formattedReports));
            console.log('✅ کارنامه‌ها همگام‌سازی شد:', formattedReports.length);
        }

        // ۲. بارگذاری امتیازهای دستی
        const { data: ranking, error: rankingError } = await client
            .from('rankings')
            .select('custom_points_added, custom_total_points')
            .eq('student_id', uuid)
            .maybeSingle();

        if (!rankingError && ranking) {
            localStorage.setItem('customPointsAdded', ranking.custom_points_added || 0);
            localStorage.setItem('customTotalPoints', ranking.custom_total_points || 0);
            console.log('✅ امتیاز دستی همگام‌سازی شد');
        }

    } catch (error) {
        console.error('خطا در همگام‌سازی:', error);
    }
}

// ============================================================
// ذخیره کاربر جدید (ثبت‌نام)
// ============================================================
async function registerNewStudent(name, className, school) {
    try {
        const client = getSupabase();
        if (!client) {
            return { success: false, error: 'اتصال به سرور برقرار نیست' };
        }

        // ۱. ساخت UUID جدید
        const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });

        // ۲. چک کردن اینکه نام تکراری نباشه
        const { data: existing } = await client
            .from('students')
            .select('user_id, full_name')
            .eq('full_name', name)
            .maybeSingle();

        if (existing) {
            return { 
                success: false, 
                error: 'این نام قبلاً ثبت شده. اگه خودتی، از معلمت آیدیت رو بپرس.' 
            };
        }

        // ۳. ساخت آیدی خودکار
        // از نام + 6 رقم تصادفی
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const userId = 'student_' + randomNum;

        // ۴. درج در Supabase
        const { data, error } = await client
            .from('students')
            .insert({
                uuid: uuid,
                user_id: userId,
                full_name: name,
                class_name: className,
                school: school,
                avatar_url: 'default',
                custom_points_added: 0,
                custom_total_points: 0
            })
            .select()
            .single();

        if (error) {
            console.error('خطا در ثبت‌نام:', error);
            return { success: false, error: error.message };
        }

        // ۵. ساخت رکورد در rankings هم
        try {
            await client
                .from('rankings')
                .insert({
                    student_id: uuid,
                    name: name,
                    class_name: classNameToSlug(className),
                    total_points: 0,
                    completed_lessons: 0,
                    avg_percent: 0,
                    streak_days: 0,
                    avatar_url: 'default',
                    custom_points_added: 0,
                    custom_total_points: 0
                });
        } catch (e) {
            console.warn('خطا در ساخت رکورد rankings:', e);
        }

        console.log('✅ ثبت‌نام موفق:', data);
        return { success: true, data: data };

    } catch (error) {
        console.error('خطا در ثبت‌نام:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// خروج از حساب (برگشت به صفحه ورود)
// ============================================================
function logoutFromAccount() {
    // پاک کردن اطلاعات ورود
    const keysToRemove = [
        'userUUID', 'studentUUID', 'userId', 'userName', 'userClass',
        'userSchool', 'userYear', 'userRegistered', 'userAvatar',
        'userAvatarEmoji', 'reports', 'streakData', 'customPointsAdded',
        'customTotalPoints', 'currentLessonProgress'
    ];

    keysToRemove.forEach(k => localStorage.removeItem(k));

    // رفتن به صفحه ورود
    if (typeof goToScreen === 'function') {
        goToScreen('screen-login', false);
    }

    // پاک کردن ورودی
    const input = document.getElementById('login-userid');
    if (input) input.value = '';

    vibrate(30);
}

// ============================================================
// ویرایش آیدی کاربر
// ============================================================
function openEditUserId() {
    const currentUserId = localStorage.getItem('userId') || '';
    const input = document.getElementById('edit-userid');
    if (input) {
        input.value = currentUserId;
    }
    document.getElementById('edit-userid-modal').classList.add('active');
}

function closeEditUserId() {
    document.getElementById('edit-userid-modal').classList.remove('active');
}

async function saveUserIdChanges() {
    const newUserId = document.getElementById('edit-userid').value.trim();

    // اعتبارسنجی
    if (!newUserId) {
        showModal('خطا', 'آیدی نمی‌تونه خالی باشه.', '⚠️');
        return;
    }

    if (newUserId.length < 3) {
        showModal('خطا', 'آیدی باید حداقل ۳ کاراکتر باشه.', '⚠️');
        return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUserId)) {
        showModal('خطا', 'آیدی فقط می‌تونه شامل حروف انگلیسی، عدد و _ باشه.', '⚠️');
        return;
    }

    const currentUserId = localStorage.getItem('userId');
    if (newUserId === currentUserId) {
        closeEditUserId();
        return;
    }

    try {
        const client = getSupabase();
        if (!client) {
            showModal('خطا', 'اتصال به سرور برقرار نیست.', '❌');
            return;
        }

        // چک یکتا بودن
        const { data: existing } = await client
            .from('students')
            .select('user_id')
            .eq('user_id', newUserId)
            .maybeSingle();

        if (existing) {
            showModal('آیدی تکراری', 'این آیدی قبلاً استفاده شده. یه آیدی دیگه انتخاب کن.', '⚠️');
            return;
        }

        // آپدیت در Supabase
        const uuid = localStorage.getItem('userUUID');
        const { error } = await client
            .from('students')
            .update({ user_id: newUserId })
            .eq('uuid', uuid);

        if (error) {
            console.error('خطا در ویرایش آیدی:', error);
            showModal('خطا', 'مشکلی در ذخیره‌سازی پیش اومد.', '❌');
            return;
        }

        // آپدیت در localStorage
        localStorage.setItem('userId', newUserId);

        // آپدیت نمایش
        const display = document.getElementById('profile-userid-display');
        if (display) display.textContent = newUserId;

        closeEditUserId();
        showModal('موفق', 'آیدی با موفقیت تغییر کرد.', '✅');
        vibrate([30, 50, 30]);

    } catch (error) {
        console.error('خطا:', error);
        showModal('خطا', 'مشکلی پیش اومد.', '❌');
    }
}

// ============================================================
// بارگذاری اطلاعات کاربر (در ابتدای برنامه)
// ============================================================
function loadUserDataFromStorage() {
    const isRegistered = localStorage.getItem('userRegistered') === 'true';
    if (!isRegistered) return false;

    const userName = localStorage.getItem('userName');
    const userId = localStorage.getItem('userId');

    if (!userName || !userId) return false;

    return true;
}

console.log('🔐 auth.js بارگذاری شد');