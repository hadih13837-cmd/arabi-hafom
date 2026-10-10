// ============================================================
// api.js — API با Supabase
// نسخه: ۹.۰.۰ — با پشتیبانی از مهلت سفارشی و وضعیت تکالیف
// ============================================================

const TEACHER_API_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
const API_URL = TEACHER_API_URL;

// ============================================================
// ذخیره/آپدیت امتیاز کاربر
// ============================================================
async function saveRankingToSupabase() {
    try {
        const client = getSupabase();
        if (!client) {
            console.warn('⚠️ Supabase Client موجود نیست');
            return false;
        }
        
        let studentId = localStorage.getItem('studentUUID');
        if (!studentId) {
            studentId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            localStorage.setItem('studentUUID', studentId);
        }
        
        const userName = localStorage.getItem('userName');
        const userClass = localStorage.getItem('userClass');
        
        if (!userName || !userClass) {
            console.log('⚠️ اطلاعات کاربر ناقص');
            return false;
        }
        
        const reports = JSON.parse(localStorage.getItem('reports') || '[]');
        const streakData = JSON.parse(localStorage.getItem('streakData') || '{}');
        
        const totalPoints = reports.reduce((sum, r) => sum + (r.score || 0), 0);
        const completedLessons = reports.length;
        const avgPercent = reports.length > 0
            ? Math.round(reports.reduce((sum, r) => sum + (r.percent || 0), 0) / reports.length)
            : 0;
        const streakDays = streakData.count || 0;
        
        let avatarUrl = 'default';
        const avatarImg = localStorage.getItem('userAvatar');
        const avatarEmoji = localStorage.getItem('userAvatarEmoji');
        
        if (avatarImg) {
            if (avatarImg.length > 100000) {
                avatarUrl = 'emoji:👤';
            } else {
                avatarUrl = avatarImg;
            }
        } else if (avatarEmoji) {
            avatarUrl = 'emoji:' + avatarEmoji;
        }
        
        const payload = {
            student_id: studentId,
            name: userName,
            class_name: classNameToSlug(userClass),
            total_points: totalPoints,
            completed_lessons: completedLessons,
            avg_percent: avgPercent,
            streak_days: streakDays,
            avatar_url: String(avatarUrl),
            last_update: new Date().toISOString()
        };
        
        console.log('📤 ذخیره در Supabase:', {
            name: payload.name,
            total_points: totalPoints,
            avg_percent: avgPercent
        });
        
        const { data, error } = await client
            .from('rankings')
            .upsert(payload, { 
                onConflict: 'student_id',
                ignoreDuplicates: false 
            })
            .select();
        
        if (error) {
            console.error('❌ خطا در ذخیره امتیاز:', error.message);
            return false;
        }
        
        console.log('✅ امتیاز ذخیره شد:', totalPoints);
        return true;
        
    } catch (error) {
        console.error('❌ خطا:', error);
        return false;
    }
}

// ============================================================
// 🆕 گرفتن وضعیت تکالیف از Supabase (مهلت سفارشی + فعال/غیرفعال)
// ============================================================
async function getStudentLessonStatus(studentId) {
    try {
        const client = getSupabase();
        if (!client) return {};
        
        const { data, error } = await client
            .from('lesson_status')
            .select('*')
            .eq('student_id', studentId);
        
        if (error) {
            console.error('خطا در گرفتن وضعیت تکالیف:', error.message);
            return {};
        }
        
        const statusMap = {};
        (data || []).forEach(item => {
            statusMap[item.lesson_id] = {
                is_enabled: item.is_enabled !== false,
                custom_due_date: item.custom_due_date || null,
                custom_points: item.custom_points || 0
            };
        });
        
        console.log('📋 وضعیت تکالیف:', statusMap);
        return statusMap;
        
    } catch (error) {
        console.error('❌ خطا:', error);
        return {};
    }
}

// ============================================================
// گرفتن رتبه‌بندی یک کلاس
// ============================================================
async function getRankingsByClass(className) {
    try {
        const client = getSupabase();
        if (!client) return [];
        
        const classSlug = classNameToSlug(className);
        
        const { data, error } = await client
            .from('rankings')
            .select('*')
            .eq('class_name', classSlug)
            .order('total_points', { ascending: false })
            .order('avg_percent', { ascending: false })
            .order('completed_lessons', { ascending: false });
        
        if (error) {
            console.error('❌ خطا در گرفتن رتبه‌بندی:', error.message);
            return [];
        }
        
        return data || [];
        
    } catch (error) {
        console.error('❌ خطا:', error);
        return [];
    }
}

// ============================================================
// گرفتن همه دانش‌آموزان (پنل معلم)
// ============================================================
async function getAllStudents() {
    try {
        const client = getSupabase();
        if (!client) return [];
        
        const { data, error } = await client
            .from('rankings')
            .select('*')
            .order('total_points', { ascending: false });
        
        if (error) {
            console.error('❌ خطا:', error.message);
            return [];
        }
        
        return data || [];
        
    } catch (error) {
        console.error('❌ خطا:', error);
        return [];
    }
}

// ============================================================
// گرفتن رتبه‌ی خودم
// ============================================================
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
        
        const payload = {
            message_id: data.message_id || 'cls_' + Date.now(),
            class_name: data.class_name || 'all',
            title: data.title || '',
            text: data.text || '',
            type: data.type || 'info',
            date: data.date || new Date().toISOString(),
            date_persian: data.date_persian || ''
        };
        
        const { data: result, error } = await client
            .from('class_messages')
            .insert(payload)
            .select();
        
        if (error) {
            console.error('❌ خطا:', error.message);
            return { success: false, error: error.message };
        }
        
        return { success: true, data: result };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getClassMessagesFromSupabase(className) {
    try {
        const client = getSupabase();
        if (!client) return [];
        
        const classSlug = classNameToSlug(className);
        
        let query = client
            .from('class_messages')
            .select('*')
            .order('date', { ascending: false });
        
        if (classSlug && classSlug !== 'all' && classSlug !== 'unknown') {
            query = query.or(`class_name.eq.${classSlug},class_name.eq.all`);
        }
        
        const { data, error } = await query;
        
        if (error) return [];
        return data || [];
        
    } catch (error) {
        return [];
    }
}

