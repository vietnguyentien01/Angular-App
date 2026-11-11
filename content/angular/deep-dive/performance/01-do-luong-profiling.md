---
title: Đo trước khi tối ưu — Web Vitals, profiler và phân tích bundle
summary: Quy trình đo hiệu năng có số liệu trước/sau, đọc Angular DevTools profiler, Chrome Performance và phân tích bundle — để CV có con số thật.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [performance, profiling, web-vitals, bundle]
related: [angular/consolidate/performance/bang-du-lieu-lon, angular/deep-dive/performance/debounced-va-injectasync]
---

## Quy trình

1. **Chọn chỉ số**: LCP (tải), INP (tương tác), CLS (ổn định layout), kích thước bundle, thời gian một thao tác cụ thể.
2. **Đo baseline** trong điều kiện cố định (production build, CPU throttling 4×, mạng "Fast 4G").
3. **Tìm nút thắt** bằng công cụ phù hợp.
4. Sửa **một thứ** một lần, đo lại, ghi số liệu.

| Câu hỏi | Công cụ |
|---|---|
| Trang tải chậm? | Lighthouse, tab Network, Web Vitals |
| Bấm nút bị khựng? | Chrome **Performance** (xem long task > 50ms), chỉ số INP |
| Component nào render nhiều/lâu? | **Angular DevTools → Profiler** |
| Bundle to vì đâu? | `ng build --stats-json` + esbuild bundle analyzer |
| Rò rỉ bộ nhớ? | Chrome **Memory** heap snapshot |

## Angular DevTools Profiler

- Ghi lại các lượt change detection; mỗi cột là một lượt, độ cao = thời gian.
- Click vào lượt để thấy component nào tốn thời gian nhất và **vì sao** lượt đó chạy (event, signal…).
- Dấu hiệu xấu: rất nhiều lượt CD khi chỉ rê chuột / cuộn → có listener hoặc timer gây CD thừa.

## Đo trong code

```ts
performance.mark('import-start');
await this.importer.parse(file);
performance.mark('import-end');
const m = performance.measure('excel-import', 'import-start', 'import-end');
console.info(`Import: ${m.duration.toFixed(0)}ms`);
```

Các `measure` hiện trên timeline của tab Performance — dễ chụp ảnh trước/sau.

:::senior Viết vào CV thế nào?
Không viết "Tối ưu hiệu năng". Viết: *"Giảm thời gian import Excel 20MB từ 8s xuống 1,2s và loại bỏ UI freeze bằng Web Worker; giảm initial bundle 38% bằng lazy route + @defer"*. Con số chỉ có được nếu bạn **đo baseline trước** khi sửa.
:::

:::quiz INP đo điều gì?
- [ ] Thời gian tải ảnh lớn nhất
- [x] Độ trễ từ lúc người dùng tương tác (click, gõ phím) tới khi trình duyệt vẽ phản hồi tiếp theo
- [ ] Số request mạng
- [ ] Độ lệch layout

INP thay thế FID trong Core Web Vitals; long task trên main thread làm INP xấu.
:::

:::quiz Đo hiệu năng bằng `ng serve` (dev build) có vấn đề gì?
- [ ] Không có vấn đề
- [x] Dev build không tối ưu, có kiểm tra dev mode (vd `checkNoChanges`) → số liệu sai lệch so với production
- [ ] `ng serve` không chạy được Profiler
- [ ] Dev build luôn nhanh hơn

Luôn đo trên production build (`ng build` rồi serve thư mục `dist`).
:::

:::exercise Lập kế hoạch đo
Người dùng phàn nàn "mở hồ sơ chậm". Viết các bước bạn sẽ làm trong 1 giờ đầu để có số liệu, trước khi sửa bất cứ gì.
???
1. Tái hiện trên production build với cùng dữ liệu (hồ sơ lớn nhất mà người dùng gặp).
2. Network tab: thời gian API, số request, request tuần tự có thể song song hoá không.
3. Performance tab (CPU 4×): ghi lại thao tác mở hồ sơ, xác định long task, thời gian scripting/rendering.
4. Angular DevTools Profiler: component nào tốn thời gian, số lượt CD.
5. Ghi baseline: "API 1,8s + render 2,4s, 3 long task > 300ms". Từ đó mới chọn hướng sửa (song song API, `@defer`, giảm DOM…).
:::
