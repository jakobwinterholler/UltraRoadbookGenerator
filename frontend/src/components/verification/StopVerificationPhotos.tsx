import { useStopPhotos } from "./useStopPhotos";

interface StopVerificationPhotosProps {
  tags: Record<string, string>;
  lat: number;
  lon: number;
  alt: string;
}

export default function StopVerificationPhotos({
  tags,
  lat,
  lon,
  alt,
}: StopVerificationPhotosProps) {
  const photos = useStopPhotos({ tags, lat, lon, alt });

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <div className={`grid gap-2 ${photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {photos.map((photo) => (
          <figure key={photo.url} className="overflow-hidden rounded-xl border border-line/60 bg-canvas/40">
            <img
              src={photo.url}
              alt={photo.alt}
              loading="lazy"
              className="h-32 w-full object-cover sm:h-36"
            />
            <figcaption className="px-2 py-1 text-[10px] leading-snug text-muted">
              {photo.credit}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
