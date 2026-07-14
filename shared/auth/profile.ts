import type { User } from "@supabase/supabase-js";

export function getDisplayName(user: User | null | undefined): string {
  if (!user) {
    return "Rider";
  }
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";
  if (full.trim()) {
    return full.trim();
  }
  const email = user.email ?? "";
  if (email.includes("@")) {
    return email.split("@")[0] ?? "Rider";
  }
  return "Rider";
}

export function getAvatarUrl(user: User | null | undefined): string | null {
  if (!user) {
    return null;
  }
  const meta = user.user_metadata ?? {};
  const url =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
  return url || null;
}

export function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const first = name.split(" ")[0] ?? name;
  if (hour < 12) {
    return `Good morning, ${first}`;
  }
  if (hour < 17) {
    return `Good afternoon, ${first}`;
  }
  return `Good evening, ${first}`;
}

export function getConnectedSince(user: User | null | undefined): string | null {
  if (!user?.created_at) {
    return null;
  }
  const date = new Date(user.created_at);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function getAuthProviderLabel(user: User | null | undefined): string {
  if (!user) {
    return "";
  }
  const provider =
    (typeof user.app_metadata?.provider === "string" && user.app_metadata.provider) ||
    (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers[0]) ||
    "email";
  if (provider === "google") {
    return "Google";
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
