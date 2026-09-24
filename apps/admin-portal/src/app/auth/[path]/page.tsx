import { AuthView } from "@neondatabase/auth-ui";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return <AuthView path={path} />;
}
