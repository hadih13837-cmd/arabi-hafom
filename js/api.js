// ============================================================
// api.js — API با Supabase
// نسخه: ۳۱.۰.۰ — رفع باگ صفر شدن امتیاز و حفظ custom_points
// ============================================================

const TEACHER_API_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
const API_URL = TEACHER_API_URL;

async function updateStudentCode(studentId, newCode) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };
        const { data: existing, error: checkError } = await client.from('rankings').select('student_id').eq('student_code', newCode).maybeSingle();
        if (checkError && checkError.code !== 'PGRST116') return { success: false, error: checkError.message };
        if (existing && existing.student_id !== studentId) return { success: false, error: 'code_taken' };
        const { error } = await client.from('rankings').update({ student_code: newCode }).eq('student_id', studentId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateCompletedLessonsDelta(studentId, delta) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };
        const { data: current } = await client.from('rankings').select('custom_completed_lessons').eq('student_id', studentId).maybeSingle();
        if (!current) return { success: false, error: 'not_found' };
        const currentCustom = parseInt(current.custom_completed_lessons) || 0;
        const newCustom = currentCustom + delta;
        const { error } = await client.from('rankings').update({ custom_completed_lessons: newCustom }).eq('student_id', studentId);
        if (error) return { success: false, error: error.message };
        return { success: true, newValue: newCustom };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateCompletedLessons(studentId, count) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };
        const safeCount = parseInt(count) || 0;
        const { error } = await client.from('rankings').update({ custom_completed_lessons: safeCount }).eq('student_id', studentId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// 🆕 محاسبه مجموع امتیاز از یک رکورد ranking
function calculateTotalPointsFromRanking(ranking) {
    if (!ranking) return 0;
    const base = parseInt(ranking.total_points) || 0;
    const challenge = parseInt(ranking.custom_points_added) || 0;
    const manual = parseInt(ranking.custom_total_points) || 0;
    const total = base + challenge + manual;
    // 🆕 جلوگیری از امتیاز منفی
    return Math.max(0, total);
}

function calculateCompletedLessons(ranking) {
    if (!ranking) return 0;
    const base = parseInt(ranking.completed_lessons) || 0;
    const custom = parseInt(ranking.custom_completed_lessons) || 0;
    return Math.max(0, base + custom);
}
// ============================================================
// 🆕 saveRankingToSupabase — نسخه نهایی (رفع کامل باگ صفر شدن امتیاز)
// این نسخه: custom_points_added و custom_total_points را حفظ می‌کند
// ============================================================
async function saveRankingToSupabase() {
    try {
        const client = getSupabase();
        if (!client) return false;

        // 🆕 بررسی ۱: اطمینان از وجود studentUUID
        let studentId = localStorage.getItem('studentUUID');
        if (!studentId) {
            const studentCode = localStorage.getItem('studentCode');
            if (studentCode && typeof generateUUIDFromCode === 'function') {
                studentId = await generateUUIDFromCode(studentCode);
                localStorage.setItem('studentUUID', studentId);
            } else {
                console.warn('⚠️ نه studentUUID و نه studentCode موجود نیست');
                return false;
            }
        }

        const userName = localStorage.getItem('userName');
        const userClass = localStorage.getItem('userClass');
        const studentCode = localStorage.getItem('studentCode') || null;
        if (!userName || !userClass) {
            console.warn('⚠️ نام یا کلاس کاربر موجود نیست');
            return false;
        }

        // 🆕 بررسی ۲: خواندن داده فعلی از دیتابیس (برای حفظ custom_points)
        const { data: existingData, error: existingError } = await client
            .from('rankings')
            .select('student_code, custom_completed_lessons, custom_points_added, custom_total_points, total_points, completed_lessons, avg_percent')
            .eq('student_id', studentId)
            .maybeSingle();

        if (existingError && existingError.code !== 'PGRST116') {
            console.error('❌ خطا در خواندن داده فعلی:', existingError.message);
            return false;
        }

        // 🆕 بررسی ۳: خواندن گزارش‌ها از Supabase
        let supabaseReports = [];
        try {
            const result = await getReportsFromSupabase(studentId);
            supabaseReports = Array.isArray(result) ? result : [];
        } catch (e) {
            console.warn('⚠️ خطا در دریافت گزارش‌ها از Supabase:', e.message);
            supabaseReports = [];
        }

        // 🆕 بررسی ۴: خواندن گزارش‌های محلی
        let localReports = [];
        try {
            const rawLocal = localStorage.getItem('reports');
            localReports = rawLocal ? JSON.parse(rawLocal) : [];
            if (!Array.isArray(localReports)) localReports = [];
        } catch (e) {
            console.warn('⚠️ خطا در خواندن گزارش‌های محلی:', e.message);
            localReports = [];
        }

        // 🆕 بررسی ۵: ترکیب هر دو منبع (با اولویت Supabase)
        const uniqueMap = {};

        supabaseReports.forEach(r => {
            if (!r.lesson_id) return;
            if (!uniqueMap[r.lesson_id] || new Date(r.created_at) > new Date(uniqueMap[r.lesson_id].created_at)) {
                uniqueMap[r.lesson_id] = {
                    lesson_id: r.lesson_id,
                    score: parseInt(r.score) || 0,
                    percent: parseInt(r.percent) || 0,
                    created_at: r.created_at
                };
            }
        });

        localReports.forEach(r => {
            if (!r.lessonId) return;
            if (!uniqueMap[r.lessonId]) {
                uniqueMap[r.lessonId] = {
                    lesson_id: r.lessonId,
                    score: parseInt(r.score) || 0,
                    percent: parseInt(r.percent) || 0,
                    created_at: r.timestamp || new Date().toISOString()
                };
            }
        });

        const uniqueReports = Object.values(uniqueMap);

        // 🆕 محاسبه دقیق امتیاز کل
        const totalPoints = uniqueReports.reduce((sum, r) => sum + (r.score || 0), 0);
        const realCompletedLessons = uniqueReports.length;
        const avgPercent = uniqueReports.length > 0
            ? Math.round(uniqueReports.reduce((sum, r) => sum + (r.percent || 0), 0) / uniqueReports.length)
            : 0;

        // 🆕 جلوگیری از صفر شدن در صورت نبود داده
        let finalTotalPoints = totalPoints;
        let finalCompletedLessons = realCompletedLessons;
        let finalAvgPercent = avgPercent;

        if (uniqueReports.length === 0 && existingData) {
            const prevTotal = parseInt(existingData.total_points) || 0;
            if (prevTotal > 0) {
                console.log('⚠️ هیچ گزارشی یافت نشد، اما امتیاز قبلی وجود دارد. حفظ می‌شود:', prevTotal);
                finalTotalPoints = prevTotal;
                finalCompletedLessons = parseInt(existingData.completed_lessons) || 0;
                finalAvgPercent = parseInt(existingData.avg_percent) || 0;
            }
        }

        // 🆕 داده استریک
        let streakDays = 0;
        try {
            const streakData = JSON.parse(localStorage.getItem('streakData') || '{}');
            streakDays = parseInt(streakData.count) || 0;
        } catch (e) {}

        // 🆕 آواتار
        let avatarUrl = 'default';
        const avatarImg = localStorage.getItem('userAvatar');
        const avatarEmoji = localStorage.getItem('userAvatarEmoji');
        if (avatarImg) {
            avatarUrl = avatarImg.length > 100000 ? 'emoji:👤' : avatarImg;
        } else if (avatarEmoji) {
            avatarUrl = 'emoji:' + avatarEmoji;
        }

        // 🆕 کد نهایی
        const finalCode = (existingData && existingData.student_code)
            ? existingData.student_code
            : studentCode;

        // 🆕 ساخت payload نهایی — حفظ custom_points
        const payload = {
            student_id: studentId,
            name: userName,
            class_name: classNameToSlug(userClass),
            total_points: finalTotalPoints,
            avg_percent: finalAvgPercent,
            streak_days: streakDays,
            avatar_url: String(avatarUrl),
            student_code: finalCode,
            last_update: new Date().toISOString(),
            completed_lessons: finalCompletedLessons
        };

        // 🆕 مقادیر سفارشی: فقط اگر رکورد جدید است، مقدار ۰ بده
        // اگر رکورد وجود دارد، مقادیر قبلی را حفظ کن
        if (!existingData) {
            payload.custom_completed_lessons = 0;
            payload.custom_points_added = 0;
            payload.custom_total_points = 0;
        } else {
            // حفظ مقادیر قبلی (یا ۰ اگر null بود)
            payload.custom_completed_lessons = parseInt(existingData.custom_completed_lessons) || 0;
            payload.custom_points_added = parseInt(existingData.custom_points_added) || 0;
            payload.custom_total_points = parseInt(existingData.custom_total_points) || 0;
        }

        // 🆕 ذخیره با upsert
        const { error } = await client.from('rankings').upsert(payload, { onConflict: 'student_id' });
        if (error) {
            console.error('❌ خطا در ذخیره امتیاز:', error.message);
            return false;
        }

        return true;
    } catch (error) {
        console.error('❌ خطا در saveRankingToSupabase:', error);
        return false;
    }
}
async function getStudentLessonStatus(studentId) {
    try {
        const client = getSupabase();
        if (!client) return {};
        const { data, error } = await client.from('lesson_status').select('*').eq('student_id', studentId);
        if (error) return {};
        const statusMap = {};
        (data || []).forEach(item => {
            statusMap[item.lesson_id] = {
                is_enabled: item.is_enabled !== false,
                custom_due_date: item.custom_due_date || null,
                custom_points: item.custom_points || 0
            };
        });
        return statusMap;
    } catch (error) { return {}; }
}

async function getAllLessonStatuses() {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('lesson_status').select('*');
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function setClassDueDate(lessonId, className, newDate) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };

        if (className === 'all') {
            const { data: existing } = await client
                .from('lesson_status')
                .select('id')
                .eq('lesson_id', lessonId)
                .eq('class_name', 'all')
                .maybeSingle();

            if (existing) {
                const { error } = await client
                    .from('lesson_status')
                    .update({ custom_due_date: newDate })
                    .eq('id', existing.id);
                if (error) return { success: false, error: error.message };
            } else {
                const { error } = await client
                    .from('lesson_status')
                    .insert({
                        lesson_id: lessonId,
                        class_name: 'all',
                        is_enabled: true,
                        custom_due_date: newDate
                    });
                if (error) return { success: false, error: error.message };
            }
        } else {
            const { data: existing, error: findErr } = await client
                .from('lesson_status')
                .select('id, is_enabled')
                .eq('lesson_id', lessonId)
                .eq('class_name', className)
                .maybeSingle();

            if (findErr && findErr.code !== 'PGRST116') {
                return { success: false, error: findErr.message };
            }

            if (existing) {
                const { error } = await client
                    .from('lesson_status')
                    .update({ custom_due_date: newDate })
                    .eq('id', existing.id);
                if (error) return { success: false, error: error.message };
            } else {
                const { error } = await client
                    .from('lesson_status')
                    .insert({
                        lesson_id: lessonId,
                        class_name: className,
                        is_enabled: true,
                        custom_due_date: newDate
                    });
                if (error) return { success: false, error: error.message };
            }
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function setClassLessonStatus(lessonId, className, isEnabled) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };

        if (className === 'all') {
            const { data: existing } = await client
                .from('lesson_status')
                .select('id')
                .eq('lesson_id', lessonId)
                .eq('class_name', 'all')
                .maybeSingle();

            if (existing) {
                const { error } = await client
                    .from('lesson_status')
                    .update({ is_enabled: isEnabled })
                    .eq('id', existing.id);
                if (error) return { success: false, error: error.message };
            } else {
                const { error } = await client
                    .from('lesson_status')
                    .insert({
                        lesson_id: lessonId,
                        class_name: 'all',
                        is_enabled: isEnabled
                    });
                if (error) return { success: false, error: error.message };
            }
        } else {
            const { data: existing, error: findErr } = await client
                .from('lesson_status')
                .select('id')
                .eq('lesson_id', lessonId)
                .eq('class_name', className)
                .maybeSingle();

            if (findErr && findErr.code !== 'PGRST116') {
                return { success: false, error: findErr.message };
            }

            if (existing) {
                const { error } = await client
                    .from('lesson_status')
                    .update({ is_enabled: isEnabled })
                    .eq('id', existing.id);
                if (error) return { success: false, error: error.message };
            } else {
                const { error } = await client
                    .from('lesson_status')
                    .insert({
                        lesson_id: lessonId,
                        class_name: className,
                        is_enabled: isEnabled
                    });
                if (error) return { success: false, error: error.message };
            }
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateStudentDueDate(studentId, lessonId, newDate) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };
        const { data: existing } = await client.from('lesson_status').select('id').eq('student_id', studentId).eq('lesson_id', lessonId).maybeSingle();
        if (existing) {
            const { error } = await client.from('lesson_status').update({ custom_due_date: newDate, is_enabled: true }).eq('id', existing.id);
            if (error) {
                console.error('❌ خطا:', error.message);
                return { success: false, error: error.message };
            }
        } else {
            const { error } = await client.from('lesson_status').insert({
                student_id: studentId, lesson_id: lessonId, is_enabled: true, custom_points: 0, custom_due_date: newDate
            });
            if (error) {
                console.error('❌ خطا:', error.message);
                return { success: false, error: error.message };
            }
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function removeStudentCustomDueDate(studentId, lessonId) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };
        const { data: existing } = await client.from('lesson_status').select('id').eq('student_id', studentId).eq('lesson_id', lessonId).maybeSingle();
        if (existing) {
            const { error } = await client.from('lesson_status').update({ custom_due_date: null }).eq('id', existing.id);
            if (error) return { success: false, error: error.message };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
async function saveReportToSupabase(report, studentId) {
    try {
        const client = getSupabase();
        if (!client) {
            console.warn('⚠️ client نیست');
            return false;
        }

        if (!studentId) {
            console.warn('⚠️ studentId نیست');
            return false;
        }

        if (!report || !report.lessonId) {
            console.warn('⚠️ report یا lessonId نیست');
            return false;
        }

        const { data: existing, error: checkError } = await client
            .from('reports')
            .select('id')
            .eq('student_id', studentId)
            .eq('lesson_id', report.lessonId)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('❌ خطا در بررسی تکراری:', checkError.message);
            return false;
        }

        if (existing) {
            console.log('ℹ️ گزارش قبلاً ثبت شده:', report.lessonId);
            return true;
        }

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

        const { error } = await client.from('reports').insert(payload);

        if (error) {
            if (error.code === '23505') {
                console.log('ℹ️ گزارش تکراری (کد 23505)');
                return true;
            }
            console.error('❌ خطا در ذخیره گزارش:', error.message);
            return false;
        }

        return true;
    } catch (error) {
        console.error('❌ خطا در saveReportToSupabase:', error);
        return false;
    }
}

async function getReportsFromSupabase(studentId) {
    try {
        const client = getSupabase();
        if (!client) return [];

        if (!studentId) return [];

        const { data, error } = await client
            .from('reports')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('⚠️ خطا در دریافت کارنامه از سرور:', error.message);
            return [];
        }

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('⚠️ خطا در getReportsFromSupabase:', error);
        return [];
    }
}

