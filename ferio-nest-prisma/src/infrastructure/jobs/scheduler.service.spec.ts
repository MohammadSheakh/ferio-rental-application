const connect = jest.fn().mockResolvedValue(undefined);
const end = jest.fn().mockResolvedValue(undefined);
const query = jest.fn(async (sql: string) => ({
  rows: sql.includes('pg_try_advisory_lock') ? [{ ok: true }] : [],
}));

jest.mock('pg', () => ({
  ...jest.requireActual('pg'),
  Client: jest.fn(() => ({ connect, query, end })),
}));

import { SchedulerService } from './scheduler.service';

describe('SchedulerService locking', () => {
  const originalUrl = process.env.CONTROL_PLANE_DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTROL_PLANE_DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/ferio_control?sslmode=disable';
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.CONTROL_PLANE_DATABASE_URL;
    else process.env.CONTROL_PLANE_DATABASE_URL = originalUrl;
  });

  it('locks and unlocks through the same dedicated client', async () => {
    const service = new SchedulerService({} as never, {} as never);
    const task = jest.fn().mockResolvedValue('ok');

    await expect((service as any).withLock('test-job', task)).resolves.toBe('ok');

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_try_advisory_lock(hashtext($1)) AS ok',
      ['ferio:sched:test-job'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock(hashtext($1))',
      ['ferio:sched:test-job'],
    );
    expect(end).toHaveBeenCalledTimes(1);
  });
});
