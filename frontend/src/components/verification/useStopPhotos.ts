import { useEffect, useState } from "react";
import {
  photoCacheKey,
  photosFromOsmTags,
  resolveStopPhotos,
  type StopPhoto,
} from "../../planning/stopVerification/poiPhotos";

interface UseStopPhotosInput {
  tags: Record<string, string>;
  lat: number;
  lon: number;
  alt: string;
}

export function useStopPhotos(input: UseStopPhotosInput | null): StopPhoto[] {
  const [photos, setPhotos] = useState<StopPhoto[]>([]);

  useEffect(() => {
    if (!input) {
      setPhotos([]);
      return;
    }

    const syncPhotos = photosFromOsmTags(input.tags, input.alt, 2);
    if (syncPhotos.length > 0) {
      setPhotos(syncPhotos);
    } else {
      setPhotos([]);
    }

    let cancelled = false;
    void resolveStopPhotos(input).then((resolved) => {
      if (!cancelled) {
        setPhotos(resolved);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    input?.alt,
    input?.lat,
    input?.lon,
    input ? photoCacheKey(input.lat, input.lon, input.tags) : "",
  ]);

  return photos;
}
