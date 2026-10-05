// ============================================================
// avatars.js — مجموعه ایموجی‌ها و منطق آواتار
// نسخه: ۳.۰.۰ — با وکتور پسر SVG برای پیش‌فرض
// ============================================================

// ============================================================
// آواتار پیش‌فرض (وکتور پسر SVG)
// ============================================================
const DEFAULT_AVATAR_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="default-avatar-svg">
    <defs>
        <linearGradient id="avatarBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#64b5f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1976d2;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="avatarHeadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e3f2fd;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="avatarHairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#5d4037;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3e2723;stop-opacity:1" />
        </linearGradient>
    </defs>
    <!-- پس‌زمینه دایره -->
    <circle cx="50" cy="50" r="48" fill="url(#avatarBgGrad)"/>
    <!-- بدن -->
    <path d="M 20 85 Q 20 58 50 58 Q 80 58 80 85 Z" fill="url(#avatarHeadGrad)"/>
    <!-- یقه -->
    <path d="M 38 60 L 50 68 L 62 60" stroke="#1976d2" stroke-width="2" fill="none" stroke-linecap="round"/>
    <!-- سر -->
    <circle cx="50" cy="38" r="18" fill="#ffe0b2"/>
    <!-- موها -->
    <path d="M 32 35 Q 32 18 50 18 Q 68 18 68 35 Q 65 28 50 28 Q 35 28 32 35 Z" fill="url(#avatarHairGrad)"/>
    <path d="M 32 35 Q 30 32 32 28 Q 33 30 35 31 Z" fill="url(#avatarHairGrad)"/>
    <path d="M 68 35 Q 70 32 68 28 Q 67 30 65 31 Z" fill="url(#avatarHairGrad)"/>
    <!-- چشم‌ها -->
    <circle cx="43" cy="38" r="2.5" fill="#333"/>
    <circle cx="57" cy="38" r="2.5" fill="#333"/>
    <!-- برق چشم -->
    <circle cx="44" cy="37" r="0.8" fill="#fff"/>
    <circle cx="58" cy="37" r="0.8" fill="#fff"/>
    <!-- لبخند -->
    <path d="M 43 46 Q 50 51 57 46" stroke="#c2185b" stroke-width="2" fill="none" stroke-linecap="round"/>
    <!-- گوش‌ها -->
    <circle cx="32" cy="40" r="3" fill="#ffccbc"/>
    <circle cx="68" cy="40" r="3" fill="#ffccbc"/>
