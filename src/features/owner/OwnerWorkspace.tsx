import { Suspense, useEffect } from 'react'
import { Outlet, useOutletContext } from 'react-router'
import type { Owner } from '@/api/types'
import { useOwnerIdParam } from '@/app/routes'
import { Alert, Button, LoadingBlock } from '@/components/ui'
import { selectOwnerRecord, useOwnersStore } from '@/stores/ownerStore'
import { OwnerPanel } from './OwnerPanel'

export interface OwnerWorkspaceContext {
  owner: Owner
}

export const useOwnerContext = () => useOutletContext<OwnerWorkspaceContext>()

/**
 * Route element for `/owners/:ownerId`. Loads the owner and lays out the two
 * working columns: the owner (details + pets) and, beside it, whatever the
 * nested route puts in the outlet (a pet, or the "add pet" form).
 */
export function OwnerWorkspace() {
  const ownerId = useOwnerIdParam()
  const load = useOwnersStore((s) => s.load)
  const record = useOwnersStore(selectOwnerRecord(ownerId))

  useEffect(() => {
    if (ownerId !== null) void load(ownerId)
  }, [ownerId, load])

  if (ownerId === null) {
    return (
      <div className="p-6">
        <Alert>That is not a valid owner link.</Alert>
      </div>
    )
  }

  if (!record?.owner) {
    if (record?.status === 'error') {
      return (
        <div className="p-6">
          <Alert
            action={
              record.error?.isNotFound ? undefined : (
                <Button variant="secondary" onClick={() => void load(ownerId)}>
                  Retry
                </Button>
              )
            }
          >
            {record.error?.isNotFound ? `Owner #${ownerId} does not exist.` : record.error?.message}
          </Alert>
        </div>
      )
    }
    return <LoadingBlock label="Loading owner…" />
  }

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
      <OwnerPanel owner={record.owner} staleError={record.status === 'error' ? record.error : null} onRetry={() => void load(ownerId)} />
      <div className="min-w-0">
        <Suspense fallback={<LoadingBlock label="Loading…" />}>
          <Outlet context={{ owner: record.owner } satisfies OwnerWorkspaceContext} />
        </Suspense>
      </div>
    </div>
  )
}
