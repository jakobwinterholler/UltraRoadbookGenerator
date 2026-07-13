export interface StopPhoto {
  url: string;
  alt: string;
  credit: string;
}

const ALLOWED_IMAGE_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
];

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some((host) => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

function commonsFileUrl(fileReference: string, width = 480): string | null {
  const trimmed = fileReference.trim();
  const match = /^(?:File|Image):(.+)$/i.exec(trimmed);
  const filename = match ? match[1] : trimmed.includes("/") ? null : trimmed;
  if (!filename) {
    return null;
  }
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
}

function photoFromTagValue(value: string, alt: string): StopPhoto | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed) && isAllowedImageUrl(trimmed)) {
    return { url: trimmed, alt, credit: "Wikimedia Commons" };
  }

  const fileUrl = commonsFileUrl(trimmed);
  if (fileUrl) {
    return { url: fileUrl, alt, credit: "Wikimedia Commons" };
  }

  return null;
}

export function photosFromOsmTags(
  tags: Record<string, string>,
  alt: string,
  max = 2,
): StopPhoto[] {
  const photos: StopPhoto[] = [];
  const seen = new Set<string>();

  function add(photo: StopPhoto | null) {
    if (!photo || seen.has(photo.url) || photos.length >= max) {
      return;
    }
    seen.add(photo.url);
    photos.push(photo);
  }

  const commonsTag = tags.wikimedia_commons?.trim();
  if (commonsTag && !commonsTag.startsWith("Category:")) {
    add(photoFromTagValue(commonsTag, alt));
  }

  const tagKeys = Object.keys(tags).sort();
  for (const key of tagKeys) {
    if (key === "image" || key.startsWith("image:") || key.startsWith("photo")) {
      add(photoFromTagValue(tags[key], alt));
    }
  }

  return photos;
}

function categoryTitle(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("Category:")) {
    return trimmed.replace(/ /g, "_");
  }
  return `Category:${trimmed.replace(/ /g, "_")}`;
}

interface WikimediaImageInfo {
  thumburl?: string;
  url?: string;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
  };
}

async function wikimediaApi<T>(params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${query.toString()}`);
  if (!response.ok) {
    throw new Error("Wikimedia request failed");
  }
  return response.json() as Promise<T>;
}

export async function fetchWikimediaCategoryPhotos(
  category: string,
  alt: string,
  max = 2,
): Promise<StopPhoto[]> {
  const payload = await wikimediaApi<{
    query?: {
      pages?: Record<
        string,
        { title?: string; imageinfo?: WikimediaImageInfo[] }
      >;
    };
  }>({
    action: "query",
    generator: "categorymembers",
    gcmtitle: categoryTitle(category),
    gcmtype: "file",
    gcmlimit: String(max),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "480",
  });

  const pages = payload.query?.pages ?? {};
  return Object.values(pages)
    .flatMap((page) => {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl ?? info?.url;
      if (!url || !isAllowedImageUrl(url)) {
        return [];
      }
      const license = info?.extmetadata?.LicenseShortName?.value?.replace(/<[^>]+>/g, "");
      return [
        {
          url,
          alt: page.title?.replace(/^File:/, "") ?? alt,
          credit: license ? `Wikimedia Commons · ${license}` : "Wikimedia Commons",
        },
      ];
    })
    .slice(0, max);
}

const photoCache = new Map<string, StopPhoto[]>();

export function photoCacheKey(lat: number, lon: number, tags: Record<string, string>): string {
  const tagFingerprint = tags.wikimedia_commons ?? tags.image ?? "";
  return `${lat.toFixed(5)}:${lon.toFixed(5)}:${tagFingerprint}`;
}

export function getCachedPhotos(key: string): StopPhoto[] | undefined {
  return photoCache.get(key);
}

export function setCachedPhotos(key: string, photos: StopPhoto[]): void {
  photoCache.set(key, photos);
}

export async function resolveStopPhotos(input: {
  tags: Record<string, string>;
  lat: number;
  lon: number;
  alt: string;
}): Promise<StopPhoto[]> {
  const cacheKey = photoCacheKey(input.lat, input.lon, input.tags);
  const cached = getCachedPhotos(cacheKey);
  if (cached) {
    return cached;
  }

  const fromTags = photosFromOsmTags(input.tags, input.alt, 2);
  if (fromTags.length >= 2) {
    setCachedPhotos(cacheKey, fromTags);
    return fromTags;
  }

  const seen = new Set(fromTags.map((photo) => photo.url));
  const merged = [...fromTags];

  const commonsCategory = input.tags.wikimedia_commons?.trim();
  if (merged.length < 2 && commonsCategory?.startsWith("Category:")) {
    try {
      for (const photo of await fetchWikimediaCategoryPhotos(commonsCategory, input.alt, 2)) {
        if (!seen.has(photo.url) && merged.length < 2) {
          seen.add(photo.url);
          merged.push(photo);
        }
      }
    } catch {
      // Optional enrichment — ignore network failures.
    }
  }

  setCachedPhotos(cacheKey, merged);
  return merged;
}
