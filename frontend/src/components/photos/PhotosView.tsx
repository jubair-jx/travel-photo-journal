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
import { PhotoViewerDialog } from "./PhotoViewerDialog";

function SkeletonGrid() {
  return (
    <ul aria-label="Loading photos" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <li
          key={index}
          className="animate-pulse overflow-hidden rounded-3xl bg-white/6 ring-1 ring-white/10"
        >
          <div className="aspect-4/3 bg-white/10" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 rounded bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="h-3 w-full rounded bg-white/10" />
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
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Photo | undefined>();
  const [deleting, setDeleting] = useState<Photo | null>(null);
  const lastRefresh = useRef(0);

  const refreshLinks = useCallback(() => {
    if (Date.now() - lastRefresh.current < REFRESH_COOLDOWN_MS) return;
    lastRefresh.current = Date.now();
    void refetch();
  }, [refetch]);

  // Photos can disappear from under a page (deleted in another tab, or the last one on this page),
  // leaving it empty while earlier pages still have content. Step back to the last real page.
  // Adjusting state while rendering is the supported way to derive it from a query result.
  if (data && data.items.length === 0 && page > 1) setPage(Math.max(1, data.totalPages));

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-widest text-orange-300 uppercase">
            Your journal
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Places &amp; <span className="italic">memories</span>
          </h1>
          {data && data.total > 0 && (
            <p className="mt-2 text-sm text-slate-400">
              {data.total} {data.total === 1 ? "photo" : "photos"}
            </p>
          )}
        </div>
        <Button onClick={() => setAdding(true)}>
          <span aria-hidden="true" className="text-lg leading-none">
            +
          </span>
          Add photo
        </Button>
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
        <Card className="py-16 text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400/20 to-pink-500/20 ring-1 ring-white/10">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="size-8 text-orange-300"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <circle cx="12" cy="12" r="3.5" />
              <path d="M8 5l1.2-1.8h5.6L16 5" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-semibold text-white">No photos yet</h2>
          <p className="mx-auto mt-2 mb-7 max-w-sm text-sm text-slate-300">
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
                  onOpen={setViewing}
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
              <span className="text-sm text-slate-400">
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

      <PhotoViewerDialog
        photo={viewing}
        onClose={() => setViewing(null)}
        onEdit={(photo) => {
          setViewing(null);
          setEditing(photo);
        }}
        onDelete={(photo) => {
          setViewing(null);
          setDeleting(photo);
        }}
        onImageError={refreshLinks}
      />
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
