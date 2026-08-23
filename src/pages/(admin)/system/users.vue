<template>
  <div class="pro-list-page">
    <PageHeader title="用户管理" description="管理成员账号、角色和使用状态。">
      <template #actions>
        <Button :icon="Download">导出</Button>
        <Button type="primary" :icon="UserPlus" @click="openCreate"
          >新增用户</Button
        >
      </template>
    </PageHeader>

    <ListPanel
      :summary="`共 ${filteredUsers.length} 位用户`"
      :selected-count="selectedKeys.length"
    >
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="搜索姓名或邮箱"
          :icon="Search"
        />
        <Select
          v-model="status"
          clearable
          placeholder="全部状态"
          :options="statusOptions"
        />
        <Select
          v-model="role"
          clearable
          placeholder="全部角色"
          :options="roleOptions"
        />
      </template>

      <template #actions>
        <Space>
          <Button theme="plain" @click="resetFilters">重置</Button>
          <TableColumnSetting
            v-model:hidden-keys="hiddenColumnKeys"
            :columns="columns"
            :disabled-keys="['user', 'action']"
            title="列设置"
            reset-text="重置"
          />
        </Space>
      </template>

      <template #selection="{ count }">
        <Space>
          <strong>已选择 {{ count }} 项</strong>
          <Button
            v-permission="'system:user:disable'"
            type="danger"
            size="small"
            @click="disableSelected"
            >批量停用</Button
          >
          <Button theme="plain" size="small" @click="selectedKeys = []"
            >取消选择</Button
          >
        </Space>
      </template>

      <Table
        v-model:selected-keys="selectedKeys"
        checkable
        :data="pageUsers"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 900 }"
      >
        <template #user="{ record }">
          <Space>
            <Avatar :size="34" :style="{ background: record.color }">{{
              record.name.slice(0, 1)
            }}</Avatar>
            <div class="user-cell">
              <strong>{{ record.name }}</strong
              ><span>{{ record.email }}</span>
            </div>
          </Space>
        </template>
        <template #role="{ value }"
          ><Tag theme="fill">{{ roleLabel(value) }}</Tag></template
        >
        <template #status="{ value }">
          <Tag :color="value === 'active' ? 'green' : 'gray'">{{
            value === "active" ? "正常" : "已停用"
          }}</Tag>
        </template>
        <template #action="{ record }">
          <Space compact>
            <Tooltip title="查看"
              ><Button size="small" theme="plain" :icon="Eye"
            /></Tooltip>
            <Tooltip title="编辑"
              ><Button
                size="small"
                theme="plain"
                :icon="Pencil"
                @click="openEdit(record)"
            /></Tooltip>
          </Space>
        </template>
      </Table>

      <template #footer>
        <Page
          v-model:page="page"
          :total="filteredUsers.length"
          :page-size="pageSize"
          show-total
        />
      </template>
    </ListPanel>

    <Drawer
      v-model="drawerOpen"
      :title="editingId ? '编辑用户' : '新增用户'"
      :width="440"
      @ok="saveUser"
    >
      <Form :model="form" layout="vertical">
        <FormItem label="姓名" prop="name"
          ><Input v-model="form.name" clearable placeholder="请输入姓名"
        /></FormItem>
        <FormItem label="邮箱" prop="email"
          ><Input v-model="form.email" clearable placeholder="name@company.com"
        /></FormItem>
        <FormItem label="角色" prop="role"
          ><Select v-model="form.role" block :options="roleOptions"
        /></FormItem>
        <FormItem label="状态" prop="status"
          ><Select v-model="form.status" block :options="statusOptions"
        /></FormItem>
      </Form>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { Download, Eye, Pencil, Search, UserPlus } from "kui-icons";
import { message, type Column, type TableKey, type TableRecord } from "kui-vue";
import { computed, reactive, ref, watch } from "vue";

interface UserRow extends TableRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  department: string;
  lastLogin: string;
  color: string;
}

