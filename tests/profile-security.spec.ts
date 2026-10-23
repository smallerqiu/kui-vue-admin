import { computed, createApp, getCurrentInstance, h, inject, nextTick, provide, reactive, ref } from "vue";
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

const auth = reactive({
  endSession: vi.fn(),
  roles: [],
  permissions: [] as string[],
  user: {} as Record<string, unknown>,
});
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

/**
 * Renders the panel titles as clickable tabs and shows only the open panel's content -- Kui keeps
 * the others mounted behind `display: none`, and the difference is the whole point: a caret
 * cannot land in a panel that is not open.
 */
const tabsStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  setup(props: any, { slots, emit }: any) {
    provide("tabActive", computed(() => String(props.modelValue ?? "")));
    return () => {
      const panels = (slots.default?.() ?? []).filter(
        (node: any) => node?.props?.title !== undefined,
      );
      return h("div", { class: "tabs", "data-active": String(props.modelValue ?? "") }, [
        panels.map((node: any) =>
          h(
            "button",
            { class: "tab-label", onClick: () => emit("update:modelValue", String(node.key)) },
            String(node.props.title),
          ),
        ),
        panels,
      ]);
    };
  },
};

const tabPanelStub = {
  props: ["title"],
  setup(_props: object, { slots }: { slots: Record<string, () => unknown> }) {
    const key = String(getCurrentInstance()?.vnode.key ?? "");
    const active = inject("tabActive", computed(() => ""));
    return () => (active.value === key ? h("div", { class: "panel" }, slots.default?.()) : null);
  },
};

/** Names the row the button belongs to, so a click can be aimed at one of the two 更换 buttons. */
const featureCardStub = {
  props: ["title"],
  setup: (props: any, { slots }: { slots: Record<string, (() => unknown) | undefined> }) => () =>
    h("div", { class: "feature-card", "data-title": String(props.title ?? "") }, [
      slots.default?.(),
      slots.extra?.(),
    ]),
};

/** Opens only when the page asks for it, the way Kui does, and keeps the footer reachable. */
const modalStub = {
  props: ["modelValue", "title"],
  setup: (props: any, { slots }: { slots: Record<string, (() => unknown) | undefined> }) => () =>
    props.modelValue
      ? h("div", { class: "modal" }, [String(props.title ?? ""), slots.default?.(), slots.footer?.()])
      : null,
};

const inputStub = {
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  setup(
    props: any,
    { emit, expose }: { emit: (event: string, value: unknown) => void; expose: (api: object) => void },
  ) {
    const el = ref<HTMLInputElement>();
    // Kui's Input hands the page a `focus()` that reaches the native field underneath it.
    expose({ focus: () => el.value?.focus() });
    return () =>
      h("input", {
        ref: el,
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
    "Form",
    "Switch",
  ]) {
    app.component(name, passThrough as never);
  }
  app.component("Tabs", tabsStub as never);
  app.component("TabPanel", tabPanelStub as never);
  app.component("FeatureCard", featureCardStub as never);
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

function buttonIn(root: HTMLElement, label: string) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (element) => element.textContent?.trim() === label,
  );
}

function clickButton(root: HTMLElement, label: string) {
  const button = buttonIn(root, label);
  if (!button) throw new Error(`No button labelled ${label}`);
  button.click();
}

/** Opens the account-security panel; the rows are not on the tab the page boots on. */
async function openSecurity(root: HTMLElement) {
  clickButton(root, "账号安全");
  await flush();
}

/** The action of one security row, aimed by the row's own title. */
function clickRowButton(root: HTMLElement, title: string, label: string) {
  const row = root.querySelector<HTMLElement>(`.feature-card[data-title="${title}"]`);
  if (!row) throw new Error(`No security row titled ${title}`);
  const button = buttonIn(row, label);
  if (!button) throw new Error(`No ${label} button in the ${title} row`);
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
async function fill(
  root: HTMLElement,
  values?: Partial<Record<"oldPassword" | "password" | "confirm", string>>,
) {
  typeInto(field(root, "当前密码"), values?.oldPassword ?? "old-password-1234");
  typeInto(field(root, "新密码"), values?.password ?? "brand-new-password-1234");
  typeInto(field(root, "确认新密码"), values?.confirm ?? "brand-new-password-1234");
  await flush();
}

const activeTabOf = (root: HTMLElement) =>
  root.querySelector(".tabs")!.getAttribute("data-active");

beforeEach(() => {
  password.mockReset();
  replace.mockReset();
  auth.endSession.mockReset();
  password.mockResolvedValue({ ok: true, loginRequired: true });
  auth.user = { email: "admin@example.test", phone: "13800000000" };
});

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
});

