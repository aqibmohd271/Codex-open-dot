"use server";
import { requireRole } from "@/server/access";
import {
  routingConfig,
  saveRouting,
  type RoutingConfig,
} from "@/server/routing";
import { models } from "@/server/agent/client";
export async function getRouting() {
  await requireRole("owner", "getRouting");
  return routingConfig();
}
export async function updateRouting(config: RoutingConfig) {
  await requireRole("owner", "updateRouting");
  saveRouting(config, (await models()).available);
  return routingConfig();
}
