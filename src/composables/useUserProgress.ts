import { ref, watch } from 'vue';

interface UserProgress {
    stats: {
        examsTaken: number;
        examsPassed: number;
        totalQuestionsAnswered: number;
        totalCorrect: number;
    };
    favorites: number[]; // Array of question IDs
    questionHistory: Record<number, {
        seen: number;
        incorrect: number;
    }>;
}

const STORAGE_KEY = 'ccse_user_progress_v1';

const defaultProgress: UserProgress = {
    stats: {
        examsTaken: 0,
        examsPassed: 0,
        totalQuestionsAnswered: 0,
        totalCorrect: 0,
    },
    favorites: [],
    questionHistory: {},
};

// Global state
const stored = localStorage.getItem(STORAGE_KEY);
const progress = ref<UserProgress>(stored ? JSON.parse(stored) : defaultProgress);

// Watch for changes and save to localStorage
watch(progress, (newVal) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal));
}, { deep: true });

export function useUserProgress() {
    // Actions
    const toggleFavorite = (questionId: number) => {
        const index = progress.value.favorites.indexOf(questionId);
        if (index === -1) {
            progress.value.favorites.push(questionId);
        } else {
            progress.value.favorites.splice(index, 1);
        }
    };

    const isFavorite = (questionId: number) => {
        return progress.value.favorites.includes(questionId);
    };

    const recordExamResult = (passed: boolean, score: number, total: number) => {
        progress.value.stats.examsTaken++;
        if (passed) progress.value.stats.examsPassed++;
        progress.value.stats.totalQuestionsAnswered += total;
        progress.value.stats.totalCorrect += score;
    };

    const recordQuestionInteraction = (questionId: number, isCorrect: boolean) => {
        if (!progress.value.questionHistory[questionId]) {
            progress.value.questionHistory[questionId] = { seen: 0, incorrect: 0 };
        }

        progress.value.questionHistory[questionId].seen++;
        if (!isCorrect) {
            progress.value.questionHistory[questionId].incorrect++;
        }
    };

    const getQuestionStats = (questionId: number) => {
        return progress.value.questionHistory[questionId] || { seen: 0, incorrect: 0 };
    };

    return {
        progress,
        toggleFavorite,
        isFavorite,
        recordExamResult,
        recordQuestionInteraction,
        getQuestionStats,
    };
}
