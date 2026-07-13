interface AuthScreenProps {
  message?: string;
  variant?: "light" | "dark";
}

export function SessionRestoreScreen({
  message = "Restoring your session…",
  variant = "light",
}: AuthScreenProps) {
  const dark = variant === "dark";
  return (
    <div
      className={`flex h-full min-h-[320px] flex-col items-center justify-center px-6 ${
        dark ? "bg-[#0a0a0a] text-white" : "bg-canvas text-ink"
      }`}
    >
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <div
          className={`h-10 w-10 animate-spin rounded-full border-2 border-t-transparent ${
            dark ? "border-white/30 border-t-white" : "border-line border-t-accent"
          }`}
        />
        <p className={`text-sm font-medium ${dark ? "text-white/70" : "text-muted"}`}>{message}</p>
      </div>
    </div>
  );
}

export function SigningInScreen({
  message = "Signing you in…",
  variant = "light",
}: AuthScreenProps) {
  const dark = variant === "dark";
  return (
    <div
      className={`flex h-full min-h-[320px] flex-col items-center justify-center px-6 ${
        dark ? "bg-[#0a0a0a] text-white" : "bg-canvas text-ink"
      }`}
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative">
          <div
            className={`h-14 w-14 animate-spin rounded-full border-[3px] border-t-transparent ${
              dark ? "border-white/20 border-t-emerald-400" : "border-line border-t-accent"
            }`}
          />
          <div
            className={`absolute inset-2 rounded-full ${
              dark ? "bg-emerald-400/10" : "bg-accent/10"
            }`}
          />
        </div>
        <div className="text-center">
          <p className={`text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>
            {message}
          </p>
          <p className={`mt-2 text-sm ${dark ? "text-white/50" : "text-muted"}`}>
            This only takes a moment
          </p>
        </div>
      </div>
    </div>
  );
}

export function Avatar({
  name,
  imageUrl,
  size = "lg",
  variant = "light",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "md" | "lg" | "xl";
  variant?: "light" | "dark";
}) {
  const dims =
    size === "xl" ? "h-24 w-24 text-2xl" : size === "lg" ? "h-16 w-16 text-lg" : "h-10 w-10 text-sm";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${dims} rounded-full object-cover ring-2 ${
          variant === "dark" ? "ring-white/10" : "ring-line"
        }`}
      />
    );
  }

  return (
    <div
      className={`${dims} flex items-center justify-center rounded-full font-semibold ${
        variant === "dark"
          ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/20 text-emerald-100 ring-2 ring-white/10"
          : "bg-gradient-to-br from-accent/15 to-orange-600/10 text-accent ring-2 ring-line"
      }`}
    >
      {initials || "?"}
    </div>
  );
}
