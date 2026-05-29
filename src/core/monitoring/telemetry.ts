export type TelemetryEvent = {
  name: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

export class TelemetryService {
  track(event: TelemetryEvent) {
    if (import.meta.env.DEV) {
      console.info('[telemetry]', event);
    }
  }

  trackError(error: Error) {
    this.track({
      name: 'runtime_error',
      timestamp: Date.now(),
      metadata: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
}

export const telemetry = new TelemetryService();
