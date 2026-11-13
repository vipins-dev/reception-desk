import { create } from 'zustand'
import type { SpeciesFilter } from '@/domain/search'

/**
 * What the receptionist typed and which species chip is on. This is UI state
 * only: it lives in a store (not in the lookup pane) so it survives switching
 * between Front Desk, All Owners and Today's Visits.
 */
interface SearchState {
  query: string
  species: SpeciesFilter
  setQuery: (query: string) => void
  setSpecies: (species: SpeciesFilter) => void
}

export const useSearchStore = create<SearchState>()((set) => ({
  query: '',
  species: 'all',
  setQuery: (query) => set({ query }),
  setSpecies: (species) => set({ species }),
}))
