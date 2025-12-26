<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { tasks } from './data/questions';
import type { Question } from './types';
import QuestionCard from './components/QuestionCard.vue';
import NavBar from './components/NavBar.vue';
import { useUserProgress } from './composables/useUserProgress';

const { progress, recordExamResult, recordQuestionInteraction, getQuestionStats, resetProgress } = useUserProgress();

// Tabs Configuration
const tabs = [
  { id: '1', label: 'Tarea 1' },
  { id: '2', label: 'Tarea 2' },
  { id: '3', label: 'Tarea 3' },
  { id: '4', label: 'Tarea 4' },
  { id: '5', label: 'Tarea 5' },
  { id: 'favorites', label: 'Favoritas' },
  { id: 'cards', label: 'Tarjetas' },
  { id: 'exam', label: 'Modo Examen' }
];

// State
const currentTab = ref('1');
const searchQuery = ref('');
const mobileSearchVisible = ref(false);
const showStatsModal = ref(false);

// Exam State
const examQuestions = ref<Question[]>([]);
const examAnswers = ref<Record<number, string>>({});
const examSubmitted = ref(false);

// Flashcard State
const flashcardQuestion = ref<Question | null>(null);
const flashcardAnswered = ref(false);

// Study Mode Answers (per session/view)
// Store study answers per task: { taskId: { questionId: answer } }
const studyAnswers = ref<Record<string, Record<number, string>>>({});

// Computed
const currentTaskTitle = computed(() => {
  if (currentTab.value === 'exam') return 'Examen Oficial (Simulación)';
  if (currentTab.value === 'favorites') return 'Mis Preguntas Favoritas';
  if (currentTab.value === 'cards') return 'Modo Tarjetas (Aleatorio)';
  return tasks[parseInt(currentTab.value)]?.title || '';
});

const questionsToShow = computed(() => {
  let questions: Question[] = [];

  if (currentTab.value === 'exam') {
    questions = examQuestions.value;
  } else if (currentTab.value === 'cards') {
    questions = flashcardQuestion.value ? [flashcardQuestion.value] : [];
  } else if (currentTab.value === 'favorites') {
    // Gather all questions
    const allQuestions = Object.values(tasks).flatMap(t => t.questions);
    questions = allQuestions.filter(q => progress.value.favorites.includes(q.id));
  } else {
    questions = tasks[parseInt(currentTab.value)]?.questions || [];
  }

  if (searchQuery.value && currentTab.value !== 'exam' && currentTab.value !== 'cards') {
    const query = searchQuery.value.toLowerCase();
    questions = questions.filter(q => 
      q.q.toLowerCase().includes(query) || 
      q.id.toString().includes(query)
    );
  }

  return questions;
});

const examProgress = computed(() => {
  const answeredCount = Object.keys(examAnswers.value).length;
  const totalCount = examQuestions.value.length;
  const percentage = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  return { answeredCount, totalCount, percentage };
});

const examScore = computed(() => {
  if (!examSubmitted.value) return 0;
  return examQuestions.value.reduce((score, q) => {
    if (examAnswers.value[q.id] === q.a) {
      return score + 1;
    }
    return score;
  }, 0);
});

const isPassed = computed(() => examScore.value >= 15);