async function saveProgressToSupabase(progress, studentId) {
    try {
        const client = getSupabase();
        if (!client) return false;

        if (!studentId || !progress || !progress.lessonId) {
            console.warn('⚠️ اطلاعات ناقص برای ذخیره پیشرفت');
            return false;
        }

        const safeStartTime = progress.startTime
            ? (typeof progress.startTime === 'number' ? progress.startTime : new Date(progress.startTime).getTime())
            : Date.now();

        const payload = {
            student_id: studentId,
            lesson_id: progress.lessonId,
            question_index: parseInt(progress.questionIndex) || 0,
            score: parseInt(progress.score) || 0,
            correct_count: parseInt(progress.correctCount) || 0,
            wrong_count: parseInt(progress.wrongCount) || 0,
            is_practice_mode: progress.isPracticeMode === true,
            start_time: safeStartTime,
            total_questions: parseInt(progress.totalQuestions) || 12,
            lesson_title: progress.lessonTitle || '',
            last_update: new Date().toISOString()
        };

        const { data: existing } = await client
            .from('current_progress')
            .select('id')
            .eq('student_id', studentId)
            .eq('lesson_id', progress.lessonId)
            .maybeSingle();

        if (existing) {
            const { error } = await client.from('current_progress').update(payload).eq('id', existing.id);
            if (error) {
                console.warn('⚠️ خطا در آپدیت پیشرفت:', error.message);
                return false;
            }
        } else {
            const { error } = await client.from('current_progress').insert(payload);
            if (error) {
                console.warn('⚠️ خطا در ایجاد پیشرفت:', error.message);
                return false;
            }
        }
        return true;
    } catch (error) {
        console.warn('⚠️ خطا در saveProgressToSupabase:', error);
        return false;
    }
}

