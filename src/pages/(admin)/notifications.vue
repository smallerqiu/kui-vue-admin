<template>
  <div class="pro-list-page">
    <PageHeader title="通知中心" description="查看服务端通知并同步已读状态。" />
    <Card bordered><NotificationList /></Card>
  </div>
</template>
<script setup lang="ts">
import NotificationList from "@/components/business/notification-list.vue";
</script>
<route lang="yaml">
meta:
  title: "通知中心"
  icon: "Bell"
  showInMenu: false
</route>
