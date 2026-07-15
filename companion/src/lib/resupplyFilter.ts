export type ResupplyFilter = "all" | "verified";

const STORAGE_KEY = "companion-resupply-filter";

export function readResupplyFilter(): ResupplyFilter {
  if (typeof localStorage === "undefined") {
    return "all";
  }
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "verified" ? "verified" : "all";
}

export function writeResupplyFilter(filter: ResupplyFilter): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, filter);
}
