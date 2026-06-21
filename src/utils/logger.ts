export const logger = {
  info(message: string, data?: unknown) {
    console.info(`[OpenLayer] ${message}`, data ?? "");
  },
  warn(message: string, data?: unknown) {
    console.warn(`[OpenLayer] ${message}`, data ?? "");
  },
  error(message: string, data?: unknown) {
    console.error(`[OpenLayer] ${message}`, data ?? "");
  }
};
