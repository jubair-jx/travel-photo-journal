"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { errorMessage } from "@/lib/errors";
import type { Photo } from "@/lib/types";
import { useListPhotosQuery } from "@/store/api";
import { DeletePhotoDialog } from "./DeletePhotoDialog";
import { PhotoCard } from "./PhotoCard";
import { PhotoFormDialog } from "./PhotoFormDialog";

function SkeletonGrid() {
  return (
    <ul aria-label="Loading photos" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <li
          key={index}
          className="animate-pulse overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
        >
          <div className="aspect-4/3 bg-slate-200" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="h-3 w-full rounded bg-slate-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Signed image links expire (15 minutes by default). When one does, the image fails to load and the
// list is fetched again for fresh links, at most once every 30 seconds.
const REFRESH_COOLDOWN_MS = 30_000;

export function PhotosView() {
  const [page, setPage] = useState(1);
  const { data, error, isLoading, isFetching, refetch } = useListPhotosQuery({ page });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Photo | undefined>();
  const [deleting, setDeleting] = useState<Photo | null>(null);
  const lastRefresh = useRef(0);

  const refreshLinks = useCallback(() => {
    if (Date.now() - lastRefresh.current < REFRESH_COOLDOWN_MS) return;
    lastRefresh.current = Date.now();
    void refetch();
  }, [refetch]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your photos</h1>
          {data && data.total > 0 && (
            <p className="text-sm text-slate-500">
              {data.total} {data.total === 1 ? "photo" : "photos"}
            </p>
          )}
        </div>
        <Button onClick={() => setAdding(true)}>Add photo</Button>
      </div>

      {isLoading && <SkeletonGrid />}

      {error && !data && (
        <Card className="space-y-4">
          <Alert>{errorMessage(error)}</Alert>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </Card>
      )}

      {data && data.items.length === 0 && page === 1 && (
        <Card className="py-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No photos yet</h2>
          <p className="mx-auto mt-1 mb-6 max-w-sm text-sm text-slate-600">
            Add your first travel photo with a note about where it was taken. Only you can see it.
          </p>
          <Button onClick={() => setAdding(true)}>Add your first photo</Button>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <>
          <ul
            aria-label="Photos"
            aria-busy={isFetching}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {data.items.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                  onImageError={refreshLinks}
                />
              ))}
            </AnimatePresence>
          </ul>
          {data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      <PhotoFormDialog open={adding} onClose={() => setAdding(false)} />
      <PhotoFormDialog
        open={editing !== undefined}
        photo={editing}
        onClose={() => setEditing(undefined)}
      />
      <DeletePhotoDialog
        photo={deleting}
        onClose={() => setDeleting(null)}
        // Removing the last photo on a page would leave it empty, so step back a page.
        onDeleted={() => {
          if (data?.items.length === 1 && page > 1) setPage(page - 1);
        }}
      />
    </div>
  );
}
