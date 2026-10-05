// ============================================================
// supabase-config.js — تنظیمات و توابع کمکی Supabase
// نسخه: ۱.۰.۰
// ============================================================

// ============================================================
// اطلاعات پروژه Supabase
// ============================================================
const SUPABASE_URL = 'https://wwmpjipvptwvfaqgvsob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bXBqaXB2cHR3dmZhcWd2c29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDU3NzYsImV4cCI6MjEwNjc4MTc3Nn0.RKwxaQ6rL13p4To0A0mo5il_HuqryG8aGGRWOz6DA7Y';

// ============================================================
// ساختن Client سراسری
// ============================================================
let supabaseClient = null;

function initSupabase() {
    if (supabaseClient) return supabaseClient;
    
    try {
        if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
            console.error('❌ کتابخانه Supabase لود نشده');
            return null;
        }
        
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            },
            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            }
        });
        
        console.log('✅ Supabase Client آماده شد');
        return supabaseClient;
        
    } catch (error) {
        console.error('❌ خطا در ساخت Supabase Client:', error);
        return null;
    }
}

// ============================================================
// گرفتن Client (اگه ساخته نشده، بساز)
// ============================================================
function getSupabase() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

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
// تبدیل snake_case به camelCase
// ============================================================
function toCamelCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(toCamelCase);
    
    const result = {};
    for (const key in obj) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = obj[key];
    }
    return result;
}

// ============================================================
// تست اتصال به Supabase
// ============================================================
async function testSupabaseConnection() {
    try {
        const client = getSupabase();
        if (!client) {
            console.error('❌ Supabase Client ساخته نشد');
            return false;
        }
        
        const { data, error } = await client
            .from('rankings')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('❌ خطا در اتصال به Supabase:', error.message);
            return false;
        }
        
        console.log('✅ اتصال به Supabase موفق');
        return true;
        
    } catch (error) {
        console.error('❌ خطا:', error);
        return false;
    }
}

// ============================================================
// شروع خودکار هنگام لود
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});