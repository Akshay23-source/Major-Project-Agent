import { supabase } from "../lib/supabase";

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

export const getEmployees = async (): Promise<Employee[]> => {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
  return data || [];
};

export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching employee:", error);
    return null;
  }
  return data;
};

export const createEmployee = async (employeeData: Omit<Employee, "id" | "created_at" | "agent_id" | "employee_id">): Promise<Employee | null> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return null;

  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (!agentData) return null;

  // Generate employee ID like EMP-XXX
  const { count } = await supabase.from("employees").select("*", { count: "exact", head: true });
  const empCount = count || 0;
  const empId = `EMP-${String(empCount + 1).padStart(3, '0')}`;

  const { data, error } = await supabase
    .from("employees")
    .insert({
      ...employeeData,
      employee_id: empId,
      agent_id: agentData.id
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating employee:", error);
    return null;
  }
  return data;
};

export const updateEmployee = async (id: string, updates: Partial<Employee>): Promise<Employee | null> => {
  const { data, error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating employee:", error);
    return null;
  }
  return data;
};

export const deleteEmployee = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting employee:", error);
    return false;
  }
  return true;
};
