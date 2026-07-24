/**
 * 获取数据类型
 */
export function getDataType(value: any): string {
  return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
}

interface FlattenOptions {
  key?: string;
  index?: number;
  type?: 'content' | 'objectStart' | 'objectEnd' | 'arrayStart' | 'arrayEnd';
  showComma?: boolean;
  length?: number;
}

interface FlattenResult {
  content?: any;
  level: number;
  key?: string;
  index?: number;
  path: string;
  showComma: boolean;
  length: number;
  type: string;
}

/**
 * JSON 扁平化处理
 */
export function jsonFlatten(
  data: any,
  path: string = "root",
  level: number = 0,
  options: FlattenOptions = {}
): FlattenResult[] {
  const { key, index, type = "content", showComma = false, length = 1 } = options;
  const dataType = getDataType(data);

  if (dataType === "array") {
    const inner = arrFlat(
      (data as any[]).map((item, idx, arr) =>
        jsonFlatten(item, `${path}[${idx}]`, level + 1, {
          index: idx,
          showComma: idx !== arr.length - 1,
          length: arr.length,
          type,
        })
      )
    );
    return [
      jsonFlatten("[", path, level, { key, length: data.length, type: "arrayStart" })[0],
      ...inner,
      jsonFlatten("]", path, level, { showComma, length: data.length, type: "arrayEnd" })[0]
    ];
  } else if (dataType === "object") {
    const keys = Object.keys(data);
    const inner = arrFlat(
      keys.map((objKey, idx, arr) =>
        jsonFlatten(
          data[objKey],
          /^[a-zA-Z_]\w*$/.test(objKey) ? `${path}.${objKey}` : `${path}["${objKey}"]`,
          level + 1,
          {
            key: objKey,
            showComma: idx !== arr.length - 1,
            length: keys.length,
            type,
          }
        )
      )
    );
    return [
      jsonFlatten("{", path, level, { key, index, length: keys.length, type: "objectStart" })[0],
      ...inner,
      jsonFlatten("}", path, level, { showComma, length: keys.length, type: "objectEnd" })[0]
    ];
  }

  return [
    {
      content: data,
      level,
      key,
      index,
      path,
      showComma,
      length,
      type,
    },
  ];
}

/**
 * 数组扁平化
 */
export function arrFlat<T>(arr: (T | T[])[]): T[] {
  // @ts-ignore
  if (typeof Array.prototype.flat === "function") {
    return (arr as any).flat();
  }
  const stack = [...arr];
  const result: T[] = [];
  while (stack.length) {
    const first = stack.shift();
    if (Array.isArray(first)) {
      stack.unshift(...first);
    } else if (first !== undefined) {
      result.push(first);
    }
  }
  return result;
}

/**
 * 深拷贝
 */
export function cloneDeep<T>(source: T, hash = new WeakMap<object, any>()): T {
  if (source === null || typeof source !== "object") return source;
  if (source instanceof Date) return new Date(source) as any;
  if (source instanceof RegExp) return new RegExp(source) as any;
  
  if (hash.has(source as object)) return hash.get(source as object);

  if (Array.isArray(source)) {
    const output: any[] = [];
    hash.set(source as object, output);
    source.forEach((item, index) => {
      output[index] = cloneDeep(item, hash);
    });
    return output as any;
  }

  const output: Record<string, any> = {};
  hash.set(source as object, output);
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      output[key] = cloneDeep((source as any)[key], hash);
    }
  }
  return output as T;
}

/**
 * 字符串自动转类型
 */
export function stringToAutoType(source: string): any {
  if (source === "null") return null;
  if (source === "undefined") return undefined;
  if (source === "true") return true;
  if (source === "false") return false;
  
  if (
    (source.startsWith('"') && source.endsWith('"')) ||
    (source.startsWith("'") && source.endsWith("'"))
  ) {
    return source.slice(1, -1);
  }
  
  const num = Number(source);
  if (!isNaN(num) || source === "NaN") {
    return num;
  }
  
  return source;
}