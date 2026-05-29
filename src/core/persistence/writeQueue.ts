export class WriteQueue {
  private queue = Promise.resolve();

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);

    this.queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }
}

export const persistenceWriteQueue = new WriteQueue();
