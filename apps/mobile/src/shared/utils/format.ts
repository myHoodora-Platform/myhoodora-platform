/** "₦25,000", or "Free" for null: the web's formatNaira, without relying on the engine's Intl locale data. */
export function formatNaira(amount: number | null): string {
  if (amount === null) return "Free";
  return `₦${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** The first word of a name, for "Hi Ada". */
export const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] ?? "";
