// ============================================================
// supabase-config.js — تنظیمات Supabase
// نسخه: ۲.۰.۰
// ============================================================

const SUPABASE_URL = 'https://wwmpjipvptwvfaqgvsob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bXBqaXB2cHR3dmZhcWd2c29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDU3NzYsImV4cCI6MjEwNjc4MTc3Nn0.RKwxaQ6rL13p4To0A0mo5il_HuqryG8aGGRWOz6DA7Y';

// ============================================================
// ساخت Client سراسری
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
            },
            global: {
                fetch: fetch.bind(window) // 🆕 با fetch استاندارد
            }
        });
        
        console.log('✅ Supabase Client آماده شد');
        return supabaseClient;
        
    } catch (error) {
        console.error('❌ خطا در ساخت Supabase Client:', error);
        return null;
    }
}

function getSupabase() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

// ============================================================
// تبدیل نام کلاس
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
// تست اتصال
// ============================================================
async function testSupabaseConnection() {
    try {
        const client = getSupabase();
        if (!client) return false;
        
        const { data, error } = await client
            .from('rankings')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('❌ خطا در اتصال:', error.message);
            return false;
        }
        
        console.log('✅ اتصال به Supabase موفق');
        return true;
        
    } catch (error) {
        console.error('❌ خطا:', error);
        return false;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});