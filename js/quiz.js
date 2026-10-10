// ============================================================
// quiz.js — سیستم سوالات، بررسی پاسخ، بازخورد، نتیجه
// نسخه: ۵.۰.۰ — با تصادفی‌سازی گزینه‌ها + image-question + reading-comprehension
// ============================================================

// متغیرهای سراسری سوالات
let currentQuestionIndex = 0;
let score = 0, correctCount = 0, wrongCount = 0;
let startTime = null, endTime = null;
let selectedOptionIndex = -1;
let selectedMatchFa = null, selectedMatchAr = null;
let matchedPairs = 0;
let orderSelected = [];
let isAnswered = false;
let shuffledMatchAr = [];
let shuffledOrderOptions = [];
let selectedAudioIndex = -1;
let playingAudioIndex = -1;
let matchedAudioPairs = [];
let selectedErrorWord = null;
let surveyAnswerText = '';
let selectedFillWord = '';
let currentShuffledOpts = []; // 🆕 ذخیره گزینه‌های تصادفی‌شده فعلی

// متغیرهای match-flip
let flippedCards = [];
let matchedFlipPairs = 0;
let flipLocked = false;
let totalFlipPairs = 0;
let matchFlipChecking = false;

// متغیرهای word-attach
let selectedAttachOption = null;
let attachedWord = '';

// ============================================================
// shuffle آرایه
// ============================================================
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ============================================================
// پخش صدا از فیلم
// ============================================================
function playAudioFromVideo(videoUrl, btnElement) {
    const video = document.getElementById('audio-video-player');
    if (!video) return;
    document.querySelectorAll('.audio-match-cell.audio-cell.playing').forEach(el => el.classList.remove('playing'));
    document.querySelectorAll('.word-build-audio-only.playing').forEach(el => el.classList.remove('playing'));
    video.pause();
    video.src = videoUrl;
    video.currentTime = 0;
    video.volume = 1.0;
    video.muted = false;
    if (btnElement) {
        btnElement.classList.add('playing');
        vibrate(15);
    }
    video.play().then(() => {
        video.onended = () => {
            if (btnElement) btnElement.classList.remove('playing');
            playingAudioIndex = -1;
        };
    }).catch(e => {
        console.log('خطا در پخش صدا:', e);
        if (btnElement) btnElement.classList.remove('playing');
        playingAudioIndex = -1;
    });
}

// ============================================================
// اجرای تکلیف
// ============================================================
async function runLesson(lessonId, practiceMode, startFromIndex = 0, forcePracticeMode = false) {
    try {
        const lessonMeta = allLessons.find(l => l.id === lessonId);
        if (!lessonMeta) return;
        
        const response = await fetch('./lessons/' + lessonMeta.file);
        if (!response.ok) throw new Error('خطا در بارگذاری');
        currentLesson = await response.json();
        
        const lessonIndex = allLessons.findIndex(l => l.id === lessonId);
        const taskTitle = lessonMeta.title || LESSON_TITLES[lessonIndex] || `تکلیف ${toPersianNum(lessonIndex + 1)}`;
        
        if (startFromIndex > 0 && !forcePracticeMode) {
            const progress = getCurrentProgress();
            if (progress && progress.lessonId === lessonId) {
                currentQuestionIndex = progress.questionIndex || 0;
                score = progress.score || 0;
                correctCount = progress.correctCount || 0;
                wrongCount = progress.wrongCount || 0;
                isPracticeMode = progress.isPracticeMode || false;
                startTime = progress.startTime ? new Date(progress.startTime) : new Date();
            } else {
                currentQuestionIndex = 0;
                score = 0;
                correctCount = 0;
                wrongCount = 0;
                isPracticeMode = practiceMode || forcePracticeMode;
                startTime = new Date();
            }
        } else {
            currentQuestionIndex = 0;
            score = 0;
            correctCount = 0;
            wrongCount = 0;
            isPracticeMode = practiceMode || forcePracticeMode;
            startTime = new Date();
        }
        
        goToScreen('screen-quiz');
        renderQuestion();
    } catch (error) {
        console.error('خطا:', error);
        showModal('خطا', 'مشکلی در بارگذاری تکلیف پیش آمد.', '❌');
    }
}

