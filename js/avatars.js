// ============================================================
// avatars.js — مجموعه ایموجی‌ها و منطق آواتار
// نسخه: ۱۲.۰.۰ — رفع کامل باگ تغییر از ایموجی به عکس بدون رفرش
// ============================================================

const DEFAULT_AVATAR = 'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png';

const AVATAR_EMOJIS = {
    'حیوانات': ['🐱', '🐶', '🦊', '🐰', '🐼', '🐨', '🦁', '🐯', '🐮', '🐷', '🐸', '🐵', '🐔', '🦉', '🦄', '🐲'],
    'طبیعت': ['🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🍀', '🌿', '🌱', '🌳', '🌴', '🍁', '🍂', '🌾', '🌵', '🌲'],
    'میوه‌ها': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥝', '🍅', '🥑', '🥕'],
    'ورزشی': ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🏆', '🏅', '🎯', '🎳', '🎮'],
    'فضا': ['⭐', '🌟', '✨', '💫', '🌙', '🌛', '🌜', '☀️', '🌞', '🪐', '🌍', '🌎', '🌏', '🚀', '🛸', '👽'],
    'آموزشی': ['📚', '📖', '📝', '✏️', '🖊️', '📐', '📏', '🎓', '🏫', '🔬', '🔭', '💡', '🧠', '💻', '🖥️', '📊']
};

function getAvatarForRanking() {
    const avatarImg = localStorage.getItem('userAvatar');
    if (avatarImg) return avatarImg;
    
    const avatarEmoji = localStorage.getItem('userAvatarEmoji');
    if (avatarEmoji) return `emoji:${avatarEmoji}`;
    
    return 'default';
}

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

// 🆕 اصلاح شد: پیدا کردن کادر آواتار از روی والد (حتی اگر عکس یا اسپن داخلش نباشه)
function applyAvatarToElements() {
    const avatar = getAvatarDisplay();
    
    // پیدا کردن تمام کادرهایی که باید آواتار داشته باشن
    const avatarContainers = [
        document.getElementById('home-avatar-img')?.parentElement,
        document.getElementById('profile-avatar-img')?.parentElement,
        document.querySelector('.home-welcome-avatar'),
        document.querySelector('.profile-avatar')
    ].filter(Boolean); // حذف مقادیر undefined/null

    // اگر کادری پیدا نشد (مثلاً در صفحه‌ی رتبه‌بندی هستیم)، کاری نکن
    if (avatarContainers.length === 0) return;

    avatarContainers.forEach(parent => {
        // پاک کردن کلاس‌های قبلی
        parent.classList.remove('emoji-mode');
        // خالی کردن کل محتوا
        parent.innerHTML = '';

        if (avatar.type === 'image') {
            const img = document.createElement('img');
            // سعی می‌کنیم آیدی درست رو بهش بدیم تا در رفرش‌های بعدی پیدا بشه
            if (parent.classList.contains('home-welcome-avatar')) img.id = 'home-avatar-img';
            else if (parent.classList.contains('profile-avatar')) img.id = 'profile-avatar-img';
            
            img.src = avatar.value;
            img.alt = 'آواتار';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            img.onerror = () => { img.src = DEFAULT_AVATAR; };
            parent.appendChild(img);
        } else if (avatar.type === 'emoji') {
            parent.classList.add('emoji-mode');
            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'emoji-avatar';
            emojiSpan.textContent = avatar.value;
            parent.appendChild(emojiSpan);
        }
    });
}

function selectEmojiAvatar(emoji, element) {
    localStorage.setItem('userAvatarEmoji', emoji);
    localStorage.removeItem('userAvatar');

    // 🆕 اعمال فوری
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
            await saveRankingToSupabase();
        }
        
        // 🆕 به‌روزرسانی پروفایل برای اطمینان
        if (typeof loadProfileData === 'function') loadProfileData();
    }, 300);
}

