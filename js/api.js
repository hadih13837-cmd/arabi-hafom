// ============================================================
// api.js — API با Supabase
// نسخه: ۲۳.۰.۰ — رفع کامل خطای ذخیره‌سازی در rankings
// ============================================================

const TEACHER_API_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
const API_URL = TEACHER_API_URL;

// ============================================================
// تغییر کد ورود دانش‌آموز
// ============================================================
async function updateStudentCode(studentId, newCode) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };
        
        const { data: existing, error: checkError } = await client
            .from('rankings').select('student_id').eq('student_code', newCode).maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') {
            return { success: false, error: checkError.message };
        }
        
        if (existing && existing.student_id !== studentId) {
            return { success: false, error: 'code_taken' };
        }
        
        const { error } = await client
            .from('rankings').update({ student_code: newCode }).eq('student_id', studentId);
        
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================================
// تغییر تعداد تکالیف انجام‌شده (توسط معلم)
// ============================================================
async function updateCompletedLessonsDelta(studentId, delta) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };
        
        const { data: current } = await client
            .from('rankings').select('custom_completed_lessons').eq('student_id', studentId).maybeSingle();
        
        if (!current) return { success: false, error: 'not_found' };
        
        const currentCustom = parseInt(current.custom_completed_lessons) || 0;
        const newCustom = currentCustom + delta;
        
        const { error } = await client
            .from('rankings').update({ custom_completed_lessons: newCustom }).eq('student_id', studentId);
        
        if (error) return { success: false, error: error.message };
        return { success: true, newValue: newCustom };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateCompletedLessons(studentId, count) {
    try {
        const client = getSupabase();
        if (!client) return { success: false, error: 'no_client' };
        
        const safeCount = parseInt(count) || 0;
        
        const { error } = await client
            .from('rankings').update({ custom_completed_lessons: safeCount }).eq('student_id', studentId);
        
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function calculateCompletedLessons(ranking) {
    if (!ranking) return 0;
    const base = parseInt(ranking.completed_lessons) || 0;
    const custom = parseInt(ranking.custom_completed_lessons) || 0;
    return base + custom;
}

// ============================================================
// ذخیره/آپدیت امتیاز و رتبه‌بندی
// ============================================================
async function saveRankingToSupabase() {
    try {
        const client = getSupabase();
        if (!client) return false;
        
        let studentId = localStorage.getItem('studentUUID');
        if (!studentId) {
            const studentCode = localStorage.getItem('studentCode');
            if (studentCode && typeof generateUUIDFromCode === 'function') {
                studentId = await generateUUIDFromCode(studentCode);
                localStorage.setItem('studentUUID', studentId);
            } else {
                return false;
            }
        }
        
        const userName = localStorage.getItem('userName');
        const userClass = localStorage.getItem('userClass');
        const studentCode = localStorage.getItem('studentCode') || null;
        
        if (!userName || !userClass) return false;
        
        // امتیاز از Supabase
        const supabaseReports = await getReportsFromSupabase(studentId);
        
        // یکتا کردن
        const uniqueMap = {};
        (supabaseReports || []).forEach(r => {
            if (!r.lesson_id) return;
            if (!uniqueMap[r.lesson_id] || 
                new Date(r.created_at) > new Date(uniqueMap[r.lesson_id].created_at)) {
                uniqueMap[r.lesson_id] = r;
            }
        });
        
        const uniqueReports = Object.values(uniqueMap);
        
        const totalPoints = uniqueReports.reduce((sum, r) => sum + (r.score || 0), 0);
        const avgPercent = uniqueReports.length > 0
            ? Math.round(uniqueReports.reduce((sum, r) => sum + (r.percent || 0), 0) / uniqueReports.length)
            : 0;
        const realCompletedLessons = uniqueReports.length;
        
        const streakData = JSON.parse(localStorage.getItem('streakData') || '{}');
        const streakDays = streakData.count || 0;
        
        let avatarUrl = 'default';
        const avatarImg = localStorage.getItem('userAvatar');
        const avatarEmoji = localStorage.getItem('userAvatarEmoji');
        
        if (avatarImg) {
            avatarUrl = avatarImg.length > 100000 ? 'emoji:👤' : avatarImg;
        } else if (avatarEmoji) {
            avatarUrl = 'emoji:' + avatarEmoji;
        }
        
        const { data: existingData } = await client
            .from('rankings')
            .select('student_code, custom_completed_lessons, custom_points_added')
            .eq('student_id', studentId)
            .maybeSingle();
        
        const finalCode = (existingData && existingData.student_code) 
            ? existingData.student_code 
            : studentCode;
        
        // 🆕 Payload اصلی
        const payload = {
            student_id: studentId,
            name: userName,
            class_name: classNameToSlug(userClass),
            total_points: totalPoints,
            avg_percent: avgPercent,
            streak_days: streakDays,
            avatar_url: String(avatarUrl),
            student_code: finalCode,
            last_update: new Date().toISOString(),
            completed_lessons: realCompletedLessons
        };
        
        // 🆕 مقادیر پیش‌فرض فقط در صورت نبود رکورد یا null بودن
        if (!existingData) {
            payload.custom_completed_lessons = 0;
            payload.custom_points_added = 0;
            payload.custom_total_points = 0;
        } else {
            if (existingData.custom_completed_lessons == null) {
                payload.custom_completed_lessons = 0;
            }
            if (existingData.custom_points_added == null) {
                payload.custom_points_added = 0;
            }
        }
        
        const { error } = await client
            .from('rankings')
            .upsert(payload, { onConflict: 'student_id' });
        
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

// ============================================================
// بقیه توابع (بدون تغییر)
// ============================================================

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

async function saveReportToSupabase(report, studentId) {
    try {
        const client = getSupabase();
        if (!client) return false;
        
        const { data: existing } = await client
            .from('reports').select('id').eq('student_id', studentId).eq('lesson_id', report.lessonId).maybeSingle();
        
        if (existing) return true;
        
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
            created_at: report.timestamp || new Date().toISOString()
        };
        
        const { error } = await client.from('reports').insert(payload);
        if (error) {
            if (error.code === '23505') return true; // کد خطای تکراری بودن
            return false;
        }
        return true;
    } catch (error) { return false; }
}

async function getReportsFromSupabase(studentId) {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('reports').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function saveProgressToSupabase(progress, studentId) {
    try {
        const client = getSupabase();
        if (!client) return false;
        
        const payload = {
            student_id: studentId,
            lesson_id: progress.lessonId,
            question_index: progress.questionIndex || 0,
            score: progress.score || 0,
            correct_count: progress.correctCount || 0,
            wrong_count: progress.wrongCount || 0,
            is_practice_mode: progress.isPracticeMode || false,
            start_time: progress.startTime ? (typeof progress.startTime === 'number' ? progress.startTime : new Date(progress.startTime).getTime()) : Date.now(),
            total_questions: progress.totalQuestions || 12,
            lesson_title: progress.lessonTitle || '',
            last_update: new Date().toISOString()
        };
        
        const { data: existing } = await client.from('current_progress').select('id').eq('student_id', studentId).eq('lesson_id', progress.lessonId).maybeSingle();
        
        if (existing) {
            await client.from('current_progress').update(payload).eq('id', existing.id);
        } else {
            await client.from('current_progress').insert(payload);
        }
        return true;
    } catch (error) { return false; }
}

async function getProgressFromSupabase(studentId, lessonId) {
    try {
        const client = getSupabase();
        if (!client) return null;
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
    } catch (error) { return null; }
}

async function clearProgressFromSupabase(studentId, lessonId) {
    try {
        const client = getSupabase();
        if (!client) return false;
        await client.from('current_progress').delete().eq('student_id', studentId).eq('lesson_id', lessonId);
        return true;
    } catch (error) { return false; }
}

async function getRankingsByClass(className) {
    try {
        const client = getSupabase();
        if (!client) return [];
        const classSlug = classNameToSlug(className);
        const { data, error } = await client.from('rankings').select('*').eq('class_name', classSlug).order('total_points', { ascending: false }).order('avg_percent', { ascending: false });
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function getAllStudents() {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('rankings').select('*').order('total_points', { ascending: false });
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function getMyRank() {
    try {
        const studentId = localStorage.getItem('studentUUID');
        const userClass = localStorage.getItem('userClass');
        if (!studentId || !userClass) return null;
        const rankings = await getRankingsByClass(userClass);
        const myIndex = rankings.findIndex(r => r.student_id === studentId);
        if (myIndex === -1) return null;
        return { rank: myIndex + 1, total: rankings.length, data: rankings[myIndex] };
    } catch (error) { return null; }
}

async function sendClassMessageToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        const payload = {
            message_id: data.message_id || 'cls_' + Date.now(),
            class_name: data.class_name || 'all', title: data.title || '', text: data.text || '', type: data.type || 'info',
            date: data.date || new Date().toISOString(), date_persian: data.date_persian || ''
        };
        const { error } = await client.from('class_messages').insert(payload);
        return { success: !error, error: error?.message };
    } catch (error) { return { success: false }; }
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
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function sendPersonalMessageToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        const payload = {
            message_id: data.message_id || 'pm_' + Date.now(),
            student_id: data.student_id, student_name: data.student_name || '', class_name: data.class_name || '', sender: data.sender || 'student',
            text: data.text || '', date: data.date || new Date().toISOString(), date_persian: data.date_persian || '',
            is_seen: data.is_seen === true || data.is_seen === 'true'
        };
        const { error } = await client.from('personal_messages').insert(payload);
        return { success: !error, error: error?.message };
    } catch (error) { return { success: false }; }
}

async function getPersonalMessages(studentId) {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('personal_messages').select('*').eq('student_id', studentId).order('date', { ascending: true });
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function getStudentConversationsFromSupabase() {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('personal_messages').select('*').order('date', { ascending: true });
        if (error) return [];
        const conversationsMap = {};
        (data || []).forEach(msg => {
            const studentId = msg.student_id;
            if (!studentId) return;
            if (!conversationsMap[studentId]) {
                conversationsMap[studentId] = {
                    student_id: studentId, student_name: msg.student_name || '', class_name: msg.class_name || '', last_message: msg.text || '', last_sender: msg.sender || '', last_date: msg.date || '',
                    last_date_persian: msg.date_persian || '', last_message_time: msg.date, unread_count: 0, avatar_url: '', messages: []
                };
            }
            conversationsMap[studentId].messages.push(msg);
            if (new Date(msg.date) > new Date(conversationsMap[studentId].last_date || 0)) {
                conversationsMap[studentId].last_message = msg.text || ''; conversationsMap[studentId].last_sender = msg.sender || '';
                conversationsMap[studentId].last_date = msg.date || ''; conversationsMap[studentId].last_date_persian = msg.date_persian || ''; conversationsMap[studentId].last_message_time = msg.date;
            }
            if (msg.sender === 'student' && !msg.is_seen) conversationsMap[studentId].unread_count++;
        });
        try {
            const studentIds = Object.keys(conversationsMap);
            if (studentIds.length > 0) {
                const { data: rankings } = await client.from('rankings').select('student_id, avatar_url').in('student_id', studentIds);
                (rankings || []).forEach(r => { if (conversationsMap[r.student_id]) conversationsMap[r.student_id].avatar_url = r.avatar_url || ''; });
            }
        } catch (e) {}
        const conversations = Object.values(conversationsMap);
        conversations.sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));
        return conversations;
    } catch (error) { return []; }
}

async function markAllMessagesAsSeenSupabase(studentId, reader) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        const senderToMark = reader === 'teacher' ? 'student' : 'teacher';
        const { error } = await client.from('personal_messages').update({ is_seen: true }).eq('student_id', studentId).eq('sender', senderToMark).eq('is_seen', false);
        return { success: !error, error: error?.message };
    } catch (error) { return { success: false }; }
}

