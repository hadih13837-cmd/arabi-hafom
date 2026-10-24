// ============================================================
// quiz.js — سیستم سوالات، بررسی پاسخ، بازخورد، نتیجه
// نسخه: ۲۸.۰.۰ — رفع باگ selectTFCustom
// ============================================================

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
let currentShuffledOpts = [];
let hasSavedReport = false;

let flippedCards = [];
let matchedFlipPairs = 0;
let flipLocked = false;
let totalFlipPairs = 0;
let matchFlipChecking = false;

let selectedAttachOption = null;
let attachedWord = '';

let selectedLettersOrder = [];
let draggedLetter = null;
let currentLetterItems = [];

let dragGenderItems = [];
let selectedGenderWordId = null;

let fillMultipleAnswers = [];
let selectedFillMultipleWord = null;

let dragIntoBlankItems = [];
let selectedDibWord = null;

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

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
        if (btnElement) btnElement.classList.remove('playing');
        playingAudioIndex = -1;
    });
}

async function runLesson(lessonId, practiceMode, startFromIndex = 0, forcePracticeMode = false) {
    try {
        const lessonMeta = allLessons.find(l => l.id === lessonId);
        if (!lessonMeta) return;
        
        const response = await fetch('./lessons/' + lessonMeta.file);
        if (!response.ok) throw new Error('خطا در بارگذاری');
        currentLesson = await response.json();
        
        if (!currentLesson.lessonId) currentLesson.lessonId = lessonId;
        
        hasSavedReport = false;
        
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
                score = 0; correctCount = 0; wrongCount = 0;
                isPracticeMode = practiceMode || forcePracticeMode;
                startTime = new Date();
            }
        } else {
            currentQuestionIndex = 0;
            score = 0; correctCount = 0; wrongCount = 0;
            isPracticeMode = practiceMode || forcePracticeMode;
            startTime = new Date();
        }
        
        goToScreen('screen-quiz');
        renderQuestion();
    } catch (error) {
        showModal('خطا', 'مشکلی در بارگذاری تکلیف پیش آمد.', '❌');
    }
}

