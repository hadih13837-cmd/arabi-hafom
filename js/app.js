// ============================================================
// app.js — نقطه شروع برنامه
// نسخه: ۳۵.۰.۰ — رفع باگ چالش هفتگی و تکرار بارگذاری
// ============================================================

const UPDATE_VERSION = 'v2.5.0';

function isReturningUser() {
    return localStorage.getItem('isReturningUser') === 'true';
}

function showChoiceView() {
    document.querySelectorAll('.welcome-view').forEach(v => v.classList.remove('active'));
    const choiceView = document.getElementById('welcome-choice-view');
    if (choiceView) choiceView.classList.add('active');
    vibrate(15);
}

function showRegisterView() {
    document.querySelectorAll('.welcome-view').forEach(v => v.classList.remove('active'));
    const registerView = document.getElementById('welcome-register-view');
    if (registerView) registerView.classList.add('active');
    vibrate(15);
    setTimeout(() => {
        const nameInput = document.getElementById('welcome-name');
        if (nameInput) nameInput.focus();
    }, 300);
}

function showLoginView() {
    document.querySelectorAll('.welcome-view').forEach(v => v.classList.remove('active'));
    const loginView = document.getElementById('welcome-login-view');
    if (loginView) loginView.classList.add('active');
    vibrate(15);
    setTimeout(() => {
        const codeInput = document.getElementById('login-code');
        if (codeInput) codeInput.focus();
    }, 300);
}

function checkAndShowUpdateModal() {
    // 🆕 اگر published نباشد، مودال نشان نده
    if (typeof isPublished !== 'undefined' && !isPublished) return;
    
    if (isReturningUser()) return;
    
    const seenVersion = localStorage.getItem('seenUpdateVersion');
    if (seenVersion === UPDATE_VERSION) return;
    if (localStorage.getItem('userRegistered') !== 'true') return;
    
    setTimeout(() => showUpdateModal(), 2500);
}

function showUpdateModal() {
    const modal = document.getElementById('update-modal');
    if (modal) modal.classList.add('active');
}

function closeUpdateModal() {
    const modal = document.getElementById('update-modal');
    if (modal) modal.classList.remove('active');
    localStorage.setItem('seenUpdateVersion', UPDATE_VERSION);
    localStorage.setItem('seenUpdateDate', new Date().toISOString());
    vibrate(20);
}

let rankingsGuideStep = 0;

const RANKINGS_GUIDE_STEPS = [
    { icon: '🏆', title: 'رتبه‌بندی کلاس', subtitle: 'با دوستات رقابت کن!', text: 'اینجا می‌تونی <strong>رتبه‌ت رو در کلاس</strong> ببینی.' },
    { icon: '🥇', title: 'سکوی قهرمانی', subtitle: 'سه نفر اول', text: 'سه نفر اول کلاس با <strong>مدال طلا، نقره و برنز</strong> نشون داده میشن.' },
    { icon: '👆', title: 'کارت پروفایل', subtitle: 'اطلاعات کامل', text: 'با کلیک روی هر دانش‌آموز، <strong>کارت پروفایلش</strong> باز میشه.' },
    { icon: '⭐', title: 'امتیاز بگیر', subtitle: 'تکالیف رو انجام بده', text: 'برای بالا رفتن در رتبه‌بندی، <strong>تکالیفت رو انجام بده</strong>.' }
];

function checkAndShowRankingsGuide() {
    if (isReturningUser()) return false;
    const hasSeen = localStorage.getItem('hasSeenRankingsGuide') === 'true';
    if (hasSeen) return false;
    setTimeout(() => showRankingsGuide(), 800);
    return true;
}

function showRankingsGuide() {
    rankingsGuideStep = 0;
    updateRankingsGuideStep();
    const overlay = document.getElementById('rankings-guide');
    if (overlay) overlay.classList.add('active');
}

function updateRankingsGuideStep() {
    const step = RANKINGS_GUIDE_STEPS[rankingsGuideStep];
    if (!step) return;
    const stepEl = document.getElementById('rankings-guide-step');
    const iconEl = document.getElementById('rankings-guide-icon');
    const titleEl = document.getElementById('rankings-guide-title');
    const subtitleEl = document.getElementById('rankings-guide-subtitle');
    const textEl = document.getElementById('rankings-guide-text');
    const nextBtn = document.getElementById('rankings-guide-next');
    const dotsEl = document.getElementById('rankings-guide-dots');
    if (stepEl) stepEl.textContent = `گام ${toPersianNum(rankingsGuideStep + 1)} از ${toPersianNum(RANKINGS_GUIDE_STEPS.length)}`;
    if (iconEl) iconEl.textContent = step.icon;
    if (titleEl) titleEl.textContent = step.title;
    if (subtitleEl) subtitleEl.textContent = step.subtitle;
    if (textEl) textEl.innerHTML = step.text;
    if (nextBtn) nextBtn.textContent = (rankingsGuideStep === RANKINGS_GUIDE_STEPS.length - 1) ? 'شروع! 🎯' : 'فهمیدم';
    if (dotsEl) {
        let dotsHTML = '';
        for (let i = 0; i < RANKINGS_GUIDE_STEPS.length; i++) {
            dotsHTML += `<div class="rankings-guide-dot ${i === rankingsGuideStep ? 'active' : ''}"></div>`;
        }
        dotsEl.innerHTML = dotsHTML;
    }
}