// ============================================================
// رندر سوال
// ============================================================
function renderQuestion() {
    const q = currentLesson.questions[currentQuestionIndex];
    const container = document.getElementById('question-area');
    const counter = document.getElementById('question-counter');
    const progress = document.getElementById('progress-fill');
    const submitBtn = document.getElementById('submit-btn');
    const scoreDisplay = document.getElementById('score-display');
    counter.textContent = `سوال ${toPersianNum(currentQuestionIndex + 1)} از ${toPersianNum(currentLesson.questions.length)}`;
    progress.style.width = `${((currentQuestionIndex) / currentLesson.questions.length) * 100}%`;
    scoreDisplay.textContent = toPersianNum(score);
    
    // ریست متغیرها
    selectedOptionIndex = -1;
    selectedMatchFa = null;
    selectedMatchAr = null;
    matchedPairs = 0;
    orderSelected = [];
    isAnswered = false;
    selectedAudioIndex = -1;
    playingAudioIndex = -1;
    matchedAudioPairs = [];
    selectedErrorWord = null;
    surveyAnswerText = '';
    selectedFillWord = '';
    currentShuffledOpts = []; // 🆕 ریست گزینه‌های تصادفی
    
    flippedCards = [];
    matchedFlipPairs = 0;
    flipLocked = false;
    totalFlipPairs = 0;
    matchFlipChecking = false;
    selectedAttachOption = null;
    attachedWord = '';
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'بررسی سوال';
    
    saveCurrentProgress();
    
    const qType = q.type || 'multiple';
    const iconData = QUESTION_ICONS[qType] || QUESTION_ICONS.multiple || { class: 'qti-test', svg: '' };
    let html = '';

    // 🆕 سوال تصویری (image-question)
    if (q.type === 'image-question') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        
        // اگه جمله عربی داره (مثل سوال ۸)
        if (q.arabicSentence) {
            html += `<div class="arabic-question-box">
                <div class="arabic-question-text">${q.arabicSentence}</div>
            </div>`;
        }
        
        // کادر تصویر (ایموجی)
        html += `<div class="image-question-box">
            <span class="image-question-emoji">${q.image || '❓'}</span>
        </div>`;
        
        // 🆕 گزینه‌های تصادفی
        currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
        html += `<div class="options-grid">`;
        currentShuffledOpts.forEach((item, displayIdx) => {
            html += `<div class="option-btn" onclick="selectOption(this, ${displayIdx})">${item.opt}</div>`;
        });
        html += `</div>`;
    }
    // 🆕 درک مطلب (reading-comprehension)
    else if (q.type === 'reading-comprehension') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        
        // کادر متن عربی
        if (q.arabicText) {
            html += `<div class="reading-text-box">
                <div class="reading-text-content">${q.arabicText.replace(/\n/g, '<br>')}</div>
            </div>`;
        }
        
        // سوال فرعی
        if (q.subQuestion) {
            html += `<div class="reading-subquestion">${q.subQuestion}</div>`;
        }
        
        // 🆕 گزینه‌های تصادفی
        currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
        html += `<div class="options-grid">`;
        currentShuffledOpts.forEach((item, displayIdx) => {
            html += `<div class="option-btn" onclick="selectOption(this, ${displayIdx})">${item.opt}</div>`;
        });
        html += `</div>`;
    }
    // جای خالی (fill)
    else if (q.type === 'fill') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        
        // جمله با جای خالی
        html += `<div class="fill-blank-container">
            <div class="fill-blank-sentence" id="fill-sentence">
                ${q.sentence.replace('.......', '<span class="blank-slot" id="blank-slot"></span>').replace('______', '<span class="blank-slot" id="blank-slot"></span>')}
            </div>
        </div>`;
        
        // 🆕 گزینه‌های تصادفی
        currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
        html += `<div class="options-grid">`;
        currentShuffledOpts.forEach((item, displayIdx) => {
            html += `<div class="option-btn" onclick="selectFillOption(this, '${item.opt}', ${displayIdx})">${item.opt}</div>`;
        });
        html += `</div>`;
    }
    // audio-match
    else if (q.type === 'audio-match') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        const faWords = q.faOptions.map((word, idx) => ({ word, originalIdx: idx }));
        const shuffledFaWords = shuffleArray([...faWords]);
        const audiosWithIdx = q.audios.map((audio, idx) => ({ audio, originalIdx: idx }));
        const shuffledAudios = shuffleArray([...audiosWithIdx]);
        html += `<div class="audio-match-grid">`;
        for (let i = 0; i < q.audios.length; i++) {
            const faItem = shuffledFaWords[i];
            const audioItem = shuffledAudios[i];
            html += `<div class="audio-match-cell word-cell"
                data-word-orig="${faItem.originalIdx}"
                onclick="selectFaWord(this, '${faItem.word}', ${faItem.originalIdx})">${faItem.word}</div>`;
            html += `<div class="audio-match-cell audio-cell"
                data-audio-idx="${audioItem.originalIdx}"
                onclick="selectAudio(this, ${audioItem.originalIdx})">
                <img src="${SOUND_VECTOR_URL}" alt="صدا" class="audio-match-wave">
            </div>`;
        }
        html += `</div>`;
        html += `<div class="audio-hint">👆 اول روی <span class="highlight">دکمه صدا</span> بزن، بعد <span class="highlight">کلمه فارسی</span> متناظرش رو انتخاب کن</div>`;
    }
    // find-error
    else if (q.type === 'find-error') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        html += `<div class="find-error-container">`;
        html += `<div class="find-error-sentence" id="find-error-sentence">`;
        q.words.forEach((word, index) => {
            html += `<div class="find-error-word" data-idx="${index}" onclick="selectErrorWord(this, ${index})">${word.text}</div>`;
        });
        html += `</div>`;
        html += `<div class="audio-hint">👆 روی کلمه‌ای که فکر می‌کنی <span class="highlight">اشتباه</span> است، کلیک کن</div>`;
        html += `</div>`;
    }
    // word-build
    else if (q.type === 'word-build') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        
        if (q.sentence) {
            html += `<div class="sentence-prompt-box">
                <div class="sentence-prompt-label">جمله فارسی:</div>
                <div class="sentence-prompt-text">${q.sentence}</div>
            </div>`;
        }
        else if (q.audioUrl) {
            html += `<div class="word-build-audio-only" onclick="playWordBuildAudio(this)">
                <img src="${SOUND_VECTOR_URL}" alt="صدا">
            </div>`;
        }
        
        html += `<div class="word-build-result" id="word-build-result">کلمات رو اینجا بچین (برای برگرداندن کلیک کن)</div>`;
        html += `<div class="word-build-options" id="word-build-options">`;
        const shuffledWB = shuffleArray([...q.words]);
        shuffledWB.forEach((word) => {
            html += `<div class="word-build-item" onclick="selectWordBuild(this, '${word}')">${word}</div>`;
        });
        html += `</div>`;
        html += `<div class="audio-hint">👆 کلمات رو به ترتیب درست بچین تا جمله ساخته بشه</div>`;
    }
    // survey
    else if (q.type === 'survey') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        html += `<div class="survey-container">`;
        html += `<textarea id="survey-answer" class="survey-textarea" placeholder="${q.placeholder || 'نظرت رو اینجا بنویس...'}"></textarea>`;
        html += `<div class="audio-hint">💬 نظرت برامون مهمه! هرچی بنویسی قبوله ✨</div>`;
        html += `</div>`;
    }
    // match-flip
    else if (q.type === 'match-flip') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        html += `<div class="audio-hint" style="margin-bottom: 15px;">👆 روی کارت‌ها کلیک کن تا معنی‌شون رو ببینی، بعد جفت‌های درست رو پیدا کن</div>`;
        
        const allCards = [];
        q.pairs.forEach((pair, idx) => {
            allCards.push({ type: 'ar', text: pair.ar, pairId: idx });
            allCards.push({ type: 'fa', text: pair.fa, pairId: idx });
        });
        const shuffledCards = shuffleArray([...allCards]);
        totalFlipPairs = q.pairs.length;
        
        html += `<div class="match-flip-grid">`;
        shuffledCards.forEach((card, index) => {
            html += `<div class="match-flip-card" data-card-idx="${index}" data-pair-id="${card.pairId}" data-type="${card.type}" onclick="flipCard(this, ${index})">
                <div class="match-flip-inner">
                    <div class="match-flip-front">❓</div>
                    <div class="match-flip-back ${card.type}">${card.text}</div>
                </div>
            </div>`;
        });
        html += `</div>`;
        html += `<div class="match-flip-status" id="match-flip-status">جفت‌های پیدا شده: ۰ از ${toPersianNum(totalFlipPairs)}</div>`;
    }
    // word-attach
    else if (q.type === 'word-attach') {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;
        
        html += `<div class="word-attach-container">`;
        html += `<div class="word-attach-base" id="word-attach-base">
            <span class="word-attach-text">${q.baseWord}</span>
            <span class="word-attach-slot" id="word-attach-slot"></span>
        </div>`;
        
        html += `<div class="word-attach-options">`;
        const shuffledOptions = shuffleArray([...q.options]);
        shuffledOptions.forEach(option => {
            html += `<div class="word-attach-item" onclick="selectAttachOption(this, '${option}')">${option}</div>`;
        });
        html += `</div>`;
        
        html += `<div class="audio-hint">👆 روی ضمیر درست کلیک کن تا به کلمه بچسبه</div>`;
        html += `</div>`;
    }
    // بقیه سوالات (multiple, match, order, image, truefalse, translation)
    else {
        html += `<div class="question-text">
            <div class="question-type-icon ${iconData.class}">${iconData.svg}</div>
            <div class="question-text-text">${q.question}</div>
        </div>`;

        if (q.type === 'multiple') {
            // 🆕 گزینه‌های تصادفی
            currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
            html += `<div class="options-grid">`;
            currentShuffledOpts.forEach((item, displayIdx) => {
                html += `<div class="option-btn" onclick="selectOption(this, ${displayIdx})">${item.opt}</div>`;
            });
            html += `</div>`;
        } 
        else if (q.type === 'match') {
            const arItems = q.pairs.map((p, i) => ({ text: p.ar, idx: i }));
            shuffledMatchAr = shuffleArray([...arItems]);
            html += `<div class="matching-container">
                <div class="matching-col" id="col-fa">${q.pairs.map((p, i) => `<div class="matching-item" data-idx="${i}" data-type="fa" onclick="selectMatch(this, 'fa')">${p.fa}</div>`).join('')}</div>
                <div class="matching-col" id="col-ar">${shuffledMatchAr.map((item) => `<div class="matching-item" data-idx="${item.idx}" data-type="ar" onclick="selectMatch(this, 'ar')">${item.text}</div>`).join('')}</div>
            </div>`;
        } 
        else if (q.type === 'order') {
            if (q.arabicSentence) {
                html += `<div class="arabic-sentence-box">
                    <div class="arabic-sentence-label">جمله عربی:</div>
                    <div class="arabic-sentence-text">${q.arabicSentence}</div>
                </div>`;
            }
            shuffledOrderOptions = shuffleArray([...q.options]);
            html += `<div class="order-container" id="order-container">${shuffledOrderOptions.map((opt) => `<div class="order-item" onclick="selectOrder(this, '${opt}')">${opt}</div>`).join('')}</div>`;
            html += `<div class="order-result" id="order-result">کلمات را اینجا بچینید (برای برگرداندن کلیک کنید)</div>`;
        } 
        else if (q.type === 'image') {
            html += `<div class="image-options-grid">`;
            q.options.forEach((opt, index) => {
                html += `<div class="image-option" onclick="selectOption(this, ${index})">${opt}</div>`;
            });
            html += `</div>`;
        } 
        else if (q.type === 'truefalse') {
            html += `<div class="true-false-grid"><button class="tf-btn" onclick="selectTF(this, 1)">درست ✓</button><button class="tf-btn" onclick="selectTF(this, 0)">غلط ✗</button></div>`;
        } 
        else if (q.type === 'translation') {
            html += `<input type="text" id="translation-answer" placeholder="پاسخ را وارد کنید..." style="width:100%;padding:16px;border:2px solid #cfd8dc;border-radius:50px;text-align:center;font-size:17px;outline:none;margin-bottom:15px;font-family:'Vazirmatn',sans-serif;background:rgba(255,255,255,0.95);">`;
        }
    }
    container.innerHTML = html;
}

