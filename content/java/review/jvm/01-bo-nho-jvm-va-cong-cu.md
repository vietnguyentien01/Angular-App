---
title: "Bộ nhớ JVM và công cụ chẩn đoán — heap, stack, GC mặc định, heap trong container, jcmd"
summary: "Nhắc nhanh heap, stack và metaspace, StackOverflowError so với OutOfMemoryError, JVM tự chọn kích thước heap và GC thế nào (kể cả trong container), các cờ nên đặt khi chạy production, và bộ công cụ jcmd, jstack, JFR. Mọi số liệu đo trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-18
tags: [java, jvm, memory, gc, tooling]
related: [java/consolidate/jvm/chan-doan-memory-leak-va-oom, java/deep-dive/jvm/gc-jit-va-do-hieu-nang]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS; đo lại trên JDK 21, thêm lưu ý ZGC trên Java 21 cần -XX:+ZGenerational."
---

## Tóm tắt nhanh

- **Heap**: mọi object. **Stack**: mỗi thread một stack, chứa biến local và lời gọi hàm. **Metaspace**: thông tin class.
- Đệ quy quá sâu → `StackOverflowError`. Giữ quá nhiều object → `OutOfMemoryError: Java heap space`.
- Không đặt `-Xmx` thì heap tối đa = **25% RAM** mà JVM thấy (`MaxRAMPercentage=25`). Trong container 1 GB, heap chỉ được **256 MB**.
- JDK 21 chọn **G1** làm GC mặc định; máy chỉ có **1 CPU** thì dùng **Serial**.
- Công cụ đi kèm JDK: `jcmd` (mọi thứ), `jstack` (thread dump), JFR (ghi sự kiện hiệu năng, chi phí thấp).

## Các vùng nhớ

```text
┌──────────────────── heap (-Xmx) ────────────────────┐   GC quản lý
│ object: new KhachHang(), String, mảng, collection    │
└──────────────────────────────────────────────────────┘
┌ stack thread 1 ┐ ┌ stack thread 2 ┐ …                    -Xss (mặc định 1 MB)
│ frame main()   │ │ frame run()    │                      biến local, tham chiếu tới object
│ frame tinh()   │ │ …              │
└────────────────┘ └────────────────┘
metaspace (class đã nạp) · code cache (code JIT đã biên dịch) · bộ nhớ native (thread, NIO buffer)
```

## Ví dụ nhanh (đã chạy trên JDK 21, máy 4 CPU, 16 GB RAM)

```text
-Xmx256m:  CPU=4 maxHeap=256 MB
           GC: [G1 Young Generation, G1 Concurrent GC, G1 Old Generation]

Đệ quy vô hạn trên thread main:           StackOverflowError ở độ sâu ~21000
Cùng code với -Xss256k:                     StackOverflowError ở độ sâu ~1795
Thread tạo với stack 64 MB:                 độ sâu 2,6–4,2 triệu
Giữ khối 10 MB trong List tới khi hết heap: OutOfMemoryError: Java heap space sau 23 khối

(độ sâu dao động giữa các lần chạy vì JIT làm frame nhỏ lại)
```

Heap tối đa khi **không** đặt `-Xmx` (`-XX:+PrintFlagsFinal`):

| RAM JVM thấy | Cờ | MaxHeapSize |
|---|---|---|
| 16 GB (máy) | mặc định | 3586129920 byte ≈ 3,3 GB (~25% RAM khả dụng) |
| 1 GB (giả lập container bằng `-XX:MaxRAM=1g`) | mặc định | 268435456 = **256 MB** |
| 1 GB | `-XX:MaxRAMPercentage=75` | 805306368 = 768 MB |

GC được chọn (giả lập bằng `-XX:ActiveProcessorCount` và `-XX:MaxRAM`):

| CPU | RAM | GC |
|---|---|---|
| 1 | 1 GB / 4 GB | Serial |
| 2 | 1 GB / 2 GB | G1 |
| 4 | 4 GB | G1 |

JVM đọc giới hạn CPU/RAM của container (cgroup) từ Java 10 và đã được backport về 8u191. Container giới hạn 1 CPU sẽ chạy Serial GC — thường không phải điều bạn muốn với một web service.

## Bảng chọn nhanh

