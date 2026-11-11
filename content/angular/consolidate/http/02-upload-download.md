---
title: Upload có tiến độ, tải file và đọc tên file từ header
summary: reportProgress với observe events, vì sao upload progress cần withXhr() ở Angular 22, tải blob và Content-Disposition.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [http, upload, download, progress]
related: [angular/review/http/httpclient-co-ban, angular/deep-dive/change-detection/angular-22-thay-doi-mac-dinh]
---

## Upload có thanh tiến độ

```ts title="upload.service.ts"
upload(file: File) {
  const body = new FormData();
  body.append('file', file);
  return this.http.post<UploadResult>('/api/files', body, { reportProgress: true, observe: 'events' }).pipe(
    map((e) => {
      if (e.type === HttpEventType.UploadProgress) {
        return { state: 'uploading' as const, percent: e.total ? Math.round((100 * e.loaded) / e.total) : 0 };
      }
      if (e.type === HttpEventType.Response) return { state: 'done' as const, result: e.body! };
      return { state: 'pending' as const };
    }),
  );
}
```

:::warning Angular 22: Fetch là backend mặc định
`FetchBackend` hiện là mặc định của `HttpClient`, và **Fetch API chưa hỗ trợ báo tiến độ upload**. Muốn có `UploadProgress`, cấu hình `provideHttpClient(withXhr())`. Tiến độ **download** vẫn hoạt động với Fetch.
:::

## Tải file và lấy tên file

```ts
download(id: string) {
  return this.http.get(`/api/cases/${id}/export`, { responseType: 'blob', observe: 'response' }).pipe(
    tap((res) => {
      const header = res.headers.get('Content-Disposition') ?? '';
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)?.[1] ?? 'export.xlsx';
      const url = URL.createObjectURL(res.body!);
      const a = Object.assign(document.createElement('a'), { href: url, download: decodeURIComponent(name) });
      a.click();
      URL.revokeObjectURL(url);
    }),
  );
}
```

:::warning CORS
Khi API khác domain, trình duyệt chỉ cho JavaScript đọc một số header "an toàn". Server phải gửi `Access-Control-Expose-Headers: Content-Disposition`, nếu không `headers.get('Content-Disposition')` trả `null`.
:::

:::quiz Với `observe: 'events'`, Observable phát gì?
- [ ] Chỉ body của response
- [x] Mọi `HttpEvent`: Sent, UploadProgress, DownloadProgress, ResponseHeader, Response…
- [ ] Chỉ `HttpResponse`
- [ ] Chỉ lỗi

Mặc định `observe: 'body'` chỉ phát body. `'response'` phát `HttpResponse` đầy đủ (có header).
:::

:::quiz Ứng dụng Angular 22 upload file nhưng không bao giờ nhận được sự kiện `UploadProgress`. Nguyên nhân khả dĩ nhất?
- [ ] Thiếu `observe: 'body'`
- [x] Đang dùng backend Fetch mặc định — cần `provideHttpClient(withXhr())`
- [ ] File quá nhỏ
- [ ] Server không hỗ trợ multipart

Đây là thay đổi hành vi dễ gặp sau khi nâng cấp lên v22 nếu app từng dựa vào XHR.
:::

:::quiz Vì sao gọi `URL.revokeObjectURL(url)` sau khi tải?
- [ ] Để huỷ request
- [x] Giải phóng bộ nhớ của blob — URL object giữ blob trong bộ nhớ cho tới khi bị revoke hoặc trang đóng
- [ ] Để xoá file trên server
- [ ] Bắt buộc để trình duyệt tải

Xuất nhiều file lớn mà không revoke sẽ làm tab tốn bộ nhớ dần.
:::

:::exercise Upload nhiều file, tối đa 3 cùng lúc
Có `files: File[]`. Viết luồng upload song song tối đa 3 file, mỗi file báo tiến độ riêng, một file lỗi không làm dừng các file khác.
???
```ts
from(files).pipe(
  mergeMap(
    (file) =>
      this.upload(file).pipe(
        map((p) => ({ name: file.name, ...p })),
        catchError(() => of({ name: file.name, state: 'error' as const })),
      ),
    3, // concurrency
  ),
).subscribe((p) => this.progress.update((m) => ({ ...m, [p.name]: p })));
```
`catchError` đặt **trong** `mergeMap` để lỗi của một file không kết thúc cả luồng.
:::
