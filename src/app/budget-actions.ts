"use server";
import { requireRole } from "@/server/access";
import {
  budgetConfig,
  saveBudget,
  usageSummary,
  type BudgetConfig,
} from "@/server/budget";
export async function getBudget() {
  await requireRole("owner", "getBudget");
  return { config: budgetConfig(), usage: usageSummary() };
}
export async function updateBudget(config: BudgetConfig) {
  await requireRole("owner", "updateBudget");
  saveBudget(config);
  return getBudget();
}