async function addEventToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        const payload = { event_id: data.event_id || 'evt_' + Date.now(), title: data.title || '', date: data.date || '', class_name: data.class_name || 'all', type: data.type || 'event', description: data.description || '' };
        const { error } = await client.from('events').insert(payload);
        return { success: !error, error: error?.message };
    } catch (error) { return { success: false }; }
}

async function getEventsFromSupabase() {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('events').select('*').order('date', { ascending: false });
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function addContestToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        const payload = { contest_id: data.contest_id || 'cnt_' + Date.now(), title: data.title || '', prize: data.prize || '', start_date: data.start_date || '', end_date: data.end_date || '', description: data.description || '' };
        const { error } = await client.from('contests').insert(payload);
        return { success: !error, error: error?.message };
    } catch (error) { return { success: false }; }
}

async function getContestsFromSupabase() {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('contests').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function addLibraryToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        const payload = { item_id: data.item_id || 'lib_' + Date.now(), title: data.title || '', type: data.type || 'video', url: data.url || '', description: data.description || '' };
        const { error } = await client.from('library').insert(payload);
        return { success: !error, error: error?.message };
    } catch (error) { return { success: false }; }
}

async function getLibraryFromSupabase() {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client.from('library').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    } catch (error) { return []; }
}

async function recoverSeenDataFromSupabase(studentId) {
    try {
        const client = getSupabase();
        if (!client) return false;
        const { data: seenData, error } = await client.from('seen_data').select('*').eq('student_id', studentId).maybeSingle();
        if (error || !seenData) return false;
        if (seenData.seen_chat_messages) localStorage.setItem('seenChatMessages', JSON.stringify(seenData.seen_chat_messages));
        if (seenData.seen_class_messages) localStorage.setItem('seenClassMessages', JSON.stringify(seenData.seen_class_messages));
        if (seenData.seen_lessons) {
            localStorage.setItem('seenLessonsForNotif', JSON.stringify(seenData.seen_lessons));
            localStorage.setItem('seenLessons', JSON.stringify(seenData.seen_lessons));
        }
        if (seenData.seen_videos) localStorage.setItem('seenVideos', JSON.stringify(seenData.seen_videos));
        if (seenData.seen_jozve_ids) localStorage.setItem('seenJozveIds', JSON.stringify(seenData.seen_jozve_ids));
        if (seenData.last_streak_message_shown) localStorage.setItem('lastStreakMessageShown', seenData.last_streak_message_shown);
        if (seenData.dismissed_new_message_notif) localStorage.setItem('dismissedNewMessageNotif', 'true');
        if (seenData.dismissed_new_jozve_notif) localStorage.setItem('dismissedNewJozveNotif', 'true');
        if (seenData.dismissed_deadline_notif) localStorage.setItem('dismissedDeadlineNotif', 'true');
        return true;
    } catch (error) { return false; }
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
        const { data: existing } = await client.from('seen_data').select('id').eq('student_id', studentId).maybeSingle();
        if (existing) {
            await client.from('seen_data').update(payload).eq('id', existing.id);
        } else {
            await client.from('seen_data').insert(payload);
        }
        return true;
    } catch (error) { return false; }
}

