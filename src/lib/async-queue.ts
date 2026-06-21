export class AsyncQueue {
  private running = 0;
  private readonly pending: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.running += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.running -= 1;
            this.pending.shift()?.();
          });
      };
      if (this.running < this.concurrency) start();
      else this.pending.push(start);
    });
  }
}
