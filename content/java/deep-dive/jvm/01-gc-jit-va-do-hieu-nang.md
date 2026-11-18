---
title: "GC, JIT và đo hiệu năng đúng cách — warmup, so sánh Serial/Parallel/G1/ZGC, JMH và bẫy dead code"
summary: "Quan sát JIT biên dịch theo tầng và vì sao lần chạy đầu chậm gấp đôi, so sánh thời gian và pause của bốn GC trên cùng một workload, rồi đo bằng JMH: vòng lặp và Stream gần như ngang nhau, boxing chậm hơn ~10 lần, benchmark không dùng kết quả bị JIT xoá. Đo trên JDK 21."
level: advanced
version: 21
lastReviewed: 2026-11-18
tags: [java, jvm, gc, jit, jmh, performance]
related: [java/consolidate/jvm/chan-doan-memory-leak-va-oom, java/deep-dive/basics/ben-trong-string-va-boxing]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS: đo lại warmup, bốn GC (thêm ZGC có/không thế hệ) và hai benchmark JMH trên JDK 21; AOT cache chuyển thành ghi chú khi nâng cấp."
---

## Tóm tắt nhanh

- Code Java chạy qua các tầng: **thông dịch → C1 → C2**. Method nóng được biên dịch dần, nên những lần chạy đầu luôn chậm hơn (*warmup*). Đo hiệu năng mà bỏ qua warmup là đo sai.
- Chọn GC theo mục tiêu: **G1** (mặc định, cân bằng), **ZGC** (pause dưới 1 ms, heap lớn — trên Java 21 nhớ thêm `-XX:+ZGenerational`), **Parallel** (thông lượng batch), **Serial** (heap nhỏ, 1 CPU).
- Đo micro-benchmark bằng **JMH**, không bằng `System.nanoTime` trong `main`. JMH lo warmup, fork JVM mới, và chống JIT xoá code.
- Số đo thực tế trên JDK 21: boxing (`List<Integer>`) chậm hơn mảng `int[]` **~10 lần trở lên**; `IntStream` và vòng `for` gần như **bằng nhau**.

## Cơ chế: JIT theo tầng

```text
bytecode ─► interpreter ─(gọi nhiều)─► C1 (biên dịch nhanh, có thu thập profile) ─(rất nóng)─► C2 (tối ưu mạnh dựa trên profile)
                                        ▲                                                      │
                                        └─────────── deoptimize khi giả định sai ◄─────────────┘
```

Hàm tính toán lặp 2 triệu lần, đo 10 lần liên tiếp (JDK 21):

```text
mặc định:  lần 1: 5704 µs   lần 2: 4139 µs   lần 3: 3465 µs   lần 4: 2604 µs … lần 10: 2632 µs
-Xint:     lần 1: 34949 µs  …                                                  lần 10: 30595 µs
```

`-XX:+PrintCompilation` cho thấy chuyện gì xảy ra:

```text
39    8 %     3       vn.hoc.Warm::tinh @ 4 (29 bytes)                  ← OSR ở tầng 3 (C1): biên dịch ngay giữa vòng lặp đang chạy
39    9       3       vn.hoc.Warm::tinh (29 bytes)
40   10 %     4       vn.hoc.Warm::tinh @ 4 (29 bytes)                  ← tầng 4 (C2)
40    8 %     3       vn.hoc.Warm::tinh @ 4 (29 bytes)   made not entrant   ← bản C1 bị thay
46   10 %     4       vn.hoc.Warm::tinh @ 4 (29 bytes)   made not entrant   ← deoptimize: giả định của C2 bị vi phạm
46   11 %     4       vn.hoc.Warm::tinh @ 4 (29 bytes)                  ← biên dịch lại
47   12       4       vn.hoc.Warm::tinh (29 bytes)
```

