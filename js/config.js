// ============================================================
// config.js — ثابت‌ها و داده‌های پایه برنامه
// ============================================================

// کد ادمین برای دسترسی به برنامه در حالت بروزرسانی
const ADMIN_CODE = 'hadi1383';

// آدرس وکتور صدا (برای سوالات صوتی)
const SOUND_VECTOR_URL = 'https://cdn.imgurl.ir/uploads/i392811_file_000000004034822fab3dfb7fe4276696.png';

// وکتورهای کتاب (برای کارت تکالیف)
const BOOK_VECTORS = [
    { url: 'https://cdn.imgurl.ir/uploads/m31567_IMG__.png', color: '#8e24aa', colorLight: 'rgba(142, 36, 170, 0.08)' },
    { url: 'https://cdn.imgurl.ir/uploads/p313911_IMG__.png', color: '#2e7d32', colorLight: 'rgba(46, 125, 50, 0.08)' },
    { url: 'https://cdn.imgurl.ir/uploads/f058661_IMG__.png', color: '#1976d2', colorLight: 'rgba(25, 118, 210, 0.08)' },
    { url: 'https://cdn.imgurl.ir/uploads/k1280_IMG__.png',   color: '#fbc02d', colorLight: 'rgba(251, 192, 45, 0.12)' },
    { url: 'https://cdn.imgurl.ir/uploads/q178853_IMG__.png', color: '#388e3c', colorLight: 'rgba(56, 142, 60, 0.08)' },
    { url: 'https://cdn.imgurl.ir/uploads/a3501_IMG__.png',   color: '#00acc1', colorLight: 'rgba(0, 172, 193, 0.08)' }
];

// عناوین پیش‌فرض تکالیف (در صورت نبود title در JSON)
const LESSON_TITLES = [
    'اَلدَّرْسُ الأَوَّل', 'اَلدَّرْسُ الثّانی', 'اَلدَّرْسُ الثّالِث', 'تکلیف چهارم',
    'تکلیف پنجم', 'تکلیف ششم', 'تکلیف هفتم', 'تکلیف هشتم',
    'تکلیف نهم', 'تکلیف دهم'
];

// آیکون‌های انواع سوالات (SVG + کلاس رنگی)
const QUESTION_ICONS = {
    multiple: {
        class: 'qti-test',
        svg: '<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
    },
    fill: {
        class: 'qti-blank',
        svg: '<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="21" y2="12"/><line x1="10" y1="8" x2="14" y2="16"/></svg>'
    },
    translation: {
        class: 'qti-essay',
        svg: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>'
    },
    match: {
        class: 'qti-match',
        svg: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
    },
    truefalse: {
        class: 'qti-tf',
        svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    },
    order: {
        class: 'qti-order',
        svg: '<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
    },
    image: {
        class: 'qti-image',
        svg: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
    },
    'audio-match': {
        class: 'qti-audio',
        svg: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2V15H6L11 19V5Z"/><path d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53"/><path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07"/></svg>'
    },
    'find-error': {
        class: 'qti-error',
        svg: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><line x1="8" y1="11" x2="14" y2="11"/></svg>'
    },
    'word-build': {
        class: 'qti-order',
        svg: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="13" width="7" height="7" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/></svg>'
    },
    'survey': {
        class: 'qti-survey',
        svg: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/></svg>'
    }
};

