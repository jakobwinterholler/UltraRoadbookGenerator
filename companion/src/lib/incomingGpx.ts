type IncomingGpxListener = (file: File) => void;

let listener: IncomingGpxListener | null = null;
let pendingFile: File | null = null;

export function onIncomingGpxFile(next: IncomingGpxListener | null): void {
  listener = next;
  if (listener && pendingFile) {
    listener(pendingFile);
    pendingFile = null;
  }
}

function queueIncomingFile(file: File): void {
  if (!file.name.toLowerCase().endsWith(".gpx")) {
    return;
  }
  if (listener) {
    listener(file);
    return;
  }
  pendingFile = file;
}

export function registerLaunchQueueConsumer(): void {
  if (typeof window === "undefined") {
    return;
  }
  const launchQueue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
  if (!launchQueue?.setConsumer) {
    return;
  }
  launchQueue.setConsumer(async (params: LaunchParams) => {
    const files = params.files ?? [];
    if (files.length === 0) {
      return;
    }
    const handle = files[0];
    const file = await handle.getFile();
    queueIncomingFile(file);
  });
}

export async function readSharedGpxFromUrl(): Promise<File | null> {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const importFlag = params.get("import");
  if (importFlag !== "gpx") {
    return null;
  }
  return null;
}

export function acceptGpxFile(file: File | null | undefined): boolean {
  if (!file) {
    return false;
  }
  const nameOk = file.name.toLowerCase().endsWith(".gpx");
  const typeOk =
    !file.type ||
    file.type === "application/gpx+xml" ||
    file.type === "application/xml" ||
    file.type === "text/xml" ||
    file.type === "application/octet-stream";
  return nameOk && typeOk;
}

export function queueIncomingGpxFile(file: File): void {
  if (!acceptGpxFile(file)) {
    return;
  }
  queueIncomingFile(file);
}

interface FileSystemFileHandle extends FileSystemHandle {
  getFile: () => Promise<File>;
}

interface LaunchParams {
  files?: FileSystemFileHandle[];
}

interface LaunchQueue {
  setConsumer: (consumer: (params: LaunchParams) => void | Promise<void>) => void;
}
