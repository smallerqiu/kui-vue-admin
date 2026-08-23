<template>
  <div class="sys-tab-wrapper">
    <div class="sys-tab-box" ref="rootRef">
      <transition-group
        class="tab-inner-box"
        tag="div"
        name="sys-tab"
        move-class="sys-tab-move"
        :time="300"
        @enter="animate.onEnter"
        @beforeEnter="animate.onBeforeEnter"
        @afterEnter="onAfterEnter"
        @beforeLeave="animate.onBeforeLeave"
        @leave="animate.onLeave"
        @afterLeave="animate.onAfterLeave"
      >
        <div
          :class="cls(view)"
          v-for="view in views"
          :key="view.key"
          draggable="true"
          @dragstart="onDragStart($event, view)"
          @dragover.prevent="onDragOver($event, view)"
          @drop.prevent="onDrop(view)"
          @dragend="resetDrag"
        >
          <i
            v-if="dragOverKey === view.key"
            :class="['sys-tab-drop-indicator', `is-${dropSide}`]"
          />
          <Dropdown trigger="contextmenu" :key="view.fullPath">
            <div class="sys-tab-item-inner">
              <router-link
                :to="{
                  path: view.path,
                  query: view.query,
                }"
              >
                <Icon
                  class="sys-tab-icon"
                  :type="view.loading ? Loading : icons[view.meta.icon]"
                  :spin="view.loading"
                  v-if="view.meta.icon"
                />
                <span class="sys-tab-title">
                  {{ $t(`route.${view.path}`) || view.meta.title || "-" }}
                </span>
                <Icon
                  :type="X"
                  class="sys-tab-close"
                  @click.prevent.stop="close(view)"
                />
              </router-link>
            </div>
            <template #overlay>
              <Menu @select="(e: MenuSelectEvent) => handle(e, view)">
                <MenuItem key="reload">{{ $t("menu.reload") }}</MenuItem>
                <MenuItem key="close">{{ $t("menu.close") }}</MenuItem>
                <MenuItem key="close-other">{{
                  $t("menu.close_other")
                }}</MenuItem>
                <MenuItem key="close-left">{{
                  $t("menu.close_left")
                }}</MenuItem>
                <MenuItem key="close-right">{{
                  $t("menu.close_right")
                }}</MenuItem>
              </Menu>
            </template>
          </Dropdown>
        </div>
      </transition-group>
    </div>
    <Dropdown trigger="hover" v-if="showDrop" placement="bottom" arrow>
      <Button :icon="ChevronDown" size="small" class="sys-tab-show-list-btn" />
      <template #overlay>
        <Menu @select="dropGo">
          <MenuItem
            :icon="icons[view.meta.icon]"
            v-for="view in views"
            :key="view.fullPath"
          >
            {{ $t(`route.${view.path}`) || view.meta.title }}
          </MenuItem>
        </Menu>
      </template>
    </Dropdown>
  </div>
