import { shuffle } from './practice-page';

describe('shuffle', () => {
  it('giữ nguyên các phần tử và không sửa mảng gốc', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('xáo trộn theo hàm random được truyền vào', () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});
