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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white/6 shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl transition-shadow hover:shadow-orange-500/10 hover:ring-white/20"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs from a configurable host, so next/image's host allow-list does not fit */}
        <img
          src={photo.imageUrl}
          alt={`${photo.name}, ${photo.location}`}
          loading="lazy"
          onError={onImageError}
          className="size-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent p-4 pt-12">
          <h3 className="font-display text-xl font-semibold text-white">{photo.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-orange-200">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
            {photo.location}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        {photo.summary ? (
          <p className="text-sm text-slate-200 italic">&ldquo;{photo.summary}&rdquo;</p>
        ) : (
          <p className="line-clamp-3 text-sm text-slate-300">{photo.description}</p>
        )}
        <p className="text-xs text-slate-500">
          {new Date(photo.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </p>
        <div className="mt-auto flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={() => onEdit(photo)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => onDelete(photo)}
          >
            Delete
          </Button>
        </div>
      </div>
    </motion.li>
  );
}
