<template>
  <div class="pro-list-page">
    <PageHeader title="商品管理" description="维护商品信息、库存和上架状态。">
      <template #actions>
        <Button v-if="canEdit" type="primary" :icon="Plus" @click="openCreate">新增商品</Button>
      </template>
    </PageHeader>
    <p v-if="error" role="alert">{{ error }} <Button @click="reload">重试</Button></p>
    <ListPanel :summary="`${total} 件商品`" :selected-count="selectedKeys.length">
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="搜索商品名称或 SKU"
          :icon="Search"
          style="width: 200px"
        />
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
          <Button v-if="canEdit" type="danger" size="small" :loading="changing" @click="disableSelected">批量下架</Button>
          <Button theme="plain" size="small" @click="selectedKeys = []">取消选择</Button>
        </Space>
      </template>
      <Table
        v-model:selected-keys="selectedKeys"
        checkable
        :data="products"
        :loading="loading"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 980 }"
      >
        <template #product="{ record }">
          <div class="product-cell">
            <span style="background: var(--kui-color-primary)"><Icon :type="Package" /></span>
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
          <Switch :model-value="record.enabled" :disabled="!canEdit || changing || loading" size="small"
            true-text="上架" false-text="下架" @update:model-value="value => toggleEnabled(record, Boolean(value))" />
        </template>
        <template #updatedAt="{ value }">
          {{ formatDateTime(value) }}
        </template>
        <template #action="{ record }">
          <Button v-if="canEdit" size="small" theme="plain" :icon="Pencil" @click="openEdit(record)">编辑</Button>
        </template>
      </Table>
      <Page v-model:page="page" :page-size="pageSize" :total="total" :disabled="loading" />
    </ListPanel>

    <Drawer
      v-model="drawerOpen"
      :title="editingId ? '编辑商品' : '新增商品'"
      :width="480"
      :closable="!saving" :mask-closable="!saving" :esc-key="!saving"
    >
      <template #footer>
        <Button :disabled="saving" @click="drawerOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="saveProduct">保存</Button>
      </template>
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
              <Input v-model="form.price" placeholder="0.00" />
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
import { Package, Pencil, Plus, Search } from "kui-icons";
import { message, PageHeader, type Column, type TableKey } from "kui-vue";
import { computed, reactive, ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { catalogApi, productInput, type Product, type ProductInput } from "@/api/catalog";
import { useResourcePage } from "@/composables/use-resource-page";
import { reportFailure } from "@/utils/report-failure";
import { formatDateTime } from "@/utils/common";

const columns: Column[] = [
  { title: "商品", key: "product", width: 280 },
  { title: "分类", key: "category", width: 120 },
  { title: "价格", key: "price", width: 120 },
  { title: "库存", key: "stock", width: 90 },
  { title: "状态", key: "status", width: 120 },
  { title: "更新时间", key: "updatedAt", width: 160 },
  { title: "操作", key: "action", width: 100, fixed: "right" },
];
const auth = useAuthStore();
const canEdit = computed(() => hasPermission("product:write", auth.user?.permissions || []));
const categoryOptions = [
  { label: "软件服务", value: "软件服务" },
  { label: "数据服务", value: "数据服务" },
  { label: "增值服务", value: "增值服务" },
];
const statusOptions = [
  { label: "已上架", value: "enabled" }, { label: "已下架", value: "disabled" },
];
const keyword = ref("");
const category = ref<string>();
const status = ref<string>();
const { items: products, total, page, pageSize, loading, error, reload } = useResourcePage<Product>(
  "/products", () => ({
    keyword: keyword.value.trim(), category: category.value,
    enabled: status.value ? status.value === "enabled" : undefined,
  }),
);
const selectedKeys = ref<TableKey[]>([]);
watch(products, () => { selectedKeys.value = []; });
const hiddenColumnKeys = ref<string[]>([]);
const drawerOpen = ref(false);
const editingId = ref("");
const saving = ref(false);
const changing = ref(false);
const emptyForm = (): ProductInput => ({
  name: "", sku: "", category: "软件服务", specs: "", image: "",
  price: "0.00", stock: 0, enabled: true,
});
const form = reactive(emptyForm());
const resetFilters = () => {
  keyword.value = ""; category.value = undefined; status.value = undefined;
};
const disableSelected = async () => {
  if (changing.value || !selectedKeys.value.length) return;
  const selected = products.value.filter(item => selectedKeys.value.includes(item.id));
  changing.value = true;
  let succeeded = 0;
  try {
    for (const item of selected) {
      await catalogApi.setProductEnabled(item.id, false);
      succeeded++;
    }
    message.success(`已下架 ${succeeded} 件商品`);
  } catch {
    message.warning(`已完成 ${succeeded}/${selected.length} 项，剩余操作已停止，请刷新后核对`);
  } finally {
    await reload();
    changing.value = false;
  }
};
const toggleEnabled = async (record: Product, enabled: boolean) => {
  if (changing.value) return;
  changing.value = true;
  try {
    await catalogApi.setProductEnabled(record.id, enabled);
    message.success(enabled ? "已上架" : "已下架");
    await reload();
  } catch (reason) {
    // Server state is preserved, and the refusal is quoted.
    reportFailure(reason, "上下架失败");
  }
  finally { changing.value = false; }
};
const openCreate = () => {
  editingId.value = "";
  Object.assign(form, emptyForm());
  drawerOpen.value = true;
};
const openEdit = (record: Product) => {
  editingId.value = record.id;
  Object.assign(form, productInput(record));
  drawerOpen.value = true;
};
const saveProduct = async () => {
  if (saving.value) return;
  if (!form.name.trim() || !form.sku.trim()) return message.warning("请填写商品名称和 SKU");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(form.price))
    return message.warning("价格须为非负金额，最多两位小数");
  if (!Number.isInteger(form.stock) || form.stock < 0)
    return message.warning("库存须为非负整数");
  saving.value = true;
  try {
    await catalogApi.saveProduct(form, editingId.value || undefined);
    drawerOpen.value = false;
    message.success("商品信息已保存");
    await reload();
  } catch (reason) {
    // Input stays for a retry; the server says what it rejected.
    reportFailure(reason, "保存失败");
  }
  finally { saving.value = false; }
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
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
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
