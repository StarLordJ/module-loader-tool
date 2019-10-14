import { MLTWorkMode } from './types';

export class MLTMessage {
  private workMode: MLTWorkMode = MLTWorkMode.ERROR;

  setupWarningAdapter;

  setupWorkMode(mode: MLTWorkMode): void {
    this.workMode = mode;
  }

  log(message: string): void {
    switch (this.workMode) {
      case MLTWorkMode.ERROR: {
        throw new Error(message);
      }
      case MLTWorkMode.WARNING: {
        console.warn();
      }
    }
  }
}

export const mltMessage = new MLTMessage();
