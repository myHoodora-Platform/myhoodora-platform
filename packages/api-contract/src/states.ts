/**
 * Nigeria's 36 states and the FCT, as a Hood's `state`. A Hood has a city (Lagos, Ibadan, Abeokuta) and
 * the state that city is in (Lagos, Oyo, Ogun). The API keeps the same list (hood.schema.ts).
 */
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export function isNigerianState(value: string): value is NigerianState {
  return (NIGERIAN_STATES as readonly string[]).includes(value);
}

/** How a state reads on its own: "Oyo State", "Lagos State", but "the FCT". */
export function stateLabel(state: string): string {
  return state === "FCT" ? "FCT (Abuja)" : `${state} State`;
}
