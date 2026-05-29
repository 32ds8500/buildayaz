export const VIRTUALIZATION_THRESHOLD = 250;

export function shouldVirtualize(itemCount: number): boolean {
  return itemCount >= VIRTUALIZATION_THRESHOLD;
}