describe("profile password dialog", () => {
  it("opens from the sign-in password row", async () => {
    const root = mount();
    await flush();

    expect(root.querySelector(".modal")).toBeNull();
    await openSecurity(root);
    clickRowButton(root, "登录密码", "修改");
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
    await openSecurity(root);
    clickRowButton(root, "登录密码", "修改");
    await flush();
    await fill(root);
    clickButton(root, "确认修改");
    await flush();

    expect(password).toHaveBeenCalledWith("old-password-1234", "brand-new-password-1234");
  });

  it("ends the local session and lands on the sign-in page once the server accepted", async () => {
    const root = mount();
    await flush();
    await openSecurity(root);
    clickRowButton(root, "登录密码", "修改");
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
    await openSecurity(root);
    clickRowButton(root, "登录密码", "修改");
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

  it("leaves the account-security panel open while the dialog is up", async () => {
    const root = mount();
    await flush();
    await openSecurity(root);
    clickRowButton(root, "登录密码", "修改");
    await flush();

    expect(activeTabOf(root)).toBe("security");
  });

  it("refuses a blank current password before spending a request", async () => {
    const root = mount();
    await flush();
    await openSecurity(root);
    clickRowButton(root, "登录密码", "修改");
    await flush();
    await fill(root, { oldPassword: "" });
    clickButton(root, "确认修改");
    await flush();

    expect(password).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")!.textContent).toContain("请输入当前密码");
  });

  /** The server's twelve character floor is what this guard mirrors, not a front-end preference. */
  it("refuses a new password shorter than the server minimum", async () => {
    const root = mount();
    await flush();
    await openSecurity(root);
    clickRowButton(root, "登录密码", "修改");
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
    await openSecurity(root);
    clickRowButton(root, "登录密码", "修改");
    await flush();
    await fill(root, { confirm: "another-password-123" });
    clickButton(root, "确认修改");
    await flush();

    expect(password).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")!.textContent).toContain("两次输入的新密码不一致");
  });
});

describe("profile contact rows", () => {
  /**
   * These two values are written by the basic-information form, so 更换 has to land the caret in
   * the box the save button reads -- an unfocused jump would leave the operator one click away
   * from the field and no better off than a toast.
   */
  it("moves to the basic-information tab and focuses the email box", async () => {
    const root = mount();
    await flush();

    await openSecurity(root);
    clickRowButton(root, "安全邮箱", "更换");
    await flush();

    expect(activeTabOf(root)).toBe("basic");
    expect(document.activeElement).toBe(field(root, "邮箱"));
    expect(field(root, "邮箱").value).toBe("admin@example.test");
  });

  it("focuses the phone box rather than the email one", async () => {
    const root = mount();
    await flush();

    await openSecurity(root);
    clickRowButton(root, "绑定手机", "更换");
    await flush();

    expect(activeTabOf(root)).toBe("basic");
    expect(document.activeElement).toBe(field(root, "手机号"));
    expect(field(root, "手机号").value).toBe("13800000000");
  });

  it("opens no dialog and sends no request for a contact change", async () => {
    const root = mount();
    await flush();

    await openSecurity(root);
    clickRowButton(root, "安全邮箱", "更换");
    await flush();

    expect(root.querySelector(".modal")).toBeNull();
    expect(password).not.toHaveBeenCalled();
  });
});

describe("profile row with nothing behind it", () => {
  /** A row that has no endpoint and no field to jump to has to say that rather than move the page. */
  it("leaves the panel where it is for two-factor and names the missing server behaviour", async () => {
    const root = mount();
    await flush();

    await openSecurity(root);
    clickRowButton(root, "两步验证", "开启");
    await flush();

    expect(message.info).toHaveBeenCalledWith("两步验证功能待接入服务端");
    expect(activeTabOf(root)).toBe("security");
    expect(root.querySelector(".modal")).toBeNull();
  });
});
