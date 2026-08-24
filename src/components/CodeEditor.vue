<template>
  <div
    ref="container"
    class="code-editor"
    :style="{ height: resolvedHeight }"
    :aria-label="ariaLabel"
  />
</template>

<script setup lang="ts">
import { useThemeStore } from "@/stores/theme";
import { defaultKeymap, history, indentWithTab } from "@codemirror/commands";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { solarizedDark } from "cm6-theme-solarized-dark";
import { solarizedLight } from "cm6-theme-solarized-light";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    language?: "java" | "javascript" | "json" | "yaml";
    readonly?: boolean;
    height?: string | number;
    lineNumbers?: boolean;
    lineWrapping?: boolean;
    ariaLabel?: string;
  }>(),
  {
    modelValue: "",
    language: "javascript",
    readonly: false,
    height: 600,
    lineNumbers: true,
    lineWrapping: true,
    ariaLabel: "Code editor",
  },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const themeStore = useThemeStore();
const container = ref<HTMLElement>();
const view = ref<EditorView>();
const themeCompartment = new Compartment();
const languageCompartment = new Compartment();
const editableCompartment = new Compartment();
const resolvedHeight = computed(() =>
  typeof props.height === "number" ? `${props.height}px` : props.height,
);
function languageExtension(): Extension {
  if (props.language === "yaml") return yaml();
  if (props.language === "java") return java();
  if (props.language === "json") return json();
  return javascript();
}
const editableExtensions = (): Extension => [
  EditorState.readOnly.of(props.readonly),
  EditorView.editable.of(!props.readonly),
];

function createView() {
  if (!container.value) return;
  const extensions: Extension[] = [
    keymap.of([indentWithTab, ...defaultKeymap]),
    history({ minDepth: 100 }),
    highlightActiveLine(),
    languageCompartment.of(languageExtension()),
    editableCompartment.of(editableExtensions()),
    themeCompartment.of(themeStore.isDark ? solarizedDark : solarizedLight),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !props.readonly)
        emit("update:modelValue", update.state.doc.toString());
    }),
    EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" },
    }),
  ];
  if (props.lineNumbers) extensions.push(lineNumbers());
  if (props.lineWrapping) extensions.push(EditorView.lineWrapping);
  view.value = new EditorView({
    parent: container.value,
    state: EditorState.create({ doc: props.modelValue, extensions }),
  });
}
watch(
  () => props.modelValue,
  (value) => {
    const editor = view.value;
    if (!editor || value === editor.state.doc.toString()) return;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
    });
  },
);
watch(
  () => props.language,
  () =>
    view.value?.dispatch({
      effects: languageCompartment.reconfigure(languageExtension()),
    }),
);
watch(
  () => props.readonly,
  () =>
    view.value?.dispatch({
      effects: editableCompartment.reconfigure(editableExtensions()),
    }),
);
watch(
  () => themeStore.theme,
  () =>
    view.value?.dispatch({
      effects: themeCompartment.reconfigure(themeStore.isDark ? solarizedDark : solarizedLight),
    }),
);
onMounted(createView);
onBeforeUnmount(() => view.value?.destroy());
defineExpose({ focus: () => view.value?.focus(), getView: () => view.value });
</script>

<style scoped>
.code-editor {
  width: 100%;
  min-height: 120px;
  overflow: hidden;
  border: 1px solid var(--kui-color-border);
  border-radius: var(--kui-border-radius, 6px);
  box-sizing: border-box;
}
</style>
