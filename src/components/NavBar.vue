<script setup lang="ts">
defineProps<{
  currentTab: string;
  tabs: { id: string; label: string }[];
}>();

const emit = defineEmits<{
  (e: 'change-tab', id: string): void;
}>();
</script>

<template>
  <div class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 mb-8">
    <div class="max-w-4xl mx-auto">
      <div class="flex overflow-x-auto no-scrollbar py-2 gap-2 px-4">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="emit('change-tab', tab.id)"
          class="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
          :class="[
            currentTab === tab.id
              ? 'bg-red-600 text-white shadow-md transform scale-105'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>
  </div>
</template>
