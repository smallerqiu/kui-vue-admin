import { createApp, defineComponent, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/pages/(admin)/index.vue";
import { systemApi, type Dashboard } from "@/api/system";
import { skeletonStub } from "./skeleton-stub";

vi.mock("@/api/system", () => ({ systemApi: { dashboard: vi.fn() } }));
// The page reaches for the shared project vocabulary rather than a copy of its own, and that module
// sits on the request layer -- mocked here so the spec never loads an HTTP client to read a label.
vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("kui-vue", () => ({
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
// Charts draw into a canvas jsdom cannot back, so this one becomes a data sink: what these tests
// care about is which figures the page hands it, and whether it tells the chart to wait.
vi.mock("@/components/charts/TrendChart.vue", () => ({
  default: {
    props: ["data", "name", "suffix", "loading"],
    setup: (props: { data: unknown; name: string; loading: boolean }) => () =>
      h("div", {
        "data-trend": JSON.stringify(props.data),
        "data-name": props.name,
        "data-loading": String(props.loading),
      }),
  },
}));

const auth = reactive({
  permissions: ["*"] as string[],
  user: { id: "actor", name: "操作员", fullName: "" },
});
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));
const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

/**
 * One workbench read as the server sends it: counts as numbers, money as two-decimal text, the two
 * panels as rows the account is allowed to open, and a queue the account may not read as null rather
 * than as zero. Every figure here is one the aggregate answers for; the page invents none of them.
 */
const figures: Dashboard = {
  orders: 12345,
  revenue: "1234567.89",
  customers: 42,
  products: 8,
  projects: 3,
  tasks: 17,
  ordersToday: 26,
  ordersTodayChange: 12.6,
  revenueMonth: "5376.00",
  revenueMonthChange: -8.4,
  ordersAwaitingShipment: 4,
  customersThisMonth: 4,
  customersThisMonthChange: 0,
  tasksOverdue: 9,
  approvalsPending: 3,
  afterSalesPending: 4,
  recentProjects: [
    {
      id: "p1",
      name: "移动端改版",
      deadline: "2026-11-03",
      progress: 45,
      status: "active",
      teamName: "研发中心",
    },
    {
      id: "p2",
      name: "数据平台升级",
      deadline: null,
      progress: null,
      status: "planning",
      teamName: null,
    },
  ],
  trend: [
    { bucket: "2026-10-16", orders: 1, revenue: "598.00" },
    { bucket: "2026-10-17", orders: 0, revenue: "0.00" },
    { bucket: "2026-10-18", orders: 0, revenue: "0.00" },
    { bucket: "2026-10-19", orders: 2, revenue: "1200.5" },
    { bucket: "2026-10-20", orders: 1, revenue: "0.00" },
    { bucket: "2026-10-21", orders: 0, revenue: "0.00" },
    { bucket: "2026-10-22", orders: 1, revenue: "1999.50" },
  ],
  activities: [
    {
      id: "a1",
      actorName: "陈默",
      moduleName: "售后管理",
      operation: "登记退款结果",
      level: "warning",
      createdAt: "2026-10-21T17:16:03.123456",
    },
    {
      id: "a2",
      actorName: null,
      moduleName: "客户管理",
      operation: "删除客户",
      level: "danger",
      createdAt: "2026-10-20T08:59:02.975709",
    },
  ],
};

const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

/** A card the test can read: the title is the promise, `data-stat` is what the page decided to show. */
const statCardStub = {
  props: ["title", "items"],
  setup: (props: { title: string; items: unknown[] }) =>
    () =>
      h("div", {
        class: "stat",
        "data-title": props.title,
        "data-stat": JSON.stringify(props.items?.[0] ?? {}),
      }),
};
// Titles stay reachable because the page keys its cards, panels and totals by them.
const cardStub = {
  props: ["title"],
  setup: (props: { title: string }, { slots }: { slots: Record<string, () => unknown> }) =>
    () => h("section", { "data-title": props.title }, [slots.extra?.(), slots.default?.()]),
};
const itemStub = {
  props: ["label"],
  setup: (props: { label: string }, { slots }: { slots: Record<string, () => unknown> }) =>
    () => h("div", { class: "item", "data-label": props.label }, slots.default?.()),
};
const tagStub = {
  props: ["color", "theme", "size"],
  setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
    () => h("span", { class: "tag" }, slots.default?.()),
};
const progressStub = {
  props: ["percent"],
  setup: (props: { percent: number }) => () => h("div", { class: "progress", "data-percent": props.percent }),
};
const featureCardStub = {
  props: ["title"],
  setup: (props: { title: string }, { slots }: { slots: Record<string, () => unknown> }) =>
    () => h("button", { class: "entry", "data-entry": props.title }, slots.default?.()),
};

const disposers: Array<() => void> = [];

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(DashboardPage);
  for (const name of ["PageHeader", "Space", "Grid", "GridItem", "Flex", "Icon", "Avatar", "Button"])
    app.component(
      name,
      defineComponent({
        setup:
          (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
          () =>
            h("div", Object.values(slots).map((slot) => slot())),
      }) as never,
    );
  app.component("Card", cardStub as never);
  app.component("StatCard", statCardStub as never);
  app.component("Descriptions", cardStub as never);
  app.component("DescriptionsItem", itemStub as never);
  app.component("Tag", tagStub as never);
  app.component("Progress", progressStub as never);
  app.component("FeatureCard", featureCardStub as never);
  app.component("Skeleton", skeletonStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const panel = (root: HTMLElement, title: string) =>
  root.querySelector(`section[data-title="${title}"]`)!;
const card = (root: HTMLElement, title: string) =>
  [...root.querySelectorAll<HTMLElement>(".stat")].find((node) => node.dataset.title === title)!;
const item = (root: HTMLElement, title: string) => JSON.parse(card(root, title).dataset.stat!);
const total = (root: HTMLElement, label: string) =>
  [...panel(root, "数据总览").querySelectorAll<HTMLElement>(".item")].find(
    (node) => node.dataset.label === label,
  )!.textContent?.trim();

describe("workbench figures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.permissions = ["*"];
    auth.user.fullName = "";
    vi.mocked(systemApi.dashboard).mockResolvedValue(structuredClone(figures));
  });
  afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

  it("holds the layout while the first read is in flight", async () => {
    let arrive!: (value: Dashboard) => void;
    vi.mocked(systemApi.dashboard).mockReturnValue(
      new Promise<Dashboard>((resolve) => {
        arrive = resolve;
      }),
    );
    const root = mount();
    await nextTick();

    // The body is never swapped for a sentence: the four card positions, the panels, the shortcut box
    // and the totals are all framed, each holding a placeholder where its figures will go.
    expect(root.querySelectorAll(".stat-skeleton")).toHaveLength(4);
    for (const title of ["近 7 天收款趋势", "项目进度", "近期活动", "快捷入口", "数据总览"])
      expect(panel(root, title).querySelector(".skeleton-line")).toBeTruthy();
    expect(root.querySelectorAll(".skeleton-line")).toHaveLength(9);
    // Nothing on the page yet reads like a figure the server answered -- least of all a zero it never
    // paid -- and no panel claims a permission the read has not had the chance to answer.
    expect(root.querySelectorAll(".stat")).toHaveLength(0);
    expect(root.textContent).not.toContain("¥");
    expect(root.textContent).not.toContain("无法读取");
    expect(root.textContent).not.toContain("正在加载");
    // The line is the one piece here that reports its own wait, and the shortcuts need no read at
    // all: they come from the account's permissions, so they are clickable from the first frame.
    const chart = panel(root, "近 7 天收款趋势").querySelector("[data-trend]")!;
    expect(JSON.parse(chart.dataset.trend!)).toEqual([]);
    expect(chart.dataset.loading).toBe("true");
    expect(root.querySelectorAll(".entry")).toHaveLength(6);

    arrive(structuredClone(figures));
    await flush();
    expect(root.querySelectorAll(".skeleton-line")).toHaveLength(0);
    expect(root.querySelectorAll(".stat-skeleton")).toHaveLength(0);
    expect(chart.dataset.loading).toBe("false");
    expect(card(root, "今日订单")).toBeTruthy();
    expect(panel(root, "近 7 天收款趋势").textContent).toContain("¥ 3,798.00");
  });

  it("hands each window its card, and the money its unit", async () => {
    const root = mount();
    await flush();

    // The card titles are the windows: 今日 over the UTC day, 本月 over the month to date, and each
    // trend the server computed over a window of the same length.
    expect(card(root, "今日订单")).toBeTruthy();
    expect(item(root, "今日订单")).toMatchObject({ value: 26, precision: 0, desc: "较昨日同时段" });
    expect(item(root, "今日订单").trend).toBe("+12.6%");
    expect(item(root, "今日订单").trendStatus).toBe("success");
    // Money leaves the API as decimal text; the page hands it to the card as a number worth two
    // decimals with the group separator, and never runs a count through it.
    expect(item(root, "本月净收款")).toMatchObject({
      value: 5376,
      precision: 2,
      prefix: "¥",
      separator: ",",
    });
    expect(item(root, "本月净收款").trend).toBe("-8.4%");
    expect(item(root, "本月净收款").trendStatus).toBe("danger");
    expect(item(root, "本月新增客户").trend).toBe("0.0%");
    expect(item(root, "本月新增客户").trendStatus).toBe("default");
  });

  it("refuses a percentage the moment the comparison window has no baseline", async () => {
    vi.mocked(systemApi.dashboard).mockResolvedValue(
      structuredClone({
        ...figures,
        ordersTodayChange: null,
        revenueMonthChange: null,
        customersThisMonthChange: null,
      }),
    );
    const root = mount();
    await flush();

    // A quiet yesterday makes a ratio meaningless rather than zero: the card says which window was
    // empty instead of drawing an arrow over a 0% nobody divided.
    expect(item(root, "今日订单")).toMatchObject({ trend: "", desc: "昨日同时段还没有订单" });
    expect(item(root, "本月净收款")).toMatchObject({ trend: "", desc: "上月同期还没有收款" });
    expect(item(root, "本月新增客户")).toMatchObject({ trend: "", desc: "上月同期还没有新增客户" });
    expect(item(root, "今日订单").trendStatus).toBe("default");
  });

  it("names a queue the account may not read instead of counting it as empty", async () => {
    vi.mocked(systemApi.dashboard).mockResolvedValue(
      structuredClone({ ...figures, approvalsPending: null, afterSalesPending: null }),
    );
    const root = mount();
    await flush();

    expect(item(root, "待审批申请")).toMatchObject({ value: 0, desc: "当前账号无法读取审批" });
    const notice = panel(root, "快捷入口").textContent!;
    // The row stays on the page: hiding it would read as a list with nothing in it.
    expect(notice).toContain("待审批申请");
    expect(notice).toContain("待处理售后");
    expect(notice.match(/无读取权限/g)).toHaveLength(2);
    // The two the account can read still show their counts and their links.
    expect(notice).toContain("待发货订单");
    expect(notice).toContain("4 项");
    expect(notice).toContain("9 项");
  });

  it("tells a closed panel from an empty one", async () => {
    vi.mocked(systemApi.dashboard).mockResolvedValue(
      structuredClone({ ...figures, recentProjects: null, activities: null }),
    );
    const root = mount();
    await flush();
    expect(panel(root, "项目进度").textContent).toContain("当前账号无法读取项目");
    expect(panel(root, "近期活动").textContent).toContain("当前账号无法读取操作日志");

    vi.mocked(systemApi.dashboard).mockResolvedValue(
      structuredClone({ ...figures, recentProjects: [], activities: [] }),
    );
    const open = mount();
    await flush();
    // An account that looked and found nothing is a different sentence from one that could not look.
    expect(panel(open, "项目进度").textContent).toContain("暂无在跟进的项目");
    expect(panel(open, "近期活动").textContent).toContain("最近没有操作记录");
  });

  it("says what a project is in the words the projects table uses", async () => {
    const root = mount();
    await flush();

    const rows = panel(root, "项目进度").querySelectorAll(".project-item");
    expect(rows).toHaveLength(2);
    // 进行中 is the label `projectStatusOptions` gives `active` -- the same list the form writes with.
    expect(rows[0]!.textContent).toContain("移动端改版");
    expect(rows[0]!.textContent).toContain("进行中");
    expect(rows[0]!.textContent).toContain("研发中心 · 截止 2026-11-03");
    expect(rows[0]!.querySelector(".progress")!.dataset.percent).toBe("45");
    // A row with no team and no deadline says so; a status code the vocabulary does not know is not
    // silently printed as the raw code.
    expect(rows[1]!.textContent).toContain("未分配团队 · 未设截止日期");
    expect(rows[1]!.textContent).toContain("规划中");
    expect(rows[1]!.querySelector(".progress")!.dataset.percent).toBe("0");
  });

  it("prints the audit rows the log page prints", async () => {
    const root = mount();
    await flush();

    const rows = panel(root, "近期活动").querySelectorAll(".activity-item");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("陈默");
    expect(rows[0]!.textContent).toContain("登记退款结果");
    expect(rows[0]!.textContent).toContain("售后管理");
    // The stored instant is read back the way it was written: naive UTC, to the minute.
    expect(rows[0]!.textContent).toContain("2026-10-21 17:16");
    // An account deleted after acting keeps its row, and the row says whose name is gone.
    expect(rows[1]!.textContent).toContain("已注销账号");
    expect(rows[1]!.textContent).toContain("2026-10-20 08:59");
  });

  it("draws the seven buckets it was given and totals the same ones it shows", async () => {
    const root = mount();
    await flush();

    const chart = panel(root, "近 7 天收款趋势").querySelector("[data-trend]")!;
    const points = JSON.parse(chart.dataset.trend!);
    expect(points).toHaveLength(7);
    // Day buckets keep the server's UTC order and drop only the century, as 经营分析 draws them.
    expect(points[0]).toEqual({ label: "10/16", value: 598 });
    expect(points[6]).toEqual({ label: "10/22", value: 1999.5 });
    // 598.00 + 1200.5 + 1999.50 added as decimals, not as floats: the total on the card is the sum of
    // the seven points the line draws.
    expect(panel(root, "近 7 天收款趋势").textContent).toContain("¥ 3,798.00");
    expect(chart.dataset.name).toBe("收款");
  });

  it("keeps the totals it has always shown, grouped for money and plain for counts", async () => {
    const root = mount();
    await flush();

    expect(total(root, "累计净收款金额")).toBe("¥ 1,234,567.89");
    expect(total(root, "订单总数")).toBe("12345");
    expect(total(root, "客户总数")).toBe("42");
    expect(total(root, "商品总数")).toBe("8");
    expect(total(root, "项目总数")).toBe("3");
    expect(total(root, "任务总数")).toBe("17");
  });

  it("prints the zero the server paid rather than a blank", async () => {
    vi.mocked(systemApi.dashboard).mockResolvedValue(
      structuredClone({
        ...figures,
        revenue: "0.00",
        revenueMonth: "0.00",
        revenueMonthChange: null,
        trend: figures.trend.map((point) => ({ ...point, revenue: "0.00", orders: 0 })),
      }),
    );
    const root = mount();
    await flush();

    // A quiet instance is still an instance that counted: 0.00 is what the sums answered.
    expect(total(root, "累计净收款金额")).toBe("¥ 0.00");
    expect(panel(root, "近 7 天收款趋势").textContent).toContain("¥ 0.00");
    expect(item(root, "本月净收款")).toMatchObject({ value: 0, desc: "上月同期还没有收款" });
  });

  it("offers only the shortcuts this account can open", async () => {
    auth.permissions = ["task:read", "customer:read"];
    const root = mount();
    await flush();

    const entries = [...panel(root, "快捷入口").querySelectorAll<HTMLElement>(".entry")].map(
      (node) => node.dataset.entry,
    );
    expect(entries).toEqual(["客户管理"]);
    // A queue the account can still read keeps its number even when its shortcut is not on offer:
    // the server answered the count, so the page does not hide a figure it was given.
    expect(panel(root, "快捷入口").textContent).toContain("逾期任务");
  });
});
