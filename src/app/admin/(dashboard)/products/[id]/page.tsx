import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import { fromDb } from "@/components/admin/product-editor/model";
import { ProductEditor } from "@/components/admin/product-editor/product-editor";
import { requireStaffPage } from "@/lib/auth";
import { catalogImageUrl } from "@/lib/images";
import { getCategoryOptions, getProductForEditor } from "../queries";

export const metadata = { title: "Edit product" };

const NOTICES: Record<string, string> = {
  active: "Saved. The product is live in your store.",
  draft: "Saved as a draft.",
  archived: "Saved.",
};

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const user = await requireStaffPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [product, categories, sp] = await Promise.all([getProductForEditor(id), getCategoryOptions(), searchParams]);
  if (!product) notFound();

  const saved = typeof sp.saved === "string" ? NOTICES[sp.saved] : undefined;

  return (
    <>
      <PageHeader title={product.name} back={{ href: "/admin/products", label: "Products" }} />
      <ProductEditor
        // Remount with fresh server data after every save.
        key={product.updated_at}
        initial={fromDb(product, (path) => catalogImageUrl(path)!)}
        categories={categories}
        isAdmin={user.role === "admin"}
        notice={saved}
      />
    </>
  );
}
