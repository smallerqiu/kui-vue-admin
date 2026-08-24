<template>
  <div class="pro-list-page">
    <PageHeader title="商品管理" description="维护商品信息、库存和上架状态。">
      <template #actions>
        <Button type="primary" :icon="Plus" @click="openCreate">新增商品</Button>
      </template>
    </PageHeader>
    <ListPanel :summary="`${filteredProducts.length} 件商品`" :selected-count="selectedKeys.length">
      <template #filters>
        <Input v-model="keyword" clearable placeholder="搜索商品名称或 SKU" :icon="Search" />
        <Select v-model="category" clearable placeholder="全部分类" :options="categoryOptions" />
        <Select v-model="status" clearable placeholder="全部状态" :options="statusOptions" />
      </template>
      <template #actions>
        <Space>
          <Button theme="plain" @click="resetFilters">重置</Button>
          <TableColumnSetting
            v-model:hidden-keys="hiddenColumnKeys"
            :columns="columns"
            :disabled-keys="['product', 'action']"
            title="列设置"
            reset-text="重置"
          />
        </Space>
      </template>
      <template #selection="{ count }">
        <Space>
          <strong>已选择 {{ count }} 项</strong>
          <Button type="danger" size="small" @click="disableSelected">批量下架</Button>
          <Button theme="plain" size="small" @click="selectedKeys = []">取消选择</Button>
        </Space>
      </template>
      <Table
        v-model:selected-keys="selectedKeys"
        checkable
        :data="filteredProducts"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 980 }"
      >
        <template #product="{ record }">
          <div class="product-cell">
            <span :style="{ background: record.color }"><Icon :type="Package" /></span>
            <div>
              <strong>{{ record.name }}</strong>
              <small>{{ record.sku }}</small>
            </div>
          </div>
        </template>
        <template #price="{ value }">
          <strong>¥ {{ Number(value).toLocaleString() }}</strong>
        </template>
        <template #stock="{ value }">
          <span :class="{ 'stock-low': Number(value) < 20 }">{{ value }}</span>
        </template>
        <template #status="{ record }">
          <Switch v-model="record.enabled" size="small" true-text="上架" false-text="下架" />
        </template>
        <template #action="{ record }">
          <Button size="small" theme="plain" :icon="Pencil" @click="openEdit(record)">编辑</Button>
        </template>
      </Table>
    </ListPanel>

    <Drawer
      v-model="drawerOpen"
      :title="editingId ? '编辑商品' : '新增商品'"
      :width="480"
      @ok="saveProduct"
    >
      <Form :model="form" layout="vertical">
        <FormItem label="商品名称">
          <Input v-model="form.name" clearable placeholder="请输入商品名称" />
        </FormItem>
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="SKU"><Input v-model="form.sku" clearable /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="分类">
              <Select v-model="form.category" block :options="categoryOptions" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="销售价格">
              <InputNumber v-model="form.price" :min="0" prefix="¥" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="库存">
              <InputNumber v-model="form.stock" :min="0" suffix="件" />
            </FormItem>
          </GridItem>
        </Grid>
        <FormItem label="立即上架"><Switch v-model="form.enabled" /></FormItem>
      </Form>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { Package, Pencil, Plus, Search } from "kui-icons";
import { message, type Column, type TableKey, type TableRecord } from "kui-vue";
import { computed, reactive, ref } from "vue";

