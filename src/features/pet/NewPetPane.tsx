import { useNavigate } from 'react-router'
import { paths } from '@/app/routes'
import { Card } from '@/components/ui'
import { useOwnersStore } from '@/stores/ownerStore'
import { useToastStore } from '@/stores/toastStore'
import { useOwnerContext } from '../owner/OwnerWorkspace'
import { PetForm } from './PetForm'

/** Route `/owners/:ownerId/pets/new`. On success it jumps straight to the new pet. */
export function NewPetPane() {
  const { owner } = useOwnerContext()
  const navigate = useNavigate()
  const addPet = useOwnersStore((s) => s.addPet)
  const toast = useToastStore((s) => s.push)

  return (
    <Card title={`New pet for ${owner.firstName} ${owner.lastName}`}>
      <PetForm
        mode="create"
        onCancel={() => void navigate(paths.owner(owner.id))}
        onSubmit={async (fields) => {
          const pet = await addPet(owner.id, fields)
          toast(`${pet.name} added`)
          void navigate(paths.pet(owner.id, pet.id))
        }}
      />
    </Card>
  )
}
