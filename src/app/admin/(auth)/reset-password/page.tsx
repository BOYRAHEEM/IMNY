import { PasswordForm } from "./password-form";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/admin/reset-password">) {
  const welcome = (await searchParams).welcome === "1";
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold tracking-[-0.04em]">{welcome ? "Welcome — set your password" : "Choose a new password"}</h1>
      {welcome && <p className="mb-6 text-sm text-muted">You&apos;ll use this with your email to sign in to the dashboard.</p>}
      <PasswordForm />
    </>
  );
}
