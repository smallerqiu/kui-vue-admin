<template>
  <div class="approval-page">
    <PageHeader title="审批中心" description="统一处理费用、采购、请假与合同审批。">
      <template #actions><Button :icon="RefreshCw" @click="refresh">刷新待办</Button></template>
    </PageHeader>

    <Grid :cols="{ xs: 2, lg: 4 }" :x-gap="12" :y-gap="12" class="approval-stats">
      <GridItem v-for="item in stats" :key="item.label">
        <Card size="small" bordered class="approval-stat">
          <span :style="{ color: item.color, background: `${item.color}18` }"><Icon :type="item.icon" /></span>
          <div><strong>{{ item.value }}</strong><small>{{ item.label }}</small></div>
        </Card>
      </GridItem>
    </Grid>

    <ListPanel :summary="`${filteredApprovals.length} 条记录`">
      <template #filters>
          <RadioGroup v-model="status" theme="card" type="button" :options="statusOptions" />
          <Input v-model="keyword" clearable placeholder="搜索标题、编号或申请人" :icon="Search" />
          <Select v-model="type" clearable placeholder="全部类型" :options="typeOptions" />
      </template>
      <Table :data="filteredApprovals" :columns="tableColumns" row-key="id" :scroll="{ x: 980 }">
        <template #subject="{ record }">
          <div class="subject-cell"><span :style="{ color: typeInfo(record.type).color, background: `${typeInfo(record.type).color}18` }"><Icon :type="typeInfo(record.type).icon" /></span><div><button type="button" @click="openDetail(record)">{{ record.title }}</button><small>{{ record.id }}</small></div></div>
        </template>
        <template #amount="{ value }"><strong v-if="value">¥ {{ Number(value).toLocaleString() }}</strong><span v-else>—</span></template>
        <template #status="{ value }"><Tag :color="statusInfo(value).color" theme="fill">{{ statusInfo(value).label }}</Tag></template>
        <template #action="{ record }">
          <Space><Button size="small" theme="plain" :icon="Eye" @click="openDetail(record)">详情</Button><Button v-if="record.status === 'pending'" size="small" type="primary" @click="approve(record)">同意</Button></Space>
        </template>
      </Table>
    </ListPanel>

    <Drawer v-model="detailOpen" :title="selected?.title || '审批详情'" :width="560" :footer="false">
      <template v-if="selected">
        <div class="approval-heading">
          <span :style="{ color: typeMap[selected.type].color, background: `${typeMap[selected.type].color}18` }"><Icon :type="typeMap[selected.type].icon" /></span>
          <div><strong>{{ selected.title }}</strong><small>{{ selected.id }} · {{ typeMap[selected.type].label }}</small></div>
          <Tag :color="approvalStatusMap[selected.status].color" theme="fill">{{ approvalStatusMap[selected.status].label }}</Tag>
        </div>
        <Grid :cols="2" :x-gap="12" :y-gap="12" class="approval-facts">
          <GridItem><small>申请人</small><strong>{{ selected.applicant }}</strong></GridItem>
          <GridItem><small>所属部门</small><strong>{{ selected.department }}</strong></GridItem>
          <GridItem><small>申请时间</small><strong>{{ selected.createdAt }}</strong></GridItem>
          <GridItem><small>申请金额</small><strong>{{ selected.amount ? `¥ ${selected.amount.toLocaleString()}` : '—' }}</strong></GridItem>
        </Grid>
        <section class="approval-section"><strong>申请说明</strong><p>{{ selected.description }}</p></section>
        <section class="approval-section">
          <strong>审批进度</strong>
          <TimeLine>
            <TimeLineItem v-for="node in approvalFlow" :key="node.name" :icon="node.state === 'done' ? CircleCheck : node.state === 'rejected' ? CircleX : Clock" :color="flowColor(node.state)" :extra="node.detail"><strong>{{ node.name }}</strong></TimeLineItem>
          </TimeLine>
        </section>
        <Space v-if="selected.status === 'pending'" class="approval-actions">
          <Button type="primary" :icon="Check" @click="approve(selected)">同意申请</Button>
          <Button type="danger" theme="plain" :icon="X" @click="openReject">驳回</Button>
        </Space>
      </template>
    </Drawer>

    <Modal v-model="rejectOpen" title="驳回申请" :width="440" @ok="rejectApproval">
      <Form layout="vertical"><FormItem label="驳回原因"><TextArea v-model="rejectReason" :rows="4" placeholder="请说明驳回原因" /></FormItem></Form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { Briefcase, Check, CircleCheck, CircleX, Clock, Eye, FileCheck, Plane, ReceiptText, RefreshCw, Search, Wallet, X } from "kui-icons";
