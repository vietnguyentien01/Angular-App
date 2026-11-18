/**
 * Sau mỗi lần deploy, file JS có tên mới (hash). Tab đang mở (hoặc index.html còn trong cache
 * của GitHub Pages ~10 phút) vẫn trỏ tới chunk cũ đã bị xoá → 404
 * "Failed to fetch dynamically imported module". Cách xử lý: tải lại trang một lần, kèm
 * tham số chống cache để chắc chắn lấy index.html mới nhất.
 */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed/i;
const RELOAD_PARAM = '_v';
const GUARD_KEY = 'learning-hub.chunk-reload-at';
/** Không tải lại quá một lần trong khoảng này, tránh vòng lặp nếu lỗi không phải do deploy. */
const GUARD_MS = 60_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return CHUNK_ERROR.test(message);
}

/** Tải lại trang (tới `url` nếu có) để lấy bản build mới nhất. Trả false nếu vừa thử rồi. */
export function reloadForNewVersion(url?: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage bị chặn: vẫn tải lại một lần.
  }
  const target = new URL(url ?? location.href, location.href);
  target.searchParams.set(RELOAD_PARAM, String(Date.now()));
  location.replace(target.toString());
  return true;
}

/** Xoá tham số chống cache khỏi thanh địa chỉ sau khi đã tải lại xong. */
export function cleanReloadParam(): void {
  const url = new URL(location.href);
  if (!url.searchParams.has(RELOAD_PARAM)) return;
  url.searchParams.delete(RELOAD_PARAM);
  history.replaceState(history.state, '', url.toString());
}

/** Bắt cả lỗi import động ngoài router (vd SDK Firebase nạp trễ). */
export function installChunkErrorListener(): void {
  addEventListener('unhandledrejection', (e) => {
    if (isChunkLoadError(e.reason)) reloadForNewVersion();
  });
}
