<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSplitterStore } from './stores/splitter.store'

const store = useSplitterStore()
const resultsContainer = ref<HTMLElement | null>(null)

function copyToClipboard(text: string, index: number) {
  try {
    navigator.clipboard.writeText(text)
    store.markAsCopied(index)
  }
  catch (err) {
    console.error('Failed to copy text:', err)
  }
}

function confirmClear(action: () => void, message = 'Are you sure you want to clear the current split?') {
  if (window.confirm(message)) {
    action()
  }
}

function handleWheel(event: WheelEvent) {
  const textarea = document.getElementById('input-text')
  if (textarea?.contains(event.target as Node)) {
    return
  }

  if (resultsContainer.value && !event.ctrlKey) {
    resultsContainer.value.scrollTop += event.deltaY
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('wheel', handleWheel, { passive: false })
  store.clearResults()
  store.selectedHistoryId = null
})

onUnmounted(() => {
  window.removeEventListener('wheel', handleWheel)
})
</script>

<template>
  <main class="h-screen bg-gray-900 text-gray-100 p-4 overflow-hidden">
    <div class="container mx-auto h-full">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
        <!-- Left side - Input -->
        <div class="space-y-4">
          <div>
            <div class="mb-2">
              <label for="input-text" class="block text-sm font-medium">
                Enter text to split
              </label>
            </div>
            <textarea
              id="input-text"
              v-model="store.inputText"
              class="w-full h-64 p-4 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter text to split"
            />
            <div class="mt-2 text-sm text-gray-400 text-right">
              {{ store.characterCount }} characters
            </div>
          </div>
          <button
            class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            @click="store.splitText"
            :disabled="!store.inputText.trim()"
          >
            Split text
          </button>

          <!-- History section -->
          <div v-if="store.history.length > 0" class="mt-8">
            <h2 class="text-sm font-medium text-gray-300 mb-3">Previous Splits</h2>
            <div class="space-y-3">
              <div
                v-for="item in store.paginatedHistory"
                :key="item.id"
                class="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors group cursor-pointer"
                :class="{ 'ring-2 ring-blue-500': item.id === store.selectedHistoryId }"
              >
                <div 
                  @click.stop="store.loadFromHistory(item.id)"
                >
                  <p class="text-sm text-gray-300 line-clamp-2">{{ item.preview }}</p>
                  <div class="mt-2 pt-2 border-t border-gray-600">
                    <div class="flex items-center justify-between text-xs text-gray-400">
                      <div class="flex items-center gap-4">
                        <span>{{ new Date(item.timestamp).toLocaleString() }}</span>
                        <span>{{ item.totalChunks }} chunks</span>
                      </div>
                      <button
                        @click.stop="confirmClear(() => store.removeFromHistory(item.id), 'Are you sure you want to remove this split from history?')"
                        class="p-1 text-gray-500 hover:text-red-500 transition-colors"
                        title="Remove from history"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="store.hasNextPage || store.hasPreviousPage" class="mt-4 flex justify-center gap-2">
              <button
                v-if="store.hasPreviousPage"
                @click="store.previousPage"
                class="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button
                v-if="store.hasNextPage"
                @click="store.nextPage"
                class="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Right side - Results -->
        <div ref="resultsContainer" class="h-full overflow-y-auto pr-2">
          <div class="space-y-4 pb-4">
            <div
              v-for="result in store.splitResults"
              :key="result.index"
              class="p-4 bg-gray-800 rounded-lg relative"
            >
              <p class="mb-4 whitespace-pre-wrap">
                {{ result.text }}
              </p>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <button
                    class="py-1 px-3 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                    @click="copyToClipboard(result.text, result.index)"
                  >
                    Copy text
                  </button>
                  <span
                    v-if="result.copied"
                    class="px-2 py-1 bg-green-600 text-white text-sm rounded"
                  >
                    Copied
                  </span>
                </div>
                <span class="text-sm text-gray-400">
                  {{ result.text.length }}/280 characters
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
