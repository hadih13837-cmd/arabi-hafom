// ============================================================
// api.js — اتصال به Google Sheets API
// جایگزین supabase.js
// نسخه: ۱.۰.۰
// ============================================================

// ============================================================
// آدرس Google Apps Script
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwH6zsAVO-tzATU3_J8SvHkOpM1GJXQRxmqWDHxcXKxDKKJZImQf_58ekigtppjj-HWgw/exec';

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
// درخواست POST به API (برای ذخیره)
// ============================================================
async function apiPost(data) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',  // 🆕 مهم برای Google Apps Script
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(data)
        });
        
        // چون no-cors هست، نمی‌تونیم response رو بخونیم
        // ولی درخواست فرستاده شده
        console.log('📤 POST ارسال شد');
        return { success: true };
    } catch (error) {
        console.error('❌ خطا در POST:', error);
        throw error;
    }
}

// ============================================================
// درخواست GET از API (برای خواندن)
// ============================================================
async function apiGet(params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${API_URL}?${queryString}` : API_URL;
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors'
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
        
        // اضافه کردن cache-buster برای جلوگیری از کش
        const result = await apiGet({ 
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
// تست اتصال به API
// ============================================================
async function testSupabaseConnection() {
    try {
        const result = await apiGet({ t: Date.now() });
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