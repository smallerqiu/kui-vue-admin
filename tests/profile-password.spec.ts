import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "@/pages/(admin)/profile.vue";
import { changePasswordApi } from "@/api/auth";
import { message } from "kui-vue";

vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (props: any) => () => h("header", String(props.title)),
  },
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/api/auth", () => ({ updateProfileApi: vi.fn(), changePasswordApi: vi.fn() }));

const replace = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ replace }) }));

const auth = reactive({ endSession: vi.fn(), roles: [], permissions: [] as string[], user: {} as Record<string, unknown> });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));
vi.mock("@/stores/theme", () => ({ useThemeStore: () => ({ theme: "light", setTheme: vi.fn() }) }));
vi.mock("@/stores/preferences", () => ({
  usePreferenceStore: () => ({ notification: false, watermark: false }),
}));

const password = vi.mocked(changePasswordApi);

/** Kui's layout and surface components wrap the dialog, so each one has to pass its slots on. */
const passThrough = {
  setup: (_props: object, { slots }: { slots: Record<string, (() => unknown) | undefined> }) =>
    () => h("div", Object.values(slots).flatMap((slot) => (slot ? [slot()] : []))),
};

/** Opens only when the page asks for it, the way Kui does, and keeps the footer reachable. */
const modalStub = {
  props: ["modelValue", "title"],
  setup: (props: any, { slots }: { slots: Record<string, (() => unknown) | undefined> }) => () =>
    props.modelValue
      ? h("div", { class: "modal" }, [
          String(props.title ?? ""),
          slots.default?.(),
          slots.footer?.(),
        ])
      : null,
};

const inputStub = {
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  setup(props: any, { emit }: { emit: (event: string, value: unknown) => void }) {
    return () =>
      h("input", {
        value: props.modelValue ?? "",
        disabled: props.disabled ? "" : undefined,
        onInput: (event: Event) =>
          emit("update:modelValue", (event.target as HTMLInputElement).value),
      });
  },
};

/** Declaring no props keeps `disabled` a real attribute and `@click` a real listener. */
const buttonStub = {
  setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) => () =>
    h("button", slots.default?.()),
};

/** The boxes are found by the label printed above them, which is what an operator reads. */
const formItemStub = {
  props: ["label"],
  setup: (props: any, { slots }: { slots: Record<string, () => unknown> }) => () =>
    h("div", { "data-label": String(props.label ?? "") }, slots.default?.()),
};

const disposers: Array<() => void> = [];

function mount() {
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
    "Switch",
    "FeatureCard",
  ]) {
    app.component(name, passThrough as never);
  }
  app.component("Modal", modalStub as never);
  app.component("FormItem", formItemStub as never);
  app.component("Input", inputStub as never);
  app.component("Button", buttonStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

function clickButton(root: HTMLElement, label: string) {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (element) => element.textContent?.trim() === label,
  );
  if (!button) throw new Error(`No button labelled ${label}`);
  button.click();
}

function field(root: HTMLElement, label: string) {
  const input = root.querySelector<HTMLInputElement>(`[data-label="${label}"] input`);
  if (!input) throw new Error(`The page rendered no ${label} box`);
  return input;
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

/** Fills the three boxes; the defaults are a pair the server would accept. */
async function fill(root: HTMLElement, values?: Partial<Record<"oldPassword" | "password" | "confirm", string>>) {
  typeInto(field(root, "当前密码"), values?.oldPassword ?? "old-password-1234");
  typeInto(field(root, "新密码"), values?.password ?? "brand-new-password-1234");
  typeInto(field(root, "确认新密码"), values?.confirm ?? "brand-new-password-1234");
  await flush();
}

beforeEach(() => {
  password.mockReset();
  replace.mockReset();
  auth.endSession.mockReset();
  password.mockResolvedValue({ ok: true, loginRequired: true });
});

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
});

describe("profile password dialog", () => {
  it("opens from the sign-in password row", async () => {
    const root = mount();
    await flush();

    expect(root.querySelector(".modal")).toBeNull();
    clickButton(root, "修改");
    await flush();

    expect(root.querySelector(".modal")!.textContent).toContain("修改登录密码");
    expect(root.querySelectorAll(".modal input").length).toBe(3);
  });

  /**
   * The server compares the first field against the stored hash and takes the new one under the
   * name `password`; a renamed or merged key is a 422 the operator would have to read.
   */
  it("sends the current and the new password as the two keys the endpoint reads", async () => {
    const root = mount();
    await flush();
    clickButton(root, "修改");
    await flush();
    await fill(root);
    clickButton(root, "确认修改");
    await flush();

    expect(password).toHaveBeenCalledWith("old-password-1234", "brand-new-password-1234");
  });

  it("ends the local session and lands on the sign-in page once the server accepted", async () => {
    const root = mount();
    await flush();
    clickButton(root, "修改");
    await flush();
    await fill(root);
    clickButton(root, "确认修改");
    await flush();

    // The session was revoked server side while the hash was replaced, so there is nothing left
    // to log out of -- and the held token would only come back as a 401 redirect.
    expect(auth.endSession).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/account/login");
    expect(message.success).toHaveBeenCalledWith("密码已修改，请使用新密码重新登录");
    expect(root.querySelector(".modal")).toBeNull();
  });

  it("keeps the dialog open with the server sentence when the current password is wrong", async () => {
    password.mockRejectedValue(new Error("Current password is incorrect"));
    const root = mount();
    await flush();
    clickButton(root, "修改");
    await flush();
    await fill(root, { oldPassword: "typo-typo-typo-1" });
    clickButton(root, "确认修改");
    await flush();

    const modal = root.querySelector(".modal")!;
    expect(modal.textContent).toContain("Current password is incorrect");
    expect(field(root, "当前密码").value).toBe("typo-typo-typo-1");
    expect(field(root, "新密码").value).toBe("brand-new-password-1234");
    expect(auth.endSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
  });

  it("refuses a blank current password before spending a request", async () => {
    const root = mount();
    await flush();
    clickButton(root, "修改");
    await flush();
    await fill(root, { oldPassword: "" });
    clickButton(root, "确认修改");
    await flush();

    expect(password).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")!.textContent).toContain("请输入当前密码");
  });

  /** The server schema requires twelve characters; catching it here saves a round trip and a 422. */
  it("refuses a new password shorter than the server minimum", async () => {
    const root = mount();
    await flush();
    clickButton(root, "修改");
    await flush();
    await fill(root, { password: "short-one", confirm: "short-one" });
    clickButton(root, "确认修改");
    await flush();

    expect(password).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")!.textContent).toContain("新密码至少 12 位");
  });

  it("refuses the two new-password boxes not matching", async () => {
    const root = mount();
    await flush();
    clickButton(root, "修改");
    await flush();
    await fill(root, { confirm: "another-password-123" });
    clickButton(root, "确认修改");
    await flush();

    expect(password).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")!.textContent).toContain("两次输入的新密码不一致");
  });

  it("says so when the other security rows have no server behaviour yet", async () => {
    const root = mount();
    await flush();

    clickButton(root, "更换");
    await flush();

    expect(message.info).toHaveBeenCalledWith("安全邮箱功能待接入服务端");
    expect(root.querySelector(".modal")).toBeNull();
  });
});
