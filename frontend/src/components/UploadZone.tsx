interface UploadZoneProps {
  file: File | null;
  isDragging: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (file: File) => void;
  onSelectFile: (file: File) => void;
}

export default function UploadZone({
  file,
  isDragging,
  onDragEnter,
  onDragLeave,
  onDrop,
  onSelectFile,
}: UploadZoneProps) {
  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
        isDragging
          ? "border-accent bg-orange-50/60"
          : "border-line bg-card hover:border-accent/40"
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragEnter();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        onDragLeave();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragLeave();
        const dropped = event.dataTransfer.files[0];
        if (dropped?.name.toLowerCase().endsWith(".gpx")) {
          onDrop(dropped);
        }
      }}
    >
      <p className="text-lg font-medium text-ink">Drag &amp; Drop GPX</p>
      <p className="mt-2 text-sm text-muted">or</p>
      <label className="mt-4 inline-block cursor-pointer text-sm font-semibold text-accent transition hover:text-accent/80">
        Select GPX File
        <input
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              onSelectFile(selected);
            }
          }}
        />
      </label>
      {file && (
        <p className="mt-6 text-sm text-muted">
          Selected: <span className="font-medium text-ink">{file.name}</span>
        </p>
      )}
    </div>
  );
}
