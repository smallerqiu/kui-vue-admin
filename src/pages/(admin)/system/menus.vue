<template>
  <div class="pro-list-page">
    <PageHeader title="菜单管理" description="维护菜单、权限码和可见状态。"
      ><template #actions
        ><Button type="primary" :icon="Plus" @click="openCreate"
          >新增菜单</Button
        ></template
      ></PageHeader
    ><ListPanel :summary="`${menus.length} 个菜单节点`"
      ><Table :data="menus" :columns="columns" row-key="id"
        ><template #type="{ value }"
          ><Tag theme="fill">{{
            value === "menu" ? "菜单" : "按钮"
          }}</Tag></template
        ><template #visible="{ record }"
          ><Switch v-model="record.visible" size="small" /></template
        ><template #action="{ record }"
          ><Button size="small" theme="plain" @click="openEdit(record)"
            >编辑</Button
          ></template
        ></Table
      ></ListPanel
    ><Drawer
      v-model="open"
      :title="editing ? '编辑菜单' : '新增菜单'"
      :width="440"
      @ok="save"
      ><Form layout="vertical"
        ><FormItem label="名称"><Input v-model="form.name" /></FormItem
        ><FormItem label="路由/权限码"><Input v-model="form.code" /></FormItem
        ><FormItem label="节点类型"
          ><RadioGroup v-model="form.type" :options="typeOptions" /></FormItem
        ><FormItem label="排序"
          ><InputNumber v-model="form.order" :min="0" /></FormItem
        ><FormItem label="显示"
          ><Switch v-model="form.visible" /></FormItem></Form
    ></Drawer>
  </div>
</template>
<script setup lang="ts">
import { Plus } from "kui-icons";
import { message, type Column, type TableRecord } from "kui-vue";
import { reactive, ref } from "vue";
interface MenuRow extends TableRecord {
  id: string;
  name: string;
  code: string;
  type: "menu" | "permission";
  order: number;
  visible: boolean;
}
const columns: Column[] = [
  { title: "名称", key: "name" },
  { title: "路由/权限码", key: "code" },
  { title: "类型", key: "type", width: 100 },
  { title: "排序", key: "order", width: 80 },
  { title: "显示", key: "visible", width: 90 },
  { title: "操作", key: "action", width: 90 },
];
const menus = ref<MenuRow[]>([
  {
    id: "M1",
    name: "订单管理",
    code: "/commerce/orders",
    type: "menu",
    order: 1,
    visible: true,
  },
  {
    id: "M2",
    name: "订单关闭",
    code: "order:close",
    type: "permission",
    order: 2,
    visible: true,
  },
  {
    id: "M3",
    name: "用户管理",
    code: "/system/users",
    type: "menu",
    order: 3,
    visible: true,
  },
  {
    id: "M4",
    name: "用户停用",
    code: "system:user:disable",
    type: "permission",
    order: 4,
    visible: true,
  },
]);
const typeOptions = [
  { label: "菜单", value: "menu" },
  { label: "按钮权限", value: "permission" },
];
const open = ref(false);
const editing = ref("");
const form = reactive({
  name: "",
  code: "",
  type: "menu" as MenuRow["type"],
  order: 0,
  visible: true,
});
const openCreate = () => {
  editing.value = "";
  Object.assign(form, {
    name: "",
    code: "",
    type: "menu",
    order: menus.value.length + 1,
    visible: true,
  });
  open.value = true;
};
const openEdit = (row: MenuRow) => {
  editing.value = row.id;
  Object.assign(form, row);
  open.value = true;
};
const save = () => {
  if (!form.name || !form.code)
    return message.warning("请填写名称和路由/权限码");
  const row = menus.value.find((i) => i.id === editing.value);
  if (row) Object.assign(row, form);
  else menus.value.push({ id: `M${Date.now()}`, ...form });
  open.value = false;
  message.success("菜单配置已保存");
};
</script>
<route lang="yaml">
meta:
  title: "菜单管理"
  icon: "SquareMenu"
  order: 3
  roles: ["admin"]
  permissions: ["system:menu"]
</route>