function nextRankingsGuide() {
    vibrate(15);
    rankingsGuideStep++;
    if (rankingsGuideStep >= RANKINGS_GUIDE_STEPS.length) closeRankingsGuide();
    else updateRankingsGuideStep();
}

function skipRankingsGuide() { vibrate(15); closeRankingsGuide(); }

function closeRankingsGuide() {
    const overlay = document.getElementById('rankings-guide');
    if (overlay) overlay.classList.remove('active');
    localStorage.setItem('hasSeenRankingsGuide', 'true');
    localStorage.setItem('rankingsGuideSeenDate', new Date().toISOString());
}
function checkAndShowNewMessageNotification() {
    if (isReturningUser()) return;
    
    const dismissed = localStorage.getItem('dismissedNewMessageNotif') === 'true';
    if (dismissed) return;
    
    const studentId = localStorage.getItem('studentUUID');
    if (!studentId) return;
    
    const cachedChat = getCachedData('studentChatCache_' + studentId);
    const cachedClass = getCachedData('studentClassMessagesCache');
    if (!cachedChat && !cachedClass) return;
    
    const seenChat = JSON.parse(localStorage.getItem('seenChatMessages') || '[]');
    const seenClass = JSON.parse(localStorage.getItem('seenClassMessages') || '[]');
    
    let unreadChat = 0, unreadClass = 0;
    if (cachedChat && cachedChat.length > 0) {
        unreadChat = cachedChat.filter(m => m.sender === 'teacher' && !seenChat.includes(m.message_id)).length;
    }
    if (cachedClass && cachedClass.length > 0) {
        unreadClass = cachedClass.filter(m => !seenClass.includes(m.message_id)).length;
    }
    
    const totalUnread = unreadChat + unreadClass;
    if (totalUnread === 0) return;
    
    const notif = document.getElementById('new-message-notification');
    const subText = document.getElementById('new-message-notification-sub');
    
    if (notif && subText) {
        let text = '';
        if (unreadChat > 0 && unreadClass > 0) {
            text = `${toPersianNum(unreadChat)} پیام شخصی و ${toPersianNum(unreadClass)} پیام کلاسی جدید`;
        } else if (unreadChat > 0) {
            text = unreadChat === 1 ? 'یک پیام شخصی جدید داری' : `${toPersianNum(unreadChat)} پیام شخصی جدید داری`;
        } else {
            text = unreadClass === 1 ? 'یک پیام کلاسی جدید داری' : `${toPersianNum(unreadClass)} پیام کلاسی جدید داری`;
        }
        subText.textContent = text;
        if (typeof repositionNotifications === 'function') repositionNotifications();
        setTimeout(() => { 
            notif.classList.add('show'); 
            if (typeof repositionNotifications === 'function') repositionNotifications(); 
        }, 600);
    }
}

function dismissNewMessageNotification() {
    const notif = document.getElementById('new-message-notification');
    if (!notif) return;
    
    notif.classList.add('swiping');
    notif.style.transform = 'translateY(-200%)';
    notif.style.opacity = '0';
    
    setTimeout(() => {
        notif.classList.remove('show', 'swiping');
        notif.style.transform = '';
        notif.style.opacity = '';
        if (typeof repositionNotifications === 'function') repositionNotifications();
    }, 300);
    
    localStorage.setItem('dismissedNewMessageNotif', 'true');
    if (typeof debouncedSaveSeenData === 'function') debouncedSaveSeenData();
}

function goToTeacherMessagesFromNotification() {
    dismissNewMessageNotification();
    setTimeout(() => goToScreen('screen-teacher-messages'), 200);
}

function resetNewMessageNotification() { 
    localStorage.removeItem('dismissedNewMessageNotif'); 
}

