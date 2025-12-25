import { tasks } from './data.js';

// State
let currentTab = '1'; // '1', '2', '3', '4', '5', or 'exam'
let searchQuery = '';
let examQuestions = []; // Stores the random questions for exam mode
let examAnswers = {}; // Stores user answers for exam mode { questionId: 'a' }
let examSubmitted = false; // Tracks if exam has been evaluated

// DOM Elements
const navTabs = document.getElementById('nav-tabs');
const questionsContainer = document.getElementById('questions-container');
const searchInput = document.getElementById('search-input');
const mobileSearchInput = document.getElementById('mobile-search-input');
const mobileSearchBar = document.getElementById('mobile-search-bar');
const searchContainer = document.querySelector('.relative.hidden.sm\\:block.w-64'); // Desktop search container
const mobileSearchToggle = document.getElementById('mobile-search-toggle');
const emptyState = document.getElementById('empty-state');
const examHeader = document.getElementById('exam-header');
const regenerateExamBtn = document.getElementById('regenerate-exam');

// Initialize
function init() {
    renderNavigation();
    renderContent();
    setupEventListeners();
}

// Navigation
function renderNavigation() {
    navTabs.innerHTML = '';

    const tabs = [
        { id: '1', label: 'Tarea 1' },
        { id: '2', label: 'Tarea 2' },
        { id: '3', label: 'Tarea 3' },
        { id: '4', label: 'Tarea 4' },
        { id: '5', label: 'Tarea 5' },
        { id: 'exam', label: 'Modo Examen', icon: true }
    ];

    tabs.forEach(tab => {
        const button = document.createElement('button');
        const isActive = currentTab === tab.id;

        let classes = 'whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm transition-colors duration-200 outline-none ';
        if (isActive) {
            classes += 'border-red-600 text-red-600';
        } else {
            classes += 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300';
        }

        button.className = classes;

        if (tab.icon) {
            button.innerHTML = `
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                    </svg>
                    ${tab.label}
                </span>
            `;
        } else {
            button.textContent = tab.label;
        }

        button.onclick = () => {
            currentTab = tab.id;
            if (currentTab === 'exam') {
                if (examQuestions.length === 0) {
                    generateExam();
                }
                // Reset exam state if entering exam mode fresh? 
                // For now, we keep state unless "Nuevo Test" is clicked.
            }
            renderNavigation();
            renderContent();
            window.scrollTo(0, 0);
        };

        navTabs.appendChild(button);
    });
}

