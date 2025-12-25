<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { tasks } from './data/questions';
import type { Question } from './types';
import QuestionCard from './components/QuestionCard.vue';
import NavBar from './components/NavBar.vue';

// State
const currentTab = ref('1');
const searchQuery = ref('');
const examQuestions = ref<Question[]>([]);
const examAnswers = ref<Record<number, string>>({});
const examSubmitted = ref(false);
const mobileSearchVisible = ref(false);

// Tabs Configuration
const tabs = [
  { id: '1', label: 'Tarea 1' },
  { id: '2', label: 'Tarea 2' },
  { id: '3', label: 'Tarea 3' },
  { id: '4', label: 'Tarea 4' },
  { id: '5', label: 'Tarea 5' },
  { id: 'exam', label: 'Modo Examen' }
];

// Computed
const currentTaskTitle = computed(() => {
  if (currentTab.value === 'exam') return 'Examen Oficial (Simulación)';
  return tasks[currentTab.value]?.title || '';
});

const questionsToShow = computed(() => {
  let questions: Question[] = [];

  if (currentTab.value === 'exam') {
    questions = examQuestions.value;
  } else {
    questions = tasks[currentTab.value]?.questions || [];
  }

  if (searchQuery.value && currentTab.value !== 'exam') {
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

    const taskQuestions = [...task.questions];
    // Shuffle task questions
    for (let i = taskQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = taskQuestions[i];
      taskQuestions[i] = taskQuestions[j]!;
      taskQuestions[j] = temp!;
    }
    selectedQuestions.push(...taskQuestions.slice(0, count));
  });

  // Reset state
  examQuestions.value = selectedQuestions;
  examAnswers.value = {};
  examSubmitted.value = false;
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const handleAnswer = (questionId: number, answer: string) => {
  if (currentTab.value === 'exam') {
    if (!examSubmitted.value) {
      examAnswers.value = { ...examAnswers.value, [questionId]: answer };
    }
  } else {
    // Study mode: Store answer locally if needed, but QuestionCard handles immediate feedback logic
    // We can use a reactive map for study mode answers if we want persistence within session
    // For now, QuestionCard props handle it. 
    // Wait, QuestionCard needs 'selectedAnswer' prop.
    // We need to store study mode answers too to pass them back.
    if (!studyAnswers.value[currentTab.value]) {
      studyAnswers.value = {
        ...studyAnswers.value,
        [currentTab.value]: {}
      };
    }
    
    // Create a new object to trigger reactivity if needed, though nested reactivity should work with ref
    const currentTaskAnswers = studyAnswers.value[currentTab.value] || {};
    currentTaskAnswers[questionId] = answer;
    studyAnswers.value[currentTab.value] = currentTaskAnswers;
  }
};

// Store study answers per task: { taskId: { questionId: answer } }
const studyAnswers = ref<Record<string, Record<number, string>>>({});

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
  examSubmitted.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const changeTab = (id: string) => {
  currentTab.value = id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'exam' && examQuestions.value.length === 0) {
    generateExam();
  }
};

// Watchers
watch(currentTab, (newTab) => {
  if (newTab === 'exam') {
    mobileSearchVisible.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-600">
    <!-- Header -->
    <header class="bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 text-white shadow-lg relative overflow-hidden">
      <div class="absolute inset-0 bg-black/10"></div>
      <div class="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <div class="flex flex-col md:flex-row justify-between items-center gap-6">
          <div class="text-center md:text-left">
            <h1 class="text-3xl md:text-4xl font-bold mb-2 tracking-tight">CCSE 2026</h1>
            <p class="text-red-50 font-medium opacity-90">Preparación para la Nacionalidad Española</p>
          </div>
          
          <!-- Search Bar (Desktop) -->
          <div v-if="currentTab !== 'exam'" class="hidden md:block w-full md:w-auto relative group">
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
            v-if="currentTab !== 'exam'"
            @click="mobileSearchVisible = !mobileSearchVisible"
            class="md:hidden p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </button>
        </div>

        <!-- Mobile Search Bar -->
        <div v-if="mobileSearchVisible && currentTab !== 'exam'" class="mt-4 md:hidden animate-fade-in">
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
    <main class="max-w-3xl mx-auto px-4 pb-20">
      
      <!-- Exam Header / Progress -->
      <div v-if="currentTab === 'exam'" class="mb-6">
        <!-- Exam Controls -->
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-slate-800">Examen Oficial</h2>
          <button 
            @click="generateExam" 
            class="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-red-600 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
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
                class="px-6 py-2 bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 text-white font-bold rounded-lg transition-all shadow-sm transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div v-if="currentTab !== 'exam' && questionsToShow.length > 0" class="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h2 class="text-lg font-semibold text-yellow-900">{{ currentTaskTitle }}</h2>
      </div>

      <!-- Questions List -->
      <div v-if="questionsToShow.length > 0" class="space-y-6">
        <QuestionCard
          v-for="question in questionsToShow"
          :key="question.id"
          :question="question"
          :selected-answer="getSelectedAnswer(question.id)"
          :show-feedback="currentTab !== 'exam' || examSubmitted"
          :show-explanation="currentTab !== 'exam' || examSubmitted"
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
        <p class="mb-4">CCSE 2026 Interactive App</p>
        <p class="text-sm text-slate-600">Diseñado para ayudar en la preparación de la prueba de conocimientos constitucionales y socioculturales de España.</p>
      </div>
    </footer>
  </div>
</template>
