// ============================================================
// supabase-config.js — تنظیمات Supabase
// نسخه: ۴.۰.۰ — با کد سه رقمی
// ============================================================

const SUPABASE_URL = 'https://wwmpjipvptwvfaqgvsob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bXBqaXB2cHR3dmZhcWd2c29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDU3NzYsImV4cCI6MjEwNjc4MTc3Nn0.RKwxaQ6rL13p4To0A0mo5il_HuqryG8aGGRWOz6DA7Y';

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
                fetch: fetch.bind(window)
            }
        });
        
        console.log('✅ Supabase Client آماده شد');
        return supabaseClient;
        
    } catch (error) {
        console.error('❌ خطا:', error);
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
// 🆕 تولید UUID از روی کد سه رقمی
// ============================================================
async function generateUUIDFromCode(studentCode) {
    const normalizedCode = String(studentCode).trim();
    
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode('arabic-hafom-v2-' + normalizedCode);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        const uuid = [
            hashHex.substring(0, 8),
            hashHex.substring(8, 12),
            '4' + hashHex.substring(13, 16),
            ((parseInt(hashHex.substring(16, 17), 16) & 0x3 | 0x8).toString(16)) + hashHex.substring(17, 20),
            hashHex.substring(20, 32)
        ].join('-');
        
        console.log('🔑 UUID از کد سه رقمی ساخته شد:', uuid);
        return uuid;
        
    } catch (error) {
        console.error('❌ خطا در تولید UUID:', error);
        return fallbackUUIDFromCode(normalizedCode);
    }
}

function fallbackUUIDFromCode(code) {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
        const char = code.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    const repeatHex = (hashHex + hashHex + hashHex + hashHex).substring(0, 32);
    
    return [
        repeatHex.substring(0, 8),
        repeatHex.substring(8, 12),
        '4' + repeatHex.substring(13, 16),
        '8' + repeatHex.substring(17, 20),
        repeatHex.substring(20, 32)
    ].join('-');
}

// ============================================================
// 🆕 چک کردن وجود کد سه رقمی در Supabase
// ============================================================
async function checkStudentCodeExists(studentCode) {
    try {
        const client = getSupabase();
        if (!client) return { exists: false, error: 'no_client' };
        
        const normalizedCode = String(studentCode).trim();
        
        const { data, error } = await client
            .from('rankings')
            .select('student_id, name, class_name, student_code')
            .eq('student_code', normalizedCode)
            .maybeSingle();
        
        if (error) {
            console.error('❌ خطا در چک کد:', error);
            return { exists: false, error: error.message };
        }
        
        if (data) {
            console.log('✅ کد پیدا شد:', data);
            return { 
                exists: true, 
                data: data,
                studentId: data.student_id,
                name: data.name,
                className: data.class_name
            };
        } else {
            console.log('ℹ️ کد جدید');
            return { exists: false };
        }
        
    } catch (error) {
        console.error('❌ خطا:', error);
        return { exists: false, error: error.message };
    }
}

// ============================================================
// 🆕 تولید کد سه رقمی یکتا
// ============================================================
async function generateUnique3DigitCode() {
    const client = getSupabase();
    if (!client) return null;
    
    // تلاش ۲۰ بار برای یه کد یکتا
    for (let attempt = 0; attempt < 20; attempt++) {
        const code = String(Math.floor(100 + Math.random() * 900)); // 100-999
        const result = await checkStudentCodeExists(code);
        if (!result.exists) {
            console.log('🎲 کد یکتا پیدا شد:', code);
            return code;
        }
    }
    
    console.warn('⚠️ نتونستم کد یکتا پیدا کنم');
    return null;
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
        
        if (error) return false;
        return true;
        
    } catch (error) {
        return false;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});