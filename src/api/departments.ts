import request from "@/utils/request";

/** Kui's Table reads a cell by column key, so a row carries an index signature. */
export interface Department {
  id: string;
  name: string;
  [key: string]: unknown;
}

/**
 * Departments are a directory rather than a ledger: `/departments` answers the
 * whole list because the user form needs every entry at once, so the page has no
 * pagination to mirror and searches the rows it already has.
 */
export async function loadDepartments(): Promise<Department[]> {
  return request.get<Department[]>("/departments");
}

/** Create and rename are open to a super administrator only, like the backend route. */
export function createDepartment(name: string) {
  return request.post<{ id: string }>("/departments", { name });
}

export function renameDepartment(id: string, name: string) {
  return request.put<Department>(`/departments/${encodeURIComponent(id)}`, { name });
}

/**
 * A 409 here means records still point at the department, and the server message
 * names the table and count, so callers must surface it instead of swallowing it.
 */
export function removeDepartment(id: string) {
  return request.delete<{ ok: boolean }>(`/departments/${encodeURIComponent(id)}`);
}
