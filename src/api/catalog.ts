import request from "@/utils/request";

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface CustomerInput {
  name: string;
  industry: string;
  level: "strategic" | "enterprise" | "growth";
  status: "active" | "follow" | "risk";
  contact: string;
  phone: string;
  email: string;
  city: string;
}
export interface Customer extends CustomerInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface ProductInput {
  name: string;
  sku: string;
  category: string;
  specs: string;
  image: string;
  price: string;
  stock: number;
  enabled: boolean;
}
export interface Product extends ProductInput {
  id: string;
  updatedAt: string;
  [key: string]: unknown;
}

// PUT is a full replacement. Never send table decorations or ownership fields.
export const productInput = (value: ProductInput): ProductInput => ({
  name: value.name, sku: value.sku, category: value.category,
  specs: value.specs, image: value.image, price: value.price,
  stock: value.stock, enabled: value.enabled,
});
export const customerInput = (value: CustomerInput): CustomerInput => ({
  name: value.name, industry: value.industry, level: value.level,
  status: value.status, contact: value.contact, phone: value.phone,
  email: value.email, city: value.city,
});
export const catalogApi = {
  setProductEnabled: (id: string, enabled: boolean) =>
    request.post<Product>(`/products/${encodeURIComponent(id)}/availability`, { enabled }),
  customer: (id: string) => request.get<Customer>(`/customers/${encodeURIComponent(id)}`),
  saveCustomer: (value: CustomerInput, id?: string) => id
    ? request.put<Customer>(`/customers/${encodeURIComponent(id)}`, customerInput(value))
    : request.post<Customer>("/customers", customerInput(value)),
  saveProduct: (value: ProductInput, id?: string) => id
    ? request.put<Product>(`/products/${encodeURIComponent(id)}`, productInput(value))
    : request.post<Product>("/products", productInput(value)),
};
