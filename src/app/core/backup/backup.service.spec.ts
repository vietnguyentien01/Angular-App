import { isBackupFile } from './backup.service';

describe('isBackupFile', () => {
  it('chấp nhận file sao lưu hợp lệ', () => {
    expect(
      isBackupFile({
        app: 'learning-hub',
        dbVersion: 1,
        exportedAt: '2026-11-11',
        progress: [{ key: 'angular/x', status: 'done', updatedAt: '' }],
        kv: [],
      }),
    ).toBe(true);
  });

  it('từ chối dữ liệu lạ', () => {
    expect(isBackupFile({ app: 'other' })).toBe(false);
    expect(isBackupFile(null)).toBe(false);
    expect(
      isBackupFile({ app: 'learning-hub', dbVersion: 1, progress: [{ key: 1 }], kv: [] }),
    ).toBe(false);
  });
});
