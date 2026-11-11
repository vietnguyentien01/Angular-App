---
title: Component động — ViewContainerRef, bindings và NgComponentOutlet
summary: Tạo component lúc runtime (dialog, widget dashboard, field của form engine), truyền input/output bằng inputBinding/outputBinding, và dọn dẹp đúng cách.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [components, dynamic, viewcontainerref]
related: [angular/consolidate/components-templates/thiet-ke-component-tai-su-dung, angular/deep-dive/forms/dynamic-form-tu-json-schema]
---

## Hai cách

| Cách | Hợp với |
|---|---|
| `*ngComponentOutlet` trong template | Biết vị trí, chỉ đổi loại component (form engine, tab động) |
| `ViewContainerRef.createComponent()` trong code | Kiểm soát vòng đời (dialog, toast, widget kéo thả) |

## `createComponent` với bindings

```ts title="widget-host.ts"
@Component({ selector: 'app-widget-host', template: `<ng-container #slot />` })
export class WidgetHost {
  private readonly slot = viewChild.required('slot', { read: ViewContainerRef });
  readonly caseId = signal('42');

  open(type: Type<unknown>) {
    this.slot().clear();
    const ref = this.slot().createComponent(type, {
      bindings: [
        inputBinding('caseId', this.caseId), // input luôn bám theo signal
        outputBinding<string>('closed', (reason) => this.onClosed(reason)),
      ],
    });
    return ref; // ref.destroy() khi không dùng nữa
  }

  private onClosed(reason: string) {
    this.slot().clear();
  }
}
```

- `inputBinding(name, signalOrFn)` — input tự cập nhật khi signal đổi, không cần gọi `setInput` thủ công.
- `outputBinding(name, listener)` — lắng nghe output, tự huỷ khi component bị huỷ.
- `twoWayBinding(name, writableSignal)` — cho `model()`.

## Với `NgComponentOutlet`

```html
<ng-container *ngComponentOutlet="widget(); inputs: { caseId: caseId() }" />
```

## Dọn dẹp

- Component tạo trong `ViewContainerRef` bị huỷ khi container bị huỷ (hoặc gọi `clear()` / `ref.destroy()`).
- Component tạo bằng hàm `createComponent()` độc lập (gắn vào `document.body`) **phải** tự `appRef.attachView` và tự `destroy()` — nếu không sẽ leak.

:::quiz Ưu điểm của `inputBinding('caseId', this.caseId)` so với `ref.setInput('caseId', this.caseId())`?
- [ ] Không khác
- [x] Input tự cập nhật mỗi khi signal đổi; `setInput` chỉ đặt giá trị một lần, phải tự gọi lại
- [ ] `inputBinding` nhanh hơn khi tạo
- [ ] `setInput` không còn tồn tại

`inputBinding` nhận một hàm/signal và bám theo nó trong suốt vòng đời component.
:::

:::quiz Dialog được tạo rồi gắn thẳng vào `document.body`, đóng dialog chỉ xoá phần tử DOM. Vấn đề?
- [ ] Không có vấn đề
- [x] Component không bị huỷ → `DestroyRef`, subscription, effect vẫn sống → memory leak
- [ ] Lỗi biên dịch
- [ ] Dialog mở lại nhanh hơn

Luôn huỷ qua `ComponentRef.destroy()` để Angular chạy cleanup.
:::

:::exercise Toast service
Thiết kế `ToastService.show(message, type)` tạo component `Toast` động ở một container cố định, tự đóng sau 4 giây hoặc khi người dùng bấm đóng (output `closed`).
???
```ts
@Service()
export class ToastService {
  private host?: ViewContainerRef;
  register(host: ViewContainerRef) {
    this.host = host; // shell gọi một lần với <ng-container #toasts />
  }

  show(message: string, type: 'success' | 'error' = 'success') {
    if (!this.host) return;
    const ref = this.host.createComponent(Toast, {
      bindings: [
        inputBinding('message', () => message),
        inputBinding('type', () => type),
        outputBinding('closed', () => ref.destroy()),
      ],
    });
    const timer = setTimeout(() => ref.destroy(), 4000);
    ref.onDestroy(() => clearTimeout(timer));
  }
}
```
Dùng thêm `LiveAnnouncer` để trình đọc màn hình đọc nội dung toast.
:::