// ============================================================
// توابع match-flip
// ============================================================
function flipCard(el, cardIdx) {
    if (isAnswered) return;
    if (flipLocked) return;
    if (matchFlipChecking) return;
    if (el.classList.contains('flipped')) return;
    if (el.classList.contains('matched')) return;
    
    vibrate(15);
    el.classList.add('flipped');
    flippedCards.push({
        el: el,
        pairId: parseInt(el.dataset.pairId),
        type: el.dataset.type,
        cardIdx: cardIdx
    });
    
    if (flippedCards.length === 2) {
        flipLocked = true;
        const card1 = flippedCards[0];
        const card2 = flippedCards[1];
        
        if (card1.pairId === card2.pairId && card1.type !== card2.type) {
            setTimeout(() => {
                card1.el.classList.add('matched');
                card2.el.classList.add('matched');
                matchedFlipPairs++;
                vibrate([30, 50, 30]);
                
                const statusEl = document.getElementById('match-flip-status');
                if (statusEl) {
                    statusEl.textContent = `جفت‌های پیدا شده: ${toPersianNum(matchedFlipPairs)} از ${toPersianNum(totalFlipPairs)}`;
                }
                
                flippedCards = [];
                flipLocked = false;
                
                if (matchedFlipPairs === totalFlipPairs && !isAnswered && !matchFlipChecking) {
                    matchFlipChecking = true;
                    setTimeout(() => {
                        if (!isAnswered) {
                            checkAnswer();
                        }
                    }, 800);
                }
            }, 400);
        } else {
            setTimeout(() => {
                card1.el.classList.remove('flipped');
                card2.el.classList.remove('flipped');
                vibrate([50, 30, 50]);
                flippedCards = [];
                flipLocked = false;
            }, 900);
        }
    }
}