// ============================================================
// مدال‌ها (لیست کامل)
// ============================================================
const MEDALS_LIST = [
    { id: 'first',       icon: '🥇', title: 'اولین قدم',       desc: 'اولین تکلیف را انجام بده',       condition: (s) => s.completedLessons >= 1 },
    { id: 'diamond',     icon: '💎', title: 'الماس',            desc: 'تکمیل ۵ تکلیف',                  condition: (s) => s.completedLessons >= 5 },
    { id: 'king',        icon: '👑', title: 'پادشاه',           desc: 'تکمیل ۱۰ تکلیف',                 condition: (s) => s.completedLessons >= 10 },
    { id: 'accurate',    icon: '🎯', title: 'دقیق',             desc: 'میانگین درصد بالای ۸۰%',         condition: (s) => s.avgPercent >= 80 && s.completedLessons >= 2 },
    { id: 'brilliant',   icon: '🌟', title: 'درخشان',           desc: 'میانگین درصد ۱۰۰%',              condition: (s) => s.avgPercent >= 100 && s.completedLessons >= 3 },
    { id: 'star',        icon: '⭐', title: 'ستاره',            desc: 'کسب ۱۰۰ امتیاز',                 condition: (s) => s.totalPoints >= 100 },
    { id: 'champion',    icon: '🏆', title: 'قهرمان',           desc: 'کسب ۳۰۰ امتیاز',                 condition: (s) => s.totalPoints >= 300 },
    { id: 'genius',      icon: '💠', title: 'نابغه',            desc: 'کسب ۶۰۰ امتیاز',                 condition: (s) => s.totalPoints >= 600 },
    { id: 'rocket',      icon: '🚀', title: 'موشک',             desc: 'کسب ۱۰۰۰ امتیاز',                condition: (s) => s.totalPoints >= 1000 },
    { id: 'smart',       icon: '🧠', title: 'زیرک',             desc: '۵ تکلیف با درصد ۱۰۰%',           condition: (s) => s.perfectScores >= 5 },
    { id: 'invincible',  icon: '🛡️', title: 'شکست‌ناپذیر',      desc: '۱۰ تکلیف با درصد بالای ۹۰%',     condition: (s) => s.highScores >= 10 },
    { id: 'fast',        icon: '⚡', title: 'سریع',             desc: 'تکمیل تکلیف زیر ۳ دقیقه',        condition: (s) => s.fastLessons >= 1 },
    { id: 'loyal',       icon: '🎖️', title: 'سرباز فداکار',    desc: 'فعالیت در ۷ روز مختلف',          condition: (s) => s.streakDays >= 7 },
    { id: 'beginner',    icon: '🌱', title: 'تازه‌کار',         desc: 'اولین امتیازت رو بگیر',          condition: (s) => s.totalPoints >= 10 },
    { id: 'diligent',    icon: '📚', title: 'کوشا',             desc: 'تکمیل ۳ تکلیف',                  condition: (s) => s.completedLessons >= 3 },
    { id: 'expert',      icon: '🎓', title: 'متخصص',            desc: 'تکمیل ۷ تکلیف',                  condition: (s) => s.completedLessons >= 7 },
    { id: 'flawless',    icon: '✨', title: 'بی‌نقص',           desc: '۳ تکلیف با درصد ۱۰۰%',           condition: (s) => s.perfectScores >= 3 },
    { id: 'persistent',  icon: '🔥', title: 'پیگیر',            desc: 'فعالیت در ۳ روز مختلف',          condition: (s) => s.streakDays >= 3 },
    { id: 'dedicated',   icon: '💪', title: 'با اراده',         desc: 'فعالیت در ۱۵ روز مختلف',         condition: (s) => s.streakDays >= 15 },
    { id: 'legend',      icon: '🌈', title: 'افسانه',           desc: 'کسب ۲۰۰۰ امتیاز',                condition: (s) => s.totalPoints >= 2000 }
];

// ============================================================
// اطلاعات ماه‌های شمسی
// ============================================================
const MONTHS_INFO = [
    { num: 1,  name: 'فروردین',   season: 'spring', icon: '🌸', days: 31 },
    { num: 2,  name: 'اردیبهشت',  season: 'spring', icon: '🌷', days: 31 },
    { num: 3,  name: 'خرداد',     season: 'spring', icon: '🌻', days: 31 },
    { num: 4,  name: 'تیر',       season: 'summer', icon: '☀️', days: 31 },
    { num: 5,  name: 'مرداد',     season: 'summer', icon: '🌞', days: 31 },
    { num: 6,  name: 'شهریور',    season: 'summer', icon: '🏖️', days: 31 },
    { num: 7,  name: 'مهر',       season: 'autumn', icon: '🍂', days: 30 },
    { num: 8,  name: 'آبان',      season: 'autumn', icon: '🍁', days: 30 },
    { num: 9,  name: 'آذر',       season: 'autumn', icon: '🌰', days: 30 },
    { num: 10, name: 'دی',        season: 'winter', icon: '❄️', days: 30 },
    { num: 11, name: 'بهمن',      season: 'winter', icon: '⛄', days: 30 },
    { num: 12, name: 'اسفند',     season: 'winter', icon: '🌨️', days: 29 }
];

// ============================================================
// اطلاعات فصل‌ها
// ============================================================
const SEASONS_INFO = {
    spring: { name: 'بهار',    icon: '🌸', desc: 'فصل شکوفه‌ها و زیبایی',  emoji: '🌷' },
    summer: { name: 'تابستان', icon: '☀️', desc: 'فصل گرما و تعطیلات',     emoji: '🏖️' },
    autumn: { name: 'پاییز',   icon: '🍂', desc: 'فصل برگ‌های رنگارنگ',   emoji: '🍁' },
    winter: { name: 'زمستان',  icon: '❄️', desc: 'فصل سرما و برف',         emoji: '⛄' }
};

