<template>
  <div ref="editorContainer" class="codemirror-editor"></div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { useThemeStore } from "@/stores/theme";
import { defaultKeymap, history, indentWithTab } from "@codemirror/commands";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { yaml } from "@codemirror/lang-yaml";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { solarizedDark } from "cm6-theme-solarized-dark";
import { solarizedLight } from "cm6-theme-solarized-light";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
const themeStore = useThemeStore();
const emit = defineEmits(["update:modelValue"]);

const props = defineProps({
  modelValue: { type: String, default: "" },
  theme: { type: String, default: "dark" },
  lang: { type: String, default: "js" },
  readonly: { type: Boolean, default: false },
  show: Boolean,
});

const editorContainer = ref<HTMLElement>();
const view = ref<EditorView | null>(null);
const themeCompartment = ref<Compartment | null>(null);

const langs: Record<string, any> = {
  js: javascript(),
  yaml: yaml(),
  java: java(),
};

watch(
  () => themeStore.theme,
  (v, n) => {
    if (v && v != n) {
      toggleTheme(v);
    }
  },
);

watch(
  () => props.modelValue,
  (newVal) => {
    if (view.value && newVal !== view.value.state.doc.toString()) {
      view.value.dispatch({
        changes: { from: 0, to: view.value.state.doc.length, insert: newVal },
      });
    }
  },
);

const toggleTheme = (theme: string) => {
  view.value?.dispatch({
    effects: themeCompartment.value?.reconfigure(
      theme == "dark" ? solarizedDark : solarizedLight,
    ),
  });
};

const initEditor = () => {
  const theme = themeStore.isDark ? solarizedDark : solarizedLight;
  themeCompartment.value = new Compartment();

  const extensions = [
    keymap.of([indentWithTab, ...defaultKeymap]),
    history({ minDepth: 100 }),
    lineNumbers(),
    highlightActiveLine(),
    EditorView.lineWrapping, // 自动换行
    themeCompartment.value.of(theme),
    langs[props.lang],
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        emit("update:modelValue", content);
      }
    }),
  ];

  const state = EditorState.create({
    doc: props.modelValue,
    extensions,
  });

  view.value = new EditorView({
    state,
    parent: editorContainer.value,
  });
};

onMounted(() => {
  initEditor();
});

onBeforeUnmount(() => {
  if (view.value) {
    view.value.destroy();
  }
});
</script>

<style>
.codemirror-editor {
  height: 600px;
  border: 1px solid var(--kui-color-border);
  border-radius: 5px;
  overflow: auto;
  width: 100%;
  box-sizing: border-box;
}
</style>
