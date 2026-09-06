import { redirect } from "next/navigation";

/** Favorit kini jadi tab di halaman Pesanan. Halaman ini hanya
    mengalihkan tautan lama agar tidak mati. */
export default function FavoritPage() {
  redirect("/pesanan?tab=favorit");
}
