import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Members from "@/pages/(admin)/project/[id].vue";
import request from "@/utils/request";
import { message } from "kui-vue";
import { skeletonStub } from "./skeleton-stub";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { id: "p1" }, path: "/project/p1" }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (_props: unknown, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("header", [_props.title, slots.default?.(), slots.actions?.()]),
  },
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const auth = reactive({ permissions: ["project:read", "project:write"] as string[] });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const get = vi.mocked(request.get);
const put = vi.mocked(request.put);

const person = (index: number, name: string) => ({
  userId: `u${index}`,
  account: name,
  fullName: `成员${name}`,
  email: `${name}@k-ui.cn`,
  departmentId: null,
});
const roster = () => ({ members: [person(1, "a"), person(2, "b")], owner: person(3, "c") });
const project = {
  id: "p1",
  name: "KUI Vue Pro",
  code: "KUI-PRO",
  deadline: "2026-12-18",
  progress: 62,
  status: "active",
};

const disposers: Array<() => void> = [];
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Members);
  const passthrough = (props: string[] = []) => ({
    props,
    setup: (_props: Record<string, unknown>, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("div", [_props.title, slots.default?.(), slots.extra?.(), slots.actions?.()]),
  });
  for (const name of [
    "Card",
    "Form",
    "FormItem",
    "Grid",
    "GridItem",
    "Space",
    "Flex",
    "Divider",
    "Empty",
    "Icon",
    "Tag",
    "Avatar",
  ])
    app.component(name, passthrough(["title"]));
  app.component("Skeleton", skeletonStub as never);
  app.component(
    "Alert",
    passthrough(["title", "description"]) as never,
  );
  app.component(
    "Button",
    {
      props: ["disabled", "loading"],
      setup: (props: any, { slots }: { slots: Record<string, () => unknown> }) =>
        () => h("button", { disabled: props.disabled || props.loading }, slots.default?.()),
    } as never,
  );
  // A multiple select the test can toggle one option at a time.
  app.component(
    "Select",
    {
      props: ["modelValue", "options", "disabled", "multiple"],
      emits: ["update:modelValue"],
      setup: (props: any, { emit }: { emit: any }) =>
        () =>
          h("div", [
            String(props.modelValue?.join(",") ?? props.modelValue ?? ""),
            ...(props.options || []).map((option: any) =>
              h(
                "button",
                {
                  disabled: props.disabled,
                  "data-person": option.value,
                  onClick: () =>
                    emit(
                      "update:modelValue",
                      props.modelValue.includes(option.value)
                        ? props.modelValue.filter((value: string) => value !== option.value)
                        : [...props.modelValue, option.value],
                    ),
                },
                option.label,
              ),
            ),
          ]),
    } as never,
  );
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const buttons = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll("button")].filter((node) => node.textContent?.includes(text));

describe("project membership page", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    auth.permissions = ["project:read", "project:write"];
    vi.clearAllMocks();
    get.mockImplementation(((path: string) => {
      if (path === "/projects/p1/members") return Promise.resolve(roster());
      if (path === "/projects/p1") return Promise.resolve(project);
      return Promise.resolve({
        items: [person(4, "d"), person(1, "a"), person(2, "b")].map((row) => ({
          id: row.userId,
          account: row.account,
          fullName: row.fullName,
          enabled: true,
        })),
        total: 3,
        page: 1,
        pageSize: 100,
      });
    }) as never);
  });
  afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

  it("holds both panels while the roster is in flight", async () => {
    let arrive!: (rows: unknown) => void;
    get.mockImplementation(((path: string) => {
      if (path === "/projects/p1/members")
        return new Promise((resolve) => {
          arrive = resolve;
        });
      if (path === "/projects/p1") return Promise.resolve(project);
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 });
    }) as never);
    const root = mount();
    await flush();

    // Three cards are on the page now, but the plan one is not a frame: this account has no
    // milestone:read, so it already stands there with its own answer instead of waiting.
    expect(root.querySelectorAll(".skeleton").length).toBe(3);
    expect(root.querySelectorAll(".skeleton-line").length).toBe(2);
    // A frame must not read as a reading: no names, no headcount, no empty-project claim.
    expect(root.textContent).not.toContain("成员a");
    expect(root.textContent).not.toContain("未指定");
    expect(root.textContent).not.toContain("2 人");
    expect(root.textContent).not.toContain("这个项目还没有成员");

    arrive(roster());
    await flush();
    expect(root.querySelectorAll(".skeleton-line").length).toBe(0);
    expect(root.textContent).toContain("2 人");
    expect(root.textContent).toContain("成员a");
  });

  it("lists the roster, the owner and the pending change", async () => {
    const root = mount();
    await flush();

    expect(root.textContent).toContain("成员a");
    expect(root.textContent).toContain("成员c (c)");
    expect(root.textContent).toContain("KUI Vue Pro");
    expect(root.textContent).toContain("进行中");
    expect(root.textContent).toContain("2 人");
    expect(buttons(root, "保存成员")[0]!.disabled).toBe(true);
  });

  it("sends the whole set on save and adopts what the server returns", async () => {
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>('[data-person="u4"]')!.click();
    await flush();
    expect(root.textContent).toContain("待保存：新增 1 人，移除 0 人");
    expect(buttons(root, "保存成员")[0]!.disabled).toBe(false);

    put.mockResolvedValue({ ...roster(), members: [...roster().members, person(4, "d")] } as never);
    buttons(root, "保存成员")[0]!.click();
    await flush();

    expect(put).toHaveBeenCalledWith("/projects/p1/members", { userIds: ["u1", "u2", "u4"] });
    expect(message.success).toHaveBeenCalledWith("项目成员已保存");
    expect(buttons(root, "保存成员")[0]!.disabled).toBe(true);
  });

  it("can remove people it can already name when the directory is refused", async () => {
    get.mockImplementation(((path: string) =>
      path === "/users"
        ? Promise.reject(Object.assign(new Error("Forbidden"), { status: 403 }))
        : path === "/projects/p1/members"
          ? Promise.resolve(roster())
          : Promise.resolve(project)) as never);
    const root = mount();
    await flush();

    expect(root.textContent).toContain("无法读取用户目录");
    // The current members stay selectable, so leaving the project is still possible.
    expect(root.querySelectorAll("[data-person]").length).toBe(2);
    root.querySelector<HTMLButtonElement>('[data-person="u2"]')!.click();
    await flush();
    expect(root.textContent).toContain("待保存：新增 0 人，移除 1 人");
  });

  it("reads the list without a write permission and says so", async () => {
    auth.permissions = ["project:read"];
    const root = mount();
    await flush();

    expect(root.textContent).toContain("没有 project:write 权限");
    expect(root.querySelector<HTMLButtonElement>('[data-person="u4"]')!.disabled).toBe(true);
  });

  it("reports a refused roster instead of showing an empty project", async () => {
    get.mockImplementation(((path: string) =>
      path === "/users"
        ? Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 })
        : Promise.reject(new Error("Record not found"))) as never);
    const root = mount();
    await flush();

    expect(root.textContent).toContain("Record not found");
    expect(buttons(root, "重试").length).toBe(1);
    expect(root.textContent).not.toContain("这个项目还没有成员");
    // A refused read shows its sentence, not a frame still pretending to wait.
    expect(root.querySelectorAll(".skeleton-line").length).toBe(0);
  });
});
