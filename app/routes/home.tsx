import { useCallback, useMemo, useState } from "react";
import type { Route } from "./+types/home";

type ImageEntry = {
  name: string;
  handle: FileSystemFileHandle;
  size: number;
  type: string;
  lastModified: number;
};

type ConversionDirection = "png-to-webp" | "webp-to-png";

const SUPPORTED_MIME_TYPES = new Set(["image/png", "image/webp"]);

const DIRECTION_CONFIG: Record<
  ConversionDirection,
  { sourceExt: string; targetExt: string; mime: string; label: string }
> = {
  "png-to-webp": {
    sourceExt: ".png",
    targetExt: ".webp",
    mime: "image/webp",
    label: "PNG → WebP",
  },
  "webp-to-png": {
    sourceExt: ".webp",
    targetExt: ".png",
    mime: "image/png",
    label: "WebP → PNG",
  },
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FS WebP Converter" },
    {
      name: "description",
      content:
        "File System Access API と Canvas で PNG / WebP を相互変換するローカルツール。",
    },
  ];
}

export default function Home({}: Route.ComponentProps) {
  const [directoryHandle, setDirectoryHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const canUseFsApi =
    typeof window !== "undefined" && "showDirectoryPicker" in window;

  const pngCount = useMemo(
    () =>
      images.filter((image) => hasExtension(image.name, ".png")).length,
    [images],
  );

  const webpCount = useMemo(
    () =>
      images.filter((image) => hasExtension(image.name, ".webp")).length,
    [images],
  );

  const appendLog = useCallback((entry: string) => {
    setLogs((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  const refreshDirectory = useCallback(
    async (incoming?: FileSystemDirectoryHandle) => {
      const handle = incoming ?? directoryHandle;
      if (!handle) return;

      setIsScanning(true);
      setStatus("ディレクトリを読み込み中...");

      try {
        const granted = await ensurePermission(handle, "read");
        if (!granted) {
          setStatus("読み取り権限を付与してください。");
          return;
        }

        const items = await collectImageEntries(handle);
        setImages(items);
        setStatus(
          items.length
            ? `読み込み完了 (${items.length} 件)`
            : "変換できるファイルが見つかりませんでした。",
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "ディレクトリの読み込みに失敗しました。";
        setStatus(message);
      } finally {
        setIsScanning(false);
      }
    },
    [directoryHandle],
  );

  const handleDirectoryPick = useCallback(async () => {
    if (!canUseFsApi) return;
    const picker = window.showDirectoryPicker;
    if (!picker) return;

    try {
      const handle = await picker({
        mode: "readwrite",
      });
      setDirectoryHandle(handle);
      setLogs([]);
      await refreshDirectory(handle);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const message =
        error instanceof Error ? error.message : "ディレクトリの選択に失敗しました。";
      setStatus(message);
    }
  }, [canUseFsApi, refreshDirectory]);

  const handleConversion = useCallback(
    async (direction: ConversionDirection) => {
      if (!directoryHandle) return;

      const config = DIRECTION_CONFIG[direction];
      const targets = images.filter((file) =>
        hasExtension(file.name, config.sourceExt),
      );

      if (!targets.length) {
        setStatus("対象ファイルが見つかりませんでした。");
        return;
      }

      const granted = await ensurePermission(directoryHandle, "readwrite");
      if (!granted) {
        setStatus("書き込み権限を付与してください。");
        return;
      }

      setIsConverting(true);
      setStatus(`${config.label} を実行中 (${targets.length} 件)`);

      for (const candidate of targets) {
        try {
          setStatus(`変換中: ${candidate.name}`);
          const file = await candidate.handle.getFile();
          const blob = await convertWithCanvas(file, config.mime);
          const newName = replaceExtension(candidate.name, config.targetExt);
          const newHandle = await directoryHandle.getFileHandle(newName, {
            create: true,
          });
          const writable = await newHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          appendLog(
            `✔ ${candidate.name} → ${newName} (${formatBytes(blob.size)})`,
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "このファイルの変換に失敗しました。";
          appendLog(`✖ ${candidate.name}: ${message}`);
        }
      }

      setStatus("変換が完了しました。");
      setIsConverting(false);
      await refreshDirectory();
    },
    [appendLog, directoryHandle, images, refreshDirectory],
  );

  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            File System Access + Canvas
          </p>
          <h1 className="text-3xl font-semibold leading-tight">
            ローカルPNG/WebPコンバーター
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-300">
            ブラウザだけでディレクトリ内の画像を読み込み、Canvas で PNG と WebP
            を相互変換します。データはローカルから出ません。
          </p>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDirectoryPick}
              disabled={!canUseFsApi || isScanning || isConverting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              ディレクトリを選択
            </button>
            {directoryHandle && (
              <button
                type="button"
                onClick={() => refreshDirectory()}
                disabled={isScanning || isConverting}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200"
              >
                再スキャン
              </button>
            )}
          </div>

          {!canUseFsApi && (
            <p className="mt-4 text-sm text-red-500">
              File System Access API をサポートする Chromium 系ブラウザでご利用ください。
            </p>
          )}

          {directoryHandle && (
            <dl className="mt-4 grid gap-2 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <dt className="font-medium">選択中のディレクトリ</dt>
                <dd className="font-mono">{directoryHandle.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium">PNG ファイル</dt>
                <dd>{pngCount} 件</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium">WebP ファイル</dt>
                <dd>{webpCount} 件</dd>
              </div>
            </dl>
          )}

          {status && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{status}</p>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <h2 className="text-lg font-semibold">変換アクション</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Canvas に描画して `toBlob()` した結果を書き戻します。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleConversion("png-to-webp")}
                disabled={
                  !directoryHandle || pngCount === 0 || isScanning || isConverting
                }
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                PNG → WebP
              </button>
              <button
                type="button"
                onClick={() => handleConversion("webp-to-png")}
                disabled={
                  !directoryHandle || webpCount === 0 || isScanning || isConverting
                }
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-purple-300"
              >
                WebP → PNG
              </button>
            </div>
            {isConverting && (
              <p className="mt-4 text-sm text-amber-600">
                大きなファイルは時間がかかる場合があります。そのままお待ちください。
              </p>
            )}
            {!!logs.length && (
              <ul className="mt-6 space-y-1 text-sm font-mono text-gray-700 dark:text-gray-200">
                {logs.map((log, index) => (
                  <li key={`${log}-${index}`}>{log}</li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <h2 className="text-lg font-semibold">変換対象ファイル</h2>
            {images.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                ディレクトリを選択すると PNG と WebP ファイルの一覧が表示されます。
              </p>
            ) : (
              <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                        ファイル名
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                        種類
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                        サイズ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {images.map((image) => (
                      <tr key={image.name}>
                        <td className="px-3 py-2 font-mono text-xs">{image.name}</td>
                        <td className="px-3 py-2">{image.type || "N/A"}</td>
                        <td className="px-3 py-2 text-right">{formatBytes(image.size)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}

function hasExtension(name: string, extension: string) {
  return name.toLowerCase().endsWith(extension);
}

function replaceExtension(fileName: string, nextExtension: string) {
  const index = fileName.lastIndexOf(".");
  if (index === -1) {
    return `${fileName}${nextExtension}`;
  }
  return `${fileName.slice(0, index)}${nextExtension}`;
}

async function collectImageEntries(handle: FileSystemDirectoryHandle) {
  const result: ImageEntry[] = [];
  const iterable = (handle as DirectoryHandleWithEntries).entries();

  for await (const [name, entry] of iterable) {
    if (entry.kind !== "file") continue;
    const fileHandle = entry as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    if (!SUPPORTED_MIME_TYPES.has(file.type)) continue;

    result.push({
      name,
      handle: fileHandle,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

type PermissionMode = "read" | "readwrite";

type PermissionDescriptor = {
  mode?: PermissionMode;
};

type PermissionCapableHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: PermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (
    descriptor?: PermissionDescriptor,
  ) => Promise<PermissionState>;
};

type DirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: PermissionMode,
) {
  const permissionHandle = handle as PermissionCapableHandle;
  if (
    typeof permissionHandle.queryPermission !== "function" ||
    typeof permissionHandle.requestPermission !== "function"
  ) {
    return true;
  }

  const current = await permissionHandle.queryPermission({ mode });
  if (current === "granted") return true;
  if (current === "denied") return false;
  const result = await permissionHandle.requestPermission({ mode });
  return result === "granted";
}

async function convertWithCanvas(file: File, mimeType: string) {
  const source = await rasterize(file);
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) {
    source.cleanup();
    throw new Error("Canvas コンテキストを初期化できませんでした。");
  }

  source.draw(context);
  const blob = await canvasToBlob(canvas, mimeType);
  source.cleanup();
  return blob;
}

type RasterizedSource = {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D) => void;
  cleanup: () => void;
};

async function rasterize(file: File): Promise<RasterizedSource> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (context) => context.drawImage(bitmap, 0, 0),
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = objectUrl;
  });

  return {
    width: img.width,
    height: img.height,
    draw: (context) => context.drawImage(img, 0, 0),
    cleanup: () => {
      URL.revokeObjectURL(objectUrl);
    },
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas から Blob を生成できませんでした。"));
        }
      },
      mimeType,
      mimeType === "image/webp" ? 0.92 : undefined,
    );
  });
}

function formatBytes(size: number) {
  if (!Number.isFinite(size)) return "-";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

declare global {
  interface DirectoryPickerOptions {
    id?: string;
    mode?: PermissionMode;
    startIn?: FileSystemHandle | string;
  }

  interface Window {
    showDirectoryPicker?: (
      options?: DirectoryPickerOptions,
    ) => Promise<FileSystemDirectoryHandle>;
  }
}

export {};
