<template>
  <div class="notification-panel">
    <Flex class="notification-head" justify="space-between" align="center">
      <div><strong>通知</strong><span>{{ store.unreadCount }} 条未读</span></div>
      <Button v-if="store.unreadCount" size="small" theme="plain" @click="store.markAllRead">全部已读</Button>
    </Flex>
    <div class="notification-list">
      <button v-for="item in recentItems" :key="item.id" type="button" :class="{ unread: !item.read }" @click="openItem(item)">
        <span class="notification-icon" :class="`notification-${item.type}`"><Icon :type="icons[item.type]" /></span>
        <span class="notification-copy"><strong>{{ item.title }}</strong><small>{{ item.content }}</small><em>{{ item.time }}</em></span>
        <i v-if="!item.read"></i>
      </button>
      <Empty v-if="!recentItems.length" description="暂无通知" />
    </div>
    <Button class="notification-footer" block theme="plain" @click="router.push('/notifications')">查看全部通知</Button>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore, type NotificationItem, type NotificationType } from "@/stores/notifications";
import { Bell, CheckCheck, PackageCheck, ShieldAlert } from "kui-icons";
import type { IconType } from "kui-vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const store = useNotificationStore();
const recentItems = computed(() => store.items.slice(0, 5));
const icons: Record<NotificationType, IconType[]> = { order: PackageCheck, security: ShieldAlert, task: CheckCheck, system: Bell };
const openItem = (item: NotificationItem) => {
  store.markRead(item.id);
  if (item.link) router.push(item.link);
};
</script>

<style scoped lang="less">
.notification-panel { width: min(390px, calc(100vw - 24px)); overflow: hidden; border: 1px solid var(--kui-popup-border); border-radius: var(--kui-card-radius); background: var(--kui-popup-bg); box-shadow: var(--kui-popup-shadow); }
.notification-head { padding: 13px 15px; border-bottom: 1px solid var(--kui-color-border); }
.notification-head > div { display: flex; gap: 8px; align-items: baseline; }
.notification-head strong { color: var(--kui-color-text-title); font-size: 15px; }
.notification-head span { color: var(--kui-color-text-description); font-size: 12px; }
.notification-list { max-height: 410px; overflow: auto; }
.notification-list > button { position: relative; display: grid; width: 100%; grid-template-columns: auto minmax(0, 1fr) auto; gap: 11px; align-items: start; padding: 13px 15px; color: inherit; text-align: left; border: 0; border-bottom: 1px solid var(--kui-color-border); background: transparent; cursor: pointer; }
.notification-list > button:hover { background: var(--kui-color-item-hover); }
.notification-list > button.unread { background: color-mix(in srgb, var(--kui-color-primary) 5%, transparent); }
.notification-list > button > i { width: 7px; height: 7px; margin-top: 7px; border-radius: 50%; background: var(--kui-color-primary); }
.notification-icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: var(--kui-control-radius); background: var(--kui-theme-fill-bg); }
.notification-order { color: var(--kui-color-primary); }.notification-security { color: var(--kui-color-danger); }.notification-task { color: var(--kui-color-success); }.notification-system { color: var(--kui-color-warning); }
.notification-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.notification-copy strong { color: var(--kui-color-text-title); font-weight: 600; }
.notification-copy small { overflow: hidden; color: var(--kui-color-text-description); text-overflow: ellipsis; white-space: nowrap; }
.notification-copy em { color: var(--kui-color-text-placeholder); font-size: 11px; font-style: normal; }
.notification-footer { border-radius: 0; }
</style>
