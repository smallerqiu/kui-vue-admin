<template>
  <section class="notices">
    <Space>
      <Skeleton :loading="store.loading" :delay="0" :title-width="25" :rows="1" animated>
        <span>{{ store.unreadCount }} 条未读</span>
      </Skeleton>
      <Button :disabled="store.saving || store.loading" @click="store.load()">刷新</Button>
      <Button
        :loading="store.saving"
        :disabled="!store.unreadCount || store.loading"
        @click="store.markAllRead"
      >
        全部已读
      </Button>
    </Space>
    <p v-if="store.error" role="alert">{{ store.error }}</p>
    <Skeleton :loading="store.loading" :delay="0" :title-width="45" :rows="3" animated>
      <template v-if="!store.error">
        <Empty v-if="!store.items.length" description="暂无通知" />
        <article v-for="item in displayed" :key="item.id">
          <strong>{{ item.title }}</strong>
          <Tag v-if="!item.readAt">未读</Tag>
          <p>{{ item.content }}</p>
          <small>{{ formatDateTime(item.createdAt) }} UTC</small>
          <Space>
            <Button
              v-if="!item.readAt"
              size="small"
              :disabled="store.saving"
              @click="store.markRead(item.id)"
            >
              标为已读
            </Button>
            <Button
              v-if="notificationPath(item.link)"
              size="small"
              :disabled="store.saving"
              @click="open(item)"
            >
              查看
            </Button>
          </Space>
        </article>
      </template>
    </Skeleton>
    <!-- Here the pager is the only place the page count is stated, so it waits for the answer rather
         than reading "Total 0 items" while the first page is still on its way. -->
    <Page
      v-if="!compact"
      :page="store.page"
      :page-size="20"
      :total="store.total"
      :show-total="!store.loading"
      :disabled="store.loading || store.saving"
      @update:page="store.load($event)"
    />
    <Button v-else block theme="plain" @click="router.push('/notifications')">查看全部通知</Button>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, onActivated, onDeactivated } from "vue";
import { useRouter } from "vue-router";
import { useNotificationStore } from "@/stores/notifications";
import { notificationPath, type NotificationItem } from "@/api/system";
import { formatDateTime } from "@/utils/common";
const props = defineProps<{ compact?: boolean }>();
const store = useNotificationStore(),
  router = useRouter();
const displayed = computed(() => (props.compact ? store.items.slice(0, 5) : store.items));
let active = true;
onMounted(() => void store.load(props.compact ? 1 : store.page));
onDeactivated(() => {
  active = false;
});
onActivated(() => {
  if (!active) {
    active = true;
    void store.load();
  }
});
async function open(item: NotificationItem) {
  const path = notificationPath(item.link);
  if (path && (item.readAt || (await store.markRead(item.id)))) await router.push(path);
}
</script>
<style scoped>
.notices {
  padding: 16px;
}
article {
  padding: 16px 0;
  border-bottom: 1px solid var(--kui-color-border);
  overflow-wrap: anywhere;
}
article p {
  white-space: pre-wrap;
}
article small {
  display: block;
  color: var(--kui-color-text-description);
  margin-bottom: 8px;
}
</style>
