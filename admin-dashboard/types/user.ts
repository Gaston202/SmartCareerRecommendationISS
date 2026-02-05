export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "user";
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  phone?: string;
}

export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  role: "admin" | "manager" | "user";
}

export interface UpdateUserDto {
  name?: string;
  role?: "admin" | "manager" | "user";
  status?: "active" | "inactive" | "suspended";
  phone?: string;
}
