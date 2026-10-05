// ============================================================
// api.js — اتصال به Google Sheets API
// نسخه: ۳.۰.۰ — با پشتیبانی از همه درخواست‌ها
// ============================================================

// ============================================================
// آدرس‌های API
// ============================================================
const TEACHER_API_URL = 'https://script.google.com/macros/s/AKfycbwH6zsAVO-tzATU3_J8SvHkOpM1GJXQRxmqWDHxcXKxDKKJZImQf_58ekigtppjj-HWgw/exec';

// برای سازگاری با کد قدیمی
const API_URL = TEACHER_API_URL;

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
// درخواست POST به API
// ============================================================
async function apiPost(data) {
    try {
        console.log('📤 POST:', data.action || 'saveRanking');
        
        const response = await fetch(TEACHER_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(data)
        });
        
        console.log('✅ POST ارسال شد');
        return { success: true };
    } catch (error) {
        console.error('❌ خطا در POST:', error);
        throw error;
    }
}

// ============================================================
// درخواست GET از API
// ============================================================
async function apiGet(params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${TEACHER_API_URL}?${queryString}` : TEACHER_API_URL;
        
        console.log('📥 GET:', params.action || 'default');
        
        const response = await fetch(url + '&t=' + Date.now(), {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('❌ خطا در GET:', error);
        throw error;
    }
}

// ============================================================
// ذخیره/آپدیت امتیاز کاربر
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
        
        // 🆕 گرفتن آواتار (با پیش‌فرض عکس پسر)
        let avatarUrl = 'default';
        if (typeof getAvatarForRanking === 'function') {
            avatarUrl = getAvatarForRanking();
        }
        
        const payload = {
            action: 'saveRanking',
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
        
        console.log('📤 ارسال به Google Sheets:', payload);
        
        await apiPost(payload);
        
        console.log('✅ اطلاعات ارسال شد');
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
        
        const result = await apiGet({ 
            action: 'getRankings',
            class_name: classSlug,
            t: Date.now()
        });
        
        if (result && result.success && result.data) {
            console.log('✅ دریافت شد:', result.data.length, 'نفر');
            return result.data;
        }
        
        return [];
    } catch (error) {
        console.error('❌ خطا در گرفتن رتبه‌بندی:', error);
        return [];
    }
}

// ============================================================
// گرفتن همه دانش‌آموزان (برای پنل معلم)
// ============================================================
async function getAllStudents() {
    try {
        const result = await apiGet({ 
            action: 'getAllStudents',
            t: Date.now()
        });
        
        if (result && result.success && result.data) {
            return result.data;
        }
        
        return [];
    } catch (error) {
        console.error('❌ خطا در گرفتن دانش‌آموزان:', error);
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
// گرفتن پیام‌های معلم
// ============================================================
async function getTeacherMessages() {
    try {
        const result = await apiGet({ 
            action: 'getMessages',
            t: Date.now()
        });
        
        if (result && result.success && result.data) {
            return result.data;
        }
        
        return [];
    } catch (error) {
        console.error('❌ خطا در گرفتن پیام‌ها:', error);
        return [];
    }
}

// ============================================================
// گرفتن رویدادها
// ============================================================
async function getEvents() {
    try {
        const result = await apiGet({ 
            action: 'getEvents',
            t: Date.now()
        });
        
        if (result && result.success && result.data) {
            return result.data;
        }
        
        return [];
    } catch (error) {
        console.error('❌ خطا در گرفتن رویدادها:', error);
        return [];
    }
}

// ============================================================
// گرفتن مسابقات
// ============================================================
async function getContests() {
    try {
        const result = await apiGet({ 
            action: 'getContests',
            t: Date.now()
        });
        
        if (result && result.success && result.data) {
            return result.data;
        }
        
        return [];
    } catch (error) {
        console.error('❌ خطا در گرفتن مسابقات:', error);
        return [];
    }
}

// ============================================================
// گرفتن کتابخانه
// ============================================================
async function getLibrary() {
    try {
        const result = await apiGet({ 
            action: 'getLibrary',
            t: Date.now()
        });
        
        if (result && result.success && result.data) {
            return result.data;
        }
        
        return [];
    } catch (error) {
        console.error('❌ خطا در گرفتن کتابخانه:', error);
        return [];
    }
}

// ============================================================
// تست اتصال به API
// ============================================================
async function testSupabaseConnection() {
    try {
        const result = await apiGet({ action: 'getAllStudents', t: Date.now() });
        if (result && result.success) {
            console.log('✅ اتصال به Google Sheets موفق');
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ اتصال ناموفق:', error);
        return false;
    }
}