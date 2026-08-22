import { inject } from "vue";

export type Translate = (key: string) => string;

let activeTranslate: Translate = (key: string) => key;

export function setTranslate(translate: Translate) {
  activeTranslate = translate;
}

export function translate(key: string) {
  return activeTranslate(key);
}

export function useTranslate(): Translate {
  return inject<Translate>("$t", (key: string) => key);
}
