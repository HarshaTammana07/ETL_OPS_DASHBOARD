import clsx from "clsx";
import bhgLogo from "../assets/BHG2025_Logo_Bkrnd_RGB@2x.png";

interface AppLogoProps {
  /** full = entire logo; mark = icon portion only (sidebar collapsed) */
  variant?: "full" | "mark";
  className?: string;
}

export function AppLogo({ variant = "full", className }: AppLogoProps) {
  if (variant === "mark") {
    return (
      <div
        className={clsx(
          "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white",
          className,
        )}
        title="Behavioral Health Group"
      >
        <img
          src={bhgLogo}
          alt="BHG"
          className="h-9 w-auto max-w-none -translate-x-0 object-left object-cover"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex shrink-0 items-center rounded-md bg-white px-2 py-1",
        className,
      )}
      title="Behavioral Health Group"
    >
      <img
        src={bhgLogo}
        alt="Behavioral Health Group"
        className="h-8 w-auto max-w-[180px] object-contain"
        draggable={false}
      />
    </div>
  );
}
