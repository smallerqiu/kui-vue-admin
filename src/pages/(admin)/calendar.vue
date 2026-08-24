<template>
  <div class="calendar-page">
    <PageHeader title="团队日程" description="汇总会议、项目节点和个人安排。">
      <template #actions>
        <Button type="primary" :icon="Plus" @click="openCreate(today)">新建日程</Button>
      </template>
    </PageHeader>

    <Grid :cols="{ xs: 1, xl: 12 }" :x-gap="16" :y-gap="16">
      <GridItem :span="{ xs: 1, xl: 9 }">
        <Card bordered class="calendar-card">
          <Calendar
            v-model="selectedDate"
            :events="calendarEvents"
            @event-click="handleCalendarEvent"
          >
            <template #extra>
              <Select
                v-model="category"
                clearable
                placeholder="全部日程"
                :options="categoryOptions"
              />
            </template>
          </Calendar>
        </Card>
      </GridItem>

      <GridItem :span="{ xs: 1, xl: 3 }">
        <Card bordered title="当日日程" class="agenda-card">
          <template #extra>
            <Tag theme="fill">{{ selectedDate }}</Tag>
          </template>
          <div v-if="selectedEvents.length" class="agenda-list">
            <button
              v-for="event in selectedEvents"
              :key="event.id"
              type="button"
              @click="openDetail(event)"
            >
              <span :style="{ background: categoryMap[event.category].color }"></span>
              <div>
                <strong>{{ event.title }}</strong>
                <small>
                  <Icon :type="Clock" />
                  {{ event.time }} · {{ categoryMap[event.category].label }}
                </small>
                <small>
                  <Icon :type="event.online ? Video : MapPin" />
                  {{ event.location }}
                </small>
              </div>
            </button>
          </div>
          <Empty v-else description="当天暂无日程" />
          <Button block theme="plain" :icon="Plus" @click="openCreate(selectedDate)">
            添加日程
          </Button>
        </Card>
        <Card bordered title="日程分类" class="legend-card">
          <div v-for="item in categoryOptions" :key="item.value">
            <span :style="{ background: categoryMap[item.value].color }"></span>
            {{ item.label }}
            <em>{{ events.filter((event) => event.category === item.value).length }}</em>
          </div>
        </Card>
      </GridItem>
    </Grid>

    <Drawer
      v-model="formOpen"
      :title="editingId ? '编辑日程' : '新建日程'"
      :width="480"
      @ok="saveEvent"
    >
      <Form :model="form" layout="vertical">
        <FormItem label="日程标题">
          <Input v-model="form.title" clearable placeholder="请输入日程标题" />
        </FormItem>
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="日期"><DatePicker v-model="form.date" block /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="时间"><Input v-model="form.time" placeholder="例如 10:30" /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="分类">
              <Select v-model="form.category" block :options="categoryOptions" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="参与人">
              <Input v-model="form.attendees" placeholder="例如 6 人" />
            </FormItem>
          </GridItem>
        </Grid>
        <FormItem label="地点或会议链接"><Input v-model="form.location" clearable /></FormItem>
        <FormItem label="日程说明"><TextArea v-model="form.description" :rows="3" /></FormItem>
        <FormItem label="线上会议"><Switch v-model="form.online" /></FormItem>
      </Form>
    </Drawer>

    <Modal
      v-model="detailOpen"
      :title="selectedEvent?.title || '日程详情'"
      :footer="false"
      :width="460"
    >
      <template v-if="selectedEvent">
        <div class="event-detail-head">
          <span :style="{ background: categoryMap[selectedEvent.category].color }"></span>
          <div>
            <strong>{{ selectedEvent.title }}</strong>
            <small>{{ categoryMap[selectedEvent.category].label }}</small>
          </div>
        </div>
        <div class="event-detail-list">
          <p>
            <Icon :type="CalendarDays" />
            {{ selectedEvent.date }}
            {{ selectedEvent.time }}
          </p>
          <p>
            <Icon :type="selectedEvent.online ? Video : MapPin" />
            {{ selectedEvent.location }}
          </p>
          <p>
            <Icon :type="Users" />
            {{ selectedEvent.attendees }}
          </p>
        </div>
        <p class="event-description">
          {{ selectedEvent.description || "暂无补充说明" }}
        </p>
        <Space>
          <Button type="primary" @click="editSelected">编辑日程</Button>
          <Button type="danger" theme="plain" @click="removeSelected">删除</Button>
        </Space>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { CalendarDays, Clock, MapPin, Plus, Users, Video } from "kui-icons";
import { Calendar, message, type CalendarEventData } from "kui-vue";
import { computed, reactive, ref } from "vue";