Hệ quả cho ứng dụng: sau mỗi lần deploy, vài phút đầu chậm hơn (CPU cao vì JIT, latency cao). Trên Java 21, cách xử lý là gửi traffic khởi động (warmup request) trước khi đưa instance vào load balancer, hoặc dùng CDS (`-XX:SharedArchiveFile`, có từ Java 13) để nạp class nhanh hơn. Khi nâng lên Java 24–25 có thêm *AOT cache* (JEP 483, 514, 515) giúp khởi động và warmup nhanh hơn nữa. (JDK 25 còn in kèm lý do sau `made not entrant`, vd `uncommon trap`; JDK 21 thì không.)

## So sánh GC

Workload: 3 triệu lần cấp phát 1 KB (đa số là rác ngắn hạn, ~30 MB sống lâu), `-Xmx512m`, máy 4 CPU, JDK 21:

| GC | Thời gian | Số lần pause | Pause dài nhất |
|---|---|---|---|
| Serial | 570 ms | 52 | 3,211 ms |
| Parallel | 559 ms | 21 | 4,011 ms |
| G1 | 645 ms | 22 | 4,119 ms |
| ZGC (`-XX:+UseZGC`, không thế hệ) | 813 ms | 24 | **0,015 ms** |
| ZGC có thế hệ (`-XX:+UseZGC -XX:+ZGenerational`) | 653 ms | 48 | **0,029 ms** |

(ZGC đo bằng `-Xlog:gc+phases`, dòng `Pause Mark Start`, `Pause Mark End`, `Pause Relocate Start`; các GC khác bằng `-Xlog:gc`.)

Cách đọc:

- Với heap nhỏ và workload ngắn, Serial nhanh nhất — không có chi phí phối hợp nhiều thread. Đó là lý do JVM chọn Serial khi chỉ có 1 CPU.
- G1 và Parallel có pause vài ms ở đây, nhưng pause tăng theo kích thước heap và lượng object sống. Với heap vài chục GB, pause của G1 có thể lên hàng trăm ms.
- ZGC làm gần như mọi việc **song song với ứng dụng**, pause tính bằng micro giây và gần như không phụ thuộc kích thước heap. Đổi lại tốn thêm CPU và bộ nhớ.
- Trên **Java 21**, `-XX:+UseZGC` mặc định là ZGC **không thế hệ**: với workload nhiều rác ngắn hạn như trên, nó chậm hơn bản có thế hệ (813 ms so với 653 ms). Dùng ZGC trên Java 21 thì bật kèm `-XX:+ZGenerational`.

| Mục tiêu | GC | Cờ |
|---|---|---|
| Mặc định, đa số web service | G1 | (không cần), `-XX:MaxGCPauseMillis=200` là mục tiêu mặc định |
| Latency thấp (giao dịch, API thời gian thực), heap lớn | ZGC | Java 21: `-XX:+UseZGC -XX:+ZGenerational`; Java 23+: `-XX:+UseZGC` |
| Batch, ETL, không quan tâm pause | Parallel | `-XX:+UseParallelGC` |
| Container nhỏ, 1 CPU, CLI | Serial | `-XX:+UseSerialGC` |

Thứ tự ưu tiên khi tối ưu: giảm cấp phát và lượng object sống (code, cache có giới hạn) → kích thước heap phù hợp → mới đến chọn và chỉnh GC.

## Đo đúng cách với JMH

```java title="TongBench.java"
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 3, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(1)
@State(Scope.Benchmark)
public class TongBench {
    int[] mang;                    // 100.000 phần tử
    List<Integer> danhSach;        // cùng dữ liệu, dạng boxing

    @Setup public void setup() { … }

    @Benchmark public long vongForMang() { long s = 0; for (int x : mang) s += x; return s; }
    @Benchmark public long intStream()   { return IntStream.of(mang).asLongStream().sum(); }
    @Benchmark public long streamBoxed() { return danhSach.stream().mapToLong(Integer::longValue).sum(); }
    @Benchmark public long vongForList() { long s = 0; for (Integer x : danhSach) s += x; return s; }

    @Benchmark public void khongDungKetQua() { long s = 0; for (int x : mang) s += x; }          // sai
    @Benchmark public void dungBlackhole(Blackhole bh) { long s = 0; for (int x : mang) s += x; bh.consume(s); }
}
```

