<template>
  <div class="calendar-page">
    <PageHeader title="团队日程" description="按月读取服务端的日程，选中日期查看当天安排。">
      <template #actions>
        <Segmented v-model="view" :options="views" />
        <Button v-if="view === 'month' && canWrite" type="primary" :icon="Plus" @click="openCreate(selectedDate)">
          新建日程
        </Button>
      </template>
    </PageHeader>

    <!-- The table view owns bulk browsing; it mounts only when selected so a month visit never pays for it. -->
    <ResourceManager v-if="view === 'list'" :definition="resources.calendar!" />

    <template v-else>
      <p v-if="error" role="alert">
        {{ error }}
        <Button @click="reload">重试</Button>
      </p>
      <p v-else-if="truncated" class="calendar-note" role="status">
        本月共 {{ total }} 条日程，已读取 {{ events.length }} 条；按分类筛选可以缩小范围。
      </p>

      <Grid :cols="{ xs: 1, xl: 12 }" :x-gap="16" :y-gap="16">
        <GridItem :span="{ xs: 1, xl: 9 }">
          <Card bordered class="calendar-card">
            <Calendar v-model="selectedDate" :events="calendarEvents" @month-change="onMonthChange"
              @event-click="openDetail">
              <template #extra>
                <!-- `block` would stack the filter under the toolbar; the row is width-capped on purpose. -->
                <Select v-model="category" clearable placeholder="全部日程" :options="calendarCategoryOptions"
                  style="width: 160px" />
              </template>
            </Calendar>
          </Card>
        </GridItem>

        <GridItem :span="{ xs: 1, xl: 3 }">
          <Card bordered title="当日日程" class="agenda-card">
            <template #extra>
              <Tag theme="fill">{{ selectedDate }}</Tag>
            </template>
            <p v-if="loading" role="status">正在加载日程…</p>
            <div v-else-if="dayEvents.length" class="agenda-list">
              <button v-for="event in dayEvents" :key="event.id" type="button" @click="openRecord(event)">
                <span :style="{ background: calendarCategories[event.category].color }"></span>
                <div>
                  <strong>{{ event.title }}</strong>
                  <small>
                    <Icon :type="Clock" />
                    {{ formatTime(event.time) }} · {{ calendarCategories[event.category].label }}
                  </small>
                  <small>
                    <Icon :type="event.online ? Video : MapPin" />
                    {{ event.location || "未填写地点" }}
                  </small>
                </div>
              </button>
            </div>
            <Empty v-else description="当天暂无日程" />
            <Button v-if="canWrite" block theme="plain" :icon="Plus" @click="openCreate(selectedDate)">
              添加日程
            </Button>
            <p v-else class="calendar-note">当前账号没有 calendar:write 权限，月历只读。</p>
          </Card>

          <Card bordered title="日程分类" class="legend-card">
            <div v-for="item in calendarCategoryOptions" :key="item.value">
              <span :style="{ background: calendarCategories[item.value].color }"></span>
              {{ item.label }}
              <em>{{ events.filter((event) => event.category === item.value).length }}</em>
            </div>
          </Card>
        </GridItem>
      </Grid>

      <Drawer v-model="formOpen" :title="editingId ? '编辑日程' : '新建日程'" :width="480" :closable="!saving"
        :mask-closable="!saving" :esc-key="!saving" @ok="submit">
        <Form layout="vertical">
          <FormItem label="日程标题">
            <Input v-model="form.title" :maxlength="200" clearable placeholder="请输入日程标题" :disabled="saving" />
          </FormItem>
          <Grid :cols="2" :x-gap="12">
            <GridItem>
              <FormItem label="日期">
                <DatePicker v-model="form.date" :disabled="saving" />
              </FormItem>
            </GridItem>
            <GridItem>
              <FormItem label="时间">
                <Input v-model="form.time" placeholder="例如 10:30" :maxlength="8" :disabled="saving" />
              </FormItem>
            </GridItem>
            <GridItem>
              <FormItem label="分类">
                <Select v-model="form.category" :options="calendarCategoryOptions" :disabled="saving" />
              </FormItem>
            </GridItem>
            <GridItem>
              <FormItem label="参与人">
                <Input v-model="form.attendees" placeholder="例如 6 人" :maxlength="1000" :disabled="saving" />
              </FormItem>
            </GridItem>
          </Grid>
          <FormItem label="地点或会议链接">
            <Input v-model="form.location" :maxlength="255" clearable :disabled="saving" />
          </FormItem>
          <FormItem label="日程说明">
            <TextArea v-model="form.description" :rows="3" :maxlength="10000" :disabled="saving" />
          </FormItem>
          <FormItem label="线上会议">
            <Switch v-model="form.online" :disabled="saving" />
          </FormItem>
        </Form>
      </Drawer>

      <Modal v-model="detailOpen" :title="selectedEvent?.title || '日程详情'" :footer="false" :width="460">
        <template v-if="selectedEvent">
          <div class="event-detail-head">
            <span :style="{ background: calendarCategories[selectedEvent.category].color }"></span>
            <div>
              <strong>{{ selectedEvent.title }}</strong>
              <small>{{ calendarCategories[selectedEvent.category].label }}</small>
            </div>
          </div>
          <div class="event-detail-list">
            <p>
              <Icon :type="CalendarDays" />
              {{ selectedEvent.date }} {{ formatTime(selectedEvent.time) }}
            </p>
            <p>
              <Icon :type="selectedEvent.online ? Video : MapPin" />
              {{ selectedEvent.location || "未填写地点" }}
            </p>
            <p>
              <Icon :type="Users" />
              {{ selectedEvent.attendees || "未填写参与人" }}
            </p>
          </div>
          <p class="event-description">
            {{ selectedEvent.description || "暂无补充说明" }}
          </p>
          <Space v-if="canWrite || canDelete">
            <Button v-if="canWrite" type="primary" :disabled="saving" @click="editSelected">编辑日程</Button>
            <Button v-if="canDelete" type="danger" theme="plain" :disabled="saving"
              @click="deleteId = selectedEvent.id">
              删除
            </Button>
          </Space>
        </template>
      </Modal>

      <Modal :model-value="!!deleteId" title="删除日程" :show-close="!saving" :mask-closable="!saving"
        :esc-key="!saving" @update:model-value="!$event && (deleteId = '')">
        <p>确定删除这条日程？此操作无法撤销。</p>
        <template #footer>
          <Button :disabled="saving" @click="deleteId = ''">取消</Button>
          <Button type="danger" :loading="saving" @click="remove">确认删除</Button>
        </template>
      </Modal>
    </template>
  </div>