async function checkAndShowNewJozveNotification() {
    if (isReturningUser()) return;
    
    const dismissed = localStorage.getItem('dismissedNewJozveNotif') === 'true';
    if (dismissed) return;
    
    try {
        const response = await fetch('./jozve/index.json?t=' + Date.now());
        if (!response.ok) return;
        const data = await response.json();
        const items = data.items || [];
        if (items.length === 0) return;
        
        const seenJozve = JSON.parse(localStorage.getItem('seenJozveIds') || '[]');
        const newItems = items.filter(item => !seenJozve.includes(item.id));
        
        if (newItems.length > 0) {
            const notif = document.getElementById('new-jozve-notification');
            const subText = document.getElementById('new-jozve-notification-sub');
            if (notif && subText) {
                const text = newItems.length === 1 
                    ? `«${newItems[0].title}» اضافه شد` 
                    : `${toPersianNum(newItems.length)} جزوه جدید اضافه شد`;
                subText.textContent = text;
                if (typeof repositionNotifications === 'function') repositionNotifications();
                setTimeout(() => { 
                    notif.classList.add('show'); 
                    if (typeof repositionNotifications === 'function') repositionNotifications(); 
                }, 300);
            }
        }
    } catch (e) { 
        console.warn('خطا در چک جزوه:', e); 
    }
}

function dismissNewJozveNotification() {
    const notif = document.getElementById('new-jozve-notification');
    if (!notif) return;
    
    notif.classList.add('swiping');
    notif.style.transform = 'translateY(-200%)';
    notif.style.opacity = '0';
    
    setTimeout(() => {
        notif.classList.remove('show', 'swiping');
        notif.style.transform = '';
        notif.style.opacity = '';
        if (typeof repositionNotifications === 'function') repositionNotifications();
    }, 300);
    
    saveJozveSeen();
}

function goToJozveFromNotification() {
    dismissNewJozveNotification();
    setTimeout(() => { window.location.href = './jozve.html'; }, 250);
}

async function saveJozveSeen() {
    try {
        const response = await fetch('./jozve/index.json?t=' + Date.now());
        if (!response.ok) return;
        const data = await response.json();
        const items = data.items || [];
        const ids = items.map(item => item.id);
        localStorage.setItem('seenJozveIds', JSON.stringify(ids));
        localStorage.setItem('dismissedNewJozveNotif', 'true');
        if (typeof debouncedSaveSeenData === 'function') debouncedSaveSeenData();
    } catch (e) {}
}

function resetJozveNotification() { 
    localStorage.removeItem('dismissedNewJozveNotif'); 
}

// ============================================================
// 🆕 سیستم استوری و چالش هفتگی
// ============================================================
let allStories = [];
let currentStoryIndex = 0;
let cachedStories = null;
let challengesData = [];
let challengeTimerInterval = null;

async function loadQuranStories() {
    try {
        const localCache = localStorage.getItem('storiesCache');
        if (localCache) {
            allStories = JSON.parse(localCache);
            renderStories();
        }
    } catch (e) {}

    try {
        const response = await fetch('./stories.json?t=' + Date.now());
        if (!response.ok) return;
        const data = await response.json();
        
        const newStories = data.stories || [];
        if (JSON.stringify(newStories) !== JSON.stringify(allStories)) {
            allStories = newStories;
            cachedStories = allStories;
            localStorage.setItem('storiesCache', JSON.stringify(allStories));
            renderStories();
        }
    } catch (e) { 
        console.warn('خطا در بارگذاری استوری:', e); 
    }
}

async function loadChallenges() {
    try {
        const response = await fetch('./challenges.json?t=' + Date.now());
        if (!response.ok) return;
        const data = await response.json();
        challengesData = data.challenges || [];
        renderStories();
    } catch (e) { 
        console.warn('خطا در بارگذاری آزمون‌ها:', e); 
    }
}

