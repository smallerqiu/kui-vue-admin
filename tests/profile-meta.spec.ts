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

/** The labelled cell on the account card, with its wrapper components stubbed out. */
function metaText(label: string) {
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
    (element) => element.querySelector("span")?.textContent?.trim() === label,
  );
  const text = row?.querySelector("strong")?.textContent?.trim();
  app.unmount();
  root.remove();
  if (!row || text === undefined) throw new Error(`The profile page rendered no ${label} row`);
  return text;
}

/** The biography box the basic-information form writes. */
function bioInput() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Profile);
  const seen: unknown[] = [];
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
    "Button",
    "Switch",
    "FeatureCard",
  ]) {
    app.component(name, passThrough as never);
  }
  app.component("FormItem", {
    props: ["label"],
    setup: (props: any, { slots }: any) => () => {
      // The control inside the labelled box is the biography's own input, so whatever value it is
      // bound to right now is the value the page would send on save.
      if (props.label === "个人简介") seen.push(slots.default?.()[0]?.props?.modelValue);
      return h("div", slots.default?.());
    },
  } as never);
  app.component("Input", { props: ["modelValue", "placeholder"], setup: () => () => h("input") } as never);
  app.mount(root);
  app.unmount();
  root.remove();
  if (!seen.length) throw new Error("The profile page rendered no 个人简介 box");
  return seen[0];
}

beforeEach(() => {
  for (const key of Object.keys(user)) delete user[key];
  user.fullName = "Administrator";
});

describe("profile last sign-in", () => {
  it("shows the previous sign-in the server reported", () => {
    user.lastLoginAt = "2026-10-21T06:01:50.306344";
    expect(metaText("上次登录")).toBe("2026-10-21 06:01");
  });

  it("says the account is signing in for the first time when the column is null", () => {
    user.lastLoginAt = null;
    expect(metaText("上次登录")).toBe("首次登录");
  });

  /**
   * A snapshot stored before the server kept the column has no key at all. Reading that as
   * "first login" would tell a returning operator they had never signed in before.
   */
  it("keeps an absent value separate from a null one", () => {
    expect(metaText("上次登录")).toBe("暂未提供");
  });
});

describe("profile department and sign-in place", () => {
  it("names the department instead of printing its id", () => {
    user.departmentId = "9a3f5f2e7c1d4b08a6e2f0c3d4e5f601";
    user.departmentName = "平台研发中心";
    expect(metaText("所属部门")).toBe("平台研发中心");
  });

  /**
   * The account above is the shape that matters: an id with no name resolved for it must not put
   * the raw key on a profile card.
   */
  it("falls back when no department name came with the account", () => {
    user.departmentId = "9a3f5f2e7c1d4b08a6e2f0c3d4e5f601";
    expect(metaText("所属部门")).toBe("未设置");
  });

  it("shows the address the previous sign-in came from", () => {
    user.lastLoginIp = "203.0.113.9";
    expect(metaText("登录地点")).toBe("203.0.113.9");
  });

  it("says nothing was provided for an account with no sign-in behind this one", () => {
    user.lastLoginIp = null;
    expect(metaText("登录地点")).toBe("暂未提供");
  });
});

describe("profile biography", () => {
  it("starts the form from the biography the account carries", () => {
    user.bio = "负责 KUI Pro 平台建设与业务管理。";
    expect(bioInput()).toBe("负责 KUI Pro 平台建设与业务管理。");
  });

  it("opens the box empty rather than writing the null back as text", () => {
    user.bio = null;
    expect(bioInput()).toBe("");
  });
});
