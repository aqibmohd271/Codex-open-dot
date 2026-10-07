import "server-only";
import { getSetting, setSetting } from "./db";
export type RoutingConfig = {
  enabled: boolean;
  simple: string;
  complex: string;
  threshold: number;
  keywords: string[];
};
export const defaultRouting: RoutingConfig = {
  enabled: false,
  simple: "",
  complex: "",
  threshold: 1500,
  keywords: ["debug", "implement", "analyze", "compare", "research"],
};
export function routingConfig(): RoutingConfig {
  return {
    ...defaultRouting,
    ...JSON.parse(getSetting("model_routing") ?? "{}"),
  };
}
export function selectModel(
  config: RoutingConfig,
  text: string,
  fallback: string,
): string {
  if (!config.enabled) return fallback;
  const complex =
    text.length >= config.threshold ||
    config.keywords.some((k) => text.toLowerCase().includes(k.toLowerCase()));
  return (complex ? config.complex : config.simple) || fallback;
}
export function saveRouting(config: RoutingConfig, available: string[]) {
  if (
    typeof config.enabled !== "boolean" ||
    !Number.isInteger(config.threshold) ||
    config.threshold < 1 ||
    config.threshold > 100000 ||
    !Array.isArray(config.keywords) ||
    config.keywords.length > 50 ||
    config.keywords.some(
      (k) => typeof k !== "string" || !k.trim() || k.length > 100,
    )
  )
    throw new Error("Invalid routing rules");
  if (
    config.enabled &&
    (!available.includes(config.simple) || !available.includes(config.complex))
  )
    throw new Error("Choose two available models");
  setSetting("model_routing", JSON.stringify(config));
}
