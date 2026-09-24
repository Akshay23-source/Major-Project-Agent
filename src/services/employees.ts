import { api } from "../lib/api";
import { safe } from "./_safe";

export interface Employee {
  id: string;
  agent_id: string;
  name: string;
  employee_id?: string;
  phone: string;
  email?: string;
  role: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  assigned_area?: string;
  joining_date?: string;
  emergency_contact?: string;
  notes?: string;
  status: "Active" | "On Leave" | "Inactive";
  rating?: number;
  created_at: string;
}

export const getEmployees = (): Promise<Employee[]> => safe(api.get<Employee[]>("/employees"), [], "fetching employees");

export const getEmployeeById = (id: string): Promise<Employee | null> => safe(api.get<Employee>(`/employees/${id}`), null, "fetching employee");

/** The server assigns the EMP-### id. */
export const createEmployee = (employeeData: Omit<Employee, "id" | "created_at" | "agent_id" | "employee_id">): Promise<Employee | null> =>
  safe(api.post<Employee>("/employees", employeeData), null, "creating employee");

export const updateEmployee = (id: string, updates: Partial<Employee>): Promise<Employee | null> =>
  safe(api.patch<Employee>(`/employees/${id}`, updates), null, "updating employee");

export const deleteEmployee = (id: string): Promise<boolean> => safe(api.delete(`/employees/${id}`).then(() => true), false, "deleting employee");