import { message, type Column, type IconType, type TableRecord } from "kui-vue";
import { computed, ref } from "vue";

type ApprovalStatus = "pending" | "approved" | "rejected";
type ApprovalType = "expense" | "purchase" | "leave" | "contract";
interface ApprovalItem extends TableRecord { id: string; title: string; type: ApprovalType; applicant: string; department: string; amount?: number; createdAt: string; status: ApprovalStatus; description: string; }
const typeMap: Record<ApprovalType, { label: string; color: string; icon: IconType[] }> = {
  expense: { label: "费用报销", color: "#3a95ff", icon: ReceiptText }, purchase: { label: "采购申请", color: "#7b61ff", icon: Wallet },
  leave: { label: "请假申请", color: "#f59e0b", icon: Plane }, contract: { label: "合同审批", color: "#22a06b", icon: Briefcase },
};
const approvalStatusMap: Record<ApprovalStatus, { label: string; color: string }> = { pending: { label: "待审批", color: "orange" }, approved: { label: "已通过", color: "green" }, rejected: { label: "已驳回", color: "red" } };
const approvals = ref<ApprovalItem[]>([
  { id: "AP-20260823-018", title: "客户拜访差旅费报销", type: "expense", applicant: "林夏", department: "销售中心", amount: 3680, createdAt: "2026-08-23 10:42", status: "pending", description: "上海客户现场方案沟通，包含交通、住宿及市内出行费用。" },
  { id: "AP-20260823-017", title: "研发测试设备采购", type: "purchase", applicant: "周牧", department: "研发中心", amount: 28600, createdAt: "2026-08-23 09:18", status: "pending", description: "移动端兼容性测试所需设备，共 6 台，已完成三方询价。" },
  { id: "AP-20260822-096", title: "年度框架服务合同", type: "contract", applicant: "陈一", department: "产品中心", amount: 128000, createdAt: "2026-08-22 16:36", status: "pending", description: "数据服务年度框架协议，法务已完成条款初审。" },
  { id: "AP-20260822-082", title: "个人年假申请", type: "leave", applicant: "顾言", department: "设计中心", createdAt: "2026-08-22 14:05", status: "approved", description: "计划休假 3 个工作日，当前工作已完成交接。" },
  { id: "AP-20260821-063", title: "市场活动物料采购", type: "purchase", applicant: "宋宁", department: "市场中心", amount: 15600, createdAt: "2026-08-21 11:20", status: "rejected", description: "秋季发布会现场物料及宣传品制作。" },
]);
const tableColumns: Column[] = [{ title: "审批事项", key: "subject", width: 300 }, { title: "申请人", key: "applicant", width: 100 }, { title: "部门", key: "department", width: 120 }, { title: "金额", key: "amount", width: 120 }, { title: "申请时间", key: "createdAt", width: 165 }, { title: "状态", key: "status", width: 100 }, { title: "操作", key: "action", width: 150, fixed: "right" }];
const statusOptions = [{ label: "全部", value: "all" }, { label: "待我审批", value: "pending" }, { label: "已通过", value: "approved" }, { label: "已驳回", value: "rejected" }];
const typeOptions = Object.entries(typeMap).map(([value, item]) => ({ label: item.label, value }));
const typeInfo = (value: ApprovalType) => typeMap[value];
const statusInfo = (value: ApprovalStatus) => approvalStatusMap[value];
const keyword = ref(""); const status = ref("pending"); const type = ref<ApprovalType>();
const detailOpen = ref(false); const rejectOpen = ref(false); const selected = ref<ApprovalItem>(); const rejectReason = ref("");
const filteredApprovals = computed(() => { const query = keyword.value.trim().toLowerCase(); return approvals.value.filter((item) => (status.value === "all" || item.status === status.value) && (!type.value || item.type === type.value) && (!query || `${item.title} ${item.id} ${item.applicant}`.toLowerCase().includes(query))); });
const stats = computed(() => [{ label: "待我审批", value: approvals.value.filter((item) => item.status === "pending").length, color: "#f59e0b", icon: Clock }, { label: "今日通过", value: approvals.value.filter((item) => item.status === "approved").length, color: "#22a06b", icon: CircleCheck }, { label: "已驳回", value: approvals.value.filter((item) => item.status === "rejected").length, color: "#ef6b73", icon: CircleX }, { label: "全部申请", value: approvals.value.length, color: "#3a95ff", icon: FileCheck }]);
const approvalFlow = computed(() => { if (!selected.value) return []; return [{ name: "申请人提交", detail: `${selected.value.applicant} · ${selected.value.createdAt}`, state: "done" }, { name: "直属负责人审批", detail: selected.value.status === "pending" ? "等待当前用户处理" : selected.value.status === "approved" ? "已同意" : "已驳回", state: selected.value.status === "pending" ? "pending" : selected.value.status === "approved" ? "done" : "rejected" }, { name: "流程完成", detail: selected.value.status === "pending" ? "等待前序节点" : "审批流程已结束", state: selected.value.status === "approved" ? "done" : "pending" }]; });
const flowColor = (state: string) => state === "done" ? "var(--kui-color-success)" : state === "rejected" ? "var(--kui-color-danger)" : "var(--kui-color-text-placeholder)";
const openDetail = (record: ApprovalItem) => { selected.value = record; detailOpen.value = true; };
const approve = (record: ApprovalItem) => { record.status = "approved"; selected.value = record; message.success("审批已通过"); };
const openReject = () => { rejectReason.value = ""; rejectOpen.value = true; };
const rejectApproval = () => { if (!rejectReason.value.trim()) return message.warning("请填写驳回原因"); if (selected.value) selected.value.status = "rejected"; rejectOpen.value = false; message.success("申请已驳回"); };
const refresh = () => message.success("待办数据已刷新");
</script>

