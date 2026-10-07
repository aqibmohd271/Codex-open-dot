"use server";
import { requireRole } from "@/server/access";
import * as providers from "@/server/providers";
import { resetModels, models } from "@/server/agent/client";
import { computerInfo } from "@/server/snapshot";
import { emit } from "@/server/bus";
import type { ProviderInput } from "@/lib/providers";
export async function getProviders() {
  await requireRole("owner", "getProviders");
  return providers.listProviders();
}
export async function saveCustomProvider(input: ProviderInput) {
  await requireRole("owner", "saveCustomProvider");
  providers.saveProvider(input);
  resetModels();
  await models();
  emit({ type: "computer", data: computerInfo() });
  return providers.listProviders();
}
export async function removeCustomProvider(id: string) {
  await requireRole("owner", "removeCustomProvider");
  providers.deleteProvider(id);
  resetModels();
  await models();
  emit({ type: "computer", data: computerInfo() });
  return providers.listProviders();
}
export async function testCustomProvider(id: string) {
  await requireRole("owner", "testCustomProvider");
  return providers.testProvider(id);
}
export async function fetchCustomModels(id: string) {
  await requireRole("owner", "fetchCustomModels");
  return providers.discoverModels(id);
}
