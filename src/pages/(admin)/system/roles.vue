<template>
  <div class="pro-list-page">
    <PageHeader
      title="角色权限"
      description="配置角色的数据范围和菜单访问权限。"
    >
      <template #actions
        ><Button type="primary" :icon="Plus" @click="openCreate"
          >新增角色</Button
        ></template
      >
    </PageHeader>

    <ListPanel :summary="`${filteredRoles.length} 个角色`">
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="搜索角色名称或编码"
          :icon="Search"
        />
      </template>
      <template #actions>
        <Space>
          <Button theme="plain" @click="keyword = ''">重置</Button>
          <TableColumnSetting
            v-model:hidden-keys="hiddenColumnKeys"
            :columns="columns"
            :disabled-keys="['name', 'action']"
            title="列设置"
            reset-text="重置"
          />
        </Space>
      </template>
      <Table
        :data="filteredRoles"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 850 }"
      >
        <template #name="{ record }">
          <div class="role-name">
            <span :style="{ background: record.color }"
              ><Icon :type="ShieldCheck"
            /></span>
            <div>
              <strong>{{ record.name }}</strong
              ><small>{{ record.description }}</small>
            </div>
          </div>
        </template>
        <template #status="{ record }"
          ><Switch v-model="record.enabled" size="small"
        /></template>
        <template #action="{ record }">
          <Space compact>
            <Button
              size="small"
              theme="plain"
              :icon="Pencil"
              @click="openEdit(record)"
              >编辑</Button
            >
            <Button
              size="small"
              theme="plain"
              :icon="KeyRound"
              @click="openPermissions(record)"
              >权限</Button
            >
          </Space>
        </template>
      </Table>
    </ListPanel>

    <Drawer
      v-model="editOpen"
      :title="editingId ? '编辑角色' : '新增角色'"
      :width="440"
      @ok="saveRole"
    >
      <Form :model="form" layout="vertical">
        <FormItem label="角色名称"
          ><Input v-model="form.name" clearable placeholder="例如：运营管理员"
        /></FormItem>
        <FormItem label="角色编码"
          ><Input
            v-model="form.code"
            clearable
            placeholder="例如：operator_admin"
        /></FormItem>
        <FormItem label="描述"
          ><Input
            v-model="form.description"
            clearable
            placeholder="简要描述角色职责"
        /></FormItem>
        <FormItem label="启用状态"><Switch v-model="form.enabled" /></FormItem>
      </Form>
    </Drawer>

    <Drawer
      v-model="permissionOpen"
      title="菜单权限"
      :width="480"
      @ok="savePermissions"
    >
      <div class="permission-heading">
        <strong>{{ activeRole?.name }}</strong
        ><span>已选择 {{ checkedKeys.length }} 项权限</span>
      </div>
      <Tree
        :data="permissionTree"
        checkable
        show-line
        :expanded-keys="expandedKeys"
        :checked-keys="checkedKeys"
        @check="handleCheck"
      />
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { KeyRound, Pencil, Plus, Search, ShieldCheck } from "kui-icons";
import { message, type Column, type TableRecord, type TreeNode } from "kui-vue";
import { computed, reactive, ref } from "vue";