const columns: Column[] = [
  { title: "用户", key: "user", width: 250 },
  { title: "角色", key: "role", width: 110 },
  { title: "部门", key: "department", width: 140 },
  { title: "状态", key: "status", width: 100 },
  { title: "最近登录", key: "lastLogin", width: 170 },
  { title: "操作", key: "action", width: 100, fixed: "right" },
];
const users = ref<UserRow[]>([
  {
    id: "U1001",
    name: "林晓",
    email: "linxiao@k-ui.cn",
    role: "admin",
    status: "active",
    department: "产品中心",
    lastLogin: "2026-08-23 09:42",
    color: "#3a95ff",
  },
  {
    id: "U1002",
    name: "陈默",
    email: "chenmo@k-ui.cn",
    role: "developer",
    status: "active",
    department: "研发中心",
    lastLogin: "2026-08-23 09:18",
    color: "#7b61ff",
  },
  {
    id: "U1003",
    name: "周宁",
    email: "zhouning@k-ui.cn",
    role: "operator",
    status: "active",
    department: "运营中心",
    lastLogin: "2026-08-22 18:06",
    color: "#22a06b",
  },
  {
    id: "U1004",
    name: "王一",
    email: "wangyi@k-ui.cn",
    role: "analyst",
    status: "disabled",
    department: "数据中心",
    lastLogin: "2026-08-20 14:31",
    color: "#f59e0b",
  },
  {
    id: "U1005",
    name: "何安",
    email: "hean@k-ui.cn",
    role: "developer",
    status: "active",
    department: "研发中心",
    lastLogin: "2026-08-19 11:20",
    color: "#ef6c77",
  },
]);
const statusOptions = [
  { label: "正常", value: "active" },
  { label: "已停用", value: "disabled" },
];
const roleOptions = [
  { label: "管理员", value: "admin" },
  { label: "开发者", value: "developer" },
  { label: "运营", value: "operator" },
  { label: "分析师", value: "analyst" },
];
const keyword = ref("");
const status = ref<string>();
const role = ref<string>();
const selectedKeys = ref<TableKey[]>([]);
const hiddenColumnKeys = ref<string[]>([]);
const page = ref(1);
const pageSize = 10;
const drawerOpen = ref(false);
const editingId = ref("");
const form = reactive({
  name: "",
  email: "",
  role: "developer",
  status: "active",
});
const filteredUsers = computed(() =>
  users.value.filter((user) => {
    const query = keyword.value.trim().toLowerCase();
    return (
      (!query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)) &&
      (!status.value || user.status === status.value) &&
      (!role.value || user.role === role.value)
    );
  }),
);
const pageUsers = computed(() =>
  filteredUsers.value.slice((page.value - 1) * pageSize, page.value * pageSize),
);
watch([keyword, status, role], () => {
  page.value = 1;
});
const roleLabel = (value: string) =>
  roleOptions.find((item) => item.value === value)?.label || value;
const resetFilters = () => {
  keyword.value = "";
  status.value = undefined;
  role.value = undefined;
};
const disableSelected = () => {
  const selected = new Set(selectedKeys.value);
  users.value.forEach((item) => {
    if (selected.has(item.id)) item.status = "disabled";
  });
  message.success(`已停用 ${selected.size} 位用户`);
  selectedKeys.value = [];
};
const resetForm = () =>
  Object.assign(form, {
    name: "",
    email: "",
    role: "developer",
    status: "active",
  });
const openCreate = () => {
  editingId.value = "";
  resetForm();
  drawerOpen.value = true;
};
const openEdit = (record: UserRow) => {
  editingId.value = record.id;
  Object.assign(form, record);
  drawerOpen.value = true;
};
const saveUser = () => {
  if (!form.name.trim() || !form.email.trim())
    return message.warning("请填写姓名和邮箱");
  if (editingId.value) {
    const target = users.value.find((item) => item.id === editingId.value);
    if (target) Object.assign(target, form);
  } else {
    users.value.unshift({
      id: `U${Date.now()}`,
      ...form,
      department: "待分配",
      lastLogin: "尚未登录",
      color: "#3a95ff",
    });
  }
  drawerOpen.value = false;
  message.success(editingId.value ? "用户信息已更新" : "用户已创建");
};
</script>

<style scoped lang="less">
.pro-list-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 8px 6px 20px;
}
.user-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.user-cell span {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.pagination-bar {
  padding-top: 16px;
}
</style>

<route lang="yaml">
meta:
  title: "用户管理"
  icon: "Users"
  order: 1
  roles: ["admin"]
</route>