// ============================================================
// پیام‌های شخصی (چت)
// ============================================================
async function sendPersonalMessageToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        
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
        
        const { data: result, error } = await client
            .from('personal_messages')
            .insert(payload)
            .select();
        
        if (error) return { success: false, error: error.message };
        return { success: true, data: result };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getPersonalMessages(studentId) {
    try {
        const client = getSupabase();
        if (!client) return [];
        
        const { data, error } = await client
            .from('personal_messages')
            .select('*')
            .eq('student_id', studentId)
            .order('date', { ascending: true });
        
        if (error) return [];
        return data || [];
        
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
        
        if (error) return [];
        
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
        } catch (e) {}
        
        const conversations = Object.values(conversationsMap);
        conversations.sort((a, b) => 
            new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0)
        );
        
        return conversations;
        
    } catch (error) {
        return [];
    }
}

// ============================================================
// علامت‌گذاری پیام‌ها
// ============================================================
async function markAllMessagesAsSeenSupabase(studentId, reader) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        
        const senderToMark = reader === 'teacher' ? 'student' : 'teacher';
        
        const { error } = await client
            .from('personal_messages')
            .update({ is_seen: true })
            .eq('student_id', studentId)
            .eq('sender', senderToMark)
            .eq('is_seen', false);
        
        if (error) return { success: false, error: error.message };
        return { success: true };
        
    } catch (error) {
        return { success: false };
    }
}

// ============================================================
// رویدادها
// ============================================================
async function addEventToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        
        const payload = {
            event_id: data.event_id || 'evt_' + Date.now(),
            title: data.title || '',
            date: data.date || '',
            class_name: data.class_name || 'all',
            type: data.type || 'event',
            description: data.description || ''
        };
        
        const { error } = await client.from('events').insert(payload);
        if (error) return { success: false, error: error.message };
        return { success: true };
        
    } catch (error) {
        return { success: false };
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
        return data || [];
        
    } catch (error) {
        return [];
    }
}

// ============================================================
// مسابقات
// ============================================================
async function addContestToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        
        const payload = {
            contest_id: data.contest_id || 'cnt_' + Date.now(),
            title: data.title || '',
            prize: data.prize || '',
            start_date: data.start_date || '',
            end_date: data.end_date || '',
            description: data.description || ''
        };
        
        const { error } = await client.from('contests').insert(payload);
        if (error) return { success: false, error: error.message };
        return { success: true };
        
    } catch (error) {
        return { success: false };
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
        return data || [];
        
    } catch (error) {
        return [];
    }
}

// ============================================================
// کتابخانه
// ============================================================
async function addLibraryToSupabase(data) {
    try {
        const client = getSupabase();
        if (!client) return { success: false };
        
        const payload = {
            item_id: data.item_id || 'lib_' + Date.now(),
            title: data.title || '',
            type: data.type || 'video',
            url: data.url || '',
            description: data.description || ''
        };
        
        const { error } = await client.from('library').insert(payload);
        if (error) return { success: false, error: error.message };
        return { success: true };
        
    } catch (error) {
        return { success: false };
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
        return data || [];
        
    } catch (error) {
        return [];
    }
}

// ============================================================
// Realtime
// ============================================================
let personalRealtimeChannel = null;
let classRealtimeChannel = null;
let conversationsRealtimeChannel = null;

function subscribeToPersonalMessages(studentId, onNewMessage) {
    try {
        const client = getSupabase();
        if (!client) return null;
        
        if (personalRealtimeChannel) {
            try { client.removeChannel(personalRealtimeChannel); } catch(e) {}
            personalRealtimeChannel = null;
        }
        
        const channelName = 'personal_rt_' + studentId + '_' + Date.now();
        
        personalRealtimeChannel = client
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'personal_messages',
                filter: `student_id=eq.${studentId}`
            }, (payload) => {
                if (typeof onNewMessage === 'function') onNewMessage(payload);
            })
            .subscribe((status) => {
                console.log('📡 Personal Realtime:', status);
            });
        
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
            classRealtimeChannel = null;
        }
        
        const classSlug = classNameToSlug(className);
        const channelName = 'class_rt_' + classSlug + '_' + Date.now();
        
        classRealtimeChannel = client
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'class_messages'
            }, (payload) => {
                if (typeof onNewMessage === 'function') onNewMessage(payload);
            })
            .subscribe((status) => {
                console.log('📡 Class Realtime:', status);
            });
        
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
            conversationsRealtimeChannel = null;
        }
        
        const channelName = 'conversations_rt_' + Date.now();
        
        conversationsRealtimeChannel = client
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'personal_messages'
            }, (payload) => {
                if (typeof onChange === 'function') onChange(payload);
            })
            .subscribe((status) => {
                console.log('📡 Conversations Realtime:', status);
            });
        
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
        
    } catch (error) {}
}

// ============================================================
// تست اتصال
// ============================================================
async function testConnection() {
    try {
        const client = getSupabase();
        if (!client) {
            return { success: false, error: 'Client not initialized' };
        }
        
        const { data, error } = await client
            .from('rankings')
            .select('count')
            .limit(1);
        
        if (error) return { success: false, error: error.message };
        
        return { 
            success: true, 
            message: 'Supabase connection working',
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}