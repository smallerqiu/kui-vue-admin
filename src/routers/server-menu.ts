import { appConfig } from "../config/app";
import { getAuthUser, getToken } from "../utils/auth";
import { applyServerMenu, type ServerMenu } from "./permissions";
import request from "@/utils/request";
import type { AdminMenuItem } from "../components/system/useMenu";

/**
 * The server menu is one round trip whose shape only changes when somebody edits a menu row,
 * and it used to sit in front of every navigation -- p50 878 ms against the deployed database.
 * One entry per account is enough: another login keys a different entry, a failed fetch drops
 * the entry so the next attempt is a real request, and the reload that follows a menu edit
 * resets this module. `local` is the menu built from the route table, which the server records
 * only annotate.
 */
let cache: { account: string; menu: Promise<AdminMenuItem[]> } | null = null;

export const loadServerMenu = (local: AdminMenuItem[]): Promise<AdminMenuItem[]> => {
  if (appConfig.useMock) return Promise.resolve(local);
  const user = getAuthUser();
  const account = String(user.id ?? user.name ?? "");
  if (!getToken() || !account) return Promise.resolve([]);
  if (cache?.account === account) return cache.menu;
  const menu = request
    .get<ServerMenu[]>("/navigation")
    .then((records) => applyServerMenu(local, records));
  menu.catch(() => {
    if (cache?.menu === menu) cache = null;
  });
  cache = { account, menu };
  return menu;
};