</svg>
`;

// ============================================================
// آواتار پیش‌فرض (عکس قدیمی - برای پشتیبانی از کاربران قدیمی)
// ============================================================
const DEFAULT_AVATAR = 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';

// ============================================================
// مجموعه ایموجی‌ها (فقط دسته‌های آموزشی و سرگرم‌کننده)
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
// گرفتن آواتار برای نمایش در رتبه‌بندی
// ============================================================
function getAvatarForRanking() {
    const avatarImg = localStorage.getItem('userAvatar');
    if (avatarImg) {
        return avatarImg;
    }
    const avatarEmoji = localStorage.getItem('userAvatarEmoji');
    if (avatarEmoji) {
        return `emoji:${avatarEmoji}`;
    }
    // 🆕 پیش‌فرض: وکتور پسر
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
    // 🆕 پیش‌فرض: وکتور پسر
    return { type: 'default-svg', value: DEFAULT_AVATAR_SVG };
}

// ============================================================
// اعمال آواتار روی عناصر صفحه
// ============================================================
function applyAvatarToElements() {
    const avatar = getAvatarDisplay();

    const imgElements = ['home-avatar-img', 'profile-avatar-img'];
    imgElements.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const parent = el.parentElement;

        if (avatar.type === 'image') {
            el.src = avatar.value;
            el.style.display = 'block';
            if (parent) {
                const emojiSpan = parent.querySelector('.emoji-avatar');
                if (emojiSpan) emojiSpan.remove();
                const svgSpan = parent.querySelector('.default-avatar-svg');
                if (svgSpan) svgSpan.remove();
                parent.classList.remove('emoji-mode');
            }
        } else if (avatar.type === 'emoji') {
            el.style.display = 'none';
            if (parent) {
                parent.classList.add('emoji-mode');
                
                // حذف SVG اگه هست
                const svgSpan = parent.querySelector('.default-avatar-svg');
                if (svgSpan) svgSpan.remove();
                
                let emojiSpan = parent.querySelector('.emoji-avatar');
                if (!emojiSpan) {
                    emojiSpan = document.createElement('span');
                    emojiSpan.className = 'emoji-avatar';
                    parent.appendChild(emojiSpan);
                }
                emojiSpan.textContent = avatar.value;
            }
        } else if (avatar.type === 'default-svg') {
            el.style.display = 'none';
            if (parent) {
                parent.classList.add('emoji-mode');
                
                // حذف ایموجی اگه هست
                const emojiSpan = parent.querySelector('.emoji-avatar');
                if (emojiSpan) emojiSpan.remove();
                
                let svgContainer = parent.querySelector('.default-avatar-svg');
                if (!svgContainer) {
                    svgContainer = document.createElement('div');
                    svgContainer.className = 'default-avatar-svg';
                    svgContainer.innerHTML = avatar.value;
                    parent.appendChild(svgContainer);
                } else {
                    svgContainer.innerHTML = avatar.value;
                }
            }
        } else {
            // پشتیبانی از عکس قدیمی
            el.src = DEFAULT_AVATAR;
            el.style.display = 'block';
            if (parent) {
                const emojiSpan = parent.querySelector('.emoji-avatar');
                if (emojiSpan) emojiSpan.remove();
                const svgSpan = parent.querySelector('.default-avatar-svg');
                if (svgSpan) svgSpan.remove();
                parent.classList.remove('emoji-mode');
            }
        }
    });
}

// ============================================================
// انتخاب ایموجی به عنوان آواتار
// ============================================================
function selectEmojiAvatar(emoji, element) {
    localStorage.setItem('userAvatarEmoji', emoji);
    localStorage.removeItem('userAvatar');

    applyAvatarToElements();

    document.querySelectorAll('.emoji-picker-item').forEach(el => {
        el.classList.remove('selected');
    });
    if (element) element.classList.add('selected');

    vibrate(15);
    
    setTimeout(() => {
        closeEmojiPicker();
        showModal('موفق', 'ایموجی پروفایل با موفقیت تغییر کرد.', '✅');
        
        if (typeof autoSyncRanking === 'function') {
            autoSyncRanking('تغییر ایموجی آواتار');
        } else if (typeof saveRankingToSupabase === 'function') {
            saveRankingToSupabase();
        }
    }, 300);
}

// ============================================================
// حذف ایموجی و برگشت به حالت پیش‌فرض (وکتور پسر)
// ============================================================
function removeEmojiAvatar() {
    localStorage.removeItem('userAvatarEmoji');
    localStorage.removeItem('userAvatar');
    applyAvatarToElements();
    vibrate(15);
}

// ============================================================
// ساخت پنل انتخاب ایموجی (HTML)
// ============================================================
function renderEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    if (!container) return;

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

// ============================================================
// باز کردن مودال انتخاب ایموجی
// ============================================================
function openEmojiPicker() {
    closeAvatarOptionsModal();
    renderEmojiPicker();
    document.getElementById('emoji-picker-modal').classList.add('active');
}

function closeEmojiPicker() {
    document.getElementById('emoji-picker-modal').classList.remove('active');
}

// ============================================================
// مودال انتخاب نوع آواتار
// ============================================================
function openAvatarOptionsModal() {
    document.getElementById('avatar-options-modal').classList.add('active');
}

function closeAvatarOptionsModal() {
    document.getElementById('avatar-options-modal').classList.remove('active');
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
        document.getElementById('avatar-input').click();
    }, 200);
}

// ============================================================
// 🆕 رندر آواتار در رتبه‌بندی (HTML)
// ============================================================
function renderAvatarHTML(ranking) {
    const avatarUrl = ranking.avatar_url || 'default';
    
    // حالت ایموجی
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '');
        return `<span class="lb-avatar-emoji">${emoji}</span>`;
    }
    
    // حالت عکس base64
    if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="آواتار" class="lb-avatar-img">`;
    }
    
    // حالت URL عکس
    if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="آواتار" class="lb-avatar-img" crossorigin="anonymous">`;
    }
    
    // 🆕 حالت پیش‌فرض: وکتور پسر
    return DEFAULT_AVATAR_SVG;
}
// ============================================================
// آواتار پیش‌فرض (وکتور پسر روی پس‌زمینه آبی SVG)
// ============================================================
const DEFAULT_AVATAR_SVG = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="default-avatar-svg">
    <defs>
        <!-- گرادیانت پس‌زمینه آبی -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#4A90E2;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#2E5C8A;stop-opacity:1" />
        </linearGradient>
        <!-- گرادیانت بدن -->
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#5B9BD5;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3E7CB1;stop-opacity:1" />
        </linearGradient>
        <!-- گرادیانت مو -->
        <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#4A3428;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#2E1F15;stop-opacity:1" />
        </linearGradient>
    </defs>

    <!-- پس‌زمینه آبی دایره‌ای -->
    <circle cx="100" cy="100" r="100" fill="url(#bgGrad)"/>

    <!-- بدن (پیراهن آبی) -->
    <path d="M 40 200 Q 40 145 100 145 Q 160 145 160 200 Z" fill="url(#bodyGrad)"/>
    <path d="M 40 200 Q 40 145 100 145 Q 160 145 160 200 Z" fill="none" stroke="#2E5C8A" stroke-width="2"/>

    <!-- یقه پیراهن -->
    <path d="M 80 148 L 100 165 L 120 148" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 80 148 L 100 165 L 120 148 L 130 155 L 100 175 L 70 155 Z" fill="#FFFFFF" opacity="0.9"/>

    <!-- گردن -->
    <rect x="88" y="125" width="24" height="25" fill="#F5C5A0"/>

    <!-- گوش‌ها -->
    <ellipse cx="70" cy="100" rx="6" ry="10" fill="#F5C5A0"/>
    <ellipse cx="130" cy="100" rx="6" ry="10" fill="#F5C5A0"/>

    <!-- سر -->
    <ellipse cx="100" cy="95" rx="35" ry="40" fill="#F5C5A0"/>

    <!-- موها -->
    <path d="M 65 85 Q 65 50 100 50 Q 135 50 135 85 Q 130 65 100 65 Q 70 65 65 85 Z" fill="url(#hairGrad)"/>
    <path d="M 65 85 Q 62 75 68 68 Q 70 75 72 78 Z" fill="url(#hairGrad)"/>
    <path d="M 135 85 Q 138 75 132 68 Q 130 75 128 78 Z" fill="url(#hairGrad)"/>

    <!-- ابروها -->
    <path d="M 78 85 Q 85 82 92 85" stroke="#3E2723" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 108 85 Q 115 82 122 85" stroke="#3E2723" stroke-width="3" fill="none" stroke-linecap="round"/>

    <!-- چشم‌ها -->
    <ellipse cx="85" cy="98" rx="4" ry="5" fill="#FFFFFF"/>
    <ellipse cx="115" cy="98" rx="4" ry="5" fill="#FFFFFF"/>
    <circle cx="85" cy="99" r="2.5" fill="#2C3E50"/>
    <circle cx="115" cy="99" r="2.5" fill="#2C3E50"/>
    <circle cx="86" cy="98" r="1" fill="#FFFFFF"/>
    <circle cx="116" cy="98" r="1" fill="#FFFFFF"/>

    <!-- بینی -->
    <path d="M 100 100 Q 98 108 100 112" stroke="#E0A680" stroke-width="2" fill="none" stroke-linecap="round"/>

    <!-- لبخند -->
    <path d="M 88 118 Q 100 126 112 118" stroke="#B85C5C" stroke-width="3" fill="none" stroke-linecap="round"/>

    <!-- گونه‌ها -->
    <ellipse cx="75" cy="110" rx="6" ry="4" fill="#FFB6B6" opacity="0.5"/>
    <ellipse cx="125" cy="110" rx="6" ry="4" fill="#FFB6B6" opacity="0.5"/>
</svg>
`;