</template>
<script setup lang="ts">
import { CalendarDays, Clock, MapPin, Plus, Users, Video } from "kui-icons";
import { PageHeader, message, type CalendarEventData } from "kui-vue";
import { computed, reactive, ref, watch } from "vue";
import {
  calendarCategories,
  calendarCategoryOptions,
  formatTime,
  loadCalendarMonth,
  monthWindow,
  removeCalendarEvent,
  saveCalendarEvent,
  type CalendarCategory,
  type CalendarForm,
  type CalendarRecord,
} from "@/api/calendar";
import { useRemoteData } from "@/composables/use-remote-data";
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources } from "@/api/workspace";
import { hasPermission } from "@/routers/permissions";
import { useAuthStore } from "@/stores/auth";
import { reportFailure } from "@/utils/report-failure";

const views = [
  { label: "月历", value: "month" },
  { label: "列表", value: "list" },
];
const view = ref<string>("month");
const auth = useAuthStore();
const canWrite = computed(() => hasPermission("calendar:write", auth.permissions));
const canDelete = computed(() => hasPermission("calendar:delete", auth.permissions));

/** The app runs in the operator's timezone, so "today" is the local calendar day. */
const localToday = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
const today = localToday();

const selectedDate = ref(today);
const category = ref<CalendarCategory>();
/** Kept in sync with the grid by `monthChange`; it defines the request window. */
const viewMonth = ref({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
const { data: month, loading, error, reload } = useRemoteData(() =>
  loadCalendarMonth(monthWindow(viewMonth.value.year, viewMonth.value.month), category.value),
);

const events = computed(() => month.value?.events || []);
const total = computed(() => month.value?.total ?? 0);
const truncated = computed(() => Boolean(month.value?.truncated));
const calendarEvents = computed<CalendarEventData[]>(() =>
  events.value.map((event) => ({
    key: event.id,
    date: event.date,
    title: event.title,
    time: formatTime(event.time),
    color: calendarCategories[event.category].color,
  })),
);
const dayEvents = computed(() => events.value.filter((event) => event.date === selectedDate.value));

/** Moving between months is a server query, not a filter over an already-loaded set. */
function onMonthChange(value: { year: number; month: number }) {
  viewMonth.value = value;
  // A cell from the neighbouring month can be selected moments before the grid
  // settles there; without this the day panel would ask for a date it has no rows for.
  const prefix = `${value.year}-${String(value.month).padStart(2, "0")}`;
  if (!selectedDate.value.startsWith(prefix)) selectedDate.value = `${prefix}-01`;
}
watch([viewMonth, category], () => void reload());

const formOpen = ref(false);
const detailOpen = ref(false);
const editingId = ref("");
const selectedEvent = ref<CalendarRecord>();
const saving = ref(false);
const deleteId = ref("");
const blankForm = (date: string): CalendarForm => ({
  title: "",
  date,
  time: "09:00",
  category: "meeting",
  location: "",
  attendees: "",
  online: false,
  description: "",
});
const form = reactive<CalendarForm>(blankForm(today));

function openCreate(date: string) {
  editingId.value = "";
  Object.assign(form, blankForm(date));
  formOpen.value = true;
}
function openRecord(record: CalendarRecord) {
  selectedEvent.value = record;
  detailOpen.value = true;
}
/** The grid hands back only its own `key`, which is the row id we gave it. */
const openDetail = (event: CalendarEventData) => {
  const record = events.value.find((item) => item.id === String(event.key));
  if (record) openRecord(record);
};
function editSelected() {
  if (!selectedEvent.value) return;
  const { id, title, date, time, category: kind, location, attendees, online, description } =
    selectedEvent.value;
  editingId.value = id;
  Object.assign(form, {
    title,
    date,
    // The table keeps seconds; the form collects what an operator would type.
    time: formatTime(time),
    category: kind,
    location: location || "",
    attendees: attendees || "",
    online,
    description: description || "",
  });
  detailOpen.value = false;
  formOpen.value = true;
}

/** The server answers 400 for an unparseable `time`, so the shape is checked first. */
function validate(source: CalendarForm) {
  if (!source.title.trim()) return "请输入日程标题";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.date)) return "日期格式应为 YYYY-MM-DD";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(source.time)) return "时间请用 24 小时制，例如 09:30";
  return "";
}

