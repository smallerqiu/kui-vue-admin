import { h } from "vue";

/**
 * Kui's Skeleton reads its default slot on every render to find out whether there is content, and only
 * then decides between the placeholder and that content -- so a body that dereferences a payload which
 * has not arrived yet still throws here, exactly as it would in the browser. With `delay: 0` the
 * placeholder is the whole body while the read is in flight, which is the shape every page here asks
 * for: a frame that holds its layout instead of a line of text.
 */
export const skeletonStub = {
  props: {
    loading: Boolean,
    delay: Number,
    rows: Number,
    titleWidth: Number,
    avatar: [Boolean, Object],
    animated: Boolean,
  },
  setup(
    props: { loading?: boolean },
    { slots }: { slots: Record<string, () => unknown> },
  ) {
    return () => {
      const child = slots.default?.();
      return h(
        "div",
        { class: "skeleton", "aria-busy": props.loading ? "true" : undefined },
        child?.length && !props.loading ? child : [h("span", { class: "skeleton-line" })],
      );
    };
  },
};
