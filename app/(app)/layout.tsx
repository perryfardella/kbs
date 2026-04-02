import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { FAB } from "@/components/FAB";
import { OnboardingGuard } from "@/components/OnboardingGuard";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg" data-vaul-drawer-wrapper>
      <OnboardingGuard>
        <main className="flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+72px)]">
          {children}
        </main>
        <BottomNav />
        <FAB />
      </OnboardingGuard>
    </div>
  );
}
