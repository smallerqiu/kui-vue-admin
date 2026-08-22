<template>
  <Flex class="pro-page-header" justify="space-between" align="center" wrap>
    <div>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <Space v-if="$slots.actions" wrap><slot name="actions" /></Space>
  </Flex>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<style scoped lang="less">
.pro-page-header {
  gap: 16px;
  margin-bottom: 16px;

  h1 { margin: 0 0 5px; color: var(--kui-color-text-title); font-size: 24px; line-height: 1.3; }
  p { margin: 0; color: var(--kui-color-text-description); }
}
</style>
