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
  // Computed by the server for the list, never typed into the form: whose customer it is, and
  // what the orders pointing back at it add up to inside the viewer's own data scope.
  ownerName: string | null;
  orderCount: number;
  annualValue: string;
  lastContactAt: string | null;
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
/**
 * The four numbers above the customer list. Each one is the row set a filter on that list selects:
 * `total` the unfiltered list, `byLevel.strategic` the 等级 dropdown, and `annualValue` the sum of
 * the 年价值 column over every page rather than the one on screen.  `monthlyAdded` /
 * `lastMonthlyAdded` count whole calendar months of the same UTC clock the rows' `createdAt` carries,
 * and `beforeThisMonth` is where the count stood at the end of last month -- the pair the 客户总数
 * trend is measured against, so a deletion this month cannot move the baseline it compares to.
 */
export interface CustomerSummary {
  total: number;
  byLevel: { strategic: number };
  monthlyAdded: number;
  lastMonthlyAdded: number;
  beforeThisMonth: number;
  annualValue: string;
  strategicAnnualValue: string;
}
/**
 * The 分类 values that exist on the products this account may read.  The column is free text the
 * product form writes, not a code list this app owns, so the only complete dropdown is the one the
 * server builds off the table: a list kept here could only offer labels that happen to match, and
 * the category a colleague just filed under another word would be unfilterable from the page that
 * lists it.
 */
export interface ProductFacets {
  categories: string[];
}
export const catalogApi = {
  customerSummary: () => request.get<CustomerSummary>("/customers/summary"),
  productFacets: () => request.get<ProductFacets>("/products/facets"),
  setProductEnabled: (id: string, enabled: boolean) =>
    request.post<Product>(`/products/${encodeURIComponent(id)}/availability`, { enabled }),
  customer: (id: string) => request.get<Customer>(`/customers/${encodeURIComponent(id)}`),
  /**
   * One page of customers for the picker in 新建订单. The list endpoint searches 名称, 联系人 and
   * 城市 -- not 电话 or 邮箱, so a box typed with a phone number legitimately comes back empty --
   * which means the picker asks the same question the customer page asks rather than keeping a
   * directory of its own: a picker built from a cached copy could not name a customer a colleague
   * added five minutes ago, and the order has to carry an id this account can really read.
   */
  searchCustomers: (keyword: string) =>
    request.get<PageResult<Customer>>("/customers", { keyword, pageSize: 20 }),
  /**
   * On-sale products for the 商品明细 rows. `enabled: true` is sent to the server rather than
   * filtering the page locally because 上架/下架 is a column the products page writes, and `POST
   * /orders` answers 404 for a product nobody is selling -- offering it here would be offering a
   * line that cannot be filed.
   */
  searchProducts: (keyword: string) =>
    request.get<PageResult<Product>>("/products", { keyword, enabled: true, pageSize: 20 }),
  saveCustomer: (value: CustomerInput, id?: string) => id
    ? request.put<Customer>(`/customers/${encodeURIComponent(id)}`, customerInput(value))
    : request.post<Customer>("/customers", customerInput(value)),
  saveProduct: (value: ProductInput, id?: string) => id
    ? request.put<Product>(`/products/${encodeURIComponent(id)}`, productInput(value))
    : request.post<Product>("/products", productInput(value)),
};
