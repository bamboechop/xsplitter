import { defineStore } from 'pinia'

interface SplitResult {
  text: string
  copied: boolean
  index: number
}

interface SplitHistory {
  id: string
  timestamp: number
  preview: string
  chunks: SplitResult[]
  totalChunks: number
  originalText: string
}

interface SplitterState {
  inputText: string
  splitResults: SplitResult[]
  history: SplitHistory[]
  currentPage: number
  itemsPerPage: number
  selectedHistoryId: string | null
}

export const useSplitterStore = defineStore('splitter', {
  state: (): SplitterState => ({
    inputText: '',
    splitResults: [],
    history: [],
    currentPage: 0,
    itemsPerPage: 5,
    selectedHistoryId: null
  }),

  getters: {
    characterCount: (state) => state.inputText.length,
    totalChunks: (state) => state.splitResults.length,
    
    paginatedHistory: (state) => {
      const start = state.currentPage * state.itemsPerPage
      return state.history.slice(start, start + state.itemsPerPage)
    },
    
    hasNextPage: (state) => {
      return state.history.length > (state.currentPage + 1) * state.itemsPerPage
    },
    
    hasPreviousPage: (state) => {
      return state.currentPage > 0
    }
  },

  actions: {
    setInputText(text: string) {
      this.inputText = text
    },

    clearResults() {
      this.splitResults = []
      this.inputText = ''
    },

    nextPage() {
      if (this.hasNextPage) {
        this.currentPage++
      }
    },

    previousPage() {
      if (this.hasPreviousPage) {
        this.currentPage--
      }
    },

    loadFromHistory(id: string) {
      const historyItem = this.history.find(item => item.id === id)
      if (historyItem) {
        this.splitResults = historyItem.chunks
        this.inputText = historyItem.originalText
        this.selectedHistoryId = id
      }
    },

    splitText() {
      const text = this.inputText.trim()
      
      // Don't proceed if text is empty or only whitespace
      if (!text) {
        return
      }

      this.clearResults()
      const chunks: string[] = []
      
      // First split by delimiter
      const delimiterSections = text.split('[SPLIT]').map(section => section.trim())
      
      for (const section of delimiterSections) {
        if (!section) continue // Skip empty sections
        
        let currentChunk = ''
        let sentences = section.match(/[^.!?]+[.!?]+/g) || [section]

        // Handle text that doesn't end with punctuation
        if (section.length > 0 && !/[.!?]$/.test(section)) {
          const lastPart = section.match(/[^.!?]+$/)
          if (lastPart) {
            sentences[sentences.length - 1] = lastPart[0]
          }
        }

        for (let sentence of sentences) {
          sentence = sentence.trim()
          
          // Check if adding this sentence would exceed max length
          const suffixLength = ` (${chunks.length + 1}/${Math.ceil(text.length / 200)})`.length
          
          if ((currentChunk + sentence).length + suffixLength <= 280) {
            currentChunk += (currentChunk ? ' ' : '') + sentence
          } else {
            // If current sentence would make chunk too long, try splitting by commas
            if (sentence.includes(',')) {
              const parts = sentence.split(',')
              for (const part of parts) {
                const trimmedPart = part.trim()
                if ((currentChunk + trimmedPart).length + suffixLength <= 280) {
                  currentChunk += (currentChunk ? ' ' : '') + trimmedPart
                } else {
                  // Store current chunk and start new one
                  if (currentChunk) chunks.push(currentChunk)
                  currentChunk = trimmedPart
                }
              }
            } else {
              // If we must split mid-sentence
              if (currentChunk) chunks.push(currentChunk)
              currentChunk = sentence
            }
          }

          // If current chunk is getting close to max, store it
          if (currentChunk.length >= 200) {
            chunks.push(currentChunk)
            currentChunk = ''
          }
        }

        // Add any remaining text from this section
        if (currentChunk) {
          chunks.push(currentChunk)
        }
      }

      // Create the results
      const results = chunks.map((chunk, index) => ({
        text: chunks.length > 1 
          ? `${chunk.trim()} (${index + 1}/${chunks.length})`
          : chunk.trim(),
        copied: false,
        index: index + 1
      }))

      this.splitResults = results

      // Add to history
      const historyItem: SplitHistory = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        preview: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        chunks: results,
        totalChunks: results.length,
        originalText: text
      }

      this.history = [historyItem, ...this.history]
      this.selectedHistoryId = historyItem.id  // Set the new item as selected
    },

    markAsCopied(index: number) {
      const result = this.splitResults.find(r => r.index === index)
      if (result) {
        result.copied = true
      }
    },

    removeFromHistory(id: string) {
      const deletedItem = this.history.find(item => item.id === id)
      this.history = this.history.filter(item => item.id !== id)
      
      const maxPage = Math.ceil(this.history.length / this.itemsPerPage) - 1
      if (this.currentPage > maxPage) {
        this.currentPage = Math.max(0, maxPage)
      }

      if (id === this.selectedHistoryId) {
        this.splitResults = []
        this.inputText = ''
        this.selectedHistoryId = null
      }
    }
  },

  persist: {
    paths: ['history']  // Only persist the history, not the selection or current split
  }
}) 