// 🆕 بررسی بج چالش هفتگی
async function checkChallengeBadge() {
    try {
        if (!challengesData || challengesData.length === 0) {
            const badge = document.getElementById('challenge-badge');
            if (badge) badge.style.display = 'none';
            return;
        }
        
        const now = new Date().getTime();
        const seenChallenges = JSON.parse(localStorage.getItem('seenChallenges') || '[]');
        
        let hasNew = false;
        let hasStarted = false;

        challengesData.forEach(c => {
            if (!seenChallenges.includes(c.id)) hasNew = true;
            
            const startDate = new Date(c.startDate);
            startDate.setHours(0, 0, 0, 0);
            if (now >= startDate.getTime()) hasStarted = true;
        });

        const badge = document.getElementById('challenge-badge');
        if (badge) {
            if (hasNew) {
                badge.textContent = 'جدید';
                badge.style.display = 'flex';
            } else if (hasStarted) {
                badge.textContent = '!';
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) { 
        console.warn('خطا در بررسی بج چالش:', e); 
    }
}


// 🆕 رندر استوری‌ها + چالش هفتگی
function renderStories() {
    const container = document.getElementById('story-scroll-container');
    if (!container) return;
    
    let html = '';

    if (allStories.length > 0) {
        const seenStories = JSON.parse(localStorage.getItem('seenStories') || '[]');
        const firstStoryId = allStories[0].id;
        const isNew = !seenStories.includes(firstStoryId);
        const previewVideoUrl = allStories[0].videoUrl;
        
        html += `
            <div class="story-item-wrapper" onclick="openStoryViewer(0)">
                <div class="story-item-ring ${isNew ? 'new-story' : 'seen-story'}">
                    <div class="story-item-image">
                        <video src="${previewVideoUrl}" autoplay loop muted playsinline></video>
                    </div>
                </div>
                <div class="story-item-title">آیات قرآنی</div>
                ${isNew ? '<div class="story-new-badge">جدید</div>' : ''}
            </div>
        `;
    }

    // 🆕 چالش هفتگی — فقط پیام درون‌برنامه‌ای "در حال ساخت"
    html += `
        <div class="story-item-wrapper" onclick="showChallengeComingSoon()">
            <div class="weekly-challenge-ring">
                <div class="weekly-challenge-image">
                    <video src="https://cdn.imgurl.ir/uploads/f978629_.mp4" autoplay loop muted playsinline></video>
                </div>
                <div class="challenge-badge" id="challenge-badge" style="display: none;">جدید</div>
            </div>
            <div class="weekly-challenge-title">چالش هفتگی</div>
        </div>
    `;
    
    container.innerHTML = html;
    setTimeout(() => checkChallengeBadge(), 100);
}

// 🆕 نمایش پیام "در حال ساخت" برای چالش هفتگی
function showChallengeComingSoon() {
    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 30]);
    }
    showModal(
        '🚧 در حال ساخت',
        'بخش چالش هفتگی هنوز آماده نیست و به‌زودی با قابلیت‌های جدید اضافه می‌شه.\n\nممنون از صبرت! 🙏',
        '🚧'
    );
}
// ✅ تابع باز کردن استوری
function openStoryViewer(index) {
    if (allStories.length === 0) return;
    
    currentStoryIndex = index;
    const story = allStories[index];
    const overlay = document.getElementById('story-viewer-overlay');
    
    if (!overlay) return;
    
    history.pushState({ storyOpen: true }, '', '#story');
    overlay.classList.add('active');
    
    const viewedStories = JSON.parse(localStorage.getItem('viewedStories') || '[]');
    const isNewView = !viewedStories.includes(story.id);
    
    fetchStoryStats(story.id).then(stats => {
        const viewCountEl = document.getElementById('story-view-count');
        const likeCountEl = document.getElementById('story-like-count');
        if (viewCountEl) viewCountEl.textContent = toPersianNum(stats.views);
        if (likeCountEl) likeCountEl.textContent = toPersianNum(stats.likes);
        
        if (isNewView && viewCountEl) {
            viewCountEl.textContent = toPersianNum(stats.views + 1);
        }
    });
    
    playCurrentStory();

    if (isNewView) {
        updateStoryInteraction(story.id, 'view');
        viewedStories.push(story.id);
        localStorage.setItem('viewedStories', JSON.stringify(viewedStories));
    }
    
    const likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');
    const likeBtn = document.getElementById('story-like-btn');
    if (likeBtn) {
        if (likedStories.includes(story.id)) likeBtn.classList.add('liked');
        else likeBtn.classList.remove('liked');
    }
}

function playCurrentStory() {
    const story = allStories[currentStoryIndex];
    if (!story) {
        closeStoryViewer();
        return;
    }

    const title = document.getElementById('story-viewer-title');
    const video = document.getElementById('story-viewer-video');
    const progress = document.getElementById('story-viewer-progress-bar');
    
    title.textContent = story.title;
    video.src = story.videoUrl;
    
    progress.style.transition = 'none';
    progress.style.width = '0%';
    
    video.onloadedmetadata = () => {
        const duration = video.duration;
        video.play().then(() => {
            if (duration > 0 && isFinite(duration)) {
                setTimeout(() => {
                    progress.style.transition = `width ${duration}s linear`;
                    progress.style.width = '100%';
                }, 50);
            }
        }).catch(() => {});
    };

    video.onended = () => {
        nextStory();
    };

    if (currentStoryIndex === 0) {
        const seenStories = JSON.parse(localStorage.getItem('seenStories') || '[]');
        if (!seenStories.includes(story.id)) {
            seenStories.push(story.id);
            localStorage.setItem('seenStories', JSON.stringify(seenStories));
        }
    }
}

function nextStory() {
    currentStoryIndex++;
    if (currentStoryIndex < allStories.length) {
        openStoryViewer(currentStoryIndex); 
    } else {
        closeStoryViewer();
    }
}

function prevStory() {
    if (currentStoryIndex > 0) {
        currentStoryIndex--;
        openStoryViewer(currentStoryIndex); 
    } else {
        playCurrentStory(); 
    }
}

