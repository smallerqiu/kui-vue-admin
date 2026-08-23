<template>
  <div class="notification-page">
    <PageHeader title="通知中心" description="查看订单、任务、安全和系统通知。">
      <template #actions>
        <Button :icon="CheckCheck" @click="store.markAllRead">全部已读</Button>
        <Button theme="plain" :icon="Trash2" @click="store.clearRead">清除已读</Button>
      </template>
    </PageHeader>
    <Card bordered>
      <RadioGroup v-model="filter" theme="card" type="button" :options="filters" />
      <div class="full-notification-list">
        <article v-for="item in filteredItems" :key="item.id" :class="{ unread: !item.read }" @click="openItem(item)">
          <span class="item-icon" :class="`item-${item.type}`"><Icon :type="icons[item.type]" /></span>
          <div><Flex align="center" wrap><h3>{{ item.title }}</h3><Tag v-if="!item.read" size="small" color="blue">未读</Tag></Flex><p>{{ item.content }}</p><small>{{ item.time }}</small></div>
          <Button size="small" theme="plain" :icon="X" @click.stop="store.remove(item.id)" />
        </article>
        <Empty v-if="!filteredItems.length" description="没有符合条件的通知" />
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { useNotificationStore, type NotificationItem, type NotificationType } from "@/stores/notifications";
import { Bell, CheckCheck, PackageCheck, ShieldAlert, Trash2, X } from "kui-icons";
import type { IconType } from "kui-vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter(); const store = useNotificationStore(); const filter = ref("all");
const filters = [{ label: "全部", value: "all" }, { label: "未读", value: "unread" }, { label: "订单", value: "order" }, { label: "系统与安全", value: "system" }];
const icons: Record<NotificationType, IconType[]> = { order: PackageCheck, security: ShieldAlert, task: CheckCheck, system: Bell };
const filteredItems = computed(() => store.items.filter((item) => {
  if (filter.value === "unread") return !item.read;
  if (filter.value === "system") return item.type === "system" || item.type === "security";
  return filter.value === "all" || item.type === filter.value;
}));
const openItem = (item: NotificationItem) => { store.markRead(item.id); if (item.link) router.push(item.link); };
</script>

<style scoped lang="less">
.notification-page { max-width: 1000px; margin: 0 auto; padding: 8px 6px 20px; }
.full-notification-list { margin-top: 16px; }
.full-notification-list article { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: start; padding: 17px 10px; border-bottom: 1px solid var(--kui-color-border); cursor: pointer; }
.full-notification-list article:hover { background: var(--kui-color-item-hover); }
.full-notification-list article.unread { background: color-mix(in srgb, var(--kui-color-primary) 5%, transparent); }
.full-notification-list h3 { margin: 0; color: var(--kui-color-text-title); font-size: 14px; }.full-notification-list p { margin: 7px 0; color: var(--kui-color-text-description); line-height: 1.6; }.full-notification-list small { color: var(--kui-color-text-placeholder); }
.item-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: var(--kui-control-radius); background: var(--kui-theme-fill-bg); font-size: 18px; }
.item-order { color: var(--kui-color-primary); }.item-security { color: var(--kui-color-danger); }.item-task { color: var(--kui-color-success); }.item-system { color: var(--kui-color-warning); }
@media (max-width: 560px) { .full-notification-list article { grid-template-columns: auto minmax(0, 1fr); }.full-notification-list article > .k-btn { grid-column: 2; justify-self: end; } }
</style>

<route lang="yaml">
meta:
  title: "通知中心"
  icon: "Bell"
  showInMenu: false
</route>
