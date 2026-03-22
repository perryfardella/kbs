import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { BottomNav } from "@/components/BottomNav";
import { FAB } from "@/components/FAB";

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

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+72px)]">
        {children}
      </main>
      <BottomNav />
      <FAB />
    </div>
  );
}
