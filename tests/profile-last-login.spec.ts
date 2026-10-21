import { createApp, h, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "@/pages/(admin)/profile.vue";

vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (props: any) => () => h("header", String(props.title)),
  },
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/api/auth", () => ({ updateProfileApi: vi.fn() }));
vi.mock("@/config/app", () => ({ appConfig: { useMock: true } }));

const user = reactive<Record<string, unknown>>({});
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user, roles: [], permissions: [] }) }));
vi.mock("@/stores/theme", () => ({ useThemeStore: () => ({ theme: "light", setTheme: vi.fn() }) }));
vi.mock("@/stores/preferences", () => ({
  usePreferenceStore: () => ({ notification: false, watermark: false }),
}));

/** Kui's layout and surface components wrap the meta rows, so each one has to pass its slots on. */
const passThrough = {
  setup: (_props: object, { slots }: { slots: Record<string, (() => unknown) | undefined> }) =>
    () => h("div", Object.values(slots).flatMap((slot) => (slot ? [slot()] : []))),
};

function lastLoginText() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Profile);
  for (const name of [
    "Grid",
    "GridItem",
    "Card",
    "Badge",
    "Space",
    "Divider",
    "Avatar",
    "Tag",
    "Tabs",
    "TabPanel",
    "Form",
    "FormItem",
    "Input",
    "Button",
    "Switch",
    "FeatureCard",
  ]) {
    app.component(name, passThrough as never);
  }
  app.mount(root);
  const row = Array.from(root.querySelectorAll<HTMLElement>(".profile-meta > div")).find(
    (element) => element.querySelector("span")?.textContent?.trim() === "上次登录",
  );
  const text = row?.querySelector("strong")?.textContent?.trim();
  app.unmount();
  root.remove();
  if (!row || text === undefined) throw new Error("The profile page rendered no 上次登录 row");
  return text;
}

beforeEach(() => {
  for (const key of Object.keys(user)) delete user[key];
  user.fullName = "Administrator";
});

describe("profile last sign-in", () => {
  it("shows the previous sign-in the server reported", () => {
    user.lastLoginAt = "2026-10-21T06:01:50.306344";
    expect(lastLoginText()).toBe("2026-10-21 06:01");
  });

  it("says the account is signing in for the first time when the column is null", () => {
    user.lastLoginAt = null;
    expect(lastLoginText()).toBe("首次登录");
  });

  /**
   * A snapshot stored before the server kept the column has no key at all. Reading that as
   * "first login" would tell a returning operator they had never signed in before.
   */
  it("keeps an absent value separate from a null one", () => {
    expect(lastLoginText()).toBe("暂未提供");
  });
});
