import type { Directive } from "vue";
import { getAuthUser } from "@/utils/auth";
import { hasPermission } from "@/routers/permissions";

export const permission: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    if (!hasPermission(binding.value, getAuthUser().permissions || []))
      el.remove();
  },
};
