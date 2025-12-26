<script setup lang="ts">
import { computed } from 'vue';
import type { Question } from '../types';
import { useUserProgress } from '../composables/useUserProgress';

const props = defineProps<{
  question: Question;
  selectedAnswer: string | null;
  showFeedback: boolean;
  showExplanation: boolean;
  isExamMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', answer: string): void;
}>();

const { progress, toggleFavorite } = useUserProgress();
const isFavorite = computed(() => progress.value.favorites.includes(props.question.id));
const letters = ['a', 'b', 'c'];

const getOptionClass = (letter: string) => {
  const isSelected = props.selectedAnswer === letter;
  const isCorrect = letter === props.question.a;
  
  // Base classes
  let classes = 'w-full text-left p-4 rounded-lg border-2 transition-all duration-200 flex items-center gap-3 group ';
  
  if (props.showFeedback) {
    if (isCorrect) {
      // Correct Answer (Green)
      classes += 'bg-green-50 border-green-200 ring-1 ring-green-500';
    } else if (isSelected && !isCorrect) {
      // Wrong Selection (Red)
      classes += 'bg-red-50 border-red-200';
    } else {
      // Others (Dimmed)
      classes += 'opacity-50 border-slate-100';
    }
  } else {
    // No Feedback (Exam Mode before eval or Study Mode before selection)
    if (isSelected) {
      // Selected (Blue/Primary)
      classes += 'bg-blue-50 border-blue-500 shadow-sm';
    } else {
      // Default
      classes += 'bg-slate-50 border-slate-100 hover:bg-white hover:border-blue-200 hover:shadow-sm';
    }
  }
  
  return classes;
};

const getLetterClass = (letter: string) => {
  const isSelected = props.selectedAnswer === letter;
  const isCorrect = letter === props.question.a;

  let classes = 'flex-shrink-0 w-6 h-6 rounded-full text-sm font-medium flex items-center justify-center transition-colors option-letter ';

  if (props.showFeedback) {
    if (isCorrect) {
      classes += 'bg-green-500 text-white';
    } else if (isSelected && !isCorrect) {
      classes += 'bg-red-500 text-white';
    } else {
      classes += 'bg-slate-100 text-slate-500';
    }
  } else {
    if (isSelected) {
      classes += 'bg-blue-500 text-white';
    } else {
      classes += 'bg-slate-100 text-slate-500';
    }
  }

  return classes;
};

const getTextClass = (letter: string) => {
  const isCorrect = letter === props.question.a;
  const isSelected = props.selectedAnswer === letter;

  let classes = 'text-slate-700 font-normal option-text ';
  
  if (props.showFeedback) {
    if (isCorrect) {
      classes += 'text-green-900 font-medium';
    } else if (isSelected && !isCorrect) {
      classes += 'text-red-900';
    }
  }
  
  return classes;
}

const handleClick = (letter: string) => {
  // Prevent changing answer if feedback is already shown (in study mode)
  // In exam mode, allow changing answer until submitted (handled by parent)
  if (!props.isExamMode && props.selectedAnswer) return;
  
  emit('select', letter);
};
</script>

<template>
  <div :id="`q-${question.id}`" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
    <!-- Header -->
    <div class="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
      <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Pregunta {{ question.id }}</span>
      <button 
        @click.stop="toggleFavorite(question.id)" 
        class="transition-colors focus:outline-none cursor-pointer"
        :class="isFavorite ? 'text-red-500 hover:text-red-600' : 'text-slate-300 hover:text-red-500'"
        title="Guardar como favorita"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="p-4">
      <h3 class="text-base font-medium text-slate-900 mb-3 leading-snug">{{ question.q }}</h3>

      <div class="space-y-2">
        <button
          v-for="(option, index) in question.options"
          :key="index"
          @click="handleClick(letters[index] || '')"
          :class="[getOptionClass(letters[index] || ''), (!isExamMode && !!selectedAnswer) || (isExamMode && showFeedback) ? '' : 'cursor-pointer']"
          :disabled="(!isExamMode && !!selectedAnswer) || (isExamMode && showFeedback)"
          class="py-2 px-3"
        >
          <span :class="getLetterClass(letters[index] || '')">{{ (letters[index] || '').toUpperCase() }}</span>
          <span :class="getTextClass(letters[index] || '')">{{ option }}</span>
        </button>
      </div>

      <!-- Explanation -->
      <div v-if="showExplanation" class="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-900 animate-fade-in">
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <span class="font-bold block mb-0.5">Explicación:</span>
            {{ question.exp }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
