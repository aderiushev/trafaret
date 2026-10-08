import { pino, type Logger } from 'pino';

export function createLogger(options: { level: string }): Logger {
  return pino({
    level: options.level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.apiKey', '*.apiToken'],
      censor: '[redacted]',
    },
  });
}