Kết quả JMH 1.37 trên JDK 21 (`maven.compiler.release` 21):

```text
Benchmark                  Mode  Cnt   Score    Error  Units
TongBench.dungBlackhole    avgt    5    8.194 ±  1.056  us/op
TongBench.intStream        avgt    5    9.743 ±  3.841  us/op
TongBench.khongDungKetQua  avgt    5    0.001 ±  0.001  us/op
TongBench.streamBoxed      avgt    5   87.002 ± 22.225  us/op
TongBench.vongForList      avgt    5  142.289 ± 99.915  us/op
TongBench.vongForMang      avgt    5    8.336 ±  0.221  us/op
```

- `khongDungKetQua` = 0,001 µs: JIT thấy `s` không được dùng nên **xoá cả vòng lặp** (dead code elimination). Benchmark viết tay trong `main` hay bị lỗi này mà không biết. Luôn `return` kết quả hoặc đưa vào `Blackhole`.
- `vongForMang` ≈ `intStream` ≈ 8–10 µs (chênh nhau nằm trong sai số): Stream trên primitive không chậm hơn vòng lặp sau khi JIT tối ưu.
- `List<Integer>` ≈ 87–142 µs, chậm **~10–17 lần**, dù dùng vòng lặp hay Stream: phải đi theo tham chiếu tới từng object `Integer` nằm rải rác trên heap. Chi phí nằm ở **cấu trúc dữ liệu**, không ở cú pháp.
- Cột `Error` quan trọng: `vongForList` ±100 µs — sai số lớn hơn cả khoảng cách với `streamBoxed`, nên **không** kết luận được vòng lặp hay Stream nhanh hơn với `List<Integer>`. Máy đo đang chạy việc khác cũng làm sai số tăng; đo lại trên máy yên tĩnh trước khi kết luận.

Thiết lập Maven: `jmh-core` làm dependency, `jmh-generator-annprocess` khai báo trong `annotationProcessorPaths` của `maven-compiler-plugin` để sinh file `META-INF/BenchmarkList`, rồi chạy `java -cp … org.openjdk.jmh.Main TongBench`.

## So sánh phương án đo hiệu năng

| Câu hỏi | Công cụ |
|---|---|
| Đoạn code A hay B nhanh hơn? | JMH (nhiều fork, đủ warmup, đọc cả sai số) |
| Ứng dụng chậm ở đâu khi chạy thật? | JFR + JDK Mission Control, hoặc async-profiler |
| GC có phải nguyên nhân latency? | Log GC (`-Xlog:gc*`), sự kiện GC trong JFR |
| Hệ thống chịu được bao nhiêu tải? | Load test (Gatling, k6, JMeter) trên môi trường giống production |
| Sau khi đổi code có chậm đi không? | Benchmark JMH chạy trong CI so với baseline, hoặc load test định kỳ |

## Tính năng mới theo phiên bản

- **Java 9**: G1 là GC mặc định. **Java 15**: ZGC chính thức. **Java 21**: ZGC có thế hệ (JEP 439), phải bật bằng `-XX:+ZGenerational`.
- JFR có từ OpenJDK 11; CDS cho class của ứng dụng (AppCDS) từ Java 10, tạo archive tự động khi thoát (`-XX:ArchiveClassesAtExit`) từ Java 13.

:::version 25 Khi nâng lên Java 23–25
- **Java 23**: generational là mặc định của ZGC. **Java 24**: gỡ ZGC không thế hệ và cờ `ZGenerational` (JEP 490) — xoá cờ này khỏi script khởi động khi nâng cấp.
- **Java 24**: AOT class loading & linking (JEP 483). **Java 25**: cải tiến AOT cache cho khởi động và warmup (JEP 514, 515), compact object headers chính thức (JEP 519, tắt mặc định).
- Java 25 bổ sung thêm sự kiện JFR (vd profiling CPU-time trên Linux ở dạng thử nghiệm).
:::

