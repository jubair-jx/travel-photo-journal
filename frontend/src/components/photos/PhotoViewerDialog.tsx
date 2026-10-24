"use client";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { Photo } from "@/lib/types";

interface PhotoViewerDialogProps {
  photo: Photo | null;
  onClose: () => void;
  onEdit: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
  onImageError: () => void;
}

// The full-size view of one photo, opened by clicking its card.
export function PhotoViewerDialog({
  photo,
  onClose,
  onEdit,
  onDelete,
  onImageError,
}: PhotoViewerDialogProps) {
  return (
    <Dialog open={photo !== null} title={photo?.name ?? "Photo"} onClose={onClose} wide>
      {photo && (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs from a configurable host, so next/image's host allow-list does not fit */}
            <img
              src={photo.imageUrl}
              alt={`${photo.name}, ${photo.location}`}
              onError={onImageError}
              className="mx-auto max-h-[60vh] w-full object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
            <span className="flex items-center gap-1.5 text-orange-200">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
              </svg>
              {photo.location}
            </span>
            <span className="text-slate-400">
              Added {new Date(photo.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}
            </span>
          </div>

          {photo.summary && (
            <p className="rounded-2xl bg-white/5 px-4 py-3 text-slate-200 italic ring-1 ring-white/10">
              &ldquo;{photo.summary}&rdquo;
            </p>
          )}

          <p className="text-sm leading-relaxed whitespace-pre-line text-slate-300">
            {photo.description}
          </p>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => onEdit(photo)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => onDelete(photo)}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
