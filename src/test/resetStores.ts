import { useOwnersStore } from '@/stores/ownerStore'
import { useDirectoryStore } from '@/stores/directoryStore'
import { usePetTypeStore } from '@/stores/petTypeStore'
import { useSearchStore } from '@/stores/searchStore'
import { useToastStore } from '@/stores/toastStore'

/** Stores are module singletons; wipe them between tests so nothing leaks. */
export function resetStores(): void {
  useOwnersStore.setState(useOwnersStore.getInitialState(), true)
  usePetTypeStore.setState(usePetTypeStore.getInitialState(), true)
  useDirectoryStore.setState(useDirectoryStore.getInitialState(), true)
  useSearchStore.setState(useSearchStore.getInitialState(), true)
  useToastStore.setState(useToastStore.getInitialState(), true)
}
