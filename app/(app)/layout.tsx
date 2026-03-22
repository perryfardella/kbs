import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const token = await getToken({ template: "convex" });
  const settings = await fetchQuery(
    api.settings.get,
    {},
    { token: token ?? undefined }
  );
  if (!settings) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
