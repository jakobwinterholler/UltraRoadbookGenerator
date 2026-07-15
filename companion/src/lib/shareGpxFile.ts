export async function shareGpxFile(bytes: Uint8Array, filename: string): Promise<void> {
  const blob = new Blob([bytes], { type: "application/gpx+xml" });
  const file = new File([blob], filename, { type: "application/gpx+xml" });

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: filename,
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
