import type { Metadata } from "next";
import { PhotosView } from "@/components/photos/PhotosView";

export const metadata: Metadata = { title: "Your photos" };

export default function PhotosPage() {
  return <PhotosView />;
}