function closeStoryViewer() {
    const overlay = document.getElementById('story-viewer-overlay');
    const video = document.getElementById('story-viewer-video');
    const progress = document.getElementById('story-viewer-progress-bar');
    
    if (video) { video.pause(); video.src = ''; }
    if (progress) { progress.style.transition = 'none'; progress.style.width = '0%'; }
    if (overlay) overlay.classList.remove('active');
    
    if (history.state && history.state.storyOpen) {
        history.back();
    }

    renderStories();
}

async function updateStoryInteraction(storyId, action) {
    try {
        const client = getSupabase();
        if (!client) return;

        const studentId = localStorage.getItem('studentUUID');
        if (!studentId) return;

        if (action === 'view') {
            const { data: current } = await client
                .from('story_interactions')
                .select('views, likes')
                .eq('story_id', storyId)
                .maybeSingle();

            if (current) {
                await client.from('story_interactions').update({ views: current.views + 1 }).eq('story_id', storyId);
            } else {
                await client.from('story_interactions').insert({ story_id: storyId, views: 1, likes: 0 });
            }
        }
    } catch (error) {
        console.warn('⚠️ خطا در آپدیت تعامل استوری:', error);
    }
}

async function fetchStoryStats(storyId) {
    try {
        const client = getSupabase();
        if (!client) return { views: 0, likes: 0 };

        const { data, error } = await client
            .from('story_interactions')
            .select('views, likes')
            .eq('story_id', storyId)
            .maybeSingle();

        if (error || !data) return { views: 0, likes: 0 };
        return { views: data.views || 0, likes: data.likes || 0 };
    } catch (error) {
        return { views: 0, likes: 0 };
    }
}

async function toggleStoryLike() {
    const story = allStories[currentStoryIndex];
    if (!story) return;

    const likeBtn = document.getElementById('story-like-btn');
    const likeCountEl = document.getElementById('story-like-count');
    if (!likeBtn || !likeCountEl) return;

    const likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');
    const isLiked = likedStories.includes(story.id);
    
    let currentCount = parseInt(fromPersianNum(likeCountEl.textContent)) || 0;
    
    if (isLiked) {
        likeBtn.classList.remove('liked');
        currentCount = Math.max(0, currentCount - 1);
        likeCountEl.textContent = toPersianNum(currentCount);
        const newLiked = likedStories.filter(id => id !== story.id);
        localStorage.setItem('likedStories', JSON.stringify(newLiked));
    } else {
        likeBtn.classList.add('liked');
        currentCount += 1;
        likeCountEl.textContent = toPersianNum(currentCount);
        likedStories.push(story.id);
        localStorage.setItem('likedStories', JSON.stringify(likedStories));
    }

    vibrate(15);

    try {
        const client = getSupabase();
        if (client) {
            const { data: current } = await client
                .from('story_interactions')
                .select('likes')
                .eq('story_id', story.id)
                .maybeSingle();

            const dbLikes = current ? current.likes : 0;
            const newLikes = isLiked ? Math.max(0, dbLikes - 1) : dbLikes + 1;

            if (current) {
                await client.from('story_interactions').update({ likes: newLikes }).eq('story_id', story.id);
            } else {
                await client.from('story_interactions').insert({ story_id: story.id, views: 0, likes: newLikes });
            }
        }
    } catch (error) {
        console.warn('⚠️ خطا در ثبت لایک در دیتابیس:', error);
    }
}

