<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { tasks } from './data/questions';
import type { Question } from './types';
import QuestionCard from './components/QuestionCard.vue';
import NavBar from './components/NavBar.vue';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from './firebase';
import { useUserProgress } from './composables/useUserProgress';
import { onMounted } from 'vue';

const { progress, currentUser, isLoading, recordExamResult, recordQuestionInteraction, getQuestionStats, resetProgress } = useUserProgress();

const deferredPrompt = ref<any>(null);
const isInstalling = ref(false);
const isSecure = ref(window.isSecureContext);

onMounted(async () => {
  console.log("App mounted. Secure context:", isSecure.value);
  if (!isSecure.value && !window.location.hostname.includes('localhost')) {
    console.warn("This app is running in an insecure context. Firebase Auth and PWA features may not work correctly.");
    alert("Contexto no seguro detectado. El login y PWA podrían no funcionar.");
  }
  // Handle Redirect Result
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log("Login successful via redirect", result.user.email);
      alert("Login exitoso vía redirect: " + result.user.email);
    } else {
      console.log("No redirect result found");
    }
  } catch (error: any) {
    console.error("Redirect login error:", error);
    if (error.code === 'auth/unauthorized-domain') {
      alert("Error de Firebase: Dominio no autorizado. Debes añadir este dominio en la consola de Firebase (Authentication > Settings > Authorized domains).");
    } else if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      alert("Error de login: " + error.message);
    }
  }

  // Handle PWA Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('beforeinstallprompt fired');
    // alert('beforeinstallprompt fired'); // Too intrusive for production, but good for debugging
    e.preventDefault();
    deferredPrompt.value = e;
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    deferredPrompt.value = null;
    isInstalling.value = false;
  });
});

const handleLogin = () => {
  if (!isSecure.value && !window.location.hostname.includes('localhost')) {
    alert("El login de Google requiere una conexión segura (HTTPS) o usar 'localhost'. Si estás probando en móvil localmente, asegúrate de usar HTTPS.");
  }
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    signInWithRedirect(auth, googleProvider);
  } else {
    signInWithPopup(auth, googleProvider);
  }
};

const handleLogout = () => signOut(auth);