interface ProductRow extends TableRecord {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  sales: number;
  enabled: boolean;
  updatedAt: string;
  color: string;
}
const columns: Column[] = [
  { title: "商品", key: "product", width: 280 },
  { title: "分类", key: "category", width: 120 },
  { title: "价格", key: "price", width: 120 },
  { title: "库存", key: "stock", width: 90 },
  { title: "销量", key: "sales", width: 90 },
  { title: "状态", key: "status", width: 120 },
  { title: "更新时间", key: "updatedAt", width: 160 },
  { title: "操作", key: "action", width: 100, fixed: "right" },
];
const products = ref<ProductRow[]>([
  {
    id: "P1",
    name: "企业协作平台专业版",
    sku: "KUI-PRO-YEAR",
    category: "软件服务",
    price: 12800,
    stock: 999,
    sales: 328,
    enabled: true,
    updatedAt: "2026-08-23 10:20",
    color: "#3a95ff",
  },
  {
    id: "P2",
    name: "数据分析服务年度版",
    sku: "DATA-PRO-YEAR",
    category: "数据服务",
    price: 28600,
    stock: 86,
    sales: 126,
    enabled: true,
    updatedAt: "2026-08-23 09:32",
    color: "#7b61ff",
  },
  {
    id: "P3",
    name: "团队空间扩容包",
    sku: "SPACE-500G",
    category: "增值服务",
    price: 2399,
    stock: 12,
    sales: 892,
    enabled: true,
    updatedAt: "2026-08-22 18:06",
    color: "#22a06b",
  },
  {
    id: "P4",
    name: "私有化部署授权",
    sku: "PRIVATE-DEPLOY",
    category: "软件服务",
    price: 68000,
    stock: 20,
    sales: 42,
    enabled: false,
    updatedAt: "2026-08-20 14:18",
    color: "#f59e0b",
  },
]);
const categoryOptions = [
  { label: "软件服务", value: "软件服务" },
  { label: "数据服务", value: "数据服务" },
  { label: "增值服务", value: "增值服务" },
];
const statusOptions = [
  { label: "已上架", value: "enabled" },
  { label: "已下架", value: "disabled" },
];
const keyword = ref("");
const category = ref<string>();
const status = ref<string>();
const selectedKeys = ref<TableKey[]>([]);
const hiddenColumnKeys = ref<string[]>([]);
const drawerOpen = ref(false);
const editingId = ref("");
const form = reactive({
  name: "",
  sku: "",
  category: "软件服务",
  price: 0,
  stock: 0,
  enabled: true,
});
const filteredProducts = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return products.value.filter(
    (item) =>
      (!query ||
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)) &&
      (!category.value || item.category === category.value) &&
      (!status.value || item.enabled === (status.value === "enabled")),
  );
});
const resetFilters = () => {
  keyword.value = "";
  category.value = undefined;
  status.value = undefined;
};
const disableSelected = () => {
  const selected = new Set(selectedKeys.value);
  products.value.forEach((item) => {
    if (selected.has(item.id)) item.enabled = false;
  });
  message.success(`已下架 ${selected.size} 件商品`);
  selectedKeys.value = [];
};
const resetForm = () =>
  Object.assign(form, {
    name: "",
    sku: "",
    category: "软件服务",
    price: 0,
    stock: 0,
    enabled: true,
  });
const openCreate = () => {
  editingId.value = "";
  resetForm();
  drawerOpen.value = true;
};
const openEdit = (record: ProductRow) => {
  editingId.value = record.id;
  Object.assign(form, record);
  drawerOpen.value = true;
};
const saveProduct = () => {
  if (!form.name.trim() || !form.sku.trim()) return message.warning("请填写商品名称和 SKU");
  const target = products.value.find((item) => item.id === editingId.value);
  if (target) Object.assign(target, form, { updatedAt: "刚刚" });
  else
    products.value.unshift({
      id: `P${Date.now()}`,
      ...form,
      sales: 0,
      updatedAt: "刚刚",
      color: "#3a95ff",
    });
  drawerOpen.value = false;
  message.success("商品信息已保存");
};
</script>

<style scoped lang="less">
.product-cell {
  display: flex;
  gap: 10px;
  align-items: center;
}
.product-cell > span {
  display: grid;
  width: 42px;
  height: 42px;
  flex: none;
  place-items: center;
  color: #fff;
  border-radius: var(--kui-control-radius);
  font-size: 20px;
}
.product-cell > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
.product-cell small {
  color: var(--kui-color-text-description);
}
.stock-low {
  color: var(--kui-color-warning);
  font-weight: 600;
}
</style>

<route lang="yaml">
meta:
  title: "商品管理"
  icon: "Package"
  order: 2
</route>
