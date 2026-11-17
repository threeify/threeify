import { expect, it } from 'vitest';
import { runTaskQueue } from './task-queue.ts';

it('processes FIFO tasks and waits for children and grandchildren added during processing', async () => {
  const order: string[] = [];
  await runTaskQueue(1, async (schedule) => {
    void schedule(async () => {
      order.push('metadata');
      void schedule(async () => {
        order.push('download');
        void schedule(async () => {
          order.push('alias');
        });
      });
    });
    void schedule(async () => {
      order.push('other metadata');
    });
  });
  expect(order).toEqual(['metadata', 'other metadata', 'download', 'alias']);
});

it('drains work added by successful tasks even when another task fails', async () => {
  const failure = new Error('Download failed');
  const order: string[] = [];
  await expect(
    runTaskQueue(1, async (schedule) => {
      void schedule(async () => {
        throw failure;
      });
      void schedule(async () => {
        order.push('metadata');
        void schedule(async () => {
          order.push('download');
        });
      });
    }),
  ).rejects.toBe(failure);
  expect(order).toEqual(['metadata', 'download']);
});