function renderQuestion() {
    const q = currentLesson.questions[currentQuestionIndex];
    const container = document.getElementById('question-area');
    const counter = document.getElementById('question-counter');
    const progress = document.getElementById('progress-fill');
    const submitBtn = document.getElementById('submit-btn');
    const skipBtn = document.getElementById('skip-btn');
    const scoreDisplay = document.getElementById('score-display');
    
    counter.textContent = `سوال ${toPersianNum(currentQuestionIndex + 1)} از ${toPersianNum(currentLesson.questions.length)}`;
    progress.style.width = `${((currentQuestionIndex) / currentLesson.questions.length) * 100}%`;
    scoreDisplay.textContent = toPersianNum(score);
    
    if (skipBtn) {
        skipBtn.style.display = (currentQuestionIndex === currentLesson.questions.length - 1) ? 'none' : 'flex';
    }
    
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
    currentShuffledOpts = [];
    flippedCards = [];
    matchedFlipPairs = 0;
    flipLocked = false;
    totalFlipPairs = 0;
    matchFlipChecking = false;
    selectedAttachOption = null;
    attachedWord = '';
    selectedLettersOrder = [];
    draggedLetter = null;
    currentLetterItems = [];
    dragGenderItems = [];
    selectedGenderWordId = null;
    fillMultipleAnswers = [];
    selectedFillMultipleWord = null;
    dragIntoBlankItems = [];
    selectedDibWord = null;
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'بررسی سوال';
    
    saveCurrentProgress();
    
    const qType = q.type || 'multiple';
    const iconData = QUESTION_ICONS[qType] || QUESTION_ICONS.multiple || { class: 'qti-test', svg: '' };
    let html = '';

    if (q.type === 'image-question') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        if (q.arabicSentence) html += `<div class="arabic-question-box"><div class="arabic-question-text">${q.arabicSentence}</div></div>`;
        
        if (q.image && q.image.trim() !== '') {
            html += `<div class="image-question-box"><span class="image-question-emoji">${q.image}</span></div>`;
            currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
            html += `<div class="options-grid">`;
            currentShuffledOpts.forEach((item, displayIdx) => {
                html += `<div class="option-btn" onclick="selectOption(this, ${displayIdx})">${item.opt}</div>`;
            });
            html += `</div>`;
        } else {
            currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
            html += `<div class="image-question-grid">`;
            currentShuffledOpts.forEach((item, displayIdx) => {
                html += `<div class="image-question-card" onclick="selectOption(this, ${displayIdx})">${item.opt}</div>`;
            });
            html += `</div>`;
        }
    }
    else if (q.type === 'fill') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        
        let sentenceHTML = q.sentence;
        sentenceHTML = sentenceHTML.replace(/\.{3,}/g, '<span class="blank-slot" id="blank-slot"></span>');
        sentenceHTML = sentenceHTML.replace(/_{3,}/g, '<span class="blank-slot" id="blank-slot"></span>');
        
        html += `<div class="fill-blank-container"><div class="fill-blank-sentence" id="fill-sentence">${sentenceHTML}</div></div>`;
        currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
        html += `<div class="options-grid">`;
        currentShuffledOpts.forEach((item, displayIdx) => {
            html += `<div class="option-btn" onclick="selectFillOption(this, '${item.opt}', ${displayIdx})">${item.opt}</div>`;
        });
        html += `</div>`;
    }
    else if (q.type === 'match') {
        const arItems = q.pairs.map((p, i) => ({ text: p.ar, idx: i }));
        shuffledMatchAr = shuffleArray([...arItems]);
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        html += `<div class="matching-container">
            <div class="matching-col" id="col-fa">${q.pairs.map((p, i) => `<div class="matching-item" data-idx="${i}" data-type="fa" onclick="selectMatch(this, 'fa')">${p.fa}</div>`).join('')}</div>
            <div class="matching-col" id="col-ar">${shuffledMatchAr.map((item) => `<div class="matching-item" data-idx="${item.idx}" data-type="ar" onclick="selectMatch(this, 'ar')">${item.text}</div>`).join('')}</div>
        </div>`;
    }
    else if (q.type === 'order') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
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
    else if (q.type === 'word-build') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        
        if (q.sentence) {
            html += `<div class="sentence-prompt-box">
                <div class="sentence-prompt-label">جمله فارسی:</div>
                <div class="sentence-prompt-text">${q.sentence}</div>
            </div>`;
        }
        else if (q.audioUrl) {
            html += `<div class="word-build-audio-only" onclick="playWordBuildAudio(this, '${q.audioUrl}')">
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
    }
    else if (q.type === 'word-attach') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        html += `<div class="word-attach-container"><div class="word-attach-base" id="word-attach-base"><span class="word-attach-text">${q.baseWord}</span><span class="word-attach-slot" id="word-attach-slot"></span></div>`;
        html += `<div class="word-attach-options">`;
        const shuffledOptions = shuffleArray([...q.options]);
        shuffledOptions.forEach(option => { html += `<div class="word-attach-item" onclick="selectAttachOption(this, '${option}')">${option}</div>`; });
        html += `</div></div>`;
    }
    else if (q.type === 'find-error') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        html += `<div class="find-error-container"><div class="find-error-sentence" id="find-error-sentence">`;
        q.words.forEach((word, index) => { html += `<div class="find-error-word" data-idx="${index}" onclick="selectErrorWord(this, ${index})">${word.text}</div>`; });
        html += `</div></div>`;
    }
    else if (q.type === 'drag-gender') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        
        html += `<div class="drag-guide-text">روی یک کلمه بزن، بعد روی کادر مذکر یا مؤنث بزن تا اونجا بره.</div>`;
        
        const shuffledWords = shuffleArray([...q.words]);
        dragGenderItems = shuffledWords.map((w, i) => ({ text: w.text, gender: w.gender, uniqueId: 'gword_' + i }));
        html += `<div class="gender-words-pool" id="gender-words-pool">`;
        dragGenderItems.forEach((item) => {
            html += `<div class="gender-word-item" data-unique-id="${item.uniqueId}" onclick="clickGenderWord(this, '${item.uniqueId}')">${item.text}</div>`;
        });
        html += `</div>`;
        html += `<div class="gender-boxes-container">
            <div class="gender-box male-box" data-gender="m" onclick="clickGenderBox('m')"><div class="gender-box-title">هَذَا (مذکر) ♂️</div><div class="gender-box-items" id="gender-box-m"></div></div>
            <div class="gender-box female-box" data-gender="f" onclick="clickGenderBox('f')"><div class="gender-box-title">هَذِهِ (مؤنث) ♀️</div><div class="gender-box-items" id="gender-box-f"></div></div>
        </div>`;
    }
    else if (q.type === 'fill-multiple') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        
        html += `<div class="drag-guide-text">روی یک کلمه بزن، بعد روی جای خالی بزن تا اونجا بره.</div>`;
        
        fillMultipleAnswers = new Array(q.sentences.length).fill(null);
        html += `<div class="fill-multiple-container">`;
        q.sentences.forEach((s, i) => {
            html += `<div class="fill-multiple-row"><div class="fill-multiple-sentence"><span class="fill-multiple-blank" id="fm-blank-${i}" onclick="clickFillMultipleBlank(${i})">---</span> ${s.sentence.replace('.......', '')}</div></div>`;
        });
        html += `</div>`;
        html += `<div class="fill-multiple-options" id="fill-multiple-options">`;
        const shuffledOpts = shuffleArray([...q.options]);
        shuffledOpts.forEach((opt) => { html += `<div class="fill-multiple-option" data-value="${opt}" onclick="clickFillMultipleOption(this, '${opt}')">${opt}</div>`; });
        html += `</div>`;
    }
    else if (q.type === 'drag-into-blank') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        
        html += `<div class="drag-guide-text">روی یک کلمه بزن، بعد روی جای خالی بزن تا اونجا بره.</div>`;
        
        dragIntoBlankItems = q.items.map((it, i) => ({ ...it, id: 'dib_' + i, filled: false }));
        html += `<div class="dib-options-pool" id="dib-options-pool">`;
        const shuffledOpts = shuffleArray([...q.options]);
        shuffledOpts.forEach((opt) => {
            html += `<div class="dib-option-item" data-value="${opt}" onclick="clickDibOption(this, '${opt}')">${opt}</div>`;
        });
        html += `</div>`;
        html += `<div class="dib-sentences-container">`;
        dragIntoBlankItems.forEach((item, i) => {
            html += `<div class="dib-sentence-row"><div class="dib-sentence-text"><span class="dib-blank" id="dib-blank-${i}" data-index="${i}" onclick="clickDibBlank(${i})">---</span> ${item.sentence.replace('.......', '')}</div></div>`;
        });
        html += `</div>`;
    }
    else if (q.type === 'truefalse-custom') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        html += `<div class="truefalse-custom-container">
            <button class="tf-custom-btn tf-yes" onclick="selectTFCustom(this, true)">✓ بله</button>
            <button class="tf-custom-btn tf-no" onclick="selectTFCustom(this, false)">✗ نه</button>
        </div>`;
    }
    else if (q.type === 'multiple') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
        html += `<div class="options-grid">`;
        currentShuffledOpts.forEach((item, displayIdx) => {
            html += `<div class="option-btn" onclick="selectOption(this, ${displayIdx})">${item.opt}</div>`;
        });
        html += `</div>`;
    }
    else if (q.type === 'translation') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        html += `<input type="text" id="translation-answer" placeholder="پاسخ را وارد کنید..." style="width:100%;padding:16px;border:2px solid #cfd8dc;border-radius:50px;text-align:center;font-size:17px;outline:none;margin-bottom:15px;font-family:'Vazirmatn',sans-serif;background:rgba(255,255,255,0.95);">`;
    }
    else if (q.type === 'reading-comprehension') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        if (q.arabicText) html += `<div class="reading-text-box"><div class="reading-text-content">${q.arabicText.replace(/\n/g, '<br>')}</div></div>`;
        if (q.subQuestion) html += `<div class="reading-subquestion">${q.subQuestion}</div>`;
        currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
        html += `<div class="options-grid">`;
        currentShuffledOpts.forEach((item, displayIdx) => {
            html += `<div class="option-btn" onclick="selectOption(this, ${displayIdx})">${item.opt}</div>`;
        });
        html += `</div>`;
    }
    else if (q.type === 'letter-order') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        
        html += `<div class="letter-order-result" id="letter-order-result"><span class="letter-order-placeholder">حروف رو اینجا بچین (برای برگرداندن کلیک کن)</span></div>`;
        currentLetterItems = q.letters.map((letter, i) => ({ letter: letter, uniqueId: 'letter_' + i + '_' + Math.random().toString(36).substr(2, 5), originalIdx: i }));
        const shuffledItems = shuffleArray([...currentLetterItems]);
        html += `<div class="letter-order-options" id="letter-order-options">`;
        shuffledItems.forEach((item) => {
            html += `<div class="letter-order-item" data-unique-id="${item.uniqueId}" data-letter="${item.letter}" onclick="selectLetterOrder(this, '${item.uniqueId}')">${item.letter}</div>`;
        });
        html += `</div>`;
    }
    else if (q.type === 'match-flip') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        const allCards = [];
        q.pairs.forEach((pair, idx) => {
            allCards.push({ type: 'ar', text: pair.ar, pairId: idx });
            allCards.push({ type: 'fa', text: pair.fa, pairId: idx });
        });
        const shuffledCards = shuffleArray([...allCards]);
        totalFlipPairs = q.pairs.length;
        html += `<div class="match-flip-grid">`;
        shuffledCards.forEach((card, index) => {
            html += `<div class="match-flip-card" data-card-idx="${index}" data-pair-id="${card.pairId}" data-type="${card.type}" onclick="flipCard(this, ${index})"><div class="match-flip-inner"><div class="match-flip-front">❓</div><div class="match-flip-back ${card.type}">${card.text}</div></div></div>`;
        });
        html += `</div>`;
        html += `<div class="match-flip-status" id="match-flip-status">جفت‌های پیدا شده: ۰ از ${toPersianNum(totalFlipPairs)}</div>`;
    }
    else if (q.type === 'audio-match') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        const faWords = q.faOptions.map((word, idx) => ({ word, originalIdx: idx }));
        const shuffledFaWords = shuffleArray([...faWords]);
        const audiosWithIdx = q.audios.map((audio, idx) => ({ audio, originalIdx: idx }));
        const shuffledAudios = shuffleArray([...audiosWithIdx]);
        html += `<div class="audio-match-grid">`;
        for (let i = 0; i < q.audios.length; i++) {
            const faItem = shuffledFaWords[i];
            const audioItem = shuffledAudios[i];
            html += `<div class="audio-match-cell word-cell" data-word-orig="${faItem.originalIdx}" onclick="selectFaWord(this, '${faItem.word}', ${faItem.originalIdx})">${faItem.word}</div>`;
            html += `<div class="audio-match-cell audio-cell" data-audio-idx="${audioItem.originalIdx}" onclick="selectAudio(this, ${audioItem.originalIdx})"><img src="${SOUND_VECTOR_URL}" alt="صدا" class="audio-match-wave"></div>`;
        }
        html += `</div>`;
    }
    else if (q.type === 'survey') {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        html += `<div class="survey-container"><textarea id="survey-answer" class="survey-textarea" placeholder="${q.placeholder || 'نظرت رو اینجا بنویس...'}"></textarea></div>`;
    }
    else {
        html += `<div class="question-text"><div class="question-type-icon ${iconData.class}">${iconData.svg}</div><div class="question-text-text">${q.question}</div></div>`;
        currentShuffledOpts = shuffleArray(q.options.map((opt, i) => ({ opt, originalIdx: i })));
        html += `<div class="options-grid">`;
        currentShuffledOpts.forEach((item, displayIdx) => {
            html += `<div class="option-btn" onclick="selectOption(this, ${displayIdx})">${item.opt}</div>`;
        });
        html += `</div>`;
    }
    container.innerHTML = html;
}

// 🆕 drag-gender با کلیک + قابلیت برگشت
function clickGenderWord(el, uniqueId) {
    if (isAnswered) return;
    if (el.classList.contains('placed')) {
        vibrate(15);
        const item = dragGenderItems.find(it => it.uniqueId === uniqueId);
        if (!item) return;
        el.classList.remove('placed');
        el.classList.add('selected-for-move');
        el.style.display = '';
        const placedEls = document.querySelectorAll('.gender-word-placed');
        placedEls.forEach(p => {
            if (p.textContent === item.text) p.remove();
        });
        selectedGenderWordId = uniqueId;
        return;
    }
    vibrate(15);
    document.querySelectorAll('.gender-word-item').forEach(w => w.classList.remove('selected-for-move'));
    el.classList.add('selected-for-move');
    selectedGenderWordId = uniqueId;
}

function clickGenderBox(gender) {
    if (isAnswered) return;
    if (!selectedGenderWordId) return;
    const item = dragGenderItems.find(it => it.uniqueId === selectedGenderWordId);
    if (!item) return;
    if (item.gender !== gender) {
        vibrate([50, 30, 50]);
        return;
    }
    moveGenderWordToBox(item, gender);
    selectedGenderWordId = null;
    if (document.querySelectorAll('.gender-word-item:not(.placed)').length === 0) {
        setTimeout(() => checkAnswer(), 500);
    }
}

function moveGenderWordToBox(item, gender) {
    vibrate(15);
    const wordEl = document.querySelector(`.gender-word-item[data-unique-id="${item.uniqueId}"]`);
    if (wordEl) { wordEl.classList.add('placed'); wordEl.classList.remove('selected-for-move'); wordEl.style.display = 'none'; }
    const boxItems = document.getElementById('gender-box-' + gender);
    if (boxItems) {
        const placedEl = document.createElement('div');
        placedEl.className = 'gender-word-placed';
        placedEl.textContent = item.text;
        placedEl.style.cursor = 'pointer';
        placedEl.onclick = function() {
            if (isAnswered) return;
            vibrate(15);
            this.remove();
            const wEl = document.querySelector(`.gender-word-item[data-unique-id="${item.uniqueId}"]`);
            if (wEl) { wEl.classList.remove('placed'); wEl.style.display = ''; }
        };
        boxItems.appendChild(placedEl);
    }
}

// 🆕 fill-multiple با کلیک + قابلیت برگشت
function clickFillMultipleOption(el, word) {
    if (isAnswered) return;
    if (el.classList.contains('used')) {
        vibrate(15);
        el.classList.remove('used');
        const idx = fillMultipleAnswers.indexOf(word);
        if (idx >= 0) {
            fillMultipleAnswers[idx] = null;
            const blankEl = document.getElementById('fm-blank-' + idx);
            if (blankEl) { blankEl.textContent = '---'; blankEl.classList.remove('filled'); }
        }
        return;
    }
    vibrate(15);
    document.querySelectorAll('.fill-multiple-option').forEach(o => o.classList.remove('selected-for-move'));
    el.classList.add('selected-for-move');
    selectedFillMultipleWord = word;
}

function clickFillMultipleBlank(index) {
    if (isAnswered) return;
    if (!selectedFillMultipleWord) {
        if (fillMultipleAnswers[index] !== null) {
            vibrate(15);
            const word = fillMultipleAnswers[index];
            fillMultipleAnswers[index] = null;
            const blankEl = document.getElementById('fm-blank-' + index);
            if (blankEl) { blankEl.textContent = '---'; blankEl.classList.remove('filled'); }
            document.querySelectorAll('.fill-multiple-option').forEach(o => {
                if (o.dataset.value === word) o.classList.remove('used');
            });
        }
        return;
    }
    if (fillMultipleAnswers[index] !== null) return;
    vibrate(15);
    fillMultipleAnswers[index] = selectedFillMultipleWord;
    const blankEl = document.getElementById('fm-blank-' + index);
    if (blankEl) { blankEl.textContent = selectedFillMultipleWord; blankEl.classList.add('filled'); }
    document.querySelectorAll('.fill-multiple-option').forEach(o => {
        if (o.dataset.value === selectedFillMultipleWord) { o.classList.add('used'); o.classList.remove('selected-for-move'); }
    });
    selectedFillMultipleWord = null;
    if (fillMultipleAnswers.every(a => a !== null)) {
        setTimeout(() => checkAnswer(), 500);
    }
}

// 🆕 drag-into-blank با کلیک + قابلیت برگشت
function clickDibOption(el, value) {
    if (isAnswered) return;
    if (el.classList.contains('used')) {
        vibrate(15);
        el.classList.remove('used');
        const idx = dragIntoBlankItems.findIndex(it => it.filled && it.correct === value);
        if (idx >= 0) {
            dragIntoBlankItems[idx].filled = false;
            const blankEl = document.getElementById('dib-blank-' + idx);
            if (blankEl) { blankEl.textContent = '---'; blankEl.classList.remove('filled'); delete blankEl.dataset.value; }
        }
        return;
    }
    vibrate(15);
    document.querySelectorAll('.dib-option-item').forEach(o => o.classList.remove('selected-for-move'));
    el.classList.add('selected-for-move');
    selectedDibWord = value;
}

function clickDibBlank(index) {
    if (isAnswered) return;
    if (!selectedDibWord) {
        if (dragIntoBlankItems[index].filled) {
            vibrate(15);
            const oldValue = dragIntoBlankItems[index].correct;
            dragIntoBlankItems[index].filled = false;
            const blankEl = document.getElementById('dib-blank-' + index);
            if (blankEl) { blankEl.textContent = '---'; blankEl.classList.remove('filled'); delete blankEl.dataset.value; }
            document.querySelectorAll('.dib-option-item').forEach(o => {
                if (o.dataset.value === oldValue) o.classList.remove('used');
            });
        }
        return;
    }
    if (dragIntoBlankItems[index].filled) return;
    vibrate(15);
    dragIntoBlankItems[index].filled = true;
    const blankEl = document.getElementById('dib-blank-' + index);
    if (blankEl) { blankEl.textContent = selectedDibWord; blankEl.classList.add('filled'); blankEl.dataset.value = selectedDibWord; }
    const remainingBlankCount = dragIntoBlankItems.filter(it => !it.filled && it.correct === selectedDibWord).length;
    if (remainingBlankCount === 0) {
        document.querySelectorAll('.dib-option-item').forEach(opt => {
            if (opt.dataset.value === selectedDibWord) { opt.classList.add('used'); opt.classList.remove('selected-for-move'); }
        });
    }
    selectedDibWord = null;
    if (dragIntoBlankItems.every(it => it.filled)) {
        setTimeout(() => { if (!isAnswered) checkAnswer(); }, 500);
    }
}

// بقیه توابع (بدون تغییر)
function skipQuestion() {
    if (isAnswered) return;
    
    const existing = document.getElementById('skip-question-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'skip-question-modal';
    modal.className = 'exit-modal-overlay active';
    modal.innerHTML = `
        <div class="skip-modal-box">
            <div class="skip-modal-icon-wrapper">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="5 4 15 12 5 20 5 4"/>
                    <line x1="19" y1="5" x2="19" y2="19"/>
                </svg>
            </div>
            <div class="skip-modal-title">رد کردن سوال؟</div>
            <div class="skip-modal-text">
                اگه این سوال رو رد کنی، <strong>امتیازش رو نمی‌گیری</strong> و مستقیم می‌ری سوال بعدی.
                <br><br>
                آیا مطمئنی که می‌خوای رد کنی؟
            </div>
            <div class="skip-modal-buttons">
                <button class="skip-modal-btn-cancel" onclick="closeSkipQuestionModal()">
                    ✋ نه، خودم جواب می‌دم
                </button>
                <button class="skip-modal-btn-confirm" onclick="confirmSkipQuestion()">
                    ⏭️ آره، رد کن
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeSkipQuestionModal() {
    const modal = document.getElementById('skip-question-modal');
    if (modal) modal.remove();
}

function confirmSkipQuestion() {
    closeSkipQuestionModal();
    vibrate(20);
    wrongCount++;
    currentQuestionIndex++;
    if (currentQuestionIndex < currentLesson.questions.length) {
        saveCurrentProgress();
        goToScreen('screen-quiz');
        renderQuestion();
    } else {
        showResult();
    }
}

function playWordBuildAudio(el, audioUrl) {
    if (isAnswered) return;
    if (!audioUrl) return;
    playAudioFromVideo(audioUrl, el);
}

function selectLetterOrder(el, uniqueId) {
    if (isAnswered) return;
    if (selectedLettersOrder.some(item => item.uniqueId === uniqueId)) return;
    const item = currentLetterItems.find(it => it.uniqueId === uniqueId);
    if (!item) return;
    vibrate(15);
    selectedLettersOrder.push({ uniqueId: uniqueId, letter: item.letter, originalIdx: item.originalIdx });
    el.style.display = 'none';
    const resultDiv = document.getElementById('letter-order-result');
    if (selectedLettersOrder.length === 1) resultDiv.innerHTML = '';
    const letterCard = document.createElement('div');
    letterCard.className = 'letter-order-placed';
    letterCard.textContent = item.letter;
    letterCard.dataset.uniqueId = uniqueId;
    letterCard.onclick = function() {
        if (isAnswered) return;
        const idx = selectedLettersOrder.findIndex(it => it.uniqueId === uniqueId);
        if (idx > -1) {
            selectedLettersOrder.splice(idx, 1);
            const optEl = document.querySelector(`#letter-order-options .letter-order-item[data-unique-id="${uniqueId}"]`);
            if (optEl) optEl.style.display = 'flex';
            this.remove();
            if (selectedLettersOrder.length === 0) resultDiv.innerHTML = '<span class="letter-order-placeholder">حروف رو اینجا بچین (برای برگرداندن کلیک کن)</span>';
        }
    };
    resultDiv.appendChild(letterCard);
    const q = currentLesson.questions[currentQuestionIndex];
    if (selectedLettersOrder.length === q.letters.length) {
        const userOrder = selectedLettersOrder.map(it => it.originalIdx);
        const correctOrder = q.letters.map((_, i) => i);
        if (JSON.stringify(userOrder) === JSON.stringify(correctOrder)) {
            setTimeout(() => {
                resultDiv.innerHTML = `<div class="letter-order-final-word">${q.resultWord}</div>`;
                vibrate([30, 50, 30]);
            }, 300);
        }
    }
}

function flipCard(el, cardIdx) {
    if (isAnswered || flipLocked || matchFlipChecking) return;
    if (el.classList.contains('flipped') || el.classList.contains('matched')) return;
    vibrate(15);
    el.classList.add('flipped');
    flippedCards.push({ el: el, pairId: parseInt(el.dataset.pairId), type: el.dataset.type, cardIdx: cardIdx });
    if (flippedCards.length === 2) {
        flipLocked = true;
        const card1 = flippedCards[0], card2 = flippedCards[1];
        if (card1.pairId === card2.pairId && card1.type !== card2.type) {
            setTimeout(() => {
                card1.el.classList.add('matched'); card2.el.classList.add('matched');
                matchedFlipPairs++; vibrate([30, 50, 30]);
                const statusEl = document.getElementById('match-flip-status');
                if (statusEl) statusEl.textContent = `جفت‌های پیدا شده: ${toPersianNum(matchedFlipPairs)} از ${toPersianNum(totalFlipPairs)}`;
                flippedCards = []; flipLocked = false;
                if (matchedFlipPairs === totalFlipPairs && !isAnswered && !matchFlipChecking) {
                    matchFlipChecking = true;
                    setTimeout(() => { if (!isAnswered) checkAnswer(); }, 800);
                }
            }, 400);
        } else {
            setTimeout(() => {
                card1.el.classList.remove('flipped'); card2.el.classList.remove('flipped');
                vibrate([50, 30, 50]);
                flippedCards = []; flipLocked = false;
            }, 900);
        }
    }
}

function selectAttachOption(el, option) {
    if (isAnswered) return;
    vibrate(15);
    document.querySelectorAll('.word-attach-item').forEach(item => item.classList.remove('selected'));
    el.classList.add('selected');
    selectedAttachOption = option;
    const slot = document.getElementById('word-attach-slot');
    if (slot) { slot.textContent = option; slot.classList.add('filled'); }
}

function selectAudio(el, audioIdx) {
    if (isAnswered) return;
    const q = currentLesson.questions[currentQuestionIndex];
    const audio = q.audios[audioIdx];
    if (!audio) return;
    playAudioFromVideo(audio.videoUrl, el);
    document.querySelectorAll('.audio-match-cell.audio-cell.selected').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.audio-match-cell.word-cell.selected').forEach(c => c.classList.remove('selected'));
    if (!el.classList.contains('correct-match')) el.classList.add('selected');
    selectedAudioIndex = audioIdx;
}

function selectFaWord(el, word, faOrigIdx) {
    if (isAnswered || el.classList.contains('correct-match')) return;
    if (selectedAudioIndex === -1) { vibrate([50, 30, 50]); return; }
    vibrate(15);
    const q = currentLesson.questions[currentQuestionIndex];
    const selectedAudio = q.audios[selectedAudioIndex];
    if (selectedAudio.correctFa === word) {
        el.classList.add('correct-match'); el.classList.remove('selected');
        const audioBtn = document.querySelector(`.audio-match-cell.audio-cell[data-audio-idx="${selectedAudioIndex}"]`);
        if (audioBtn) { audioBtn.classList.add('correct-match'); audioBtn.classList.remove('selected', 'playing'); }
        matchedAudioPairs.push({ audioIdx: selectedAudioIndex, faWord: word });
        vibrate([30, 50, 30]);
        selectedAudioIndex = -1;
        if (matchedAudioPairs.length === q.audios.length) setTimeout(() => checkAnswer(), 800);
    } else {
        el.classList.add('wrong');
        const audioBtn = document.querySelector(`.audio-match-cell.audio-cell[data-audio-idx="${selectedAudioIndex}"]`);
        if (audioBtn) { audioBtn.classList.add('wrong'); audioBtn.classList.remove('selected', 'playing'); }
        vibrate([50, 30, 50]);
        const wrongEl = el, wrongAudio = audioBtn;
        setTimeout(() => { wrongEl.classList.remove('wrong'); if (wrongAudio) wrongAudio.classList.remove('wrong'); }, 800);
        selectedAudioIndex = -1;
    }
}

function selectErrorWord(el, index) {
    if (isAnswered) return;
    vibrate(15);
    document.querySelectorAll('.find-error-word').forEach(w => w.classList.remove('selected'));
    el.classList.add('selected');
    selectedErrorWord = index;
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
            if (orderSelected.length === 0) resultDiv.innerHTML = 'کلمات رو اینجا بچین (برای برگرداندن کلیک کن)';
        }
    };
    resultDiv.appendChild(wordSpan);
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

