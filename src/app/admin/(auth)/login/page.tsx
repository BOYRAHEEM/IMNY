import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  forbidden: "This account doesn't have access to the dashboard.",
  link: "That link has expired or was already used. Request a new one.",
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next, error } = await searchParams;

  const user = await getCurrentUser();
  if (user && (user.role === "admin" || user.role === "staff")) redirect("/admin");

  return (
    <>
      <h1 className="mb-6 text-lg font-medium">Sign in to your dashboard</h1>
      <LoginForm
        next={typeof next === "string" ? next : undefined}
        notice={typeof error === "string" ? NOTICES[error] : undefined}
      />
    </>
  );
}