async function downloadStoryVideo() {
    const story = allStories[currentStoryIndex];
    if (!story || !story.videoUrl) return;

    vibrate(15);

    try {
        const response = await fetch(story.videoUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `story_${story.id}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.warn('⚠️ خطا در دانلود:', error);
        const a = document.createElement('a');
        a.href = story.videoUrl;
        a.download = `story_${story.id}.mp4`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}
// ============================================================
// 🆕 autoSyncRanking — با بررسی کامل
// ============================================================
function autoSyncRanking(reason = 'unknown') {
    // 🆕 بررسی ۱: ثبت‌نام
    if (localStorage.getItem('userRegistered') !== 'true') return;
    
    // 🆕 بررسی ۲: تابع موجود
    if (typeof saveRankingToSupabase !== 'function') return;
    
    // 🆕 بررسی ۳: studentUUID موجود باشد
    const studentId = localStorage.getItem('studentUUID');
    if (!studentId) return;
    
    // 🆕 بررسی ۴: کاربر برگشتی نباید بلافاصله سینک شود
    if (isReturningUser()) {
        // فقط در بازگشت به برنامه سینک شود، نه در هر بار
        if (reason !== 'بازگشت به برنامه') return;
    }
    
    setTimeout(async () => {
        try { 
            await saveRankingToSupabase(); 
        } catch (e) { 
            console.warn('⚠️ خطا در autoSyncRanking:', e);
        }
    }, 500);
}

async function checkMaintenanceMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('admin') === ADMIN_CODE;
    
    try {
        const response = await fetch('./maintenance.json?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) return false;
        const data = await response.json();
        
        isPublished = (data.published !== false);
        
        if (isAdmin) return false;
        
        // 🆕 اگر maintenance: true باشد، نگهداری
        if (data.maintenance === true) return true;
        
        // 🆕 اگر published: false باشد، کاربر عادی نمی‌تواند وارد شود
        if (data.published === false) {
            return true;
        }
        
        return false;
    } catch(e) { 
        return false; 
    }
}

async function startApp() {
    const isRegistered = localStorage.getItem('userRegistered') === 'true';
    
    if (isRegistered) {
        updateStreak();
        await loadLessonsListForNotification();
        goToScreen('screen-home');
        
        // 🆕 تخصیص کد برای کاربر قدیمی
        setTimeout(async () => {
            const existingCode = localStorage.getItem('studentCode');
            if (!existingCode || !/^[0-9]{3}$/.test(existingCode)) {
                if (typeof assignCodeToOldUser === 'function') {
                    const newCode = await assignCodeToOldUser();
                    if (newCode && typeof showCodeModalToOldUser === 'function') {
                        setTimeout(() => showCodeModalToOldUser(newCode), 3000);
                    }
                }
            }
        }, 1000);
        
        // 🆕 انتقال داده‌های محلی به Supabase
        setTimeout(async () => {
            try {
                if (typeof transferLocalDataToSupabase === 'function') {
                    await transferLocalDataToSupabase();
                }
            } catch (e) {
                console.warn('⚠️ خطا در transferLocalDataToSupabase:', e);
            }
        }, 2000);
        
        setTimeout(() => {
            checkAndShowNotification();
            checkDeadlineWarning();
            updateNotificationBadge();
            checkVideoNotification();
            
            if (typeof checkTeacherMessagesBadge === 'function') {
                checkTeacherMessagesBadge();
            }
            
            if (typeof startRealtimeSubscriptions === 'function' && 
                typeof isRealtimeStarted !== 'undefined' && 
                !isRealtimeStarted) {
                setTimeout(() => startRealtimeSubscriptions(), 500);
            }
            
            if (!isReturningUser()) {
                checkAndShowUpdateModal();
                setTimeout(() => checkAndShowNewMessageNotification(), 1500);
                setTimeout(() => checkAndShowNewJozveNotification(), 2000);
            }
            
            if (!isReturningUser()) {
                if (localStorage.getItem('guideCompleted') !== 'true') {
                    currentGuideStep = 0;
                    showGuideStep();
                } else {
                    showStreakMessage();
                }
            }
            
            // 🆕 بارگذاری استوری و چالش فقط یک بار
            loadQuranStories();
            loadChallenges();
        }, 500);
    } else {
        goToScreen('screen-welcome');
        setTimeout(() => showChoiceView(), 100);
    }
}

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================================
// 🆕 PWA — Service Worker
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('✅ Service Worker ثبت شد');

            setInterval(() => {
                registration.update().catch(() => {});
            }, 60000);

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                console.log('🆕 نسخه‌ی جدید پیدا شد!');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('✅ نسخه‌ی جدید آماده - نمایش اعلان');
                        showUpdateNotification();
                        setTimeout(() => {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }, 3000);
                    }
                });
            });

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    const activeScreen = document.querySelector('.screen.active');
                    const isInQuiz = activeScreen && ['screen-quiz', 'screen-feedback', 'screen-result'].includes(activeScreen.id);
                    if (!isInQuiz) {
                        console.log('🔄 بارگذاری مجدد برای اعمال تغییرات...');
                        window.location.reload();
                    } else {
                        console.log('⏸️ رفرش به تعویق افتاد - کاربر در حال کار است');
                    }
                }
            });

        } catch (e) {
            console.log('⚠️ خطا در Service Worker:', e);
        }
    });
}

function showUpdateNotification() {
    if (document.getElementById('sw-update-notification')) return;
    
    const notif = document.createElement('div');
    notif.id = 'sw-update-notification';
    notif.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px);
        background: linear-gradient(135deg, #4caf50, #2e7d32); color: #fff; padding: 14px 22px;
        border-radius: 50px; font-family: 'Vazirmatn', sans-serif; font-size: 14px; font-weight: 900;
        z-index: 999999; box-shadow: 0 8px 30px rgba(76, 175, 80, 0.6);
        display: flex; align-items: center; gap: 10px;
        transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    notif.innerHTML = `<span style="font-size: 20px; animation: swSpin 1s linear infinite;">🔄</span><span>نسخه‌ی جدید در حال بارگذاری...</span>`;
    document.body.appendChild(notif);
    
    const style = document.createElement('style');
    style.textContent = `@keyframes swSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    
    setTimeout(() => { notif.style.transform = 'translateX(-50%) translateY(0)'; }, 50);
    
    setTimeout(() => {
        notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        notif.style.opacity = '0';
        notif.style.transform = 'translateX(-50%) translateY(-100px)';
        setTimeout(() => notif.remove(), 300);
    }, 2000);
}
// ============================================================
// PWA — نصب
// ============================================================
let deferredPrompt = null;
const installBanner = document.getElementById('install-banner');

function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function wasDismissed() {
    return localStorage.getItem('installBannerDismissed') === 'true';
}

function dismissInstallBanner() {
    if (installBanner) installBanner.classList.remove('show');
    localStorage.setItem('installBannerDismissed', 'true');
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isAppInstalled() && !wasDismissed() && installBanner) {
        setTimeout(() => installBanner.classList.add('show'), 3000);
    }
});