async function getProgressFromSupabase(studentId, lessonId) {
    try {
        const client = getSupabase();
        if (!client) return null;

        if (!studentId) return null;

        let query = client.from('current_progress').select('*').eq('student_id', studentId);
        if (lessonId) query = query.eq('lesson_id', lessonId);

        const { data, error } = await query.maybeSingle();

        if (error || !data) return null;

        return {
            lessonId: data.lesson_id,
            questionIndex: data.question_index,
            score: data.score,
            correctCount: data.correct_count,
            wrongCount: data.wrong_count,
            isPracticeMode: data.is_practice_mode,
            startTime: data.start_time,
            totalQuestions: data.total_questions,
            lessonTitle: data.lesson_title
        };
    } catch (error) {
        return null;
    }
}

async function clearProgressFromSupabase(studentId, lessonId) {
    try {
        const client = getSupabase();
        if (!client) return false;

        if (!studentId || !lessonId) return false;

        await client
            .from('current_progress')
            .delete()
            .eq('student_id', studentId)
            .eq('lesson_id', lessonId);

        return true;
    } catch (error) {
        return false;
    }
}
async function getRankingsByClass(className) {
    try {
        const client = getSupabase();
        if (!client) return [];

        const classSlug = classNameToSlug(className);

        const { data, error } = await client
            .from('rankings')
            .select('student_id, name, class_name, total_points, completed_lessons, custom_completed_lessons, custom_points_added, custom_total_points, avg_percent, streak_days, avatar_url')
            .eq('class_name', classSlug)
            .order('total_points', { ascending: false })
            .order('avg_percent', { ascending: false });

        if (error) {
            console.warn('⚠️ خطا در دریافت رتبه‌بندی:', error.message);
            return [];
        }

        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

async function getAllStudents() {
    try {
        const client = getSupabase();
        if (!client) return [];

        const { data, error } = await client
            .from('rankings')
            .select('*')
            .order('total_points', { ascending: false });

        if (error) {
            console.warn('⚠️ خطا در دریافت لیست دانش‌آموزان:', error.message);
            return [];
        }

        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

async function getMyRank() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        const userClass = localStorage.getItem('userClass');
        if (!studentId || !userClass) return null;

        const rankings = await getRankingsByClass(userClass);
        const myIndex = rankings.findIndex(r => r.student_id === studentId);

        if (myIndex === -1) return null;

        return {
            rank: myIndex + 1,
            total: rankings.length,
            data: rankings[myIndex]
        };
    } catch (error) {
        return null;
    }
}

// ============================================================
// پیام‌های کلاسی
// ============================================================
async function sendClassMessageToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };

        if (!data || !data.title || !data.text) {
            return { success: false, error: 'اطلاعات ناقص' };
        }

        const payload = {
            message_id: data.message_id || 'cls_' + Date.now(),
            class_name: data.class_name || 'all',
            title: data.title || '',
            text: data.text || '',
            type: data.type || 'info',
            date: data.date || new Date().toISOString(),
            date_persian: data.date_persian || ''
        };

        const { error } = await client.from('class_messages').insert(payload);

        return { success: !error, error: error?.message };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getClassMessagesFromSupabase(className) {
    try {
        const client = getSupabase();
        if (!client) return [];

        const classSlug = classNameToSlug(className);
        let query = client.from('class_messages').select('*').order('date', { ascending: false });

        if (classSlug && classSlug !== 'all' && classSlug !== 'unknown') {
            query = query.or(`class_name.eq.${classSlug},class_name.eq.all`);
        }

        const { data, error } = await query;

        if (error) {
            console.warn('⚠️ خطا در دریافت پیام‌های کلاسی:', error.message);
            return [];
        }

        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

// ============================================================
// پیام‌های شخصی
// ============================================================
async function sendPersonalMessageToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };

        if (!data || !data.student_id || !data.text) {
            return { success: false, error: 'اطلاعات ناقص' };
        }

        const payload = {
            message_id: data.message_id || 'pm_' + Date.now(),
            student_id: data.student_id,
            student_name: data.student_name || '',
            class_name: data.class_name || '',
            sender: data.sender || 'student',
            text: data.text || '',
            date: data.date || new Date().toISOString(),
            date_persian: data.date_persian || '',
            is_seen: data.is_seen === true || data.is_seen === 'true'
        };

        const { error } = await client.from('personal_messages').insert(payload);

        if (error) {
            console.error('❌ خطا در ارسال پیام:', error.message);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getPersonalMessages(studentId) {
    try {
        const client = getSupabase();
        if (!client) return [];

        if (!studentId) return [];

        const { data, error } = await client
            .from('personal_messages')
            .select('*')
            .eq('student_id', studentId)
            .order('date', { ascending: true });

        if (error) {
            console.warn('⚠️ خطا در دریافت پیام‌های شخصی:', error.message);
            return [];
        }

        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

async function getStudentConversationsFromSupabase() {
    try {
        const client = getSupabase();
        if (!client) return [];

        const { data, error } = await client
            .from('personal_messages')
            .select('*')
            .order('date', { ascending: true });

        if (error) {
            console.warn('⚠️ خطا در دریافت مکالمات:', error.message);
            return [];
        }

        const conversationsMap = {};

        (data || []).forEach(msg => {
            const studentId = msg.student_id;
            if (!studentId) return;

            if (!conversationsMap[studentId]) {
                conversationsMap[studentId] = {
                    student_id: studentId,
                    student_name: msg.student_name || '',
                    class_name: msg.class_name || '',
                    last_message: msg.text || '',
                    last_sender: msg.sender || '',
                    last_date: msg.date || '',
                    last_date_persian: msg.date_persian || '',
                    last_message_time: msg.date,
                    unread_count: 0,
                    avatar_url: '',
                    messages: []
                };
            }

            conversationsMap[studentId].messages.push(msg);

            if (new Date(msg.date) > new Date(conversationsMap[studentId].last_date || 0)) {
                conversationsMap[studentId].last_message = msg.text || '';
                conversationsMap[studentId].last_sender = msg.sender || '';
                conversationsMap[studentId].last_date = msg.date || '';
                conversationsMap[studentId].last_date_persian = msg.date_persian || '';
                conversationsMap[studentId].last_message_time = msg.date;
            }

            if (msg.sender === 'student' && !msg.is_seen) {
                conversationsMap[studentId].unread_count++;
            }
        });

        try {
            const studentIds = Object.keys(conversationsMap);
            if (studentIds.length > 0) {
                const { data: rankings } = await client
                    .from('rankings')
                    .select('student_id, avatar_url')
                    .in('student_id', studentIds);

                (rankings || []).forEach(r => {
                    if (conversationsMap[r.student_id]) {
                        conversationsMap[r.student_id].avatar_url = r.avatar_url || '';
                    }
                });
            }
        } catch (e) {
            console.warn('⚠️ خطا در دریافت آواتارها:', e);
        }

        const conversations = Object.values(conversationsMap);
        conversations.sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));

        return conversations;
    } catch (error) {
        console.error('❌ خطا در getStudentConversationsFromSupabase:', error);
        return [];
    }
}

async function markAllMessagesAsSeenSupabase(studentId, reader) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };

        if (!studentId) return { success: false };

        const senderToMark = reader === 'teacher' ? 'student' : 'teacher';

        const { error } = await client
            .from('personal_messages')
            .update({ is_seen: true })
            .eq('student_id', studentId)
            .eq('sender', senderToMark)
            .eq('is_seen', false);

        if (error) {
            console.warn('⚠️ خطا در علامت‌گذاری:', error.message);
        }

        return { success: !error, error: error?.message };
    } catch (error) {
        return { success: false };
    }
}

