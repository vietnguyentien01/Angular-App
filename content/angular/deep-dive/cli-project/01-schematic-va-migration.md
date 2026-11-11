---
title: Schematic, generator và migration — tự động hoá cho cả team
summary: Hiểu cơ chế ng generate / ng update, tự viết generator tạo feature theo chuẩn team, và vì sao migration tự động quan trọng khi bảo trì design system.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [cli, schematics, generator, migration, tooling]
related: [angular/consolidate/cli-project/cau-hinh-runtime-va-proxy, angular/deep-dive/change-detection/angular-22-thay-doi-mac-dinh]
---

## Schematic là gì?

Một **hàm biến đổi cây file** (`Tree`) — đọc, tạo, sửa file trong một "vùng nháp", rồi áp dụng một lần nếu không lỗi. `ng generate` và `ng update` đều chạy schematic:

- `ng generate component x` → schematic `component` của `@schematics/angular`.
- `ng update @angular/core` → các schematic trong `migrations.json` của package (vd `change-detection-eager` ở v22).

```ts title="tools/schematics/feature/index.ts (rút gọn)"
export function feature(options: { name: string }): Rule {
  return (tree: Tree) => {
    const dir = `src/app/features/${strings.dasherize(options.name)}`;
    tree.create(`${dir}/index.ts`, `export * from './${options.name}.routes';\n`);
    tree.create(`${dir}/data-access/.gitkeep`, '');
    tree.create(`${dir}/ui/.gitkeep`, '');
    // … sinh routes, facade, page theo template chuẩn của team
    return tree;
  };
}
```

```json title="collection.json"
{
  "schematics": {
    "feature": { "factory": "./feature/index#feature", "description": "Tạo feature theo chuẩn team" }
  }
}
```

Với Nx, khái niệm tương đương là **generator** (`nx g @org/tools:feature cases`).

## Vì sao đáng đầu tư?

| Không có generator | Có generator |
|---|---|
| Mỗi người tạo feature một kiểu | Cấu trúc thống nhất (facade, routes, index.ts, test mẫu) |
| Review tốn công nhắc lại quy ước | Quy ước nằm trong code |
| Đổi chuẩn → sửa tay hàng trăm file | Viết **migration** sửa tự động |

## Migration cho thư viện nội bộ

Khi design system đổi API (vd `[size]="'large'"` → `size="lg"`), cung cấp migration trong `migrations.json` của package: các team chạy `ng update @org/ui` là code được sửa tự động. Đây là cách Angular làm với chính nó.

:::quiz Vì sao schematic thao tác trên `Tree` thay vì ghi file trực tiếp?
- [ ] Để chạy nhanh hơn
- [x] Mọi thay đổi được gom lại và chỉ áp dụng khi toàn bộ schematic thành công — lỗi giữa chừng không để lại trạng thái nửa vời; hỗ trợ cả chế độ chạy thử (dry run)
- [ ] Vì Node không ghi file được
- [ ] Để tương thích Windows

`ng generate ... --dry-run` liệt kê thay đổi mà không ghi gì.
:::

:::quiz Design system nội bộ đổi tên input ở 40 dự án. Cách giảm công nâng cấp nhất?
- [ ] Gửi email hướng dẫn sửa tay
- [ ] Giữ cả tên cũ và mới mãi mãi
- [x] Phát hành kèm migration schematic để `ng update` tự sửa code, đồng thời deprecate tên cũ trong một giai đoạn
- [ ] Bắt các dự án viết lại

Deprecate + migration tự động là quy trình Angular dùng cho chính các thay đổi của mình.
:::