setTimeout(() => {
    if (!isAppInstalled() && !wasDismissed() && !deferredPrompt && installBanner) {
        installBanner.classList.add('show');
    }
}, 3000);

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            if (installBanner) installBanner.classList.remove('show');
            localStorage.setItem('installBannerDismissed', 'true');
        }
        deferredPrompt = null;
    } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        alert(isIOS 
            ? 'برای نصب در آیفون:\n\n۱. دکمه Share را بزنید.\n۲. Add to Home Screen را انتخاب کنید.' 
            : 'برای نصب:\n\nمنوی مرورگر → Add to home screen یا نصب برنامه');
    }
}

window.addEventListener('appinstalled', () => {
    if (installBanner) installBanner.classList.remove('show');
    localStorage.setItem('installBannerDismissed', 'true');
});

// ============================================================
// بارگذاری اولیه
// ============================================================
window.addEventListener('load', async () => {
    // 🆕 بررسی حالت نگهداری
    const isMaintenance = await checkMaintenanceMode();
    if (isMaintenance) {
        window.location.replace('./maintenance.html');
        return;
    }

    loadUserInfo();
    loadTheme();
    
    // 🆕 تخصیص کد برای کاربر قدیمی
    if (localStorage.getItem('userRegistered') === 'true') {
        const existingCode = localStorage.getItem('studentCode');
        if (!existingCode || !/^[0-9]{3}$/.test(existingCode)) {
            setTimeout(async () => {
                if (typeof assignCodeToOldUser === 'function') {
                    const newCode = await assignCodeToOldUser();
                    if (newCode && typeof showCodeModalToOldUser === 'function') {
                        setTimeout(() => showCodeModalToOldUser(newCode), 2000);
                    }
                }
            }, 2000);
        }
    }

    // 🆕 تولید studentUUID اگر نیست
    if (localStorage.getItem('userRegistered') === 'true' && !localStorage.getItem('studentUUID')) {
        const studentCode = localStorage.getItem('studentCode');
        if (studentCode && typeof generateUUIDFromCode === 'function') {
            const newUUID = await generateUUIDFromCode(studentCode);
            localStorage.setItem('studentUUID', newUUID);
        } else {
            const newUUID = generateUUID();
            localStorage.setItem('studentUUID', newUUID);
        }
    }

    // 🆕 بارگذاری تنظیمات
    if (localStorage.getItem('soundsEnabled') === 'false') {
        const el = document.getElementById('setting-sounds');
        if (el) el.checked = false;
    }
    if (localStorage.getItem('musicEnabled') === 'false') {
        const el = document.getElementById('setting-music');
        if (el) el.checked = false;
    }
    if (localStorage.getItem('darkMode') === 'true') {
        const settingEl = document.getElementById('setting-dark-mode');
        if (settingEl) settingEl.checked = true;
        document.body.classList.add('dark-mode');
    }

    initNotificationSwipe();

    const cameFromClips = sessionStorage.getItem('cameFromClips') === 'true';
    const isRegistered = localStorage.getItem('userRegistered') === 'true';

    if (cameFromClips || window.location.hash === '#home') {
        sessionStorage.removeItem('cameFromClips');
        history.replaceState({ screen: 'screen-home' }, '', '');
        
        if (isRegistered) {
            updateStreak();
            goToScreen('screen-home', false);
            
            // 🆕 انتقال داده‌ها به Supabase
            setTimeout(async () => {
                try {
                    if (typeof transferLocalDataToSupabase === 'function') {
                        await transferLocalDataToSupabase();
                    }
                } catch (e) {}
            }, 1500);
            
            // 🆕 بارگذاری تکالیف و نوتیفیکیشن‌ها
            setTimeout(() => {
                if (allLessons.length === 0) {
                    loadLessonsListForNotification().then(() => {
                        checkAndShowNotification();
                        checkDeadlineWarning();
                        updateNotificationBadge();
                    });
                } else {
                    checkAndShowNotification();
                    checkDeadlineWarning();
                    updateNotificationBadge();
                }
                
                checkVideoNotification();
                
                if (typeof checkTeacherMessagesBadge === 'function') {
                    checkTeacherMessagesBadge();
                }
                
                if (typeof startRealtimeSubscriptions === 'function' && 
                    typeof isRealtimeStarted !== 'undefined' && 
                    !isRealtimeStarted) {
                    setTimeout(() => startRealtimeSubscriptions(), 1000);
                }
                
                if (!isReturningUser()) {
                    checkAndShowUpdateModal();
                    setTimeout(() => checkAndShowNewMessageNotification(), 1500);
                    setTimeout(() => checkAndShowNewJozveNotification(), 2000);
                    setTimeout(() => showStreakMessage(), 800);
                }
                
                // 🆕 بارگذاری استوری و چالش فقط یک بار
                setTimeout(() => {
                    loadQuranStories();
                    loadChallenges();
                }, 300);
            }, 300);
        } else {
            goToScreen('screen-welcome', false);
            setTimeout(() => showChoiceView(), 100);
        }
    } else {
        pushHistory('screen-splash');
        setTimeout(typeMotivation, 500);
    }

    // 🆕 سینک اولیه امتیاز
    if (isRegistered) {
        setTimeout(() => autoSyncRanking('ورود به برنامه'), 1500);
    }
    
    // 🆕 بارگذاری استوری/چالش فقط یک بار در اینجا
    if (isRegistered) {
        setTimeout(() => {
            loadQuranStories();
            loadChallenges();
        }, 500);
    }
});