interface RoleRow extends TableRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  members: number;
  enabled: boolean;
  createdAt: string;
  color: string;
  permissions: string[];
}
const columns: Column[] = [
  { title: "角色", key: "name", width: 280 },
  { title: "编码", key: "code", width: 160 },
  { title: "成员数", key: "members", width: 100 },
  { title: "状态", key: "status", width: 90 },
  { title: "创建时间", key: "createdAt", width: 160 },
  { title: "操作", key: "action", width: 170, fixed: "right" },
];
const roles = ref<RoleRow[]>([
  {
    id: "R1",
    name: "超级管理员",
    code: "admin",
    description: "拥有全部系统权限",
    members: 2,
    enabled: true,
    createdAt: "2026-06-12",
    color: "#3a95ff",
    permissions: ["dashboard", "order", "product", "user", "role"],
  },
  {
    id: "R2",
    name: "运营管理员",
    code: "operator",
    description: "负责商品和订单运营",
    members: 8,
    enabled: true,
    createdAt: "2026-07-03",
    color: "#22a06b",
    permissions: ["dashboard", "order", "product"],
  },
  {
    id: "R3",
    name: "数据分析师",
    code: "analyst",
    description: "查看经营和用户数据",
    members: 4,
    enabled: true,
    createdAt: "2026-07-18",
    color: "#7b61ff",
    permissions: ["dashboard", "analytics"],
  },
  {
    id: "R4",
    name: "访客",
    code: "guest",
    description: "仅可查看基础信息",
    members: 12,
    enabled: false,
    createdAt: "2026-08-01",
    color: "#8c8c8c",
    permissions: ["dashboard"],
  },
]);
const permissionTree: TreeNode[] = [
  { title: "仪表盘", key: "dashboard" },
  {
    title: "交易中心",
    key: "commerce",
    children: [
      { title: "订单管理", key: "order" },
      { title: "商品管理", key: "product" },
      { title: "售后管理", key: "after-sale" },
    ],
  },
  {
    title: "数据中心",
    key: "data",
    children: [{ title: "经营分析", key: "analytics" }],
  },
  {
    title: "系统管理",
    key: "system",
    children: [
      { title: "用户管理", key: "user" },
      { title: "角色权限", key: "role" },
    ],
  },
];
const expandedKeys = ["commerce", "data", "system"];
const keyword = ref("");
const hiddenColumnKeys = ref<string[]>([]);
const editOpen = ref(false);
const permissionOpen = ref(false);
const editingId = ref("");
const activeRole = ref<RoleRow>();
const checkedKeys = ref<string[]>([]);
const form = reactive({ name: "", code: "", description: "", enabled: true });
const filteredRoles = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return roles.value.filter(
    (item) =>
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.code.toLowerCase().includes(query),
  );
});
const resetForm = () =>
  Object.assign(form, { name: "", code: "", description: "", enabled: true });
const openCreate = () => {
  editingId.value = "";
  resetForm();
  editOpen.value = true;
};
const openEdit = (role: RoleRow) => {
  editingId.value = role.id;
  Object.assign(form, role);
  editOpen.value = true;
};
const saveRole = () => {
  if (!form.name.trim() || !form.code.trim())
    return message.warning("请填写角色名称和编码");
  const target = roles.value.find((item) => item.id === editingId.value);
  if (target) Object.assign(target, form);
  else
    roles.value.push({
      id: `R${Date.now()}`,
      ...form,
      members: 0,
      createdAt: "2026-08-23",
      color: "#3a95ff",
      permissions: [],
    });
  editOpen.value = false;
  message.success("角色信息已保存");
};
const openPermissions = (role: RoleRow) => {
  activeRole.value = role;
  checkedKeys.value = [...role.permissions];
  permissionOpen.value = true;
};
const handleCheck = (_node: TreeNode, _checked: boolean, keys: string[]) => {
  checkedKeys.value = keys;
};
const savePermissions = () => {
  if (activeRole.value) activeRole.value.permissions = [...checkedKeys.value];
  permissionOpen.value = false;
  message.success("角色权限已更新");
};
</script>

<style scoped lang="less">
.role-name {
  display: flex;
  gap: 10px;
  align-items: center;
}
.role-name > span {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  color: #fff;
  border-radius: var(--kui-control-radius);
}
.role-name > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.role-name small {
  overflow: hidden;
  color: var(--kui-color-text-description);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.permission-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 12px;
  border-radius: var(--kui-control-radius);
  background: var(--kui-theme-fill-bg);
}
.permission-heading span {
  color: var(--kui-color-text-description);
}
</style>

<route lang="yaml">
meta:
  title: "角色权限"
  icon: "ShieldCheck"
  order: 2
  roles: ["admin"]
</route>
