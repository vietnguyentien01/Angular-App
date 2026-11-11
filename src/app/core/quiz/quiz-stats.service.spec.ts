import { TestBed } from '@angular/core/testing';
import { QuizStatsService } from './quiz-stats.service';

describe('QuizStatsService', () => {
  it('ghi nhận đúng/sai và danh sách câu sai gần nhất', async () => {
    const stats = TestBed.inject(QuizStatsService);
    await stats.record('rxjs/a#q1', false);
    await stats.record('rxjs/a#q2', true);
    expect(stats.wrongKeys().has('rxjs/a#q1')).toBe(true);
    expect(stats.wrongKeys().has('rxjs/a#q2')).toBe(false);

    await stats.record('rxjs/a#q1', true);
    expect(stats.get('rxjs/a#q1')).toMatchObject({ correct: 1, wrong: 1, last: 'correct' });
    expect(stats.wrongKeys().size).toBe(0);
  });
});
