import { Pipe, type PipeTransform, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

/**
 * Đánh dấu HTML của nội dung là tin cậy.
 *
 * CHỈ dùng cho HTML do `scripts/build-content.ts` sinh ra: script đó escape mọi HTML thô
 * trong Markdown, nên đầu ra chỉ gồm thẻ do marked + shiki tạo. Cần bypass vì sanitizer
 * mặc định của Angular xoá thuộc tính `style` mà shiki dùng để tô màu code.
 * Không bao giờ dùng pipe này cho dữ liệu người dùng nhập.
 */
@Pipe({ name: 'trustedContentHtml' })
export class TrustedContentHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
