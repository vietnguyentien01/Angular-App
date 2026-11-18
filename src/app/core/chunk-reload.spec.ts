import { isChunkLoadError } from './chunk-reload';

describe('isChunkLoadError', () => {
  it('nhận ra lỗi tải chunk của các trình duyệt', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://x.github.io/Angular-App/chunk-DfVYE9Py.js',
        ),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('bỏ qua lỗi khác', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
