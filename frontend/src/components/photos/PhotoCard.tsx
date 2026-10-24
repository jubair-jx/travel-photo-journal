"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { Photo } from "@/lib/types";

interface PhotoCardProps {
  photo: Photo;
  onEdit: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
  onImageError: () => void;
}

export function PhotoCard({ photo, onEdit, onDelete, onImageError }: PhotoCardProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-slate-200"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs from a configurable host, so next/image's host allow-list does not fit */}
      <img
        src={photo.imageUrl}
        alt={`${photo.name}, ${photo.location}`}
        loading="lazy"
        onError={onImageError}
        className="aspect-4/3 w-full bg-slate-100 object-cover"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-semibold text-slate-900">{photo.name}</h3>
          <p className="text-sm text-slate-500">
            {photo.location} ·{" "}
            {new Date(photo.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </p>
        </div>
        {photo.summary ? (
          <p className="text-sm text-slate-700 italic">{photo.summary}</p>
        ) : (
          <p className="line-clamp-3 text-sm text-slate-600">{photo.description}</p>
        )}
        <div className="mt-auto flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={() => onEdit(photo)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            onClick={() => onDelete(photo)}
          >
            Delete
          </Button>
        </div>
      </div>
    </motion.li>
  );
}
