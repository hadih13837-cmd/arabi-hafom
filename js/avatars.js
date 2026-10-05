// ============================================================
// avatars.js — مجموعه ایموجی‌ها و منطق آواتار
// نسخه: ۷.۰.۰ — با رفع مشکل نمایش در رتبه‌بندی
// ============================================================

// ============================================================
// آواتار پیش‌فرض — 🆕 استفاده از تصویر داخل پروژه به‌جای CDN
// ============================================================
const DEFAULT_AVATAR = 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';

// ============================================================
// مجموعه ایموجی‌ها
// ============================================================
const AVATAR_EMOJIS = {
    'حیوانات': ['🐱', '🐶', '🦊', '🐰', '🐼', '🐨', '🦁', '🐯', '🐮', '🐷', '🐸', '🐵', '🐔', '🦉', '🦄', '🐲'],
    'طبیعت': ['🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🍀', '🌿', '🌱', '🌳', '🌴', '🍁', '🍂', '🌾', '🌵', '🌲'],
    'میوه‌ها': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥝', '🍅', '🥑', '🥕'],
    'ورزشی': ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🏆', '🏅', '🎯', '🎳', '🎮'],
    'فضا': ['⭐', '🌟', '✨', '💫', '🌙', '🌛', '🌜', '☀️', '🌞', '🪐', '🌍', '🌎', '🌏', '🚀', '🛸', '👽'],
    'آموزشی': ['📚', '📖', '📝', '✏️', '🖊️', '📐', '📏', '🎓', '🏫', '🔬', '🔭', '💡', '🧠', '💻', '🖥️', '📊']
};

// ============================================================
// گرفتن آواتار برای ذخیره در رتبه‌بندی
// ============================================================
function getAvatarForRanking() {
    const avatarImg = localStorage.getItem('userAvatar');
    if (avatarImg) return avatarImg;
    
    const avatarEmoji = localStorage.getItem('userAvatarEmoji');
    if (avatarEmoji) return `emoji:${avatarEmoji}`;
    
    return 'default';
}

// ============================================================
// گرفتن آواتار برای نمایش در برنامه
// ============================================================
function getAvatarDisplay() {
    const avatarImg = localStorage.getItem('userAvatar');
    if (avatarImg) {
        return { type: 'image', value: avatarImg };
    }
    const avatarEmoji = localStorage.getItem('userAvatarEmoji');
    if (avatarEmoji) {
        return { type: 'emoji', value: avatarEmoji };
    }
    return { type: 'image', value: DEFAULT_AVATAR };
}

// ============================================================
// اعمال آواتار روی عناصر صفحه
// ============================================================
function applyAvatarToElements() {
    const avatar = getAvatarDisplay();
    console.log('🎨 اعمال آواتار:', avatar.type);

    const imgElements = ['home-avatar-img', 'profile-avatar-img'];
    
    imgElements.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const parent = el.parentElement;
        if (!parent) return;

        parent.classList.remove('emoji-mode');
        
        const oldEmoji = parent.querySelector('.emoji-avatar');
        if (oldEmoji) oldEmoji.remove();
        
        const oldSvg = parent.querySelector('.default-avatar-svg');
        if (oldSvg) oldSvg.remove();

        if (avatar.type === 'image') {
            el.src = avatar.value;
            el.style.display = 'block';
            el.style.width = '100%';
            el.style.height = '100%';
            el.style.objectFit = 'cover';
            el.style.borderRadius = '50%';
        } else if (avatar.type === 'emoji') {
            el.style.display = 'none';
            parent.classList.add('emoji-mode');
            
            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'emoji-avatar';
            emojiSpan.textContent = avatar.value;
            parent.appendChild(emojiSpan);
        }
    });
}

// ============================================================
// انتخاب ایموجی
// ============================================================
function selectEmojiAvatar(emoji, element) {
    console.log('🎨 انتخاب ایموجی:', emoji);
    
    localStorage.setItem('userAvatarEmoji', emoji);
    localStorage.removeItem('userAvatar');

    applyAvatarToElements();

    document.querySelectorAll('.emoji-picker-item').forEach(el => {
        el.classList.remove('selected');
    });
    if (element) element.classList.add('selected');

    vibrate(15);
    
    setTimeout(async () => {
        closeEmojiPicker();
        showModal('موفق', 'ایموجی پروفایل با موفقیت تغییر کرد.', '✅');
        
        if (typeof saveRankingToSupabase === 'function') {
            const success = await saveRankingToSupabase();
            if (success) {
                console.log('✅ آواتار در Supabase ذخیره شد');
            }
        }
    }, 300);
}