// ============================================================
// مدیریت تغییر وضعیت visibility
// ============================================================
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (localStorage.getItem('userRegistered') === 'true') {
            autoSyncRanking('بازگشت به برنامه');
            
            if (typeof startRealtimeSubscriptions === 'function' && 
                typeof isRealtimeStarted !== 'undefined' && 
                !isRealtimeStarted) {
                setTimeout(() => startRealtimeSubscriptions(), 1000);
            }
            
            if (!isReturningUser()) {
                setTimeout(() => checkAndShowNewMessageNotification(), 1000);
                setTimeout(() => checkAndShowNewJozveNotification(), 1500);
            }
            
            // 🆕 بروزرسانی استوری و چالش
            setTimeout(() => {
                loadQuranStories();
                loadChallenges();
            }, 500);
        }
    }
});

// ============================================================
// مدیریت ورودی‌های کد
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const codeInputs = ['welcome-code', 'login-code'];
    codeInputs.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (id === 'welcome-code') saveUserInfo();
                else if (id === 'login-code') loginWithCode();
            }
        });
    });
});

// ============================================================
// توابع کمکی صفحه خانه
// ============================================================
async function loadHomeContests() {
    const section = document.getElementById('home-contests-section');
    const list = document.getElementById('home-contests-list');
    if (!section || !list) return;
    
    try {
        if (typeof getContestsFromSupabase !== 'function') return;
        const contests = await getContestsFromSupabase();
        
        if (!contests || contests.length === 0) { 
            section.style.display = 'none'; 
            return; 
        }
        
        const today = getPersianDate();
        const activeContests = contests.filter(c => {
            const endNum = persianDateToNumber(c.end_date);
            const todayNum = persianDateToNumber(today);
            return endNum >= todayNum;
        });
        
        if (activeContests.length === 0) { 
            section.style.display = 'none'; 
            return; 
        }
        
        list.innerHTML = activeContests.slice(0, 3).map(c => `
            <div class="home-contest-item">
                <div class="home-contest-icon">🏆</div>
                <div class="home-contest-info">
                    <div class="home-contest-title">${c.title}</div>
                    <div class="home-contest-meta">🎁 ${c.prize || 'بدون جایزه'} • تا ${c.end_date}</div>
                </div>
            </div>
        `).join('');
        
        section.style.display = 'block';
    } catch (error) { 
        section.style.display = 'none'; 
    }
}

async function loadHomeLibrary() {
    const section = document.getElementById('home-library-section');
    const list = document.getElementById('home-library-list');
    if (!section || !list) return;
    
    try {
        if (typeof getLibraryFromSupabase !== 'function') return;
        const items = await getLibraryFromSupabase();
        
        if (!items || items.length === 0) { 
            section.style.display = 'none'; 
            return; 
        }
        
        const typeIcons = { video: '🎬', pdf: '📄', audio: '🎵', site: '🌐', book: '📚' };
        
        list.innerHTML = items.slice(0, 4).map(item => `
            <a href="${item.url}" target="_blank" class="home-library-item">
                <div class="home-library-icon">${typeIcons[item.type] || '📄'}</div>
                <div class="home-library-info">
                    <div class="home-library-title">${item.title}</div>
                </div>
            </a>
        `).join('');
        
        section.style.display = 'block';
    } catch (error) { 
        section.style.display = 'none'; 
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (localStorage.getItem('userRegistered') === 'true') {
            loadHomeContests();
            loadHomeLibrary();
        }
    }, 3000);
});