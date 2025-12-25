import { tasks } from './data.js';

// State
let currentTab = '1'; // '1', '2', '3', '4', '5', or 'exam'
let searchQuery = '';
let examQuestions = []; // Stores the random questions for exam mode

// DOM Elements
const navTabs = document.getElementById('nav-tabs');
const questionsContainer = document.getElementById('questions-container');
const searchInput = document.getElementById('search-input');
const mobileSearchInput = document.getElementById('mobile-search-input');
const mobileSearchToggle = document.getElementById('mobile-search-toggle');
const mobileSearchBar = document.getElementById('mobile-search-bar');
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
            classes += 'border-blue-500 text-blue-600';
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
            if (currentTab === 'exam' && examQuestions.length === 0) {
                generateExam();
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

    // Header visibility
    if (currentTab === 'exam') {
        examHeader.classList.remove('hidden');
        questionsToShow = examQuestions;
    } else {
        examHeader.classList.add('hidden');
        if (tasks[currentTab]) {
            questionsToShow = tasks[currentTab].questions;
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
        <span class="status-badge px-2 py-1 rounded text-xs font-medium bg-slate-200 text-slate-600 hidden">Pendiente</span>
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
        button.className = `w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-start gap-3 group option-btn`;
        button.dataset.letter = letter;

        button.innerHTML = `
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-sm font-medium flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-colors option-letter">${letter.toUpperCase()}</span>
            <span class="text-slate-700 font-normal option-text">${optText}</span>
        `;

        button.onclick = () => handleAnswer(question, letter, card);

        optionsContainer.appendChild(button);
    });

    body.appendChild(optionsContainer);

    // Explanation (Hidden initially)
    const explanation = document.createElement('div');
    explanation.className = 'explanation hidden mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800';
    explanation.innerHTML = `
        <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    // Prevent re-answering if already answered (optional, but good UX)
    if (cardElement.dataset.answered === 'true') return;

    cardElement.dataset.answered = 'true';
    const isCorrect = selectedLetter === question.a;

    // Update Badge
    const badge = cardElement.querySelector('.status-badge');
    badge.classList.remove('hidden', 'bg-slate-200', 'text-slate-600');
    if (isCorrect) {
        badge.classList.add('bg-green-100', 'text-green-700');
        badge.textContent = 'Correcta';
    } else {
        badge.classList.add('bg-red-100', 'text-red-700');
        badge.textContent = 'Incorrecta';
    }

    // Update Options Styles
    const buttons = cardElement.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.classList.remove('hover:bg-slate-50', 'hover:border-slate-300');

        const letter = btn.dataset.letter;

        if (letter === question.a) {
            // Correct Answer - Always Green
            btn.classList.add('bg-green-50', 'border-green-200', 'ring-1', 'ring-green-500');
            btn.querySelector('.option-letter').classList.add('bg-green-500', 'text-white');
            btn.querySelector('.option-text').classList.add('text-green-900', 'font-medium');
        } else if (letter === selectedLetter && !isCorrect) {
            // Wrong Selection - Red
            btn.classList.add('bg-red-50', 'border-red-200');
            btn.querySelector('.option-letter').classList.add('bg-red-500', 'text-white');
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

// Exam Logic
function generateExam() {
    const allQuestions = [];
    Object.values(tasks).forEach(task => {
        allQuestions.push(...task.questions);
    });

    // Shuffle and pick 25
    examQuestions = allQuestions
        .sort(() => 0.5 - Math.random())
        .slice(0, 25);
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
