export type Supplier = {
  id: string;
  name: string;
  kind: "supplier" | "customer" | "both";
  eik: string | null;
  egn: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  active: boolean;
  created_at: string;
};

export type Material = {
  id: string;
  code: string | null;
  name: string;
  waste_code: string | null;
  unit: string;
  default_price: number | null;
  active: boolean;
  created_at: string;
};

export type MaterialBalance = {
  material_id: string;
  material_name: string;
  code: string | null;
  unit: string;
  active: boolean;
  quantity_kg: number;
  total_value: number;
  avg_price: number;
};

export type HistoryRow = {
  id: string;
  entry_date: string;
  type: string;
  type_bg: string;
  material_id: string;
  material_name: string | null;
  quantity_kg: number;
  value: number;
  unit_price: number | null;
  supplier_name: string | null;
  note: string | null;
  operator_name: string | null;
  created_at: string;
};

export type PaymentMethod = "cash" | "bank";
