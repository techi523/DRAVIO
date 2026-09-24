import { AccountView } from "@neondatabase/auth-ui";
import { accountViewPaths } from "@neondatabase/auth-ui/server";

export function generateStaticParams() {
  return Object.values(accountViewPaths).map((path) => ({ path }));
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return <AccountView path={path} />;
}
