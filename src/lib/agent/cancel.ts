const cancelled = new Set<string>();
export function cancelRun(id: string): void { cancelled.add(id); }
export function isCancelled(id: string): boolean { return cancelled.has(id); }
export function clearCancelled(id: string): void { cancelled.delete(id); }