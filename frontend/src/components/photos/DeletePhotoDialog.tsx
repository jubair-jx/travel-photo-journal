"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { errorMessage } from "@/lib/errors";
import type { Photo } from "@/lib/types";
import { useDeletePhotoMutation } from "@/store/api";

export function DeletePhotoDialog({
  photo,
  onClose,
  onDeleted,
}: {
  photo: Photo | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [deletePhoto, { isLoading }] = useDeletePhotoMutation();
  const [failure, setFailure] = useState<string | null>(null);

  const close = () => {
    setFailure(null);
    onClose();
  };

  const confirm = async () => {
    if (!photo) return;
    const result = await deletePhoto(photo.id);
    if ("error" in result) {
      setFailure(errorMessage(result.error));
      return;
    }
    toast.success("Photo deleted");
    onDeleted?.();
    close();
  };

  return (
    <Dialog open={photo !== null} title="Delete this photo?" onClose={close}>
      <div className="space-y-4">
        {failure && <Alert>{failure}</Alert>}
        <p className="text-sm text-slate-300">
          <strong className="text-white">{photo?.name}</strong> and its image will be permanently
          removed. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} loading={isLoading}>
            Delete
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
