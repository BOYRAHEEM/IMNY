import { PageHeader } from "@/components/admin/page-header";
import { emptyProduct } from "@/components/admin/product-editor/model";
import { ProductEditor } from "@/components/admin/product-editor/product-editor";
import { requireStaffPage } from "@/lib/auth";
import { getCategoryOptions } from "../queries";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const user = await requireStaffPage();
  const categories = await getCategoryOptions();

  return (
    <>
      <PageHeader title="Add product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductEditor initial={emptyProduct()} categories={categories} isAdmin={user.role === "admin"} />
    </>
  );
}
