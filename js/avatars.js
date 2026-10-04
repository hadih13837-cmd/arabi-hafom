// ============================================================
// avatars.js — مجموعه ایموجی‌ها و منطق آواتار
// نسخه: ۲.۱.۰ — با همگام‌سازی خودکار
// ============================================================

// ============================================================
// آواتار پیش‌فرض (عکس پسر)
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
    return 'emoji:👤';
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
    return { type: 'default', value: DEFAULT_AVATAR };
}

// ============================================================
// اعمال آواتار توی عناصر صفحه
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
                parent.classList.remove('emoji-mode');
            }
        } else if (avatar.type === 'emoji') {
            el.style.display = 'none';
            if (parent) {
                parent.classList.add('emoji-mode');
                
                let emojiSpan = parent.querySelector('.emoji-avatar');
                if (!emojiSpan) {
                    emojiSpan = document.createElement('span');
                    emojiSpan.className = 'emoji-avatar';
                    parent.appendChild(emojiSpan);
                }
                emojiSpan.textContent = avatar.value;
            }
        } else {
            el.src = avatar.value;
            el.style.display = 'block';
            if (parent) {
                const emojiSpan = parent.querySelector('.emoji-avatar');
                if (emojiSpan) emojiSpan.remove();
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
        
        // 🆕 همگام‌سازی خودکار بعد از تغییر ایموجی
        if (typeof autoSyncRanking === 'function') {
            autoSyncRanking('تغییر ایموجی آواتار');
        } else if (typeof saveRankingToSupabase === 'function') {
            saveRankingToSupabase();
        }
    }, 300);
}

// ============================================================
// حذف ایموجی و برگشت به حالت پیش‌فرض
// ============================================================
function removeEmojiAvatar() {
    localStorage.removeItem('userAvatarEmoji');
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