const handleInstall = async () => {
  if (!deferredPrompt.value) {
    alert("La instalación no está disponible en este momento. Asegúrate de cumplir los requisitos de PWA y usar un navegador compatible (Chrome en Android, Safari en iOS).");
    return;
  }
  
  try {
    isInstalling.value = true;
    console.log('Triggering PWA install prompt...');
    
    // Some browsers might not support .prompt() or might behave unexpectedly
    if (typeof deferredPrompt.value.prompt !== 'function') {
      throw new Error("El navegador no soporta la función de instalación programática.");
    }

    await deferredPrompt.value.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await deferredPrompt.value.userChoice;
    console.log(`User response to the install prompt: ${choiceResult.outcome}`);
    
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
      deferredPrompt.value = null;
    } else {
      console.log('User dismissed the install prompt');
    }
  } catch (err: any) {
    console.error("Installation error:", err);
    alert("Error al intentar instalar: " + (err.message || "Error desconocido"));
  } finally {
    isInstalling.value = false;
  }
};

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
const flashcardSessionStats = ref({
  answered: 0,
  correct: 0,
  incorrect: 0
});

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
      flashcardSessionStats.value.answered++;
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
             
             if (currentTab.value === 'cards') {
               if (isCorrect) flashcardSessionStats.value.correct++;
               else flashcardSessionStats.value.incorrect++;
             }
          }
       } else if (question) {
         const isCorrect = answer === question.a;
         recordQuestionInteraction(questionId, isCorrect);
         
         if (currentTab.value === 'cards') {
           if (isCorrect) flashcardSessionStats.value.correct++;
           else flashcardSessionStats.value.incorrect++;
         }
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

watch(showStatsModal, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-900">
    <!-- Header -->
    <header class="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg z-40">
      <div class="max-w-5xl mx-auto px-4 py-3 md:py-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="bg-yellow-400 p-1.5 rounded-lg shadow-inner flex-shrink-0">
              <svg class="w-6 h-6 md:w-7 md:h-7 text-red-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <h1 class="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none">CCSE <span class="text-yellow-400">2026</span></h1>
              <p class="text-[10px] md:text-xs text-red-50 font-medium opacity-80 truncate mt-0.5">Preguntas oficiales 2026 • Material de estudio no oficial</p>
            </div>
          </div>
          
          <div class="flex items-center gap-2 md:gap-3">
            <!-- Search Bar (Desktop) -->
            <div v-if="currentTab !== 'exam' && currentTab !== 'cards'" class="hidden md:block relative group">
              <input 
                v-model="searchQuery"
                type="text" 
                placeholder="Buscar..." 
                class="w-48 lg:w-64 px-4 py-1.5 rounded-full text-sm text-slate-700 bg-white/90 border-2 border-transparent focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 shadow-sm transition-all pl-9"
              >
              <svg class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>

            <div class="flex items-center gap-2 bg-white/10 p-1 rounded-xl border border-white/10">
              <!-- Stats Button -->
              <button 
                @click="showStatsModal = true"
                class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white flex items-center gap-2 px-3 cursor-pointer"
                title="Ver Estadísticas"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <span class="text-xs font-bold">Stats</span>
              </button>

              <div class="w-px h-4 bg-white/20 mx-1"></div>

              <!-- Auth Button -->
              <div v-if="!isLoading" class="flex items-center">
                <button 
                  v-if="!currentUser"
                  @click="handleLogin"
                  class="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-all text-xs font-bold cursor-pointer"
                >
                  <svg class="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  Login
                </button>
                <div v-else class="flex items-center gap-2 px-2">
                  <img :src="currentUser.photoURL || ''" class="w-6 h-6 rounded-full border border-yellow-400" alt="User">
                  <button @click="handleLogout" class="text-[10px] font-bold text-red-100 hover:text-white underline cursor-pointer">Salir</button>
                </div>
              </div>
            </div>

            <!-- Mobile Search Toggle -->
            <button 
              v-if="currentTab !== 'exam' && currentTab !== 'cards'"
              @click="mobileSearchVisible = !mobileSearchVisible"
              class="md:hidden p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors cursor-pointer border border-white/10"
            >
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile Search Bar -->
        <div v-if="mobileSearchVisible && currentTab !== 'exam' && currentTab !== 'cards'" class="mt-3 md:hidden animate-fade-in">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar..." 
            class="w-full px-4 py-2 rounded-lg text-sm text-slate-700 bg-white border-2 border-transparent focus:border-yellow-400 focus:outline-none shadow-sm"
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
      <div 
        v-if="currentTab !== 'exam' && questionsToShow.length > 0" 
        class="mb-6 rounded-xl p-4 shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4 transition-colors"
        :class="[
          currentTab === 'cards' ? 'bg-blue-50 border-blue-100' : 
          currentTab === 'favorites' ? 'bg-red-50 border-red-100' : 
          'bg-yellow-50 border-yellow-100'
        ]"
      >
        <div class="flex flex-col">
          <h2 class="text-lg font-bold" :class="currentTab === 'cards' ? 'text-blue-900' : currentTab === 'favorites' ? 'text-red-900' : 'text-yellow-900'">
            {{ currentTaskTitle }}
          </h2>
          <div v-if="currentTab === 'cards'" class="flex flex-wrap items-center gap-2 mt-2">
            <div class="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 text-blue-700 rounded-lg border border-blue-200 shadow-sm">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <span class="text-[11px] font-bold uppercase tracking-tight">Vistas: {{ flashcardSessionStats.answered }}</span>
            </div>
            <div class="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 text-green-700 rounded-lg border border-green-200 shadow-sm">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span class="text-[11px] font-bold uppercase tracking-tight">Aciertos: {{ flashcardSessionStats.correct }}</span>
            </div>
            <div class="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 text-red-700 rounded-lg border border-red-200 shadow-sm">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              <span class="text-[11px] font-bold uppercase tracking-tight">Fallos: {{ flashcardSessionStats.incorrect }}</span>
            </div>
          </div>
        </div>
        
        <!-- Next Button for Flashcard Mode -->
        <button 
          v-if="currentTab === 'cards' && flashcardAnswered"
          @click="generateFlashcard"
          class="w-full md:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-all shadow-md transform hover:scale-105 flex items-center justify-center gap-2 cursor-pointer animate-fade-in"
        >
          Siguiente Tarjeta
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </button>
      </div>

      <!-- Exam Progress Bar (Sticky) -->
      <div v-if="currentTab === 'exam' && !examSubmitted" class="mb-6 bg-white/95 backdrop-blur-md rounded-xl p-4 sticky top-[52px] md:top-[60px] z-30 shadow-md border border-slate-200">
        <div class="w-full flex flex-col gap-2">
          <div class="flex justify-between items-center">
            <div>
              <span class="text-[10px] font-bold text-red-600 uppercase tracking-widest">Progreso del Examen</span>
              <div class="text-xl font-black text-slate-900">{{ examProgress.answeredCount }} <span class="text-slate-400 text-sm font-medium">/ {{ examProgress.totalCount }}</span></div>
            </div>
            <button 
              @click="evaluateExam"
              :disabled="examProgress.answeredCount === 0"
              class="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-all shadow-md transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Finalizar
            </button>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div class="bg-red-600 h-full rounded-full transition-all duration-500" :style="{ width: `${examProgress.percentage}%` }"></div>
          </div>
        </div>
      </div>

      <!-- Questions List -->
      <div v-if="questionsToShow.length > 0" class="space-y-4">
        <QuestionCard
          v-for="(question, index) in questionsToShow"
          :key="question.id"
          :question="question"
          :number="currentTab === 'exam' ? index + 1 : undefined"
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
        <p class="text-sm text-slate-500 mb-4">Diseñado para ayudar en la preparación de la prueba de conocimientos constitucionales y socioculturales de España.</p>
        
        <div class="flex flex-col md:flex-row items-center justify-center gap-4 mb-6">
          <a 
            href="https://examenes.cervantes.es/es/ccse/preparar-prueba" 
            target="_blank" 
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors text-sm border border-slate-700 cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
            Documentación Oficial (Cervantes)
          </a>
          
          <a 
            href="https://github.com/ERNO1997/ccse-2026" 
            target="_blank" 
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors text-sm border border-slate-700 cursor-pointer group"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub Repo
            <span class="ml-1 text-yellow-400 group-hover:scale-125 transition-transform">★</span>
          </a>

          <!-- Install PWA Button -->
          <button 
            v-if="deferredPrompt"
            @click="handleInstall"
            class="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all text-sm font-bold shadow-lg cursor-pointer"
            :disabled="isInstalling"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            {{ isInstalling ? 'Instalando...' : 'Instalar App' }}
          </button>
        </div>

        <p class="text-xs text-slate-600 italic">Aviso: Este es un material de estudio independiente y no oficial. Las preguntas corresponden al temario oficial del 2026.</p>
      </div>
    </footer>

    <!-- Stats Modal -->
    <div v-if="showStatsModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 class="text-lg font-bold text-slate-800">Estadísticas de Progreso</h3>
          <button @click="showStatsModal = false" class="text-slate-400 hover:text-slate-600 cursor-pointer">
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

          <!-- Flashcard Stats -->
          <div class="grid grid-cols-1 gap-4">
            <div class="bg-yellow-50 p-4 rounded-xl flex justify-between items-center">
              <div class="text-left">
                <div class="text-xs font-bold text-yellow-800 uppercase tracking-wider">Tarjetas Respondidas</div>
                <div class="text-2xl font-bold text-yellow-900">{{ Object.keys(progress.questionHistory).length }} / 300</div>
              </div>
              <div class="w-24 bg-yellow-200 rounded-full h-2 overflow-hidden">
                <div class="bg-yellow-600 h-full transition-all" :style="{ width: `${(Object.keys(progress.questionHistory).length / 300) * 100}%` }"></div>
              </div>
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