:::senior Góc nhìn senior
Phần lớn vấn đề hiệu năng của ứng dụng enterprise nằm ở **I/O** (N+1 query, gọi API tuần tự, thiếu index, thiếu cache) chứ không ở JVM. Thứ tự làm việc: đo end-to-end và tìm điểm nghẽn bằng tracing/JFR, sửa thuật toán và I/O, rồi mới đến heap và GC. Khi đề xuất "tối ưu" trong code review, yêu cầu số đo JMH hoặc profiler — "Stream chậm hơn for" hay "nên dùng StringBuilder" là ví dụ của những niềm tin mà số đo ở trên và trong bài *Bên trong String* không ủng hộ cho trường hợp phổ biến.
:::

:::quiz Benchmark `void tinh() { long s = 0; for (int x : mang) s += x; }` (không trả kết quả) đo được 0,001 µs. Vì sao?
- [ ] Mảng rỗng
- [x] JIT xoá vòng lặp vì kết quả không được dùng (dead code elimination)
- [ ] JMH bỏ qua method `void`
- [ ] CPU quá nhanh

Trả về `s` hoặc `bh.consume(s)` thì đo được ~8 µs như các benchmark khác (JDK 21).
:::

:::quiz Từ kết quả JMH, nguyên nhân chính làm tổng `List<Integer>` chậm hơn `int[]` ~10 lần trở lên là gì?
- [ ] Stream API chậm
- [ ] Vòng for-each chậm
- [x] Boxing: mỗi phần tử là một object riêng trên heap, phải đi theo tham chiếu và unbox
- [ ] GC chạy trong lúc đo

Vòng `for` và Stream trên cùng `List<Integer>` cho kết quả không phân biệt được (~142 ± 100 và ~87 ± 22 µs, khoảng sai số chồng lên nhau).
:::

:::exercise Viết benchmark cho nối chuỗi
Bài *Bên trong String* đo thô `+=` trong vòng lặp với `System.nanoTime`. Viết lại bằng JMH: hai benchmark nối 1.000 số nguyên thành chuỗi, một dùng `+=`, một dùng `StringBuilder`, có warmup và trả kết quả. Dự đoán và giải thích kết quả.
???
```java
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 3, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(1)
@State(Scope.Benchmark)
public class NoiChuoiBench {
    @Param({"1000"}) int n;

    @Benchmark public String congBang() { String r = ""; for (int i = 0; i < n; i++) r += i; return r; }
    @Benchmark public String stringBuilder() { var sb = new StringBuilder(); for (int i = 0; i < n; i++) sb.append(i); return sb.toString(); }
}
```

Đã chạy với `@Param({"100", "1000", "10000"})` trên JDK 21 (JMH 1.37):

```text
Benchmark                      (n)  Mode  Cnt      Score      Error  Units
NoiChuoiBench.congBang         100  avgt    5      2.556 ±    0.370  us/op
NoiChuoiBench.congBang        1000  avgt    5    220.512 ±   84.632  us/op
NoiChuoiBench.congBang       10000  avgt    5  34561.950 ± 3565.924  us/op
NoiChuoiBench.stringBuilder    100  avgt    5      0.520 ±    0.331  us/op
NoiChuoiBench.stringBuilder   1000  avgt    5     11.221 ±    8.279  us/op
NoiChuoiBench.stringBuilder  10000  avgt    5    120.848 ±   45.058  us/op
```

Khoảng cách **tăng nhanh** theo `n`: ~5 lần ở 100, ~20 lần ở 1.000, ~290 lần ở 10.000. Mỗi `+=` tạo chuỗi mới và chép lại toàn bộ, tổng O(n²); `StringBuilder` là O(n) — `n` tăng 10 lần thì thời gian tăng ~11–22 lần, còn `+=` tăng ~86–157 lần. Khác bài đo thô, JMH có warmup và fork riêng nên số đo ổn định, có cột sai số để so sánh. Trả `String` về là đủ để JIT không xoá code.
:::