type EventCategory = "meeting" | "project" | "personal" | "deadline";
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  category: EventCategory;
  location: string;
  attendees: string;
  online: boolean;
  description: string;
}
const today = "2026-08-23";
const selectedDate = ref(today);
const category = ref<EventCategory>();
const categoryMap: Record<EventCategory, { label: string; color: string }> = {
  meeting: { label: "会议", color: "#3a95ff" },
  project: { label: "项目", color: "#7b61ff" },
  personal: { label: "个人", color: "#22a06b" },
  deadline: { label: "截止节点", color: "#ef6b73" },
};
const categoryOptions = Object.entries(categoryMap).map(([value, item]) => ({
  label: item.label,
  value: value as EventCategory,
}));
const events = ref<CalendarEvent[]>([
  {
    id: "1",
    title: "产品周会",
    date: "2026-08-23",
    time: "09:30",
    category: "meeting",
    location: "腾讯会议 263-801",
    attendees: "产品与研发 · 8 人",
    online: true,
    description: "同步本周进展、风险及下周计划。",
  },
  {
    id: "2",
    title: "KUI Pro 交互评审",
    date: "2026-08-23",
    time: "14:00",
    category: "project",
    location: "三楼梧桐会议室",
    attendees: "项目组 · 6 人",
    online: false,
    description: "评审项目与任务中心的交互细节。",
  },
  {
    id: "3",
    title: "客户数据平台联调",
    date: "2026-08-25",
    time: "10:30",
    category: "project",
    location: "研发协作室",
    attendees: "前后端 · 5 人",
    online: false,
    description: "完成客户标签接口联调。",
  },
  {
    id: "4",
    title: "季度 OKR 复盘",
    date: "2026-08-27",
    time: "15:00",
    category: "meeting",
    location: "飞书会议",
    attendees: "管理团队 · 12 人",
    online: true,
    description: "复盘季度目标达成情况。",
  },
  {
    id: "5",
    title: "移动工作台一期交付",
    date: "2026-08-31",
    time: "18:00",
    category: "deadline",
    location: "线上提交",
    attendees: "移动项目组",
    online: true,
    description: "完成一期功能发布和文档归档。",
  },
  {
    id: "6",
    title: "健身训练",
    date: "2026-08-24",
    time: "19:30",
    category: "personal",
    location: "运动中心",
    attendees: "个人",
    online: false,
    description: "",
  },
]);
const filteredEvents = computed(() =>
  events.value.filter((event) => !category.value || event.category === category.value),
);
const calendarEvents = computed<CalendarEventData[]>(() =>
  filteredEvents.value.map((event) => ({
    ...event,
    key: event.id,
    color: categoryMap[event.category].color,
  })),
);
const eventsFor = (date: string) =>
  filteredEvents.value
    .filter((event) => event.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
const selectedEvents = computed(() => eventsFor(selectedDate.value));
const formOpen = ref(false);
const detailOpen = ref(false);
const editingId = ref("");
const selectedEvent = ref<CalendarEvent>();
const form = reactive<Omit<CalendarEvent, "id">>({
  title: "",
  date: today,
  time: "09:00",
  category: "meeting",
  location: "",
  attendees: "",
  online: false,
  description: "",
});
const resetForm = (date: string) =>
  Object.assign(form, {
    title: "",
    date,
    time: "09:00",
    category: "meeting",
    location: "",
    attendees: "",
    online: false,
    description: "",
  });
const openCreate = (date: string) => {
  editingId.value = "";
  resetForm(date);
  formOpen.value = true;
};
const openDetail = (event: CalendarEvent) => {
  selectedEvent.value = event;
  detailOpen.value = true;
};
const handleCalendarEvent = (event: CalendarEventData) =>
  openDetail(events.value.find((item) => item.id === event.key) as CalendarEvent);
const editSelected = () => {
  if (!selectedEvent.value) return;
  editingId.value = selectedEvent.value.id;
  Object.assign(form, selectedEvent.value);
  detailOpen.value = false;
  formOpen.value = true;
};
const saveEvent = () => {
  if (!form.title.trim()) return message.warning("请输入日程标题");
  const current = events.value.find((event) => event.id === editingId.value);
  if (current) Object.assign(current, form);
  else events.value.push({ id: `${Date.now()}`, ...form });
  selectedDate.value = form.date;
  formOpen.value = false;
  message.success("日程已保存");
};
const removeSelected = () => {
  if (!selectedEvent.value) return;
  events.value = events.value.filter((event) => event.id !== selectedEvent.value?.id);
  detailOpen.value = false;
  message.success("日程已删除");
};
</script>

<style scoped lang="less">
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
  padding: 14px;
  margin: 18px 0;
  border-radius: var(--kui-control-radius);
  background: var(--kui-theme-fill-bg);
}
.event-detail-list p {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 7px 0;
}
.event-description {
  line-height: 1.7;
}
</style>

<route lang="yaml">
meta:
  title: "团队日程"
  icon: "CalendarDays"
  order: 11
</route>
