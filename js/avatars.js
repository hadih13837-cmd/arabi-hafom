// ============================================================
// avatars.js — مجموعه ایموجی‌ها و منطق آواتار
// ============================================================

// ============================================================
// آواتار پیش‌فرض (عکس پسر)
// ============================================================
const DEFAULT_AVATAR = 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';

// ============================================================
// مجموعه ایموجی‌های پیشنهادی (دسته‌بندی شده)
// ============================================================
const AVATAR_EMOJIS = {
    'حیوانات': ['🐱', '🐶', '🦊', '🐰', '🐼', '🐨', '🦁', '🐯', '🐮', '🐷', '🐸', '🐵', '🐔', '🦉', '🦄', '🐲'],
    'طبیعت': ['🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🍀', '🌿', '🌱', '🌳', '🌴', '🍁', '🍂', '🌾', '🌵', '🌲'],
    'میوه‌ها': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥝', '🍅', '🥑', '🥕'],
    'ورزشی': ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🏆', '🏅', '🎯', '🎳', '🎮'],
    'فضا': ['⭐', '🌟', '✨', '💫', '🌙', '🌛', '🌜', '☀️', '🌞', '🪐', '🌍', '🌎', '🌏', '🚀', '🛸', '👽'],
    'آموزشی': ['📚', '📖', '📝', '✏️', '🖊️', '📐', '📏', '🎓', '🏫', '🔬', '🔭', '💡', '🧠', '💻', '🖥️', '📊'],
    'چهره‌ها': ['😀', '😎', '🤓', '😇', '🥳', '🤗', '😺', '🤖', '👻', '🎃', '👑', '🧙', '🦸', '🧚', '🥷', '💪'],
    'غذا': ['🍕', '🍔', '🌮', '🌯', '🍟', '🍿', '🍩', '🍪', '🎂', '🧁', '🍰', '🍫', '🍬', '🍭', '🍦', '🍧'],
    'رنگ‌ها': ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛'],
    'نمادها': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💝', '🔥', '⚡', '💎', '🌈', '☮️', '✌️']
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
// گرفتن آواتار برای نمایش توی خود برنامه
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
            // عکس کاربر
            el.src = avatar.value;
            el.style.display = 'block';
            if (parent) {
                const emojiSpan = parent.querySelector('.emoji-avatar');
                if (emojiSpan) emojiSpan.remove();
            }
        } else if (avatar.type === 'emoji') {
            // ایموجی انتخاب‌شده
            el.style.display = 'none';
            if (parent) {
                let emojiSpan = parent.querySelector('.emoji-avatar');
                if (!emojiSpan) {
                    emojiSpan = document.createElement('span');
                    emojiSpan.className = 'emoji-avatar';
                    parent.appendChild(emojiSpan);
                }
                emojiSpan.textContent = avatar.value;
            }
        } else {
            // 🆕 عکس پیش‌فرض (پسر)
            el.src = avatar.value;
            el.style.display = 'block';
            if (parent) {
                const emojiSpan = parent.querySelector('.emoji-avatar');
                if (emojiSpan) emojiSpan.remove();
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
    renderEmojiPicker();
    document.getElementById('emoji-picker-modal').classList.add('active');
}

function closeEmojiPicker() {
    document.getElementById('emoji-picker-modal').classList.remove('active');
}