// ============================================================
// توابع word-attach
// ============================================================
function selectAttachOption(el, option) {
    if (isAnswered) return;
    vibrate(15);
    
    document.querySelectorAll('.word-attach-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    el.classList.add('selected');
    selectedAttachOption = option;
    
    const slot = document.getElementById('word-attach-slot');
    if (slot) {
        slot.textContent = option;
        slot.classList.add('filled');
    }
}

// ============================================================
// انتخاب‌های سوال audio-match
// ============================================================
function selectAudio(el, audioIdx) {
    if (isAnswered) return;
    const q = currentLesson.questions[currentQuestionIndex];
    const audio = q.audios[audioIdx];
    if (!audio) return;
    playAudioFromVideo(audio.videoUrl, el);
    document.querySelectorAll('.audio-match-cell.audio-cell.selected').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.audio-match-cell.word-cell.selected').forEach(c => c.classList.remove('selected'));
    if (!el.classList.contains('correct-match')) {
        el.classList.add('selected');
    }
    selectedAudioIndex = audioIdx;
}

function selectFaWord(el, word, faOrigIdx) {
    if (isAnswered) return;
    if (el.classList.contains('correct-match')) return;
    if (selectedAudioIndex === -1) {
        vibrate([50, 30, 50]);
        el.style.animation = 'none';
        setTimeout(() => { el.style.animation = 'shakeWrong 0.35s ease'; }, 10);
        return;
    }
    vibrate(15);
    const q = currentLesson.questions[currentQuestionIndex];
    const selectedAudio = q.audios[selectedAudioIndex];

    if (selectedAudio.correctFa === word) {
        el.classList.add('correct-match');
        el.classList.remove('selected');
        const audioBtn = document.querySelector(`.audio-match-cell.audio-cell[data-audio-idx="${selectedAudioIndex}"]`);
        if (audioBtn) {
            audioBtn.classList.add('correct-match');
            audioBtn.classList.remove('selected', 'playing');
        }
        matchedAudioPairs.push({ audioIdx: selectedAudioIndex, faWord: word });
        vibrate([30, 50, 30]);
        selectedAudioIndex = -1;
        if (matchedAudioPairs.length === q.audios.length) {
            setTimeout(() => { checkAnswer(); }, 800);
        }
    } else {
        el.classList.add('wrong');
        const audioBtn = document.querySelector(`.audio-match-cell.audio-cell[data-audio-idx="${selectedAudioIndex}"]`);
        if (audioBtn) {
            audioBtn.classList.add('wrong');
            audioBtn.classList.remove('selected', 'playing');
        }
        vibrate([50, 30, 50]);
        const wrongEl = el;
        const wrongAudio = audioBtn;
        setTimeout(() => {
            wrongEl.classList.remove('wrong');
            if (wrongAudio) wrongAudio.classList.remove('wrong');
        }, 800);
        selectedAudioIndex = -1;
    }
}

// ============================================================
// انتخاب‌های find-error
// ============================================================
function selectErrorWord(el, index) {
    if (isAnswered) return;
    vibrate(15);
    document.querySelectorAll('.find-error-word').forEach(w => w.classList.remove('selected'));
    el.classList.add('selected');
    selectedErrorWord = index;
}

// ============================================================
// انتخاب‌های word-build
// ============================================================
function playWordBuildAudio(el) {
    if (isAnswered) return;
    const q = currentLesson.questions[currentQuestionIndex];
    if (!q.audioUrl) return;
    playAudioFromVideo(q.audioUrl, el);
}

function selectWordBuild(el, word) {
    if (isAnswered) return;
    if (orderSelected.includes(word)) return;
    vibrate(15);
    orderSelected.push(word);
    el.style.display = 'none';
    const resultDiv = document.getElementById('word-build-result');
    if (orderSelected.length === 1) resultDiv.innerHTML = '';
    const wordSpan = document.createElement('span');
    wordSpan.textContent = word;
    wordSpan.style.cursor = 'pointer';
    wordSpan.onclick = function() {
        if (isAnswered) return;
        const idx = orderSelected.indexOf(word);
        if (idx > -1) {
            orderSelected.splice(idx, 1);
            document.querySelectorAll('#word-build-options .word-build-item').forEach(item => {
                if (item.textContent === word) item.style.display = 'block';
            });
            this.remove();
            if (orderSelected.length === 0) {
                resultDiv.innerHTML = 'کلمات رو اینجا بچین (برای برگرداندن کلیک کن)';
            }
        }
    };
    resultDiv.appendChild(wordSpan);
}

// ============================================================
// توابع انتخاب سوالات عادی
// ============================================================
function selectOption(el, displayIdx) {
    if (isAnswered) return;
    vibrate(15);
    document.querySelectorAll('.option-btn, .image-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedOptionIndex = displayIdx;
}

function selectFillOption(el, word, displayIdx) {
    if (isAnswered) return;
    vibrate(15);
    document.querySelectorAll('.option-btn').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedOptionIndex = displayIdx;
    selectedFillWord = word;
    
    const slot = document.getElementById('blank-slot');
    if (slot) {
        slot.textContent = word;
        slot.classList.add('filled');
    }
}

function selectTF(el, value) {
    if (isAnswered) return;
    vibrate(15);
    document.querySelectorAll('.tf-btn').forEach(e => e.classList.remove('selected-true', 'selected-false'));
    el.classList.add(value === 1 ? 'selected-true' : 'selected-false');
    selectedOptionIndex = value;
}

function selectMatch(el, type) {
    if (isAnswered) return;
    if (el.classList.contains('correct') || el.classList.contains('wrong')) return;
    vibrate(15);
    if (type === 'fa') {
        if (selectedMatchFa === el) { el.classList.remove('selected'); selectedMatchFa = null; return; }
        if (selectedMatchFa) selectedMatchFa.classList.remove('selected');
        selectedMatchFa = el;
    } else {
        if (selectedMatchAr === el) { el.classList.remove('selected'); selectedMatchAr = null; return; }
        if (selectedMatchAr) selectedMatchAr.classList.remove('selected');
        selectedMatchAr = el;
    }
    el.classList.add('selected');
    if (selectedMatchFa && selectedMatchAr) {
        const faIdx = selectedMatchFa.dataset.idx;
        const arIdx = selectedMatchAr.dataset.idx;
        if (faIdx === arIdx) {
            const faEl = selectedMatchFa, arEl = selectedMatchAr;
            faEl.classList.remove('selected'); arEl.classList.remove('selected');
            faEl.classList.add('correct', 'matched'); arEl.classList.add('correct', 'matched');
            selectedMatchFa = null; selectedMatchAr = null;
            matchedPairs++;
            vibrate(30);
        } else {
            const faEl = selectedMatchFa, arEl = selectedMatchAr;
            faEl.classList.add('wrong'); arEl.classList.add('wrong');
            vibrate([50, 30, 50]);
            selectedMatchFa = null; selectedMatchAr = null;
            setTimeout(() => { faEl.classList.remove('wrong', 'selected'); arEl.classList.remove('wrong', 'selected'); }, 800);
        }
    }
}

function selectOrder(el, word) {
    if (isAnswered) return;
    if (orderSelected.includes(word)) return;
    vibrate(15);
    orderSelected.push(word);
    el.style.display = 'none';
    const resultDiv = document.getElementById('order-result');
    if (orderSelected.length === 1) resultDiv.innerHTML = '';
    const wordSpan = document.createElement('span');
    wordSpan.textContent = word;
    wordSpan.style.cursor = 'pointer';
    wordSpan.onclick = function() {
        if (isAnswered) return;
        const idx = orderSelected.indexOf(word);
        if (idx > -1) {
            orderSelected.splice(idx, 1);
            document.querySelectorAll('#order-container .order-item').forEach(item => {
                if (item.textContent === word) item.style.display = 'block';
            });
            this.remove();
            if (orderSelected.length === 0) resultDiv.innerHTML = 'کلمات را اینجا بچینید (برای برگرداندن کلیک کنید)';
        }
    };
    resultDiv.appendChild(wordSpan);
}

// ============================================================
// بررسی پاسخ (با پشتیبانی از گزینه‌های تصادفی)
// ============================================================
function checkAnswer() {
    if (isAnswered) return;
    const q = currentLesson.questions[currentQuestionIndex];
    let isCorrect = false;
    let answerGiven = false;

    if (q.type === 'multiple' || q.type === 'fill' || q.type === 'image' || q.type === 'image-question' || q.type === 'reading-comprehension') {
        if (selectedOptionIndex !== -1) {
            answerGiven = true;
            // 🆕 تبدیل اندیس نمایش به اندیس اصلی
            const selectedOriginal = currentShuffledOpts[selectedOptionIndex] 
                ? currentShuffledOpts[selectedOptionIndex].originalIdx 
                : selectedOptionIndex;
            if (selectedOriginal === q.correct) isCorrect = true;
        }
    } 
    else if (q.type === 'truefalse') {
        if (selectedOptionIndex !== -1) {
            answerGiven = true;
            if ((selectedOptionIndex === 1 && q.correct) || (selectedOptionIndex === 0 && !q.correct)) isCorrect = true;
        }
    } 
    else if (q.type === 'translation') {
        const ans = document.getElementById('translation-answer').value.trim();
        if (ans !== '') {
            answerGiven = true;
            const correct = q.correct;
            const altCorrect = q.altCorrect || [];
            if (ans === correct || altCorrect.includes(ans)) isCorrect = true;
        }
    } 
    else if (q.type === 'match') {
        if (matchedPairs === q.pairs.length) {
            isCorrect = true;
            answerGiven = true;
        } else {
            showModal('توجه', 'لطفاً همه جفت‌ها را به درستی وصل کنید.', '⚠️');
            return;
        }
    } 
    else if (q.type === 'match-flip') {
        if (matchedFlipPairs === totalFlipPairs) {
            isCorrect = true;
            answerGiven = true;
        } else {
            showModal('توجه', 'لطفاً همه جفت‌ها را پیدا کن.', '⚠️');
            return;
        }
    } 
    else if (q.type === 'word-attach') {
        if (selectedAttachOption !== null) {
            answerGiven = true;
            if (selectedAttachOption === q.correct) isCorrect = true;
        } else {
            showModal('توجه', 'لطفاً یک ضمیر انتخاب کن.', '⚠️');
            return;
        }
    } 
    else if (q.type === 'order') {
        if (orderSelected.length > 0) {
            answerGiven = true;
            const userAnswer = JSON.stringify(orderSelected);
            let matched = (userAnswer === JSON.stringify(q.correct));
            if (!matched && q.altCorrect && Array.isArray(q.altCorrect)) {
                for (const alt of q.altCorrect) {
                    if (JSON.stringify(orderSelected) === JSON.stringify(alt)) {
                        matched = true;
                        break;
                    }
                }
            }
            if (matched) isCorrect = true;
            else {
                showModal('خطا', 'ترتیب کلمات اشتباه است.', '❌');
                orderSelected = [];
                renderQuestion();
                return;
            }
        }
    } 
    else if (q.type === 'audio-match') {
        if (matchedAudioPairs.length === q.audios.length) {
            isCorrect = true;
            answerGiven = true;
        } else {
            showModal('توجه', 'لطفاً همه صداها را با کلمه درست تطبیق بده.', '⚠️');
            return;
        }
    } 
    else if (q.type === 'find-error') {
        if (selectedErrorWord !== null) {
            answerGiven = true;
            const errorIdx = q.words.findIndex(w => w.isError);
            if (selectedErrorWord === errorIdx) isCorrect = true;
        }
    } 
    else if (q.type === 'word-build') {
        if (orderSelected.length > 0) {
            answerGiven = true;
            const userAnswer = JSON.stringify(orderSelected);
            let matched = (userAnswer === JSON.stringify(q.correct));
            if (!matched && q.altCorrect && Array.isArray(q.altCorrect)) {
                for (const alt of q.altCorrect) {
                    if (JSON.stringify(orderSelected) === JSON.stringify(alt)) {
                        matched = true;
                        break;
                    }
                }
            }
            if (matched) isCorrect = true;
            else {
                showModal('خطا', 'جمله اشتباهه. دوباره تلاش کن.', '❌');
                orderSelected = [];
                renderQuestion();
                return;
            }
        }
    } 
    else if (q.type === 'survey') {
        const ans = document.getElementById('survey-answer').value.trim();
        if (ans.length >= (q.minLength || 2)) {
            answerGiven = true;
            isCorrect = true;
            surveyAnswerText = ans;
        } else {
            showModal('توجه', 'لطفاً نظرت رو بنویس.', '⚠️');
            return;
        }
    }

    if (!answerGiven) {
        showModal('توجه', 'لطفاً یک پاسخ انتخاب کنید.', '⚠️');
        return;
    }

    isAnswered = true;
    document.getElementById('submit-btn').disabled = true;

    if (isCorrect) {
        if (!isPracticeMode) score += q.points;
        correctCount++;
        playCorrectSound();
        vibrate(30);
        showFeedback(true, isPracticeMode ? 0 : q.points, q);
    } else {
        wrongCount++;
        playWrongSound();
        vibrate([50, 30, 50]);
        showFeedback(false, 0, q);
    }
    
    saveCurrentProgress();
}

// ============================================================
// گرفتن متن پاسخ صحیح
// ============================================================
function getCorrectAnswerText(q) {
    if (q.type === 'multiple' || q.type === 'fill' || q.type === 'image' || q.type === 'image-question' || q.type === 'reading-comprehension') return q.options[q.correct];
    if (q.type === 'truefalse') return q.correct ? 'درست ✓' : 'غلط ✗';
    if (q.type === 'translation') return q.correct;
    if (q.type === 'match') return q.pairs.map(p => `${p.ar} → ${p.fa}`).join('\n');
    if (q.type === 'match-flip') return q.pairs.map(p => `${p.ar} → ${p.fa}`).join('\n');
    if (q.type === 'word-attach') return `${q.baseWord}${q.correct} = ${q.resultWord}`;
    if (q.type === 'order') return q.correct.join(' ');
    if (q.type === 'audio-match') {
        return q.audios.map((a, i) => `${toPersianNum(i+1)}: ${a.correctFa}`).join(' | ');
    }
    if (q.type === 'find-error') {
        return q.correctFix ? `${q.correctFix.wrong} → ${q.correctFix.correct}` : '-';
    }
    if (q.type === 'word-build') {
        return q.correct.join(' ');
    }
    if (q.type === 'survey') {
        return '✅ نظر شما ثبت شد. ممنون!';
    }
    return '-';
}

// ============================================================
// نمایش بازخورد
// ============================================================
function showFeedback(isCorrect, points, q) {
    goToScreen('screen-feedback');
    const icon = document.getElementById('fb-icon');
    const title = document.getElementById('fb-title');
    const sub = document.getElementById('fb-sub');
    const pts = document.getElementById('fb-points');
    const answerBox = document.getElementById('correct-answer-box');
    const answerLabel = document.getElementById('answer-label');
    const answerText = document.getElementById('answer-text');
    const findErrorBox = document.getElementById('find-error-feedback-box');

    findErrorBox.style.display = 'none';
    findErrorBox.innerHTML = '';

    answerBox.className = 'correct-answer-box';
    answerBox.style.display = 'none';
    answerBox.innerHTML = `
        <div class="answer-label" id="answer-label"></div>
        <div class="answer-text" id="answer-text"></div>
    `;

    if (isCorrect) {
        icon.textContent = '⭐';
        title.textContent = 'آفرین!';
        title.style.color = '#4caf50';
        sub.textContent = 'پاسخ شما درست بود.';
        if (isPracticeMode) {
            pts.textContent = 'حالت تمرین (بدون امتیاز)';
            pts.style.color = '#999';
            pts.style.fontSize = '16px';
        } else {
            pts.textContent = `+${toPersianNum(points)} امتیاز`;
            pts.style.color = '#f57c00';
            pts.style.fontSize = '24px';
        }
        
        if (q.type === 'match-flip') {
            answerBox.className = 'correct-answer-box';
            answerBox.style.display = 'block';
            answerBox.innerHTML = `
                <div class="answer-label">✅ همه جفت‌ها به درستی پیدا شدند:</div>
                <div class="answer-text" style="font-size: 15px; line-height: 2; text-align: right;">
                    ${q.pairs.map(p => `• <strong>${p.ar}</strong> = ${p.fa}`).join('<br>')}
                </div>
            `;
        } 
        else if (q.type === 'word-attach') {
            answerBox.className = 'correct-answer-box';
            answerBox.style.display = 'block';
            answerBox.innerHTML = `
                <div class="answer-label">✅ پاسخ درست:</div>
                <div class="answer-text" style="font-size: 28px; direction: rtl;">
                    ${q.baseWord}${q.correct} = <strong>${q.resultWord}</strong>
                </div>
                <div style="font-size: 14px; color: #2e7d32; margin-top: 8px; font-weight: bold;">
                    معنی: ${q.resultMeaning}
                </div>
                ${q.explanation ? `
                    <div class="feedback-explanation-box">
                        💡 ${q.explanation.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}
            `;
        } 
        else if (q.type === 'match') {
            answerBox.className = 'correct-answer-box';
            answerBox.style.display = 'block';
            answerBox.innerHTML = `
                <div class="answer-label">✅ همه جفت‌ها به درستی وصل شدند:</div>
                <div class="answer-text" style="font-size: 15px; line-height: 2; text-align: right;">
                    ${q.pairs.map(p => `• <strong>${p.ar}</strong> = ${p.fa}`).join('<br>')}
                </div>
                ${q.explanation ? `
                    <div class="feedback-explanation-box">
                        💡 ${q.explanation.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}
            `;
        } 
        else {
            answerBox.className = 'correct-answer-box';
            answerLabel.textContent = 'پاسخ صحیح شما:';
            answerText.textContent = getCorrectAnswerText(q);
            answerBox.style.display = 'block';
            
            if (q.explanation) {
                answerBox.insertAdjacentHTML('beforeend', `
                    <div class="feedback-explanation-box">
                        💡 ${q.explanation.replace(/\n/g, '<br>')}
                        ${q.correctSentence ? `<span class="correct-sentence">✅ پاسخ درست: ${q.correctSentence}</span>` : ''}
                    </div>
                `);
            }
        }
    } else {
        icon.textContent = '😞';
        title.textContent = 'متأسفانه';
        title.style.color = '#f44336';
        sub.textContent = 'پاسخ شما اشتباه است.';
        pts.textContent = '۰ امتیاز';
        pts.style.color = '#999';
        pts.style.fontSize = '24px';

        if (q.type === 'match-flip') {
            answerBox.className = 'correct-answer-box wrong-answer';
            answerBox.style.display = 'block';
            answerBox.innerHTML = `
                <div class="answer-label" style="color: #c62828;">❌ پاسخ صحیح:</div>
                <div class="answer-text" style="font-size: 15px; line-height: 2; text-align: right; color: #b71c1c;">
                    ${q.pairs.map(p => `• <strong>${p.ar}</strong> = ${p.fa}`).join('<br>')}
                </div>
            `;
        } 
        else if (q.type === 'word-attach') {
            answerBox.className = 'correct-answer-box wrong-answer';
            answerBox.style.display = 'block';
            answerBox.innerHTML = `
                <div class="answer-label" style="color: #c62828;">❌ پاسخ صحیح:</div>
                <div class="answer-text" style="font-size: 26px; direction: rtl; color: #b71c1c;">
                    ${q.baseWord}${q.correct} = <strong>${q.resultWord}</strong>
                </div>
                <div style="font-size: 14px; color: #c62828; margin-top: 8px; font-weight: bold;">
                    معنی: ${q.resultMeaning}
                </div>
                ${q.explanation ? `
                    <div class="feedback-explanation-box" style="border-right-color: #c62828; color: #b71c1c;">
                        💡 ${q.explanation.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}
            `;
        } 
        else if (q.type === 'match') {
            answerBox.className = 'correct-answer-box wrong-answer';
            answerBox.style.display = 'block';
            answerBox.innerHTML = `
                <div class="answer-label" style="color: #c62828;">❌ پاسخ صحیح:</div>
                <div class="answer-text" style="font-size: 15px; line-height: 2; text-align: right; color: #b71c1c;">
                    ${q.pairs.map(p => `• <strong>${p.ar}</strong> = ${p.fa}`).join('<br>')}
                </div>
                ${q.explanation ? `
                    <div class="feedback-explanation-box" style="border-right-color: #c62828; color: #b71c1c;">
                        💡 ${q.explanation.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}
            `;
        } 
        else if (q.type === 'find-error' && q.correctFix) {
            answerBox.style.display = 'none';
            findErrorBox.style.display = 'block';
            const correctedHTML = q.correctedSentence.replace(
                q.correctFix.correct,
                `<span class="fixed-word">${q.correctFix.correct}</span>`
            );
            findErrorBox.innerHTML = `
                <div class="find-error-correction" style="background: linear-gradient(135deg, #ffebee, #ffcdd2); border-color: #ef5350;">
                    <div class="find-error-correction-title" style="color: #c62828;">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c62828" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        پاسخ صحیح: «${q.correctFix.wrong}» اشتباه بود
                    </div>
                    <div class="find-error-correction-sentence" style="color: #b71c1c;">${correctedHTML}</div>
                    ${q.explanation ? `<div class="find-error-explanation" style="color: #b71c1c;">💡 ${q.explanation.replace(/\n/g, '<br>')}</div>` : ''}
                </div>
            `;
        } 
        else {
            answerBox.className = 'correct-answer-box wrong-answer';
            answerLabel.textContent = 'پاسخ صحیح:';
            answerText.textContent = getCorrectAnswerText(q);
            answerBox.style.display = 'block';
            
            if (q.explanation) {
                answerBox.insertAdjacentHTML('beforeend', `
                    <div class="feedback-explanation-box" style="border-right-color: #c62828; color: #b71c1c;">
                        💡 ${q.explanation.replace(/\n/g, '<br>')}
                        ${q.correctSentence ? `<span class="correct-sentence" style="color: #2e7d32;">✅ پاسخ درست: ${q.correctSentence}</span>` : ''}
                    </div>
                `);
            }
        }
    }
}

// ============================================================
// سوال بعدی
// ============================================================
function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentLesson.questions.length) {
        saveCurrentProgress();
        goToScreen('screen-quiz');
        renderQuestion();
    } else {
        showResult();
    }
}

// ============================================================
// نمایش نتیجه نهایی
// ============================================================
function showResult() {
    endTime = new Date();
    goToScreen('screen-result');
    const percent = Math.round((correctCount / currentLesson.questions.length) * 100);
    document.getElementById('final-score-circle').textContent = `${toPersianNum(percent)}%`;
    document.getElementById('final-percent').textContent = `${toPersianNum(percent)}%`;
    document.getElementById('final-correct').textContent = toPersianNum(correctCount);
    document.getElementById('final-wrong').textContent = toPersianNum(wrongCount);
    document.getElementById('final-points').textContent = toPersianNum(score);
    const practiceBanner = document.getElementById('practice-banner');
    const reportBtn = document.getElementById('report-btn');
    const resultTitle = document.getElementById('result-title');
    const pointsRow = document.getElementById('final-points-row');
    const lessonIndex = allLessons.findIndex(l => l.id === currentLesson.lessonId);
    const lesson = allLessons[lessonIndex];
    const dueDate = lesson ? (lesson.dueDate || '۱۴۰۵/۰۹/۱۵') : null;
    const expired = isExpired(dueDate);
    if (isPracticeMode || expired) {
        practiceBanner.classList.add('show');
        reportBtn.style.display = 'none';
        resultTitle.textContent = 'تمرین تمام شد!';
        pointsRow.style.display = 'none';
        if (expired) practiceBanner.innerHTML = '⚠️ مهلت این تکلیف گذشته بود، بنابراین نمره و کارنامه‌ای صادر نشد.';
    } else {
        practiceBanner.classList.remove('show');
        reportBtn.style.display = 'flex';
        resultTitle.textContent = 'تکلیف تمام شد!';
        pointsRow.style.display = 'flex';
        if (percent >= 80) showConfetti();
    }
    
    clearCurrentProgress();
}