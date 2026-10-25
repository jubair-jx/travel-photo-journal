"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PhotoImage } from "@/components/ui/PhotoImage";
import type { Photo } from "@/lib/types";

interface PhotoCardProps {
  photo: Photo;
  onOpen: (photo: Photo) => void;
  onEdit: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
  onImageError: () => void;
}

export function PhotoCard({ photo, onOpen, onEdit, onDelete, onImageError }: PhotoCardProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={() => onOpen(photo)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl bg-white/6 shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl transition-shadow hover:shadow-orange-500/10 hover:ring-white/20"
    >
      <button
        type="button"
        aria-label={`View ${photo.name}`}
        className="relative block aspect-4/3 w-full cursor-pointer overflow-hidden bg-slate-800 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-400"
      >
        <PhotoImage
          src={photo.imageUrl}
          alt={`${photo.name}, ${photo.location}`}
          onFailure={onImageError}
          className="size-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute inset-x-0 bottom-0 block bg-linear-to-t from-black/80 via-black/30 to-transparent p-4 pt-12">
          <span className="block font-display text-xl font-semibold text-white">{photo.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-orange-200">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
            {photo.location}
          </span>
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        {photo.summary ? (
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-200 ring-1 ring-violet-400/30">
              <span aria-hidden="true">✨</span> AI summary
            </span>
            <p className="text-sm text-slate-200 italic">&ldquo;{photo.summary}&rdquo;</p>
          </div>
        ) : (
          <p className="line-clamp-3 text-sm text-slate-300">{photo.description}</p>
        )}
        <p className="text-xs text-slate-500">
          {new Date(photo.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </p>
        <div className="mt-auto flex gap-2 pt-1">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(photo);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(photo);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </motion.li>
  );
}
