export interface TraceEntry {
  timestamp: string;
  event: string;
  data?: unknown;
}

export class Tracer {
  private trace: TraceEntry[] = [];

  log(event: string, data?: unknown): void {
    this.trace.push({
      timestamp: new Date().toISOString(),
      event,
      data,
    });
  }

  getTrace(): TraceEntry[] {
    return this.trace;
  }

  clear(): void {
    this.trace = [];
  }
}