// 🆕 تابع حذف آواتار
function removeAvatar() {
    localStorage.removeItem('userAvatarEmoji');
    localStorage.removeItem('userAvatar');
    
    applyAvatarToElements();
    vibrate(15);
    
    closeEmojiPicker();
    showModal('موفق', 'آواتار به حالت پیش‌فرض بازگشت.', '✅');
    
    if (typeof saveRankingToSupabase === 'function') {
        saveRankingToSupabase();
    }
    
    if (typeof loadProfileData === 'function') loadProfileData();
}

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

    // دکمه حذف
    html += `
        <div style="padding: 20px 0; text-align: center; border-top: 2px dashed #e3f2fd; margin-top: 15px;">
            <button onclick="removeAvatar()" style="background: linear-gradient(135deg, #ffebee, #ffcdd2); color: #c62828; border: 2px solid #ef9a9a; padding: 12px 24px; border-radius: 50px; font-family: 'Vazirmatn', sans-serif; font-size: 14px; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; width: 100%; justify-content: center;">
                🗑️ حذف آواتار (بازگشت به پیش‌فرض)
            </button>
        </div>
    `;

    container.innerHTML = html;
}

function openEmojiPicker() {
    const optionsModal = document.getElementById('avatar-options-modal');
    if (optionsModal) optionsModal.classList.remove('active');
    
    renderEmojiPicker();
    
    const emojiModal = document.getElementById('emoji-picker-modal');
    if (emojiModal) emojiModal.classList.add('active');
}

function closeEmojiPicker() {
    const modal = document.getElementById('emoji-picker-modal');
    if (modal) modal.classList.remove('active');
}

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
    setTimeout(() => openEmojiPicker(), 200);
}

function chooseGalleryOption() {
    closeAvatarOptionsModal();
    setTimeout(() => {
        const fileInput = document.getElementById('avatar-input');
        if (fileInput) fileInput.click();
    }, 200);
}

// ============================================================
// رندر آواتار در رتبه‌بندی
// ============================================================
function renderAvatarInRanking(ranking) {
    const avatarUrl = (ranking && ranking.avatar_url) ? String(ranking.avatar_url).trim() : '';
    
    if (!avatarUrl || avatarUrl === '' || avatarUrl === 'null' || avatarUrl === 'undefined' || avatarUrl === 'default') {
        return `<img src="${DEFAULT_AVATAR}" alt="" class="lb-avatar-img">`;
    }
    
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '').trim();
        if (!emoji || emoji === '👤' || emoji === '👦🏻' || emoji === '👦') {
            return `<img src="${DEFAULT_AVATAR}" alt="" class="lb-avatar-img">`;
        }
        return `<span class="lb-avatar-emoji">${emoji}</span>`;
    }
    
    if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="" class="lb-avatar-img">`;
    }
    
    if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="" class="lb-avatar-img" onerror="this.src='${DEFAULT_AVATAR}'">`;
    }
    
    return `<img src="${DEFAULT_AVATAR}" alt="" class="lb-avatar-img">`;
}

function renderAvatarHTML(ranking) {
    return renderAvatarInRanking(ranking);
}

function renderAvatarForChat(conv) {
    const avatarUrl = (conv && conv.avatar_url) ? String(conv.avatar_url).trim() : '';
    
    if (!avatarUrl || avatarUrl === '' || avatarUrl === 'null' || avatarUrl === 'default') {
        return `<img src="${DEFAULT_AVATAR}" alt="">`;
    }
    
    if (avatarUrl.startsWith('emoji:')) {
        const emoji = avatarUrl.replace('emoji:', '').trim();
        if (!emoji || emoji === '👤' || emoji === '👦🏻' || emoji === '👦') {
            return `<img src="${DEFAULT_AVATAR}" alt="">`;
        }
        return emoji;
    }
    
    if (avatarUrl.startsWith('data:image')) {
        return `<img src="${avatarUrl}" alt="">`;
    }
    
    if (avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="" onerror="this.src='${DEFAULT_AVATAR}'">`;
    }
    
    return `<img src="${DEFAULT_AVATAR}" alt="">`;
}