let personalRealtimeChannel = null;
let classRealtimeChannel = null;
let conversationsRealtimeChannel = null;

function subscribeToPersonalMessages(studentId, onNewMessage) {
    try {
        const client = getSupabase();
        if (!client) return null;
        if (personalRealtimeChannel) { try { client.removeChannel(personalRealtimeChannel); } catch(e) {} }
        personalRealtimeChannel = client.channel('personal_rt_' + studentId + '_' + Date.now())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_messages', filter: `student_id=eq.${studentId}` },
                (payload) => { if (typeof onNewMessage === 'function') onNewMessage(payload); })
            .subscribe();
        return personalRealtimeChannel;
    } catch (error) { return null; }
}

function subscribeToClassMessages(className, onNewMessage) {
    try {
        const client = getSupabase();
        if (!client) return null;
        if (classRealtimeChannel) { try { client.removeChannel(classRealtimeChannel); } catch(e) {} }
        const classSlug = classNameToSlug(className);
        classRealtimeChannel = client.channel('class_rt_' + classSlug + '_' + Date.now())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'class_messages' },
                (payload) => { if (typeof onNewMessage === 'function') onNewMessage(payload); })
            .subscribe();
        return classRealtimeChannel;
    } catch (error) { return null; }
}

function subscribeToConversations(onChange) {
    try {
        const client = getSupabase();
        if (!client) return null;
        if (conversationsRealtimeChannel) { try { client.removeChannel(conversationsRealtimeChannel); } catch(e) {} }
        conversationsRealtimeChannel = client.channel('conversations_rt_' + Date.now())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_messages' },
                (payload) => { if (typeof onChange === 'function') onChange(payload); })
            .subscribe();
        return conversationsRealtimeChannel;
    } catch (error) { return null; }
}

function unsubscribeAll() {
    try {
        const client = getSupabase();
        if (!client) return;
        client.removeAllChannels();
        personalRealtimeChannel = null;
        classRealtimeChannel = null;
        conversationsRealtimeChannel = null;
    } catch (error) {}
}