// ============================================================
// جملات انگیزشی برای صفحه خانه
// ============================================================
const MOTIVATIONS = [
    "امروز روز یادگیریه، بیا شروع کنیم!", "تو می‌تونی، فقط باورت کن!",
    "هر روز یه قدم به موفقیت نزدیک‌تر!", "هدف داشته باش و ادامه بده!",
    "بیا با هم عربی رو حرفه‌ای یاد بگیریم!", "دانش یعنی قدرت، بیا قدرتمند بشیم!",
    "سختی‌ها میان و میرن، ولی علم می‌مونه!", "آینده‌ت رو امروز بساز!",
    "هیچ‌وقت دیر نیست برای یادگیری!", "تلاش امروزت، افتخار فرداته!",
    "تو ستاره‌ی من هستی، بدرخش!", "هر سوال، یه فرصت یادگیریه!",
    "برنده‌ها کسانی‌ان که ادامه میدن!", "مثل یه نهال رشد کن و ثمر بده!",
    "تو با ارزش‌تر از اون هستی که فکر می‌کنی!"
];

// ============================================================
// مراحل راهنمای برنامه (Guide Steps)
// ============================================================
const GUIDE_STEPS = [
    { element: null,                  title: 'خوش آمدید! 👋',       text: 'به برنامه عربی هفتم خوش آمدید! می‌خواهیم با هم یک تور کوتاه بزنیم و بخش‌های مختلف برنامه رو بهت معرفی کنیم.', icon: '👋' },
    { element: 'guide-menu-btn',      title: 'منوی کناری ☰',         text: 'با زدن این دکمه، منوی کناری باز می‌شه که از اونجا می‌تونی به همه بخش‌های برنامه دسترسی داشته باشی.',           icon: '☰' },
    { element: 'guide-notif-btn',     title: 'زنگوله اعلان‌ها 🔔',   text: 'اینجا اعلان‌های مهم مثل تکالیف جدید و پیام‌ها رو می‌بینی. اگه نقطه قرمز داشته باشه، یعنی اعلان جدید داری!',  icon: '🔔' },
    { element: 'streak-badge',        title: 'استریک روزانه 🔥',    text: 'هر روزی که وارد برنامه بشی، این کادر نشون می‌ده که چند روز متوالی اومدی. با زدن روش، تقویم فعالیت‌هات رو می‌بینی!', icon: '🔥' },
    { element: 'guide-profile-avatar',title: 'حساب کاربری 👤',       text: 'اینجا می‌تونی پروفایلت رو ببینی و ویرایش کنی، عکس پروفایل بذاری و آمار کلیت رو مشاهده کنی.',                     icon: '👤' },
    { element: 'guide-lessons-btn',   title: 'تکالیف من 📚',         text: 'این بخش مهم‌ترین قسمت برنامه‌ست! معلمت اینجا تکالیف رو قرار می‌ده و تو باید انجامشون بدی تا نمره بگیری.',         icon: '📚' },
    { element: 'guide-reports-btn',   title: 'کارنامه‌ها 📊',       text: 'بعد از انجام هر تکلیف، کارنامه‌ات اینجا ذخیره می‌شه و می‌تونی به صورت PDF دانلودش کنی.',                          icon: '📊' },
    { element: 'guide-clips-btn',     title: 'کلیپ‌های آموزشی 🎬',  text: 'اینجا کلیپ‌های موشن گرافیک و ویدیوهای آموزشی رو می‌بینی که به یادگیری بهتر کمک می‌کنن.',                          icon: '🎬' },
    { element: 'guide-medals-btn',    title: 'مدال‌ها 🏆',           text: 'با انجام تکالیف و کسب امتیاز، مدال‌های مختلفی می‌گیری. مدال‌ها رو اینجا می‌بینی!',                                icon: '🏆' },
    { element: 'guide-settings-btn',  title: 'تنظیمات ⚙️',          text: 'از اینجا می‌تونی تم رنگی، حالت شب، موسیقی و صداها رو تنظیم کنی.',                                                 icon: '⚙️' },
    { element: 'guide-profile-btn',   title: 'پروفایل سریع 👤',     text: 'این دکمه هم مثل آواتار بالای صفحه، تو رو به پروفایلت می‌بره.',                                                    icon: '👤' }
];