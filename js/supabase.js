// ============================================================
// supabase.js — اتصال به Supabase + توابع رتبه‌بندی
// نسخه: ۳.۱.۰ — با ساخت خودکار UUID
// ============================================================

// ============================================================
// تنظیمات Supabase
// ============================================================
const SUPABASE_URL = 'https://tocowguxqrhvmdsgyux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvY293Z3V4cXJoaHZtZHNneXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODM2MDIsImV4cCI6MjEwNjI1OTYwMn0.KhouMN8uOXjvb48-ekqbr3TCjfXZiGE8BTrbEnsLUDU';

// ============================================================
// تبدیل نام کلاس فارسی به slug انگلیسی
// ============================================================
function classNameToSlug(className) {
    const map = {
        'هفتم یک': 'hafom-1',
        'هفتم دو': 'hafom-2',
        'هفتم سه': 'hafom-3',
        'هفتم چهار': 'hafom-4',
        'هفتم پنج': 'hafom-5'
    };
    return map[className] || 'unknown';
}

// ============================================================
// تبدیل slug انگلیسی به نام کلاس فارسی
// ============================================================
function slugToClassName(slug) {
    const map = {
        'hafom-1': 'هفتم یک',
        'hafom-2': 'هفتم دو',
        'hafom-3': 'هفتم سه',
        'hafom-4': 'هفتم چهار',
        'hafom-5': 'هفتم پنج'
    };
    return map[slug] || slug;
}

// ============================================================
// درخواست به Supabase (REST API)
// ============================================================
async function supabaseRequest(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const defaultHeaders = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
    const finalOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...(options.headers || {})
        }
    };
    
    try {
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Supabase Error:', response.status, errorText);
            throw new Error(`Supabase error: ${response.status}`);
        }
        
        if (response.status === 204) return null;
        
        const text = await response.text();
        if (!text) return null;
        
        return JSON.parse(text);
    } catch (error) {
        console.error('❌ خطا در ارتباط با Supabase:', error);
        throw error;
    }
}

// ============================================================
// ذخیره/آپدیت امتیاز کاربر در Supabase
// ============================================================
async function saveRankingToSupabase() {
    try {
        // اگه studentUUID نداره، خودش بساز
        let studentId = localStorage.getItem('studentUUID');
        if (!studentId) {
            console.log('🆕 studentUUID نداشت - در حال ساخت...');
            studentId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            localStorage.setItem('studentUUID', studentId);
            console.log('✅ UUID ساخته شد:', studentId);
        }
        
        const userName = localStorage.getItem('userName');
        const userClass = localStorage.getItem('userClass');
        
        if (!userName || !userClass) {
            console.log('⚠️ اطلاعات کاربر ناقص - ثبت امتیاز انجام نشد');
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
        const avatarUrl = typeof getAvatarForRanking === 'function' 
            ? getAvatarForRanking() 
            : 'emoji:👤';
        
        const payload = {
            student_id: studentId,
            name: userName,
            class_name: classNameToSlug(userClass),
            total_points: totalPoints,
            completed_lessons: completedLessons,
            avg_percent: avgPercent,
            streak_days: streakDays,
            avatar_url: avatarUrl,
            last_update: new Date().toISOString()
        };
        
        console.log('📤 ارسال به Supabase:', payload);
        
        // چک کن آیا رکورد قبلاً وجود داره
        const existing = await supabaseRequest(
            `rankings?student_id=eq.${studentId}&select=id`,
            { method: 'GET' }
        );
        
        if (existing && existing.length > 0) {
            // آپدیت
            await supabaseRequest(
                `rankings?student_id=eq.${studentId}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                    headers: { 'Prefer': 'return=minimal' }
                }
            );
            console.log('✅ امتیاز آپدیت شد:', totalPoints);
        } else {
            // درج جدید
            await supabaseRequest(
                'rankings',
                {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Prefer': 'return=minimal' }
                }
            );
            console.log('✅ امتیاز جدید ثبت شد:', totalPoints);
        }
        
        return true;
    } catch (error) {
        console.error('❌ خطا در ثبت امتیاز:', error);
        return false;
    }
}

// ============================================================
// گرفتن رتبه‌بندی یه کلاس خاص
// ============================================================
async function getRankingsByClass(className) {
    try {
        const classSlug = classNameToSlug(className);
        console.log('🔍 گرفتن رتبه‌بندی برای کلاس:', className, '→', classSlug);
        
        const data = await supabaseRequest(
            `rankings?class_name=eq.${classSlug}&order=total_points.desc,avg_percent.desc,completed_lessons.desc&select=*`,
            { method: 'GET' }
        );
        
        console.log('✅ دریافت شد:', data ? data.length : 0, 'نفر');
        return data || [];
    } catch (error) {
        console.error('❌ خطا در گرفتن رتبه‌بندی:', error);
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
        console.error('❌ خطا:', error);
        return null;
    }
}

// ============================================================
// تست اتصال به Supabase
// ============================================================
async function testSupabaseConnection() {
    try {
        const data = await supabaseRequest('rankings?select=id&limit=1', { method: 'GET' });
        console.log('✅ اتصال به Supabase موفق');
        return true;
    } catch (error) {
        console.error('❌ اتصال به Supabase ناموفق:', error);
        return false;
    }
}