</template>
<script setup lang="ts">
import { useTranslate } from "@/lang/useTranslate";
import type { ViewItem } from "@/stores/tabs";
import { useTabViewsStore } from "@/stores/tabs";
import { getTransitionHorProp } from "@/utils/transition";
import id from "hash-sum";
import * as kuiIcons from "kui-icons";
import { ChevronDown, Loading, X } from "kui-icons";
import type { MenuSelectEvent } from "kui-vue";
import {
  computed,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
const $t = useTranslate();
const route = useRoute();
const router = useRouter();
const tab = useTabViewsStore();
const animate = getTransitionHorProp("tab-fade");
const icons = ref<Record<string, any>>(kuiIcons);

const showDrop = ref(false);
const observe = ref<ResizeObserver>();
const rootRef = ref<HTMLElement>();
const draggedKey = ref("");
const dragOverKey = ref("");
const dropSide = ref<"before" | "after">("before");

const views = computed<ViewItem[]>(() => tab.views);
const current = computed(() => route.fullPath);
const currentIndex = computed(() =>
  views.value.findIndex((v) => v.fullPath === current.value),
);

watch(
  () => route.fullPath,
  (_) => {
    tab.addView(route);
    updatePosition();
  },
);
const updatePosition = () => {
  nextTick(() => {
    if (rootRef.value)
      showDrop.value = rootRef.value?.clientWidth < rootRef.value?.scrollWidth;
    nextTick(() => {
      scrollToCenter();
    });
  });
};

const onAfterEnter = (e: any) => {
  animate.onAfterEnter(e);
  updatePosition();
};

onBeforeMount(() => {
  tab.addView(route);
});

onMounted(() => {
  if (rootRef.value) {
    observe.value = new ResizeObserver(() => {
      updatePosition();
    });
    observe.value.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  if (observe.value) {
    observe.value.disconnect();
  }
});

const dropGo = (e: { key: string }) => {
  let view = views.value.find((x: ViewItem) => x.fullPath === e.key);
  if (view) go(view);
};

const scrollToCenter = (smooth = true) => {
  let box = rootRef.value;
  if (!box) return;
  let items = box.children[0]?.children || [];
  let item = items[currentIndex.value] as HTMLElement;
  if (!item) return;
  const offset = item.offsetLeft;
  const scrollDistance =
    offset -
    parseFloat((box.clientWidth / 2).toFixed(2)) +
    parseFloat((item.clientWidth / 2).toFixed(2));
  if (smooth) {
    box.scrollTo({ left: scrollDistance, behavior: "smooth" });
  } else {
    box.scrollLeft = scrollDistance;
  }
};

const handle = (e: MenuSelectEvent, view: ViewItem) => {
  let cur_index, select_index;
  switch (e.key) {
    case "reload":
      reload(view);
      break;
    case "close":
      close(view);
      break;
    case "close-other":
      tab.closeOtherView(view);
      if (current.value !== view.fullPath) {
        go(view);
      }
      break;
    case "close-right":
      cur_index = views.value.findIndex((x) => x.fullPath === current.value);
      select_index = views.value.indexOf(view);
      if (current.value !== view.fullPath && cur_index > select_index) {
        go(view);
      }
      tab.closeRightView(view);
      break;
    case "close-left":
      cur_index = views.value.findIndex((x) => x.fullPath === current.value);
      select_index = views.value.indexOf(view);
      if (current.value !== view.fullPath && cur_index < select_index) {
        go(view);
      }
      tab.closeLeftView(view);
      break;
    default:
      break;
  }
};

const reload = (view: ViewItem) => {
  let currentId = id(route.fullPath);
  if (currentId !== view.key) {
    tab.reloadSelectView(view);
    return;
  }
  tab.reloadView(view);
};

const close = (view: ViewItem) => {
  let viewsArray = views.value;
  if (viewsArray.length === 1) return;
  if (view.fullPath === current.value) {
    let index = viewsArray.findIndex((x) => x.fullPath === view.fullPath);

    if (index === 0) {
      index = 1;
    } else if (index === viewsArray.length - 1) {
      index = viewsArray.length - 2;
    } else {
      index += 1;
    }
    let item = viewsArray[index];
    tab.closeView(view);
    go(item);
  } else {
    tab.closeView(view);
  }
  updatePosition();
};

const go = (item: ViewItem) => {
  router.push({
    path: item.path,
    query: item.query,
  });
};

const onDragStart = (event: DragEvent, view: ViewItem) => {
  draggedKey.value = view.key;
  event.dataTransfer?.setData("text/plain", view.key);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
};

const onDragOver = (event: DragEvent, view: ViewItem) => {
  if (!draggedKey.value || draggedKey.value === view.key) {
    dragOverKey.value = "";
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  dragOverKey.value = view.key;
  dropSide.value = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
};

const onDrop = (target: ViewItem) => {
  const fromIndex = views.value.findIndex((view) => view.key === draggedKey.value);
  const targetIndex = views.value.findIndex((view) => view.key === target.key);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return resetDrag();
  let toIndex = targetIndex + (dropSide.value === "after" ? 1 : 0);
  if (fromIndex < toIndex) toIndex -= 1;
  tab.moveView(fromIndex, toIndex);
  resetDrag();
  nextTick(updatePosition);
};

const resetDrag = () => {
  draggedKey.value = "";
  dragOverKey.value = "";
};

const cls = (item: ViewItem) => {
  let index = views.value.indexOf(item);
  return [
    "sys-tab-item",
    {
      "sys-tab-item-active": item.fullPath === current.value,
      "sys-tab-item-dragging": item.key === draggedKey.value,
      "sys-tab-item-first": index === 0,
      "sys-tab-item-prev": index === currentIndex.value - 1,
      "sys-tab-item-next": index === currentIndex.value + 1,
    },
  ];
};
</script>
<style lang="less">
.sys-tab-wrapper {
  display: flex;
  align-items: center;
  background-color: var(--header-bg);
  border-radius: 10px;
  overflow: hidden;
  .sys-tab-show-list-btn.k-btn-sm {
    margin: 0 8px;
  }

  .sys-tab-box {
    display: flex;
    flex-wrap: nowrap;
    overflow: auto hidden;
    gap: 2px;
    padding: 8px 0 0;
    flex: 1;

    &::-webkit-scrollbar {
      height: 0;
    }

    .tab-inner-box {
      display: flex;
      flex-wrap: nowrap;
      margin-left: 8px;
      height: 34px;
      transition: all 0.3s ease-in-out;
      margin-bottom: -2px;
    }

    .sys-tab-item {
      display: inline-flex;
      position: relative;
      cursor: pointer;
      height: 26px;
      line-height: 26px;
      font-size: 12px;
      margin: 0 4px;
      user-select: none;
      &::before,
      &::after {
        content: "";
        position: absolute;
        width: 15px;
        height: 17px;
        background: none;
        bottom: 8px;
        z-index: 0;
      }

      &::before {
        box-shadow: 12px 12px 0px 9px var(--header-bg);
        border-radius: 0 0 12px 0;
        left: -15px;
        bottom: 2px;
        height: 16px;
        top: auto;
      }

      &::after {
        border-radius: 0 0 0 12px;
        box-shadow: -12px 12px 0px 9px var(--header-bg);
        right: -15px;
        top: 15px;
      }

      .sys-tab-item-inner {
        border-radius: 8px;
        z-index: 1;
        position: relative;
        &::before,
        &::after {
          content: "";
          position: absolute;
          width: 2px;
          height: 14px;
          background: var(--kui-color-item-selected);
          top: 6px;
        }
        &::before {
          left: -5px;
        }
        &::after {
          right: -5px;
        }

        &:hover {
          background: var(--kui-color-item-selected);
        }
        a {
          padding: 0 8px;
          color: var(--kui-color-text);
          display: flex;
          text-decoration: none;
          align-items: center;
        }
      }

      .sys-tab-title {
        max-width: 120px;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .sys-tab-icon {
        margin-right: 5px;
      }

      .sys-tab-close {
        margin-left: 5px;
        font-size: 13px;
        font-weight: bold;
        border-radius: 50%;
        padding: 2px;
        z-index: 10;

        &:hover {
          background-color: var(--kui-color-item-selected);
        }
      }
    }

    .sys-tab-item-dragging {
      opacity: 0.4;
    }

    .sys-tab-drop-indicator {
      position: absolute;
      z-index: 120;
      top: 3px;
      bottom: 5px;
      width: 2px;
      border-radius: 2px;
      background: var(--kui-color-primary);
      pointer-events: none;

      &.is-before { left: -5px; }
      &.is-after { right: -5px; }
    }

    .sys-tab-move {
      transition: transform 180ms var(--kui-motion-easing);
    }
    .sys-tab-item-first,
    .sys-tab-item-next {
      .sys-tab-item-inner::before {
        background-color: transparent;
      }
    }
    .sys-tab-item-prev {
      .sys-tab-item-inner::after {
        background-color: transparent;
      }
    }

    .sys-tab-item-active {
      vertical-align: top;
      align-self: flex-start;
      justify-self: baseline;
      border-radius: 10px 10px 0 0;
      padding-bottom: 8px;
      position: relative;
      z-index: 100;
      height: 100%;
      background-color: var(--kui-color-bg);
      &::before {
        box-shadow: 12px 12px 0px 9px var(--kui-color-bg);
      }
      &::after {
        box-shadow: -12px 12px 0px 9px var(--kui-color-bg);
      }
      .sys-tab-item-inner {
        background: var(--kui-color-bg);
        position: relative;
        border-radius: 8px 8px 0 0;
        z-index: 1;
        &:hover {
          background: var(--kui-color-bg);
        }
        &::before,
        &::after {
          background-color: transparent;
        }
      }
    }
  }

  .tab-fade-leave-active {
    transition: width 0.3s;
    animation: fadeout 0.3s ease-in-out;
  }

  @keyframes fadeout {
    0% {
      opacity: 1;
    }

    100% {
      width: 0;
      opacity: 0;
    }
  }

  @-webkit-keyframes fadeout {
    0% {
      opacity: 1;
    }

    100% {
      width: 0;
      opacity: 0;
    }
  }
}

.sys-tab-enter,
.sys-tab-leave-to {
  transition: all 0.3s ease-in-out;
  opacity: 0;
  .sys-tab-item-inner {
    transition: all 0.3s ease-in-out;
  }
}
.sys-tab-enter-active,
.sys-tab-leave-active {
  transition: all 0.3s ease-in-out;
  .sys-tab-item-inner {
    transition: all 0.3s ease-in-out;
  }
}
/* 可选：显式定义 enter-to（其实默认 opacity:1，可省略） */
.sys-tab-enter-to,
.sys-tab-leave {
  opacity: 1;

  .sys-tab-item-inner {
    transition: all 0.3s ease-in-out;
  }
}

.k-dropdown-menu {
  max-height: calc(100vh - 100px);
  overflow: auto;
}

.k-dropdown-menu-item {
  height: 32px !important;
}
</style>
