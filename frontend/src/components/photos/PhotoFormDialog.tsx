"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { LocationField } from "@/components/ui/LocationField";
import { applyFieldIssues, isApiError } from "@/lib/errors";
import { photoFieldsSchema, validateImage, type PhotoFieldValues } from "@/lib/schemas";
import type { Photo } from "@/lib/types";
import { shrinkImage } from "@/lib/image";
import {
  useCreatePhotoMutation,
  useDescribePhotoMutation,
  useUpdatePhotoMutation,
} from "@/store/api";

interface PhotoFormDialogProps {
  open: boolean;
  // Present when editing; absent when adding.
  photo?: Photo | undefined;
  onClose: () => void;
}

const IMAGE_ERROR_CODES = new Set(["PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE"]);

function PhotoForm({ photo, onClose }: Omit<PhotoFormDialogProps, "open">) {
  const editing = photo !== undefined;
  const [createPhoto, creating] = useCreatePhotoMutation();
  const [updatePhoto, updating] = useUpdatePhotoMutation();
  const [describePhoto, describing] = useDescribePhotoMutation();
  const [file, setFile] = useState<File | undefined>();
  const [imageError, setImageError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    control,
    getValues,
    setValue,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PhotoFieldValues>({
    resolver: zodResolver(photoFieldsSchema),
    defaultValues: {
      name: photo?.name ?? "",
      location: photo?.location ?? "",
      description: photo?.description ?? "",
    },
  });

  // A local URL for previewing the chosen file, released when the choice changes or the form closes.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const submit = async (values: PhotoFieldValues) => {
    const problem = validateImage(file, !editing);
    setImageError(problem);
    if (problem) return;
    setFailure(null);

    const body = new FormData();
    body.set("name", values.name);
    body.set("location", values.location);
    body.set("description", values.description);
    if (file) body.set("image", file);

    const result = editing ? await updatePhoto({ id: photo.id, body }) : await createPhoto(body);

    if ("data" in result) {
      toast.success(editing ? "Photo updated" : "Photo added");
      onClose();
      return;
    }

    const error = result.error;
    if (!isApiError(error)) {
      setFailure("Something went wrong. Please try again.");
    } else if (IMAGE_ERROR_CODES.has(error.code)) {
      setImageError(error.message);
    } else if (error.details?.some((issue) => issue.path === "image")) {
      setImageError(error.details.find((issue) => issue.path === "image")?.message);
    } else if (!applyFieldIssues(error, setError, ["name", "location", "description"])) {
      setFailure(error.message);
    }
  };

  const shownImage = preview ?? photo?.imageUrl;
  const description = useWatch({ control, name: "description" });
  const hasDescription = description.trim().length > 0;

  // Drafts the description from the chosen picture. The user reads and edits it before saving.
  const writeWithAi = async () => {
    if (!file) return;
    try {
      const body = new FormData();
      body.set("image", await shrinkImage(file));
      const { name, location } = getValues();
      if (name.trim()) body.set("name", name.trim());
      if (location.trim()) body.set("location", location.trim());

      const result = await describePhoto(body);
      if ("error" in result) {
        toast.error(
          isApiError(result.error) && result.error.code === "AI_UNAVAILABLE"
            ? "AI descriptions are not available right now. You can write it yourself."
            : "Could not write a description. Try again, or write it yourself.",
        );
        return;
      }
      setValue("description", result.data.description, { shouldValidate: true, shouldDirty: true });
      toast.success("Draft ready. Edit it however you like.");
    } catch {
      toast.error("Could not read that image. You can write the description yourself.");
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      {failure && <Alert>{failure}</Alert>}
      <TextField label="Name" error={errors.name?.message} {...register("name")} />
      <Controller
        control={control}
        name="location"
        render={({ field }) => (
          <LocationField
            label="Location"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.location?.message}
          />
        )}
      />
      <TextAreaField
        label="Description"
        rows={4}
        hint="A short AI summary is generated from this when you save."
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-orange-500/10 px-4 py-3 ring-1 ring-white/10">
        <span aria-hidden="true" className="text-lg">
          ✨
        </span>
        <p className="min-w-0 flex-1 text-sm text-slate-300">
          {file
            ? "Let AI look at your photo and draft the description."
            : "Choose an image below, then let AI draft the description."}
        </p>
        <Button
          variant="secondary"
          disabled={!file}
          loading={describing.isLoading}
          onClick={() => void writeWithAi()}
        >
          {hasDescription ? "Rewrite with AI" : "Write with AI"}
        </Button>
      </div>
      <div>
        <label htmlFor="photo-image" className="mb-1 block text-sm font-medium text-slate-200">
          Image
        </label>
        {shownImage && (
          // eslint-disable-next-line @next/next/no-img-element -- local preview or signed URL
          <img
            src={shownImage}
            alt="Selected photo preview"
            className="mb-2 max-h-48 rounded-lg object-cover"
          />
        )}
        <input
          id="photo-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={imageError ? true : undefined}
          aria-describedby={imageError ? "photo-image-error" : undefined}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            setFile(chosen);
            setImageError(validateImage(chosen, !editing));
          }}
          className="block w-full text-sm text-slate-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-200 hover:file:bg-white/20"
        />
        {editing && !imageError && (
          <p className="mt-1 text-xs text-slate-400">Leave empty to keep the current image.</p>
        )}
        {!editing && !imageError && (
          <p className="mt-1 text-xs text-slate-400">JPEG, PNG or WebP, up to 10 MB.</p>
        )}
        {imageError && (
          <p id="photo-image-error" role="alert" className="mt-1 text-sm text-red-400">
            {imageError}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={creating.isLoading || updating.isLoading}>
          {editing ? "Save changes" : "Add photo"}
        </Button>
      </div>
    </form>
  );
}

export function PhotoFormDialog({ open, photo, onClose }: PhotoFormDialogProps) {
  return (
    <Dialog open={open} title={photo ? "Edit photo" : "Add a photo"} onClose={onClose}>
      <PhotoForm photo={photo} onClose={onClose} />
    </Dialog>
  );
}
