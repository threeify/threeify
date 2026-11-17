import pLimit from 'p-limit';

export type ScheduleTask = <T>(task: () => Promise<T>) => Promise<T>;

/** One FIFO queue. Tasks may enqueue more work; drain everything, including after a failure. */
export async function runTaskQueue(
  parallel: number,
  produce: (schedule: ScheduleTask) => Promise<void>,
): Promise<void> {
  const limit = pLimit(parallel);
  const pending: Promise<void>[] = [];
  const failures: { error: unknown }[] = [];
  const track = <T>(task: Promise<T>): Promise<T> => {
    const index = pending.length;
    pending.push(
      task.then(
        () => {},
        (error: unknown) => {
          failures[index] = { error };
        },
      ),
    );
    return task;
  };
  const schedule: ScheduleTask = (task) => track(limit(task));
  // The producer coordinates tasks without occupying a worker while it waits for them.
  void track(Promise.resolve().then(() => produce(schedule)));
  for (let index = 0; index < pending.length; index++) await pending[index];
  const failed = failures.find(Boolean);
  if (failed) throw failed.error;
}