function selectOption(el, displayIdx) {
    if (isAnswered) return;
    vibrate(15);
    document.querySelectorAll('.option-btn, .image-option, .image-question-card').forEach(e => e.classList.remove('selected'));
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
    if (slot) { slot.textContent = word; slot.classList.add('filled'); }
}

// ============================================================
// 🆕 truefalse-custom — انتخاب بله/نه (رفع باگ)
// ============================================================
function selectTFCustom(el, isYes) {
    if (isAnswered) return;
    vibrate(15);
    
    // حذف انتخاب قبلی از همه دکمه‌ها
    document.querySelectorAll('.tf-custom-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // مارک دکمه انتخاب‌شده
    el.classList.add('selected');
    
    // ذخیره انتخاب: 1 = بله، 0 = نه
    selectedOptionIndex = isYes ? 1 : 0;
}

function selectMatch(el, type) {
    if (isAnswered || el.classList.contains('correct') || el.classList.contains('wrong')) return;
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

function checkAnswer() {
    if (isAnswered) return;
    const q = currentLesson.questions[currentQuestionIndex];
    let isCorrect = false;
    let answerGiven = false;

    if (q.type === 'multiple' || q.type === 'fill' || q.type === 'image' || q.type === 'image-question' || q.type === 'reading-comprehension') {
        if (selectedOptionIndex !== -1) {
            answerGiven = true;
            const selectedOriginal = currentShuffledOpts[selectedOptionIndex] ? currentShuffledOpts[selectedOptionIndex].originalIdx : selectedOptionIndex;
            if (selectedOriginal === q.correct) isCorrect = true;
        }
    }
    else if (q.type === 'truefalse-custom') {
        if (selectedOptionIndex !== -1) {
            answerGiven = true;
            if ((selectedOptionIndex === 1 && q.correct) || (selectedOptionIndex === 0 && !q.correct)) isCorrect = true;
        }
    }
    else if (q.type === 'translation') {
        const ans = document.getElementById('translation-answer').value.trim();
        if (ans !== '') {
            answerGiven = true;
            if (ans === q.correct || (q.altCorrect || []).includes(ans)) isCorrect = true;
        }
    }
    else if (q.type === 'match') {
        if (matchedPairs === q.pairs.length) { isCorrect = true; answerGiven = true; }
        else { showModal('توجه', 'لطفاً همه جفت‌ها را به درستی وصل کنید.', '⚠️'); return; }
    }
    else if (q.type === 'match-flip') {
        if (matchedFlipPairs === totalFlipPairs) { isCorrect = true; answerGiven = true; }
        else { showModal('توجه', 'لطفاً همه جفت‌ها را پیدا کن.', '⚠️'); return; }
    }
    else if (q.type === 'word-attach') {
        if (selectedAttachOption !== null) {
            answerGiven = true;
            if (selectedAttachOption === q.correct) isCorrect = true;
        } else { showModal('توجه', 'لطفاً یک ضمیر انتخاب کن.', '⚠️'); return; }
    }
    else if (q.type === 'audio-match') {
        if (matchedAudioPairs.length === q.audios.length) { isCorrect = true; answerGiven = true; }
        else { showModal('توجه', 'لطفاً همه صداها را با کلمه درست تطبیق بده.', '⚠️'); return; }
    }
    else if (q.type === 'find-error') {
        if (selectedErrorWord !== null) {
            answerGiven = true;
            const errorIdx = q.words.findIndex(w => w.isError);
            if (selectedErrorWord === errorIdx) isCorrect = true;
        }
    }
    else if (q.type === 'order') {
        if (orderSelected.length > 0) {
            answerGiven = true;
            const userAnswer = JSON.stringify(orderSelected);
            let matched = (userAnswer === JSON.stringify(q.correct));
            if (!matched && q.altCorrect) {
                for (const alt of q.altCorrect) {
                    if (JSON.stringify(orderSelected) === JSON.stringify(alt)) { matched = true; break; }
                }
            }
            if (matched) {
                isCorrect = true;
            } else {
                showModal('خطا', 'ترتیب کلمات اشتباهه. دوباره تلاش کن.', '❌');
                orderSelected = [];
                renderQuestion();
                return;
            }
        }
    }
    else if (q.type === 'letter-order') {
        if (selectedLettersOrder.length > 0) {
            answerGiven = true;
            const userOrder = selectedLettersOrder.map(it => it.originalIdx);
            const correctOrder = q.letters.map((_, i) => i);
            if (JSON.stringify(userOrder) === JSON.stringify(correctOrder)) isCorrect = true;
            else {
                showModal('خطا', 'ترتیب حروف اشتباه است. دوباره تلاش کن.', '❌');
                selectedLettersOrder = []; renderQuestion(); return;
            }
        }
    }
    else if (q.type === 'drag-gender') {
        const allPlaced = document.querySelectorAll('.gender-word-placed').length === q.words.length;
        if (allPlaced) { isCorrect = true; answerGiven = true; }
        else { showModal('توجه', 'لطفاً همه کلمات را در کادر درست قرار بده.', '⚠️'); return; }
    }
    else if (q.type === 'drag-into-blank') {
        const allFilled = dragIntoBlankItems.every(it => it.filled);
        if (allFilled) {
            answerGiven = true;
            let allCorrect = true;
            dragIntoBlankItems.forEach((item, i) => {
                const blankEl = document.getElementById('dib-blank-' + i);
                const filledValue = blankEl ? blankEl.dataset.value : null;
                if (filledValue !== item.correct) allCorrect = false;
            });
            if (allCorrect) isCorrect = true;
            else { showModal('خطا', 'بعضی جواب‌ها اشتباه است. دوباره تلاش کن.', '❌'); return; }
        } else { showModal('توجه', 'لطفاً همه جای خالی‌ها را پر کن.', '⚠️'); return; }
    }
    else if (q.type === 'fill-multiple') {
        const allFilled = fillMultipleAnswers.every(a => a !== null);
        if (allFilled) {
            answerGiven = true;
            let allCorrect = true;
            q.sentences.forEach((s, i) => { if (fillMultipleAnswers[i] !== s.correct) allCorrect = false; });
            if (allCorrect) isCorrect = true;
            else { showModal('خطا', 'بعضی جواب‌ها اشتباه است. دوباره تلاش کن.', '❌'); return; }
        } else { showModal('توجه', 'لطفاً همه جای خالی‌ها را پر کن.', '⚠️'); return; }
    }
    else if (q.type === 'word-build') {
        if (orderSelected.length > 0) {
            answerGiven = true;
            const userAnswer = JSON.stringify(orderSelected);
            let matched = (userAnswer === JSON.stringify(q.correct));
            if (!matched && q.altCorrect) {
                for (const alt of q.altCorrect) {
                    if (JSON.stringify(orderSelected) === JSON.stringify(alt)) { matched = true; break; }
                }
            }
            if (matched) {
                isCorrect = true;
            } else {
                showModal('خطا', 'جمله اشتباهه. دوباره تلاش کن.', '❌');
                orderSelected = [];
                renderQuestion();
                return;
            }
        }
    }
    else if (q.type === 'survey') {
        const ans = document.getElementById('survey-answer').value.trim();
        if (ans.length >= (q.minLength || 2)) { answerGiven = true; isCorrect = true; surveyAnswerText = ans; }
        else { showModal('توجه', 'لطفاً نظرت رو بنویس.', '⚠️'); return; }
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

function getCorrectAnswerText(q) {
    if (q.type === 'multiple' || q.type === 'fill' || q.type === 'image' || q.type === 'image-question' || q.type === 'reading-comprehension') return q.options[q.correct];
    if (q.type === 'truefalse-custom') return q.correct ? 'بله ✓' : 'نه ✗';
    if (q.type === 'translation') return q.correct;
    if (q.type === 'match') return q.pairs.map(p => `${p.ar} → ${p.fa}`).join('\n');
    if (q.type === 'match-flip') return q.pairs.map(p => `${p.ar} → ${p.fa}`).join('\n');
    if (q.type === 'word-attach') return `${q.baseWord}${q.correct} = ${q.resultWord}`;
    if (q.type === 'audio-match') return q.audios.map((a, i) => `${toPersianNum(i+1)}: ${a.correctFa}`).join(' | ');
    if (q.type === 'find-error') return q.correctFix ? `${q.correctFix.wrong} → ${q.correctFix.correct}` : '-';
    if (q.type === 'word-build') return q.correct.join(' ');
    if (q.type === 'letter-order') return `${q.resultWord}`;
    if (q.type === 'drag-gender') return 'همه کلمات در کادر درست قرار گرفتند';
    if (q.type === 'drag-into-blank') return q.items.map((it, i) => `${i+1}. ${it.correct}`).join(' | ');
    if (q.type === 'fill-multiple') return q.sentences.map((s, i) => `${toPersianNum(i+1)}. ${s.correct}`).join(' | ');
    if (q.type === 'survey') return '✅ نظر شما ثبت شد. ممنون!';
    return '-';
}

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
    answerBox.innerHTML = `<div class="answer-label" id="answer-label"></div><div class="answer-text" id="answer-text"></div>`;

    if (isCorrect) {
        icon.textContent = '⭐';
        title.textContent = 'آفرین!';
        title.style.color = '#4caf50';
        sub.textContent = 'پاسخ شما درست بود.';
        if (isPracticeMode) { pts.textContent = 'حالت تمرین (بدون امتیاز)'; pts.style.color = '#999'; pts.style.fontSize = '16px'; }
        else { pts.textContent = `+${toPersianNum(points)} امتیاز`; pts.style.color = '#f57c00'; pts.style.fontSize = '24px'; }

        if (q.explanation) {
            answerBox.className = 'correct-answer-box';
            answerBox.style.display = 'block';
            answerBox.innerHTML = `<div class="feedback-explanation-box">💡 ${q.explanation.replace(/\n/g, '<br>')}</div>`;
        }
    } else {
        icon.textContent = '😞';
        title.textContent = 'متأسفانه';
        title.style.color = '#f44336';
        sub.textContent = 'پاسخ شما اشتباه است.';
        pts.textContent = '۰ امتیاز';
        pts.style.color = '#999';
        pts.style.fontSize = '24px';

        if (q.explanation) {
            answerBox.className = 'correct-answer-box wrong-answer';
            answerBox.style.display = 'block';
            answerBox.innerHTML = `<div class="feedback-explanation-box" style="border-right-color: #c62828; color: #b71c1c;">💡 ${q.explanation.replace(/\n/g, '<br>')}</div>`;
        }
    }
}

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

async function showResult() {
    endTime = new Date();
    goToScreen('screen-result');
    const percent = Math.round((correctCount / currentLesson.questions.length) * 100);
    document.getElementById('final-score-circle').textContent = `${toPersianNum(percent)}%`;
    document.getElementById('final-percent').textContent = `${toPersianNum(percent)}%`;
    document.getElementById('final-correct').textContent = toPersianNum(correctCount);
    document.getElementById('final-wrong').textContent = toPersianNum(wrongCount);
    document.getElementById('final-points').textContent = toPersianNum(score);

    const resultCircle = document.getElementById('final-score-circle');
    if (resultCircle) {
        if (percent === 100) { resultCircle.style.borderColor = '#4caf50'; resultCircle.style.color = '#2e7d32'; }
        else if (percent >= 80) { resultCircle.style.borderColor = '#8bc34a'; resultCircle.style.color = '#558b2f'; }
        else if (percent >= 50) { resultCircle.style.borderColor = '#ff9800'; resultCircle.style.color = '#e65100'; }
        else { resultCircle.style.borderColor = '#f44336'; resultCircle.style.color = '#c62828'; }
    }

    const practiceBanner = document.getElementById('practice-banner');
    const reportBtn = document.getElementById('report-btn');
    const resultTitle = document.getElementById('result-title');
    const pointsRow = document.getElementById('final-points-row');
    const lessonIndex = allLessons.findIndex(l => l.id === currentLesson.lessonId);
    const lesson = allLessons[lessonIndex];

    await ensureCustomLessonStatus();
    let dueDate = '۱۴۰۵/۰۹/۱۵';
    if (lesson) dueDate = getEffectiveDueDateSafe(lesson);
    const expired = typeof isExpired === 'function' ? isExpired(dueDate) : false;

    if (!isPracticeMode && !expired) {
        reportBtn.style.display = 'flex';
        resultTitle.textContent = 'تکلیف تمام شد!';
        pointsRow.style.display = 'flex';
        if (percent >= 80 && typeof showConfetti === 'function') showConfetti();
        practiceBanner.classList.remove('show');
        
        if (!hasSavedReport) {
            hasSavedReport = true;
            setTimeout(async () => {
                try {
                    if (typeof saveReportCardOnce === 'function') {
                        await saveReportCardOnce();
                        console.log('✅ کارنامه به صورت خودکار ذخیره شد');
                    }
                } catch (e) { console.error('خطا در ذخیره خودکار:', e); }
            }, 300);
        }
    } else {
        practiceBanner.classList.add('show');
        reportBtn.style.display = 'none';
        resultTitle.textContent = 'تمرین تمام شد!';
        pointsRow.style.display = 'none';
        if (expired) practiceBanner.innerHTML = '⚠️ مهلت این تکلیف گذشته بود، بنابراین نمره و کارنامه‌ای صادر نشد.';
    }
    clearCurrentProgress();
}