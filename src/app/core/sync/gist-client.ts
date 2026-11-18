/** Tên file trong Gist chứa dữ liệu đồng bộ. */
export const SYNC_FILE = 'learning-hub-sync.json';
const DESCRIPTION = 'Learning Hub — dữ liệu đồng bộ tiến độ học (tự tạo, đừng sửa tay)';
const API = 'https://api.github.com';

export class GistError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface GistFile {
  filename: string;
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

interface Gist {
  id: string;
  html_url: string;
  files: Record<string, GistFile | null>;
}

/** Gọi GitHub Gist API trực tiếp từ trình duyệt bằng token của chính người dùng. */
export class GistClient {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(`${API}${path}`, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new GistError('Không kết nối được GitHub (kiểm tra mạng).', 0);
    }
    if (!res.ok) {
      const msg =
        res.status === 401
          ? 'Token không hợp lệ hoặc đã hết hạn.'
          : res.status === 403 || res.status === 404
            ? 'Token không có quyền đọc/ghi Gist, hoặc Gist đã bị xoá.'
            : `GitHub trả lỗi ${res.status}.`;
      throw new GistError(msg, res.status);
    }
    return (await res.json()) as T;
  }

  /** Tìm Gist đồng bộ đã có (theo tên file) trong 100 Gist gần nhất của người dùng. */
  async find(): Promise<string | undefined> {
    const list = await this.call<Gist[]>('/gists?per_page=100');
    return list.find((g) => g.files[SYNC_FILE])?.id;
  }

  async create(content: string): Promise<string> {
    const g = await this.call<Gist>('/gists', {
      method: 'POST',
      body: JSON.stringify({
        description: DESCRIPTION,
        public: false,
        files: { [SYNC_FILE]: { content } },
      }),
    });
    return g.id;
  }

  /** Trả về nội dung file, hoặc `undefined` nếu Gist không còn file đồng bộ. */
  async read(id: string): Promise<string | undefined> {
    const g = await this.call<Gist>(`/gists/${encodeURIComponent(id)}`);
    const f = g.files[SYNC_FILE];
    if (!f) return undefined;
    if (f.truncated && f.raw_url) {
      const res = await this.fetchFn(f.raw_url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) throw new GistError(`GitHub trả lỗi ${res.status}.`, res.status);
      return res.text();
    }
    return f.content;
  }

  async write(id: string, content: string): Promise<void> {
    await this.call<Gist>(`/gists/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [SYNC_FILE]: { content } } }),
    });
  }
}