// Content Rendering
function renderContent() {
    questionsContainer.innerHTML = '';
    let questionsToShow = [];

    // Header visibility & Search Bar Toggling
    if (currentTab === 'exam') {
        examHeader.classList.remove('hidden');
        questionsToShow = examQuestions;
        // Hide Search
        if (searchContainer) searchContainer.classList.add('invisible');
        if (mobileSearchToggle) mobileSearchToggle.classList.add('hidden');
    } else {
        examHeader.classList.add('hidden');
        // Show Search
        if (searchContainer) searchContainer.classList.remove('invisible');
        if (mobileSearchToggle) mobileSearchToggle.classList.remove('hidden');

        if (tasks[currentTab]) {
            questionsToShow = tasks[currentTab].questions;

            // Add Task Title Header
            const titleHeader = document.createElement('div');
            titleHeader.className = 'mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4';
            titleHeader.innerHTML = `
                <h2 class="text-lg font-semibold text-yellow-900">${tasks[currentTab].title}</h2>
            `;
            questionsContainer.appendChild(titleHeader);
        }
    }

    // Exam Progress & Evaluate Button
    if (currentTab === 'exam') {
        // Progress
        const answeredCount = Object.keys(examAnswers).length;
        const totalCount = examQuestions.length;

        const progressHeader = document.createElement('div');
        // Adjusted top position to top-16 (header height) + padding to ensure full visibility
        progressHeader.className = 'mb-6 bg-white border-2 border-red-100 rounded-xl p-4 sticky top-20 z-40 shadow-md';

        const percentage = Math.round((answeredCount / totalCount) * 100);

        progressHeader.innerHTML = `
            <div class="w-full flex flex-col gap-2">
                <div class="flex justify-between items-center">
                    <div>
                        <span class="text-sm font-bold text-red-600 uppercase tracking-wider">Progreso del Examen</span>
                        <div class="text-2xl font-bold text-slate-900">${answeredCount} <span class="text-slate-400 text-lg">/ ${totalCount}</span></div>
                    </div>
                    ${!examSubmitted ? `
                        <button id="evaluate-btn" class="px-6 py-2 bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 text-white font-bold rounded-lg transition-all shadow-sm transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                            Evaluar
                        </button>
                    ` : ''}
                </div>
                <!-- Progress Bar -->
                <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div class="bg-gradient-to-r from-red-500 to-yellow-400 h-2.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
        questionsContainer.appendChild(progressHeader);

        // Result Display (if submitted)
        if (examSubmitted) {
            const score = calculateScore();
            const passed = score >= 15;

            const resultCard = document.createElement('div');
            resultCard.className = `mb-8 p-6 rounded-xl border-2 ${passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} text-center`;
            resultCard.innerHTML = `
                <h3 class="text-2xl font-bold mb-2 ${passed ? 'text-green-800' : 'text-red-800'}">
                    ${passed ? '¡APROBADO!' : 'NO APTO'}
                </h3>
                <p class="text-lg mb-4 ${passed ? 'text-green-700' : 'text-red-700'}">
                    Has acertado <strong>${score}</strong> de ${totalCount} preguntas.
                </p>
                <p class="text-sm text-slate-600">Se necesitan 15 aciertos para aprobar.</p>
            `;
            // Insert after progress header
            questionsContainer.appendChild(resultCard);
        }
    }

    // Filter by search
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        questionsToShow = questionsToShow.filter(q =>
            q.q.toLowerCase().includes(query) ||
            q.id.toString().includes(query)
        );
    }

    // Empty state
    if (questionsToShow.length === 0) {
        questionsContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    questionsContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Render questions
    questionsToShow.forEach(q => {
        questionsContainer.appendChild(createQuestionCard(q));
    });

    // Attach Evaluate Listener
    if (currentTab === 'exam' && !examSubmitted) {
        const evaluateBtn = document.getElementById('evaluate-btn');
        if (evaluateBtn) {
            evaluateBtn.onclick = evaluateExam;
        }
    }
}

function createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md';
    card.id = `q-${question.id}`;

    // Header
    const header = document.createElement('div');
    header.className = 'bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center';
    header.innerHTML = `
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pregunta ${question.id}</span>
        ${currentTab !== 'exam' ? '<span class="status-badge px-2 py-1 rounded text-xs font-medium bg-slate-200 text-slate-600 hidden">Pendiente</span>' : ''}
    `;
    card.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'p-6';

    const questionText = document.createElement('h3');
    questionText.className = 'text-lg font-medium text-slate-900 mb-6';
    questionText.textContent = question.q;
    body.appendChild(questionText);

    // Options
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'space-y-3';

    const letters = ['a', 'b', 'c'];

    question.options.forEach((optText, index) => {
        const letter = letters[index];
        const button = document.createElement('button');

        // Determine styling based on state
        let btnClasses = `w-full text-left px-4 py-3 rounded-lg border transition-all flex items-start gap-3 group option-btn `;

        if (currentTab === 'exam') {
            const isSelected = examAnswers[question.id] === letter;

            if (examSubmitted) {
                // Exam Submitted: Show Right/Wrong
                if (letter === question.a) {
                    // Correct Answer
                    btnClasses += 'bg-green-100 border-green-300 ring-1 ring-green-500';
                } else if (isSelected && letter !== question.a) {
                    // Wrong Selection
                    btnClasses += 'bg-red-100 border-red-300';
                } else {
                    btnClasses += 'border-slate-200 opacity-50';
                }
            } else {
                // Exam Active: Show Selection only
                if (isSelected) {
                    btnClasses += 'bg-blue-50 border-blue-500 ring-1 ring-blue-500';
                } else {
                    btnClasses += 'border-slate-200 hover:bg-slate-50 hover:border-slate-300';
                }
            }
        } else {
            // Study Mode (Default)
            btnClasses += 'border-slate-200 hover:bg-slate-50 hover:border-slate-300';
        }

        button.className = btnClasses;
        button.dataset.letter = letter;

        // Inner HTML Logic
        let letterClasses = 'flex-shrink-0 w-6 h-6 rounded-full text-sm font-medium flex items-center justify-center transition-colors option-letter ';
        let textClasses = 'font-normal option-text ';

        if (currentTab === 'exam') {
            const isSelected = examAnswers[question.id] === letter;
            if (examSubmitted) {
                if (letter === question.a) {
                    letterClasses += 'bg-green-600 text-white';
                    textClasses += 'text-green-900 font-medium';
                } else if (isSelected && letter !== question.a) {
                    letterClasses += 'bg-red-600 text-white'; // Red background for incorrect letter
                    textClasses += 'text-red-900';
                } else {
                    letterClasses += 'bg-slate-100 text-slate-500 text-slate-700';
                }
            } else {
                if (isSelected) {
                    letterClasses += 'bg-blue-600 text-white';
                    textClasses += 'text-blue-900 font-medium';
                } else {
                    letterClasses += 'bg-slate-100 text-slate-500 text-slate-700';
                }
            }
        } else {
            // Study Mode Logic for Letters
            // For initial render in study mode, no answer is selected yet, so default styling.
            // The actual styling for correct/incorrect answers is applied in handleAnswer.
            letterClasses += 'bg-slate-100 text-slate-500';
            textClasses += 'text-slate-700';
        }

        button.innerHTML = `
            <span class="${letterClasses}">${letter.toUpperCase()}</span>
            <span class="${textClasses}">${optText}</span>
        `;

        button.onclick = () => handleAnswer(question, letter, card);

        optionsContainer.appendChild(button);
    });

    body.appendChild(optionsContainer);

    // Explanation (Hidden initially)
    // In exam mode, only show if submitted
    const showExplanation = currentTab !== 'exam' || examSubmitted;
    const explanation = document.createElement('div');
    explanation.className = `explanation ${showExplanation ? 'hidden' : 'hidden'} mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-900`;
    explanation.innerHTML = `
        <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
                <p class="font-semibold mb-1">Explicación</p>
                <p>${question.exp}</p>
            </div>
        </div>
    `;
    body.appendChild(explanation);

    card.appendChild(body);
    return card;
}

function handleAnswer(question, selectedLetter, cardElement) {
    if (currentTab === 'exam') {
        if (examSubmitted) return; // Cannot change answers after submission

        // Update State
        examAnswers[question.id] = selectedLetter;

        // Re-render to show selection and update progress
        renderContent();

        // Maintain scroll position roughly? 
        // Actually, re-rendering the whole content might be jarring. 
        // Better to update DOM in place if possible, but for simplicity in this architecture, 
        // let's try to update just the card or re-render. 
        // Given the "Evaluate" button is sticky, re-render is okay but scroll might jump.
        // Let's just update the card UI in place for smoother experience.
        updateCardUI(cardElement, question, selectedLetter);
        updateProgressUI();

    } else {
        // Study Mode Logic (Existing)
        // Prevent re-answering if already answered (optional, but good UX)
        if (cardElement.dataset.answered === 'true') return;

        cardElement.dataset.answered = 'true';
        const isCorrect = selectedLetter === question.a;

        // Update Badge
        const badge = cardElement.querySelector('.status-badge');
        if (badge) {
            badge.classList.remove('hidden', 'bg-slate-200', 'text-slate-600');
            if (isCorrect) {
                badge.classList.add('bg-green-100', 'text-green-700');
                badge.textContent = 'Correcta';
            } else {
                badge.classList.add('bg-red-100', 'text-red-700');
                badge.textContent = 'Incorrecta';
            }
        }

        // Update Options Styles
        const buttons = cardElement.querySelectorAll('.option-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.remove('hover:bg-slate-50', 'hover:border-slate-300');

            const letter = btn.dataset.letter;

            if (letter === question.a) {
                // Correct Answer - Always Green
                btn.classList.add('bg-green-100', 'border-green-300', 'ring-1', 'ring-green-500');
                btn.querySelector('.option-letter').classList.add('bg-green-600', 'text-white');
                btn.querySelector('.option-text').classList.add('text-green-900', 'font-medium');
            } else if (letter === selectedLetter && !isCorrect) {
                // Wrong Selection - Red
                btn.classList.add('bg-red-50', 'border-red-200');
                btn.querySelector('.option-letter').classList.remove('bg-slate-100', 'text-slate-500');
                btn.querySelector('.option-letter').classList.add('bg-red-600', 'text-white'); // Highlight letter red
                btn.querySelector('.option-text').classList.add('text-red-900');
            } else {
                // Others - Dimmed
                btn.classList.add('opacity-50');
            }
        });

        // Show Explanation
        const explanation = cardElement.querySelector('.explanation');
        explanation.classList.remove('hidden');
        explanation.classList.add('animate-fade-in');
    }
}

function updateCardUI(card, question, selectedLetter) {
    const buttons = card.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        const letter = btn.dataset.letter;
        const isSelected = letter === selectedLetter;

        // Reset classes
        btn.className = `w-full text-left px-4 py-3 rounded-lg border transition-all flex items-start gap-3 group option-btn ${isSelected ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`;

        const letterSpan = btn.querySelector('.option-letter');
        const textSpan = btn.querySelector('.option-text');

        letterSpan.className = `flex-shrink-0 w-6 h-6 rounded-full text-sm font-medium flex items-center justify-center transition-colors option-letter ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`;
        textSpan.className = `font-normal option-text ${isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'}`;
    });
}

function updateProgressUI() {
    // We can just re-render the progress header part or finding it
    // But since we are inside renderContent loop usually, let's just find the element
    // Actually, simpler to just re-render content if we want to be safe, but scroll jump is annoying.
    // Let's find the counter.
    const counter = document.querySelector('#questions-container .text-lg.font-bold');
    if (counter) {
        counter.textContent = `${Object.keys(examAnswers).length} / ${examQuestions.length}`;
    }
}

function evaluateExam() {
    examSubmitted = true;
    renderContent();
    window.scrollTo(0, 0);
}

function calculateScore() {
    let score = 0;
    examQuestions.forEach(q => {
        if (examAnswers[q.id] === q.a) {
            score++;
        }
    });
    return score;
}

// Exam Logic
function generateExam() {
    examQuestions = [];
    const distribution = { 1: 10, 2: 3, 3: 2, 4: 3, 5: 7 };

    for (const [taskId, count] of Object.entries(distribution)) {
        if (tasks[taskId]) {
            const taskQuestions = [...tasks[taskId].questions];
            const selected = taskQuestions
                .sort(() => 0.5 - Math.random())
                .slice(0, count);
            examQuestions.push(...selected);
        }
    }

    // Shuffle the final mix -> REMOVED to keep topic order
    // examQuestions.sort(() => 0.5 - Math.random());

    // Reset state
    examAnswers = {};
    examSubmitted = false;
}

// Event Listeners
function setupEventListeners() {
    const handleSearch = (e) => {
        searchQuery = e.target.value;
        renderContent();
    };

    searchInput.addEventListener('input', handleSearch);
    mobileSearchInput.addEventListener('input', handleSearch);

    mobileSearchToggle.addEventListener('click', () => {
        mobileSearchBar.classList.toggle('hidden');
        if (!mobileSearchBar.classList.contains('hidden')) {
            mobileSearchInput.focus();
        }
    });

    regenerateExamBtn.addEventListener('click', () => {
        generateExam();
        renderContent();
        window.scrollTo(0, 0);
    });
}

// Start
init();