<style scoped lang="less">
.approval-stats { margin-bottom: 16px; }.approval-stat :deep(.k-card-body) { display: flex; gap: 11px; align-items: center; }.approval-stat span,.approval-heading > span { display: grid; width: 40px; height: 40px; flex: none; place-items: center; border-radius: var(--kui-control-radius); font-size: 18px; }.approval-stat div { display: flex; flex-direction: column; }.approval-stat strong { color: var(--kui-color-text-title); font-size: 20px; }.approval-stat small { color: var(--kui-color-text-description); }
.subject-cell { display: flex; gap: 10px; align-items: center; }.subject-cell > span { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: var(--kui-control-radius); }.subject-cell > div { display: flex; min-width: 0; flex-direction: column; }.subject-cell button { overflow: hidden; padding: 0; color: var(--kui-color-text-title); font: inherit; font-weight: 600; text-align: left; text-overflow: ellipsis; white-space: nowrap; border: 0; background: none; cursor: pointer; }.subject-cell button:hover { color: var(--kui-color-primary); }.subject-cell small { color: var(--kui-color-text-placeholder); }
.approval-heading { display: flex; gap: 12px; align-items: center; }.approval-heading > div { display: flex; min-width: 0; flex: 1; flex-direction: column; }.approval-heading > div > strong { color: var(--kui-color-text-title); font-size: 17px; }.approval-heading small { color: var(--kui-color-text-description); }.approval-facts { margin-top: 20px; }.approval-facts > div { padding: 12px; border-radius: var(--kui-control-radius); background: var(--kui-theme-fill-bg); }.approval-facts small,.approval-facts strong { display: block; }.approval-facts small { margin-bottom: 5px; color: var(--kui-color-text-description); }.approval-facts strong { color: var(--kui-color-text-title); }
.approval-section { padding-top: 20px; margin-top: 20px; border-top: 1px solid var(--kui-color-border); }.approval-section > strong { display: block; margin-bottom: 14px; color: var(--kui-color-text-title); }.approval-section p { color: var(--kui-color-text-description); line-height: 1.7; }.approval-actions { margin-top: 24px; }
</style>

<route lang="yaml">
meta:
  title: "审批中心"
  icon: "Stamp"
  order: 10
</route>
