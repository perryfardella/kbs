import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-accent">KBS</h1>
        <p className="mt-1 text-sm text-text-muted">Karina&apos;s Bookkeeping Service</p>
      </div>
      <SignIn
        appearance={{
          theme: dark,
          variables: {
            colorBackground: "#141414",
            colorNeutral: "#f5f5f5",
            colorPrimary: "#e8d5b0",
            colorPrimaryForeground: "#0a0a0a",
            colorForeground: "#f5f5f5",
            colorInput: "#0a0a0a",
            colorInputForeground: "#f5f5f5",
            colorDanger: "#f87171",
            borderRadius: "1rem",
          },
        }}
      />
    </div>
  );
}
