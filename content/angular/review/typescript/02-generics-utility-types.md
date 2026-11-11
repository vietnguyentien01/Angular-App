---
title: Generics, utility types, keyof, satisfies
summary: Viết hàm và service tái sử dụng có type chính xác, các utility type hay dùng và toán tử satisfies.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [typescript, generics, utility-types]
related: [angular/review/typescript/kieu-va-narrowing]
---

## Generics

```ts
// Hàm giữ nguyên kiểu đầu vào
function first<T>(list: readonly T[]): T | undefined {
  return list[0];
}

// Ràng buộc: T phải có id
function byId<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((x) => x.id === id);
}

// Service API dùng chung
class CrudApi<T extends { id: string }> {
  constructor(private readonly url: string) {}
  private readonly http = inject(HttpClient);
  list() { return this.http.get<T[]>(this.url); }
  get(id: string) { return this.http.get<T>(`${this.url}/${id}`); }
}
```

## Utility types hay dùng

| Utility | Kết quả | Dùng khi |
|---|---|---|
| `Partial<T>` | Mọi thuộc tính thành tuỳ chọn | Payload PATCH, bản nháp form |
| `Required<T>` | Mọi thuộc tính bắt buộc | Sau khi đã validate |
| `Pick<T, 'a' \| 'b'>` | Chỉ giữ vài thuộc tính | DTO hiển thị |
| `Omit<T, 'id'>` | Bỏ vài thuộc tính | Payload tạo mới (chưa có id) |
| `Record<K, V>` | Object có key K, value V | Map trạng thái → nhãn |
| `Readonly<T>` | Không cho gán lại thuộc tính | State bất biến |
| `ReturnType<typeof fn>` | Kiểu trả về của hàm | Suy ra kiểu từ code |

## `keyof`, `typeof`, `satisfies`

```ts
const STATUS_LABEL = {
  draft: 'Nháp',
  submitted: 'Đã nộp',
  approved: 'Đã duyệt',
} satisfies Record<string, string>;

type Status = keyof typeof STATUS_LABEL; // 'draft' | 'submitted' | 'approved'
```

`satisfies` kiểm tra object khớp kiểu **nhưng giữ nguyên kiểu cụ thể** (key literal) — khác với `: Record<string, string>` vốn làm mất thông tin key.

:::quiz `type CreateOrder = Omit<Order, 'id' | 'createdAt'>` dùng để làm gì?
- [ ] Tạo một class mới
- [x] Kiểu payload tạo đơn — giống `Order` nhưng không có các trường server tự sinh
- [ ] Xoá thuộc tính khỏi object lúc runtime
- [ ] Khiến mọi thuộc tính tuỳ chọn

Utility type chỉ tồn tại lúc biên dịch, không thay đổi object thật.
:::

:::quiz Khác biệt giữa `const x: Record<string, string> = {...}` và `const x = {...} satisfies Record<string, string>`?
- [ ] Không khác
- [x] Với `satisfies`, `keyof typeof x` vẫn là các key cụ thể; với chú thích kiểu, nó thành `string`
- [ ] `satisfies` chạy lúc runtime
- [ ] `satisfies` cho phép value không phải string

`satisfies` = "kiểm tra nhưng không mở rộng kiểu".
:::

:::quiz Hàm `byId<T extends { id: string }>(list: T[], id: string)` gọi với `byId(users, '1')` (users: `User[]`) trả về kiểu gì?
- [ ] `{ id: string } | undefined`
- [x] `User | undefined`
- [ ] `any`
- [ ] `unknown`

Generic suy ra `T = User`, nên giữ đủ các thuộc tính khác của `User`.
:::
