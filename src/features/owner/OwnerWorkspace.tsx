import { Suspense, useEffect } from 'react'
import { Outlet, useOutletContext } from 'react-router'
import type { Owner } from '@/api/types'
import { useOwnerIdParam } from '@/app/routes'
import { Alert, Button, LoadingBlock, Panel, Skeleton } from '@/components/ui'
import { selectOwnerRecord, useOwnersStore } from '@/stores/ownerStore'
import { OwnerPanel } from './OwnerPanel'

export interface OwnerWorkspaceContext {
  owner: Owner
}

export const useOwnerContext = () => useOutletContext<OwnerWorkspaceContext>()

function OwnerSkeleton() {
  return (
    <Panel role="status" aria-label="Loading owner" className="space-y-4 p-5 lg:col-span-9">
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/4" />
    </Panel>
  )
}

/**
 * Route element for `/owners/:ownerId`. Loads the owner and lays out the two
 * working panes beside the lookup: the owner (details + pets) and, next to it,
 * whatever the nested route puts in the outlet (the open pet).
 */
export function OwnerWorkspace() {
  const ownerId = useOwnerIdParam()
  const load = useOwnersStore((s) => s.load)
  const record = useOwnersStore(selectOwnerRecord(ownerId))

  useEffect(() => {
    if (ownerId !== null) void load(ownerId)
  }, [ownerId, load])

  if (ownerId === null) return <Alert>That is not a valid owner link.</Alert>

  if (!record?.owner) {
    if (record?.status === 'error') {
      return (
        <Alert
          action={
            record.error?.isNotFound ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void load(ownerId)}>
                Retry
              </Button>
            )
          }
        >
          {record.error?.isNotFound ? `Owner #${ownerId} does not exist.` : record.error?.message}
        </Alert>
      )
    }
    return <OwnerSkeleton />
  }

  return (
    <div className="grid gap-4 lg:h-full lg:grid-cols-9">
      <OwnerPanel
        owner={record.owner}
        staleError={record.status === 'error' ? record.error : null}
        onRetry={() => void load(ownerId)}
        className="lg:col-span-4"
      />
      <div className="min-w-0 lg:col-span-5 lg:min-h-0">
        <Suspense fallback={<LoadingBlock label="Loading…" />}>
          <Outlet context={{ owner: record.owner } satisfies OwnerWorkspaceContext} />
        </Suspense>
      </div>
    </div>
  )
}
