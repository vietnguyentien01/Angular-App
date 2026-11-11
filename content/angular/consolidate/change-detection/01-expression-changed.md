---
title: ExpressionChangedAfterItHasBeenChecked — hiểu đúng và sửa tận gốc
summary: Vì sao lỗi chỉ xuất hiện ở dev mode, các nguyên nhân hay gặp và vì sao setTimeout không phải cách sửa.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [change-detection, error, debugging]
related: [angular/review/change-detection/lifecycle-hooks, angular/consolidate/change-detection/markforcheck-detectchanges]
---

## TL;DR

Ở **dev mode**, sau mỗi lượt change detection Angular chạy thêm một lượt **kiểm tra** (`checkNoChanges`). Nếu một binding cho ra giá trị **khác** lần trước → lỗi `NG0100: ExpressionChangedAfterItHasBeenChecked`.

Lỗi này nghĩa là **luồng dữ liệu không một chiều**: trong lúc render, có thứ đã thay đổi state đã được render.

## Nguyên nhân hay gặp

| Nguyên nhân | Ví dụ |
|---|---|
| Con sửa state của cha trong hook sau render | `ngAfterViewInit() { this.parent.title = 'x' }` |
| Binding trả về giá trị mới mỗi lần đọc | `{{ getItems() }}` trả mảng mới, `{{ Math.random() }}`, `new Date()` |
| Service được cập nhật giữa chừng render | Con gọi `loadingService.show()` trong `ngOnInit` khi cha đang hiển thị `loading` |

```ts bad title="Con báo chiều cao lên cha sau khi render"
ngAfterViewInit() {
  this.layout.headerHeight = this.el.nativeElement.offsetHeight; // cha đã render headerHeight rồi
}
```

```ts bad title="Cách 'chữa cháy' phổ biến"
ngAfterViewInit() {
  setTimeout(() => (this.layout.headerHeight = ...)); // che lỗi, gây render 2 lần, khó debug
}
```

```ts good
// Dùng signal: cập nhật sẽ lên lịch một lượt render mới thay vì đổi giá trị giữa chừng
readonly headerHeight = signal(0);

constructor() {
  afterNextRender(() => this.layout.headerHeight.set(this.el.nativeElement.offsetHeight));
}
```

:::senior Góc nhìn Senior
Khi review thấy `setTimeout` / `Promise.resolve().then` chỉ để "sửa" NG0100, hãy hỏi: *dữ liệu này nên được tính ở đâu để chảy một chiều từ trên xuống?* Thường câu trả lời là nâng state lên service/cha, hoặc dùng `computed` thay vì gán trong hook.
:::

:::quiz Vì sao lỗi NG0100 không xuất hiện ở production build?
- [ ] Vì production đã sửa lỗi tự động
- [x] Vì lượt `checkNoChanges` chỉ chạy ở dev mode — bug vẫn còn, chỉ không bị báo
- [ ] Vì production dùng OnPush
- [ ] Vì production không có change detection

Ở production, giá trị mới có thể không được hiển thị cho tới lượt CD tiếp theo → UI lệch dữ liệu.
:::

:::quiz Binding nào chắc chắn gây NG0100?
- [ ] `{{ user().name }}`
- [ ] `{{ total() }}` với `total = computed(...)`
- [x] `{{ now() }}` với `now() { return Date.now(); }`
- [ ] `{{ items.length }}`

Mỗi lần gọi trả giá trị mới → lượt kiểm tra thấy khác. Lưu thời gian vào signal và cập nhật bằng timer.
:::

:::exercise Tìm nguyên nhân
```ts
@Component({ template: `<p>{{ status.message }}</p><app-child />` })
export class Parent { status = inject(StatusService); }

@Component({ template: `...` })
export class Child {
  private status = inject(StatusService);
  ngOnInit() { this.status.message = 'Đang tải…'; }
}
```
Vì sao lỗi xuất hiện và sửa thế nào?
???
`Parent` render `status.message` **trước** khi duyệt xuống `Child`. `Child.ngOnInit` (chạy trong cùng lượt CD) đổi `message` → lượt kiểm tra thấy giá trị khác.

Sửa: biến `message` thành signal (`message = signal('')`) và `set` trong Child. Khi signal đổi, Angular lên lịch render lại phần đọc nó — không còn đổi giá trị "sau lưng" lượt render hiện tại. Tốt hơn nữa: để cha quyết định trạng thái tải dựa trên dữ liệu, không để con ghi vào state chung trong lúc khởi tạo.
:::