| Cần | Cờ / công cụ |
|---|---|
| Heap trong container | `-XX:MaxRAMPercentage=75` (chừa phần cho metaspace, thread, native) |
| Heap cố định (VM, máy chủ riêng) | `-Xms` = `-Xmx` (vd `-Xms4g -Xmx4g`) |
| Có heap dump khi OOM | `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps` |
| Thoát ngay khi OOM để orchestrator khởi động lại | `-XX:+ExitOnOutOfMemoryError` |
| Log GC | `-Xlog:gc*:file=/logs/gc.log:time,uptime:filecount=5,filesize=20m` |
| Xem thread đang làm gì | `jstack <pid>` hoặc `jcmd <pid> Thread.print` |
| Đếm object theo class | `jcmd <pid> GC.class_histogram` |
| Heap dump thủ công | `jcmd <pid> GC.heap_dump /dumps/app.hprof` |
| Ghi hiệu năng 60 giây | `jcmd <pid> JFR.start duration=60s filename=/dumps/app.jfr` |
| Xem cờ đang dùng | `jcmd <pid> VM.flags`, `java -XX:+PrintFlagsFinal -version` |

## Lỗi hay gặp: đặt `-Xmx` bằng giới hạn container

```bash bad
# container giới hạn 1 GB
java -Xmx1g -jar app.jar
# heap 1 GB + metaspace + stack các thread + code cache + buffer native > 1 GB
# → container bị kernel giết (OOMKilled, exit code 137), không có heap dump, không có OutOfMemoryError
```

```bash good
java -XX:MaxRAMPercentage=75 -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps -jar app.jar
```

`OutOfMemoryError` là JVM tự báo (có thể có heap dump). `OOMKilled` là hệ điều hành giết cả process vì tổng bộ nhớ vượt giới hạn — hai sự cố khác nhau, cách điều tra khác nhau.

:::version Java 17 / 21 / 25
- Nhận biết giới hạn container: Java 10+ (và 8u191+). `MaxRAMPercentage`: Java 10+ (trước đó là các cờ `-XX:MaxRAMFraction` khó dùng).
- G1 là GC mặc định từ **Java 9**.
- **Trên Java 21**, `-XX:+UseZGC` vẫn chạy ZGC **không thế hệ**; muốn ZGC có thế hệ (generational, JEP 439) phải thêm `-XX:+ZGenerational` (đã kiểm tra trên JDK 21: `ZGenerational = false` mặc định).
- **Khi nâng lên Java 23+**: generational là mặc định của ZGC; Java 24 gỡ hẳn chế độ không thế hệ và cờ `ZGenerational`.
- JFR miễn phí trong OpenJDK từ Java 11.
:::

:::interview `StackOverflowError` và `OutOfMemoryError` khác nhau thế nào?
`StackOverflowError` xảy ra khi stack của **một thread** hết chỗ — thường do đệ quy vô hạn hoặc quá sâu; kích thước stack đặt bằng `-Xss`. `OutOfMemoryError` xảy ra khi JVM không cấp phát được bộ nhớ — phổ biến nhất là heap đầy (`Java heap space`), ngoài ra có `Metaspace`, `unable to create native thread`, `Direct buffer memory`. Cả hai là `Error`, không nên bắt để chạy tiếp. Với OOM heap, cần heap dump để biết object nào đang giữ bộ nhớ.
:::

:::quiz Container giới hạn 1 GB RAM, chạy `java -jar app.jar` không có cờ nào. Heap tối đa khoảng bao nhiêu?
- [ ] 1 GB
- [ ] 768 MB
- [x] 256 MB
- [ ] Không giới hạn

`MaxRAMPercentage` mặc định 25%. Đã đo với `-XX:MaxRAM=1g`: `MaxHeapSize = 268435456`.
:::

:::quiz Dịch vụ chạy trong container giới hạn **1 CPU**. JDK 21 chọn GC nào?
- [ ] G1
- [x] Serial
- [ ] ZGC
- [ ] Parallel

Đã đo bằng `-XX:ActiveProcessorCount=1`: `UseSerialGC`. Muốn G1 thì cấp ≥ 2 CPU hoặc đặt `-XX:+UseG1GC`.
:::

:::quiz Pod Kubernetes bị khởi động lại với lý do `OOMKilled` (exit 137), log ứng dụng không có `OutOfMemoryError`. Nguyên nhân hợp lý nhất?
- [ ] Heap đầy
- [x] Tổng bộ nhớ của process (heap + phần ngoài heap) vượt giới hạn container
- [ ] Đệ quy vô hạn
- [ ] GC bị lỗi

Thường do `-Xmx` đặt quá sát giới hạn container. Để `MaxRAMPercentage` khoảng 70–75%.
:::
