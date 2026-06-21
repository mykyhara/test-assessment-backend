import { AsyncQueue } from '../lib/async-queue';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface NewUser {
  name: string;
  email: string;
}

const seed: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  { id: 3, name: 'Alice Johnson', email: 'alice@example.com' },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class UserStore {
  private readonly users = new Map<number, User>();
  private readonly inFlight = new Map<number, Promise<User | null>>();
  private readonly queue: AsyncQueue;
  private nextId: number;

  constructor(
    private readonly latencyMs: number,
    concurrency: number,
  ) {
    for (const user of seed) this.users.set(user.id, user);
    this.nextId = Math.max(...this.users.keys()) + 1;
    this.queue = new AsyncQueue(concurrency);
  }

  fetch(id: number): Promise<User | null> {
    const ongoing = this.inFlight.get(id);
    if (ongoing) return ongoing;

    const request = this.queue.run(() => this.read(id)).finally(() => this.inFlight.delete(id));
    this.inFlight.set(id, request);
    return request;
  }

  create(input: NewUser): User {
    const user: User = { id: this.nextId++, ...input };
    this.users.set(user.id, user);
    return user;
  }

  private async read(id: number): Promise<User | null> {
    await delay(this.latencyMs);
    return this.users.get(id) ?? null;
  }
}
