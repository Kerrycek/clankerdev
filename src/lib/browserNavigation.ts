export function hardReplace(url: string): void {
  window.location.replace(url);
}

export function hardAssign(url: string): void {
  window.location.assign(url);
}

export function hardReload(): void {
  window.location.reload();
}