// ============================================================
// رویدادها، مسابقات، کتابخانه
// ============================================================
async function addEventToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };

        if (!data || !data.title || !data.date) {
            return { success: false, error: 'اطلاعات ناقص' };
        }

        const payload = {
            event_id: data.event_id || 'evt_' + Date.now(),
            title: data.title || '',
            date: data.date || '',
            class_name: data.class_name || 'all',
            type: data.type || 'event',
            description: data.description || ''
        };

        const { error } = await client.from('events').insert(payload);

        return { success: !error, error: error?.message };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getEventsFromSupabase() {
    try {
        const client = getSupabase();
        if (!client) return [];

        const { data, error } = await client
            .from('events')
            .select('*')
            .order('date', { ascending: false });

        if (error) return [];

        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

async function addContestToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };

        if (!data || !data.title || !data.start_date || !data.end_date) {
            return { success: false, error: 'اطلاعات ناقص' };
        }

        const payload = {
            contest_id: data.contest_id || 'cnt_' + Date.now(),
            title: data.title || '',
            prize: data.prize || '',
            start_date: data.start_date || '',
            end_date: data.end_date || '',
            description: data.description || ''
        };

        const { error } = await client.from('contests').insert(payload);

        return { success: !error, error: error?.message };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getContestsFromSupabase() {
    try {
        const client = getSupabase();
        if (!client) return [];

        const { data, error } = await client
            .from('contests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return [];

        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

async function addLibraryToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };

        if (!data || !data.title || !data.url) {
            return { success: false, error: 'اطلاعات ناقص' };
        }

        const payload = {
            item_id: data.item_id || 'lib_' + Date.now(),
            title: data.title || '',
            type: data.type || 'video',
            url: data.url || '',
            description: data.description || ''
        };

        const { error } = await client.from('library').insert(payload);

        return { success: !error, error: error?.message };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getLibraryFromSupabase() {
    try {
        const client = getSupabase();
        if (!client) return [];

        const { data, error } = await client
            .from('library')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return [];

        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

// ============================================================
// seen_data (ذخیره وضعیت دیده‌شده)
// ============================================================
async function recoverSeenDataFromSupabase(studentId) {
    try {
        const client = getSupabase();
        if (!client) return false;

        if (!studentId) return false;

        const { data: seenData, error } = await client
            .from('seen_data')
            .select('*')
            .eq('student_id', studentId)
            .maybeSingle();

        if (error || !seenData) return false;

        if (seenData.seen_chat_messages) {
            localStorage.setItem('seenChatMessages', JSON.stringify(seenData.seen_chat_messages));
        }
        if (seenData.seen_class_messages) {
            localStorage.setItem('seenClassMessages', JSON.stringify(seenData.seen_class_messages));
        }
        if (seenData.seen_lessons) {
            localStorage.setItem('seenLessonsForNotif', JSON.stringify(seenData.seen_lessons));
            localStorage.setItem('seenLessons', JSON.stringify(seenData.seen_lessons));
        }
        if (seenData.seen_videos) {
            localStorage.setItem('seenVideos', JSON.stringify(seenData.seen_videos));
        }
        if (seenData.seen_jozve_ids) {
            localStorage.setItem('seenJozveIds', JSON.stringify(seenData.seen_jozve_ids));
        }
        if (seenData.last_streak_message_shown) {
            localStorage.setItem('lastStreakMessageShown', seenData.last_streak_message_shown);
        }
        if (seenData.dismissed_new_message_notif) {
            localStorage.setItem('dismissedNewMessageNotif', 'true');
        }
        if (seenData.dismissed_new_jozve_notif) {
            localStorage.setItem('dismissedNewJozveNotif', 'true');
        }
        if (seenData.dismissed_deadline_notif) {
            localStorage.setItem('dismissedDeadlineNotif', 'true');
        }

        return true;
    } catch (error) {
        return false;
    }
}

async function saveSeenDataToSupabase() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) return false;

        const client = getSupabase();
        if (!client) return false;

        const payload = {
            student_id: studentId,
            seen_chat_messages: JSON.parse(localStorage.getItem('seenChatMessages') || '[]').slice(-500),
            seen_class_messages: JSON.parse(localStorage.getItem('seenClassMessages') || '[]').slice(-500),
            seen_lessons: JSON.parse(localStorage.getItem('seenLessonsForNotif') || '[]'),
            seen_videos: JSON.parse(localStorage.getItem('seenVideos') || '[]'),
            seen_jozve_ids: JSON.parse(localStorage.getItem('seenJozveIds') || '[]'),
            last_streak_message_shown: localStorage.getItem('lastStreakMessageShown') || null,
            dismissed_new_message_notif: localStorage.getItem('dismissedNewMessageNotif') === 'true',
            dismissed_new_jozve_notif: localStorage.getItem('dismissedNewJozveNotif') === 'true',
            dismissed_deadline_notif: localStorage.getItem('dismissedDeadlineNotif') === 'true',
            last_update: new Date().toISOString()
        };

        const { data: existing } = await client
            .from('seen_data')
            .select('id')
            .eq('student_id', studentId)
            .maybeSingle();

        if (existing) {
            await client.from('seen_data').update(payload).eq('id', existing.id);
        } else {
            await client.from('seen_data').insert(payload);
        }

        return true;
    } catch (error) {
        return false;
    }
}

// ============================================================
// Real-time Subscriptions
// ============================================================
let personalRealtimeChannel = null;
let classRealtimeChannel = null;
let conversationsRealtimeChannel = null;

function subscribeToPersonalMessages(studentId, onNewMessage) {
    try {
        const client = getSupabase();
        if (!client) return null;

        if (!studentId) return null;

        if (personalRealtimeChannel) {
            try { client.removeChannel(personalRealtimeChannel); } catch(e) {}
        }

        personalRealtimeChannel = client
            .channel('personal_rt_' + studentId + '_' + Date.now())
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'personal_messages', filter: `student_id=eq.${studentId}` },
                (payload) => {
                    if (typeof onNewMessage === 'function') onNewMessage(payload);
                })
            .subscribe();

        return personalRealtimeChannel;
    } catch (error) {
        return null;
    }
}