async function submit() {
  const problem = validate(form);
  if (problem) return message.warning(problem);
  saving.value = true;
  // A refused write keeps the drawer and its input open, so what was rejected stays on screen.
  try {
    const saved = await saveCalendarEvent(
      { ...form, title: form.title.trim() },
      editingId.value || undefined,
    );
    message.success(editingId.value ? "日程已更新" : "日程已创建");
    formOpen.value = false;
    editingId.value = "";
    selectedDate.value = saved.date;
    const year = Number(saved.date.slice(0, 4));
    const monthNumber = Number(saved.date.slice(5, 7));
    // Moving the window is what re-reads the month; only an unchanged month reloads here.
    if (year === viewMonth.value.year && monthNumber === viewMonth.value.month) await reload();
    else viewMonth.value = { year, month: monthNumber };
  } catch (reason) {
    reportFailure(reason, "保存失败");
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!deleteId.value) return;
  const target = deleteId.value;
  saving.value = true;
  try {
    await removeCalendarEvent(target);
    message.success("日程已删除");
    detailOpen.value = false;
    await reload();
  } catch (reason) {
    // The detail panel stays open and the row stays on the grid until a reload succeeds.
    reportFailure(reason, "删除失败");
  } finally {
    saving.value = false;
    deleteId.value = "";
  }
}
</script>
<style scoped lang="less">
.calendar-note {
  margin: 0 0 12px;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.agenda-card {
  min-height: 410px;
}
.agenda-list {
  display: grid;
  gap: 4px;
  margin-bottom: 14px;
}
.agenda-list > button {
  display: grid;
  grid-template-columns: 3px 1fr;
  gap: 10px;
  padding: 10px 5px;
  color: inherit;
  text-align: left;
  border: 0;
  border-bottom: 1px solid var(--kui-color-border);
  background: none;
  cursor: pointer;
}
.agenda-list > button > span {
  border-radius: var(--kui-shape-circle);
}
.agenda-list div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.agenda-list strong {
  color: var(--kui-color-text-title);
}
.agenda-list small {
  display: flex;
  gap: 5px;
  align-items: center;
  color: var(--kui-color-text-description);
}
.legend-card {
  margin-top: 16px;
}
.legend-card :deep(.k-card-body) {
  display: grid;
  gap: 11px;
}
.legend-card :deep(.k-card-body) > div {
  display: flex;
  gap: 8px;
  align-items: center;
}
.legend-card span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.legend-card em {
  margin-left: auto;
  color: var(--kui-color-text-description);
  font-style: normal;
}
.event-detail-head {
  display: flex;
  gap: 10px;
  align-items: center;
}
.event-detail-head > span {
  width: 4px;
  height: 42px;
  border-radius: var(--kui-shape-circle);
}
.event-detail-head > div {
  display: flex;
  flex-direction: column;
}
.event-detail-head strong {
  color: var(--kui-color-text-title);
  font-size: 17px;
}
.event-detail-head small,
.event-description {
  color: var(--kui-color-text-description);
}
.event-detail-list {
  display: grid;
  gap: 8px;
  margin: 16px 0;
}
.event-detail-list p {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--kui-color-text-description);
}
</style>
<route lang="yaml">
meta:
  title: "团队日程"
  icon: "CalendarDays"
  order: 11
</route>