// ============================================================
// حذف آواتار
// ============================================================
function removeEmojiAvatar() {
    localStorage.removeItem('userAvatarEmoji');
    localStorage.removeItem('userAvatar');
    applyAvatarToElements();
    vibrate(15);
}

// ============================================================
// ساخت پنل انتخاب ایموجی
// ============================================================
function renderEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    if (!container) {
        console.error('❌ #emoji-picker-container پیدا نشد');
        return;
    }

    const currentEmoji = localStorage.getItem('userAvatarEmoji') || '';
    let html = '';

    Object.keys(AVATAR_EMOJIS).forEach(category => {
        html += `<div class="emoji-category-title">${category}</div>`;
        html += `<div class="emoji-category-grid">`;
        AVATAR_EMOJIS[category].forEach(emoji => {
            const selected = (emoji === currentEmoji) ? 'selected' : '';
            html += `<div class="emoji-picker-item ${selected}" onclick="selectEmojiAvatar('${emoji}', this)">${emoji}</div>`;
        });
        html += `</div>`;
    });

    container.innerHTML = html;
}

function openEmojiPicker() {
    const optionsModal = document.getElementById('avatar-options-modal');
    if (optionsModal) optionsModal.classList.remove('active');
    
    renderEmojiPicker();
    
    const emojiModal = document.getElementById('emoji-picker-modal');
    if (emojiModal) {
        emojiModal.classList.add('active');
    }
}

function closeEmojiPicker() {
    const modal = document.getElementById('emoji-picker-modal');
    if (modal) modal.classList.remove('active');
}

// ============================================================
// مودال انتخاب نوع آواتار
// ============================================================
function openAvatarOptionsModal() {
    const modal = document.getElementById('avatar-options-modal');
    if (modal) modal.classList.add('active');
}

function closeAvatarOptionsModal() {
    const modal = document.getElementById('avatar-options-modal');
    if (modal) modal.classList.remove('active');
}

function chooseEmojiOption() {
    closeAvatarOptionsModal();
    setTimeout(() => {
        openEmojiPicker();
    }, 200);
}

function chooseGalleryOption() {
    closeAvatarOptionsModal();
    setTimeout(() => {
        const fileInput = document.getElementById('avatar-input');
        if (fileInput) fileInput.click();
    }, 200);
}

// ============================================================
// 🆕 رندر آواتار در رتبه‌بندی (نسخه نهایی قطعی)
// ============================================================
function renderAvatarInRanking(ranking) {
    const avatarUrl = ranking.avatar_url || '';
    
    // حالت ۱: خالی، null، default
    if (!avatarUrl || avatarUrl === 'default' || avatarUrl === 'null' || avatarUrl === '') {
        return `<img src="${DEFAULT_AVATAR}" alt="" class="lb-avatar-img" loading="lazy" crossorigin="anonymous" onerror="this.style.display='none'">`;
    }
    
    // حالت ۲: ایموجی
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '');
        if (!emoji || emoji === '👤' || emoji === '👦🏻') {
            return `<img src="${DEFAULT_AVATAR}" alt="" class="lb-avatar-img" loading="lazy" crossorigin="anonymous" onerror="this.style.display='none'">`;
        }
        return `<span class="lb-avatar-emoji">${emoji}</span>`;
    }
    
    // حالت ۳: عکس base64
    if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="" class="lb-avatar-img">`;
    }
    
    // حالت ۴: URL عکس خارجی
    if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="" class="lb-avatar-img" loading="lazy" crossorigin="anonymous" onerror="this.src='${DEFAULT_AVATAR}'">`;
    }
    
    // پیش‌فرض
    return `<img src="${DEFAULT_AVATAR}" alt="" class="lb-avatar-img" loading="lazy" crossorigin="anonymous" onerror="this.style.display='none'">`;
}

// برای سازگاری
function renderAvatarHTML(ranking) {
    return renderAvatarInRanking(ranking);
}

// ============================================================
// 🆕 رندر آواتار در مکالمات (چت)
// ============================================================
function renderAvatarForChat(conv) {
    const avatarUrl = conv.avatar_url || '';
    
    if (!avatarUrl || avatarUrl === 'default' || avatarUrl === 'null') {
        return `<img src="${DEFAULT_AVATAR}" alt="" onerror="this.style.display='none'">`;
    }
    
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '');
        if (!emoji || emoji === '👤' || emoji === '👦🏻') {
            return `<img src="${DEFAULT_AVATAR}" alt="" onerror="this.style.display='none'">`;
        }
        return emoji;
    }
    
    if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="">`;
    }
    
    if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="" onerror="this.src='${DEFAULT_AVATAR}'">`;
    }
    
    return `<img src="${DEFAULT_AVATAR}" alt="" onerror="this.style.display='none'">`;
}