function subscribeToClassMessages(className, onNewMessage) {
    try {
        const client = getSupabase();
        if (!client) return null;

        if (classRealtimeChannel) {
            try { client.removeChannel(classRealtimeChannel); } catch(e) {}
        }

        const classSlug = classNameToSlug(className);

        classRealtimeChannel = client
            .channel('class_rt_' + classSlug + '_' + Date.now())
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'class_messages' },
                (payload) => {
                    // 🆕 فقط پیام‌های مربوط به کلاس کاربر یا all
                    if (payload.new && (payload.new.class_name === classSlug || payload.new.class_name === 'all')) {
                        if (typeof onNewMessage === 'function') onNewMessage(payload);
                    }
                })
            .subscribe();

        return classRealtimeChannel;
    } catch (error) {
        return null;
    }
}

function subscribeToConversations(onChange) {
    try {
        const client = getSupabase();
        if (!client) return null;

        if (conversationsRealtimeChannel) {
            try { client.removeChannel(conversationsRealtimeChannel); } catch(e) {}
        }

        conversationsRealtimeChannel = client
            .channel('conversations_rt_' + Date.now())
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'personal_messages' },
                (payload) => {
                    if (typeof onChange === 'function') onChange(payload);
                })
            .subscribe();

        return conversationsRealtimeChannel;
    } catch (error) {
        return null;
    }
}

function unsubscribeAll() {
    try {
        const client = getSupabase();
        if (!client) return;

        client.removeAllChannels();
        personalRealtimeChannel = null;
        classRealtimeChannel = null;
        conversationsRealtimeChannel = null;
    } catch (error) {
        console.warn('⚠️ خطا در unsubscribeAll:', error);
    }
}