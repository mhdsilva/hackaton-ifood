import { readFile } from "node:fs/promises";

import { AgentError } from "./pick-address.js";
import { resolveOptions, type ResolveOptionsSettings } from "./resolve-options.js";
import type {
  IfoodItemDetail,
  IfoodSearchItem,
  ResolveOptionsInput,
  ResolveOptionsOutput,
  ToolCaller,
} from "./types.js";

export interface DiscoveryFixture {
  searchOffers: Record<string, { results: IfoodSearchItem[] }>;
  getItem: Record<string, IfoodItemDetail>;
}

const DEFAULT_FIXTURE_URL = new URL(
  "../../../../fixtures/ifood-discovery-italiano.json",
  import.meta.url,
);

/** Endereço sintético da contingência: nenhum dado de conta real. */
const SIMULATED_ADDRESS = {
  addressId: "00000000-0000-4000-8000-000000000000",
  alias: "Demo",
  location: { neighborhood: "Centro", city: "São Carlos", state: "SP" },
  coordinates: { latitude: -22.0175, longitude: -47.8909 },
};

export async function loadDiscoveryFixture(
  url: URL = DEFAULT_FIXTURE_URL,
): Promise<DiscoveryFixture> {
  return JSON.parse(await readFile(url, "utf8")) as DiscoveryFixture;
}

/** `ToolCaller` que responde a partir da fixture capturada, com a mesma forma do MCP. */
export function fixtureCaller(fixture: DiscoveryFixture): ToolCaller {
  return {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      if (name === "listAddresses") return { results: [SIMULATED_ADDRESS] } as T;
      if (name === "searchOffers") {
        const query = String(args.query ?? "").toLowerCase();
        return (fixture.searchOffers[query] ?? { results: [] }) as T;
      }
      if (name === "getItem") {
        const detail = fixture.getItem[String(args.itemId)];
        if (!detail) throw new Error("item fora da fixture");
        return detail as T;
      }
      throw new Error(`tool ${name} sem fixture`);
    },
  };
}

/**
 * Tenta o iFood real; se falhar por indisponibilidade, devolve opções da fixture marcadas como
 * `simulated`. Erros que exigem ação do participante (endereço) não são mascarados.
 */
export async function resolveOptionsWithFallback(
  input: ResolveOptionsInput,
  caller: ToolCaller,
  fixture: DiscoveryFixture | (() => Promise<DiscoveryFixture>) = loadDiscoveryFixture,
  settings: ResolveOptionsSettings = {},
): Promise<ResolveOptionsOutput> {
  try {
    return await resolveOptions(input, caller, settings);
  } catch (error) {
    if (
      error instanceof AgentError &&
      [
        "NO_ADDRESS",
        "ADDRESS_SELECTION_REQUIRED",
        "ADDRESS_NOT_FOUND",
        "MCP_NOT_CONNECTED",
      ].includes(error.code)
    ) {
      throw error;
    }
    const data = typeof fixture === "function" ? await fixture() : fixture;
    const simulated = await resolveOptions(
      { ...input, addressId: undefined },
      fixtureCaller(data),
      settings,
    );
    return {
      ...simulated,
      source: "simulated",
      warnings: [...simulated.warnings, "Opções de demonstração: o iFood não respondeu a tempo"],
    };
  }
}