// Methods
const generateExam = () => {
  const distribution: Record<number, number> = { 1: 10, 2: 3, 3: 2, 4: 3, 5: 7 };
  let selectedQuestions: Question[] = [];

  // Select questions from each task
  Object.entries(distribution).forEach(([taskIdStr, count]) => {
    const taskId = parseInt(taskIdStr);
    const task = tasks[taskId];
    if (!task) return;

    // Smart Selection: Prioritize unseen or incorrect questions
    const weightedQuestions = task.questions.map(q => {
      const stats = progress.value.questionHistory[q.id];
      let weight = 3; // Default (Unseen)
      if (stats) {
        if (stats.incorrect > 0) weight = 2; // Has errors
        else weight = 1; // Seen and correct
      }
      return { q, weight, random: Math.random() };
    });

    // Sort by weight (desc) then random
    weightedQuestions.sort((a, b) => {
      if (a.weight !== b.weight) return b.weight - a.weight;
      return a.random - b.random;
    });

    selectedQuestions.push(...weightedQuestions.slice(0, count).map(wq => wq.q));
  });

  // Reset state
  examQuestions.value = selectedQuestions;
  examAnswers.value = {};
  examSubmitted.value = false;
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const generateFlashcard = () => {
  const allQuestions = Object.values(tasks).flatMap(t => t.questions);
  if (allQuestions.length === 0) return;

  // Smart selection: prioritize unseen or incorrect
  const pool = [...allQuestions].sort((a, b) => {
    const statsA = getQuestionStats(a.id);
    const statsB = getQuestionStats(b.id);
    
    // Priority: Unseen (seen=0) > Incorrect (incorrect > 0) > Seen
    const scoreA = statsA.seen === 0 ? 0 : (statsA.incorrect > 0 ? 1 : 2);
    const scoreB = statsB.seen === 0 ? 0 : (statsB.incorrect > 0 ? 1 : 2);
    
    if (scoreA !== scoreB) return scoreA - scoreB;
    return Math.random() - 0.5; // Random within same priority
  });

  flashcardQuestion.value = pool[0] || null;
  flashcardAnswered.value = false;
  
  // Clear previous answer for this specific question in studyAnswers if we want it to be fresh
  if (studyAnswers.value['cards'] && pool[0]) {
    delete studyAnswers.value['cards'][pool[0].id];
  }
};

const handleAnswer = (questionId: number, answer: string) => {
  if (currentTab.value === 'exam') {
    if (!examSubmitted.value) {
      examAnswers.value = { ...examAnswers.value, [questionId]: answer };
    }
  } else {
    // Study mode or Flashcard mode
    if (!studyAnswers.value[currentTab.value]) {
      studyAnswers.value[currentTab.value] = {};
    }
    
    const currentTaskAnswers = studyAnswers.value[currentTab.value]!;
    
    if (currentTab.value === 'cards') {
      flashcardAnswered.value = true;
    }

    // Check if this is a new answer for this session/view
    if (!currentTaskAnswers[questionId]) {
       // Find question to check correctness
       const taskId = parseInt(currentTab.value);
       const question = !isNaN(taskId) ? tasks[taskId]?.questions.find(q => q.id === questionId) : undefined;
       
       // For favorites/cards tab, we need to search in all tasks
       if ((currentTab.value === 'favorites' || currentTab.value === 'cards') && !question) {
          const allQuestions = Object.values(tasks).flatMap(t => t.questions);
          const found = allQuestions.find(q => q.id === questionId);
          if (found) {
             const isCorrect = answer === found.a;
             recordQuestionInteraction(questionId, isCorrect);
          }
       } else if (question) {
         const isCorrect = answer === question.a;
         recordQuestionInteraction(questionId, isCorrect);
       }
    }

    currentTaskAnswers[questionId] = answer;
  }
};

const getSelectedAnswer = (questionId: number) => {
  if (currentTab.value === 'exam') {
    return examAnswers.value[questionId] || null;
  } else {
    return studyAnswers.value[currentTab.value]?.[questionId] || null;
  }
};

const evaluateExam = () => {
  if (Object.keys(examAnswers.value).length < 25) {
    if (!confirm('No has respondido a todas las preguntas. ¿Quieres evaluar de todas formas?')) {
      return;
    }
  }
  
  // Record results
  const score = examQuestions.value.reduce((acc, q) => {
    const answer = examAnswers.value[q.id];
    const isCorrect = answer === q.a;
    
    // Record interaction for each question
    if (answer) {
      recordQuestionInteraction(q.id, isCorrect);
    }
    
    return isCorrect ? acc + 1 : acc;
  }, 0);

  const passed = score >= 15;
  recordExamResult(passed, score, 25);

  examSubmitted.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const handleReset = () => {
  if (confirm('¿Estás seguro de que quieres borrar todas tus estadísticas y favoritos? Esta acción no se puede deshacer.')) {
    resetProgress();
    showStatsModal.value = false;
    // Reset local session state too
    examQuestions.value = [];
    examAnswers.value = {};
    examSubmitted.value = false;
    studyAnswers.value = {};
    flashcardQuestion.value = null;
    flashcardAnswered.value = false;
    alert('Estadísticas reiniciadas correctamente.');
  }
};

const changeTab = (id: string) => {
  currentTab.value = id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'exam' && examQuestions.value.length === 0) {
    generateExam();
  } else if (id === 'cards' && !flashcardQuestion.value) {
    generateFlashcard();
  }
};

// Watchers
watch(currentTab, (newTab) => {
  if (newTab === 'exam' || newTab === 'cards') {
    mobileSearchVisible.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-900">
    <!-- Header -->
    <header class="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-xl z-40">
      <div class="max-w-5xl mx-auto px-4 py-4 md:py-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="bg-yellow-400 p-2 rounded-lg shadow-inner">
              <svg class="w-8 h-8 text-red-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
            <div>
              <h1 class="text-2xl md:text-3xl font-black tracking-tighter uppercase">CCSE <span class="text-yellow-400">2026</span></h1>
              <p class="text-red-50 font-medium opacity-90">Preparación para la Nacionalidad Española</p>
              <p class="text-[10px] text-yellow-200/80 font-bold uppercase tracking-widest mt-0.5">Material de estudio no oficial • Preguntas oficiales 2026</p>
            </div>
          </div>
          
          <div class="flex items-center gap-3">
            <!-- Stats Button -->
            <button 
              @click="showStatsModal = true"
              class="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors text-white flex items-center gap-2 px-4 cursor-pointer"
              title="Ver Estadísticas"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <span class="hidden md:inline font-medium">Estadísticas</span>
            </button>

            <!-- Search Bar (Desktop) -->
            <div v-if="currentTab !== 'exam' && currentTab !== 'cards'" class="hidden md:block w-full md:w-auto relative group">
              <input 
                v-model="searchQuery"
                type="text" 
                placeholder="Buscar pregunta..." 
                class="w-80 px-4 py-2.5 rounded-full text-slate-700 bg-white/95 border-2 border-transparent focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 shadow-lg transition-all pl-10"
              >
              <svg class="w-5 h-5 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>

            <!-- Mobile Search Toggle -->
            <button 
              v-if="currentTab !== 'exam' && currentTab !== 'cards'"
              @click="mobileSearchVisible = !mobileSearchVisible"
              class="md:hidden p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors cursor-pointer"
            >
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile Search Bar -->
        <div v-if="mobileSearchVisible && currentTab !== 'exam' && currentTab !== 'cards'" class="mt-4 md:hidden animate-fade-in">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar pregunta..." 
            class="w-full px-4 py-2.5 rounded-lg text-slate-700 bg-white border-2 border-transparent focus:border-yellow-400 focus:outline-none shadow-lg"
          >
        </div>
      </div>
    </header>

    <!-- Navigation -->
    <NavBar :current-tab="currentTab" :tabs="tabs" @change-tab="changeTab" />

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto px-4 pb-20">
      
      <!-- Exam Header / Progress -->
      <div v-if="currentTab === 'exam'" class="mb-6">
        <!-- Exam Controls -->
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-slate-800">Examen Oficial</h2>
          <button 
            @click="generateExam" 
            class="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-red-600 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Nuevo Examen
          </button>
        </div>

        <!-- Progress Bar (Hidden after submission) -->
        <div v-if="!examSubmitted" class="mb-6 bg-white border-2 border-red-100 rounded-xl p-4 sticky top-20 z-40 shadow-md">
          <div class="w-full flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <div>
                <span class="text-sm font-bold text-red-600 uppercase tracking-wider">Progreso del Examen</span>
                <div class="text-2xl font-bold text-slate-900">{{ examProgress.answeredCount }} <span class="text-slate-400 text-lg">/ {{ examProgress.totalCount }}</span></div>
              </div>
              <button 
                @click="evaluateExam"
                :disabled="examProgress.answeredCount === 0"
                class="px-6 py-2 bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 text-white font-bold rounded-lg transition-all shadow-sm transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Evaluar
              </button>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div class="bg-gradient-to-r from-red-500 to-yellow-400 h-2.5 rounded-full transition-all duration-500" :style="{ width: `${examProgress.percentage}%` }"></div>
            </div>
          </div>
        </div>

        <!-- Result Card -->
        <div v-if="examSubmitted" class="mb-8 p-6 rounded-xl border-2 text-center animate-fade-in" :class="isPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'">
          <h3 class="text-2xl font-bold mb-2" :class="isPassed ? 'text-green-800' : 'text-red-800'">
            {{ isPassed ? '¡APROBADO!' : 'NO APTO' }}
          </h3>
          <p class="text-lg mb-4" :class="isPassed ? 'text-green-700' : 'text-red-700'">
            Has acertado <strong>{{ examScore }}</strong> de {{ examQuestions.length }} preguntas.
          </p>
          <p class="text-sm text-slate-600">Se necesitan 15 aciertos para aprobar.</p>
        </div>
      </div>

      <!-- Task Title Header (Study Mode) -->
      <div v-if="currentTab !== 'exam' && questionsToShow.length > 0" class="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex justify-between items-center">
        <h2 class="text-lg font-semibold text-yellow-900">{{ currentTaskTitle }}</h2>
        
        <!-- Next Button for Flashcard Mode -->
        <button 
          v-if="currentTab === 'cards' && flashcardAnswered"
          @click="generateFlashcard"
          class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all shadow-md transform hover:scale-105 flex items-center gap-2 cursor-pointer animate-fade-in"
        >
          Siguiente
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </button>
      </div>

      <!-- Questions List -->
      <div v-if="questionsToShow.length > 0" class="space-y-4">
        <QuestionCard
          v-for="question in questionsToShow"
          :key="question.id"
          :question="question"
          :selected-answer="getSelectedAnswer(question.id)"
          :show-feedback="(currentTab !== 'exam' && !!getSelectedAnswer(question.id)) || (currentTab === 'exam' && examSubmitted)"
          :show-explanation="(currentTab !== 'exam' && !!getSelectedAnswer(question.id)) || (currentTab === 'exam' && examSubmitted)"
          :is-exam-mode="currentTab === 'exam'"
          @select="(ans) => handleAnswer(question.id, ans)"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-20">
        <div class="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 class="text-xl font-medium text-slate-900 mb-2">No se encontraron preguntas</h3>
        <p class="text-slate-500">Intenta con otra búsqueda o cambia de tarea.</p>
      </div>

    </main>

    <!-- Footer -->
    <footer class="bg-slate-900 text-slate-400 py-12 mt-12">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <p class="mb-4 font-bold text-slate-200">CCSE 2026 Interactive App</p>
        <p class="text-sm text-slate-500 mb-2">Diseñado para ayudar en la preparación de la prueba de conocimientos constitucionales y socioculturales de España.</p>
        <p class="text-xs text-slate-600 italic">Aviso: Este es un material de estudio independiente y no oficial. Las preguntas corresponden al temario oficial del 2026.</p>
      </div>
    </footer>

    <!-- Stats Modal -->
    <div v-if="showStatsModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 class="text-lg font-bold text-slate-800">Estadísticas de Progreso</h3>
          <button @click="showStatsModal = false" class="text-slate-400 hover:text-slate-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="p-6 space-y-6">
          <!-- Exam Stats -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-blue-50 p-4 rounded-xl text-center">
              <div class="text-3xl font-bold text-blue-600">{{ progress.stats.examsTaken }}</div>
              <div class="text-xs font-medium text-blue-800 uppercase tracking-wide mt-1">Exámenes</div>
            </div>
            <div class="bg-green-50 p-4 rounded-xl text-center">
              <div class="text-3xl font-bold text-green-600">{{ progress.stats.examsPassed }}</div>
              <div class="text-xs font-medium text-green-800 uppercase tracking-wide mt-1">Aprobados</div>
            </div>
          </div>

          <!-- General Stats -->
          <div class="space-y-4">
            <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span class="text-slate-600">Preguntas Respondidas</span>
              <span class="font-bold text-slate-900">{{ progress.stats.totalQuestionsAnswered }}</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span class="text-slate-600">Aciertos Totales</span>
              <span class="font-bold text-slate-900">{{ progress.stats.totalCorrect }}</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span class="text-slate-600">Tasa de Acierto</span>
              <span class="font-bold text-slate-900">
                {{ progress.stats.totalQuestionsAnswered > 0 ? Math.round((progress.stats.totalCorrect / progress.stats.totalQuestionsAnswered) * 100) : 0 }}%
              </span>
            </div>
             <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span class="text-slate-600">Preguntas Favoritas</span>
              <span class="font-bold text-red-500 flex items-center gap-1">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                {{ progress.favorites.length }}
              </span>
            </div>
          </div>
        </div>
        <div class="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-col gap-3">
          <p class="text-xs text-slate-500 text-center">Tus datos se guardan automáticamente en este dispositivo.</p>
          <button 
            @click="handleReset"
            class="w-full py-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer border border-red-200"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Borrar todos los datos
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
