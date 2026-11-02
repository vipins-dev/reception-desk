import { useNavigate } from 'react-router'
import { paths } from '@/app/routes'
import { Card } from '@/components/ui'
import { normalizeLastNameQuery } from '@/domain/validation'
import { useOwnersStore } from '@/stores/ownerStore'
import { useSearchStore } from '@/stores/searchStore'
import { useToastStore } from '@/stores/toastStore'
import { OwnerForm } from './OwnerForm'

/**
 * `/owners/new`. If the receptionist searched for a name that does not exist,
 * that text is carried over into the last-name field — the usual path to here.
 */
export function NewOwnerPane() {
  const navigate = useNavigate()
  const create = useOwnersStore((s) => s.create)
  const toast = useToastStore((s) => s.push)
  const searched = useSearchStore.getState().query.trim()

  return (
    <div className="mx-auto max-w-xl p-4">
      <Card title="New owner">
        <OwnerForm
          mode="create"
          initial={searched ? { lastName: normalizeLastNameQuery(searched) } : {}}
          onCancel={() => void navigate(paths.home)}
          onSubmit={async (fields) => {
            const owner = await create(fields)
            toast(`Owner ${owner.firstName} ${owner.lastName} created`)
            void navigate(paths.owner(owner.id))
          }}
        />
      </Card>
    </div>
  )
}
