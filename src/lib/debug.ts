/**
 * Lightweight conditional logger for developer debugging.
 *
 * Call `setDebugLogging(true)` to enable verbose debug logging.
 * When disabled (default), only console.error calls will reach logs.
 */
let _debugEnabled = typeof process !== "undefined" ? process.env.NODE_ENV !== "production" : true;

export function setDebugLogging(enabled: boolean): void {
    _debugEnabled = enabled;
}

export function debugLog(...args: unknown[]): void {
    if (_debugEnabled) {
        console.log(...args);
    }
}
