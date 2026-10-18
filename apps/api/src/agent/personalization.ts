import { pickAddress } from "./pick-address.js";
import { stripPersonalData } from "./sanitize.js";
import type { IfoodAddress, IfoodSearchItem, ResolveOptionsInput, ToolCaller } from "./types.js";

export interface Personalization {
  profile: unknown;
  recommendations: IfoodSearchItem[];
}

/** Loads optional account personalization without making discovery depend on those tools. */
export async function loadPersonalization(
  input: ResolveOptionsInput,
  caller: ToolCaller,
): Promise<Personalization> {
  const addresses = await caller.callTool<{ results?: IfoodAddress[] }>("listAddresses");
  const address = pickAddress(addresses.results ?? [], input.addressId);

  const [rawProfile, rawRecommendations] = await Promise.allSettled([
    caller.callTool<Record<string, unknown>>("getUser"),
    caller.callTool<{ results?: IfoodSearchItem[] }>("getRecommendations", {
      userLocation: address.coordinates,
      pageSize: 20,
    }),
  ]);

  return {
    profile:
      rawProfile.status === "fulfilled" ? stripPersonalData(rawProfile.value) : undefined,
    recommendations:
      rawRecommendations.status === "fulfilled" ? rawRecommendations.value.results ?? [] : [],
  };
}
