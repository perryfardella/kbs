import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-accent">KBS</h1>
        <p className="mt-1 text-sm text-text-muted">Karina&apos;s Bookkeeping Service</p>
      </div>
      <SignIn
        appearance={{
          variables: {
            colorBackground: "#ffffff",
            colorNeutral: "#1c1917",
            colorPrimary: "#8f6824",
            colorPrimaryForeground: "#ffffff",
            colorForeground: "#1c1917",
            colorInput: "#f7f5f0",
            colorInputForeground: "#1c1917",
            colorDanger: "#b91c1c",
            borderRadius: "1rem",
          },
        }}
      />
    </div>
  );
}
