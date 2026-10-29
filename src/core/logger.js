/**
 * @typedef {"info" | "warn" | "error"} LogLevel
 * @typedef {{ level: LogLevel, scope: string, message: string, details?: object }} LogEntry
 * @typedef {(entry: LogEntry) => void} LogSink
 * @typedef {{ info: LogWrite, warn: LogWrite, error: LogWrite }} Logger
 * @typedef {(message: string, details?: object) => void} LogWrite
 */

/**
 * Creates a logger that tags every entry with a scope (e.g. "engine", "edge").
 * @param {string} scope
 * @param {LogSink} sink
 * @returns {Logger}
 */
export function createLogger(scope, sink) {
  const write = (level) => (message, details) => {
    sink(details === undefined ? { level, scope, message } : { level, scope, message, details });
  };
  return { info: write("info"), warn: write("warn"), error: write("error") };
}

/**
 * Default sink for the browser console. The only place allowed to use console.
 * @type {LogSink}
 */
export const consoleSink = (entry) => {
  // eslint-disable-next-line no-console -- this sink is the logger's single console gateway
  console[entry.level](`[${entry.scope}] ${entry.message}`, entry.details ?? "");
};
