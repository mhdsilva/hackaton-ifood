import { AgentError, pickAddress } from "./pick-address.js";
import { stripPersonalData } from "./sanitize.js";
import type { IfoodAddress, IfoodSearchItem, ResolveOptionsInput, ToolCaller } from "./types.js";

export interface RequiredPersonalization {
  profile: unknown;
  recommendations: IfoodSearchItem[];
}

/** Calls both account personalization tools before any option generation or fallback. */
export async function loadRequiredPersonalization(
  input: ResolveOptionsInput,
  caller: ToolCaller,
): Promise<RequiredPersonalization> {
  const addresses = await caller.callTool<{ results?: IfoodAddress[] }>("listAddresses");
  const address = pickAddress(addresses.results ?? [], input.addressId);

  try {
    const [rawProfile, rawRecommendations] = await Promise.all([
      caller.callTool<Record<string, unknown>>("getUser"),
      caller.callTool<{ results?: IfoodSearchItem[] }>("getRecommendations", {
        userLocation: address.coordinates,
        pageSize: 20,
      }),
    ]);
    return {
      profile: stripPersonalData(rawProfile),
      recommendations: rawRecommendations.results ?? [],
    };
  } catch {
    throw new AgentError(
      "PERSONALIZATION_REQUIRED",
      "Não foi possível carregar seu perfil e suas recomendações do iFood. Tente novamente.",
    );
  }
}
