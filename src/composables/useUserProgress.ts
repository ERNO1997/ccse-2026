import { ref, watch } from 'vue';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
const currentUser = ref<User | null>(null);
const isLoading = ref(true);

// Watch for changes and save to localStorage (always)
watch(progress, (newVal) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal));

    // Also save to Firestore if logged in
    if (currentUser.value) {
        const userDoc = doc(db, 'users', currentUser.value.uid);
        setDoc(userDoc, newVal, { merge: true });
    }
}, { deep: true });

// Firebase Auth Listener
onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed:", user ? user.email : "null");
    alert("Auth state changed: " + (user ? user.email : "null"));
    currentUser.value = user;
    if (user) {
        // Logged in: Fetch from Firestore
        const userDoc = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDoc);

        if (docSnap.exists()) {
            const remoteData = docSnap.data() as UserProgress;
            progress.value = remoteData;
        } else {
            await setDoc(userDoc, progress.value);
        }
    }
    isLoading.value = false;
});

// Handle Redirect Result globally
import { getRedirectResult } from 'firebase/auth';
async function handleRedirect() {
    try {
        alert("Comprobando getRedirectResult...");
        const result = await getRedirectResult(auth);
        if (result) {
            alert("¡Redirect detectado! Usuario: " + result.user.email);
        } else {
            console.log("No redirect result found in useUserProgress");
        }
    } catch (error: any) {
        alert("Error en redirect (useUserProgress): " + error.code + " - " + error.message);
    }
}
handleRedirect();

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

    const resetProgress = () => {
        progress.value = JSON.parse(JSON.stringify(defaultProgress));
    };

    return {
        progress,
        currentUser,
        isLoading,
        toggleFavorite,
        isFavorite,
        recordExamResult,
        recordQuestionInteraction,
        getQuestionStats,
        resetProgress,
    };
}
