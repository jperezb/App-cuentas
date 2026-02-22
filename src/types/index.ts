export type Currency = "CLP" | "USD" | "EUR" | "UF";

export type BankName =
  | "BancoEstado"
  | "BancoChile"
  | "Santander"
  | "BCI"
  | "Itaú"
  | "Scotiabank"
  | "BancoFalabella"
  | "BancoRipley"
  | "BICE"
  | "Security"
  | "Otro";

export type AccountType = "corriente" | "vista" | "ahorro" | "credito" | "inversion";

export interface BankAccount {
  id: string;
  name: string;
  bank: BankName;
  type: AccountType;
  currency: Currency;
  balance: number;
  lastSync: string | null;
  fintocLinkId: string | null;
  color: string;
}

export type TransactionCategory =
  | "alimentacion"
  | "transporte"
  | "vivienda"
  | "salud"
  | "educacion"
  | "entretenimiento"
  | "ropa"
  | "servicios"
  | "transferencia"
  | "sueldo"
  | "freelance"
  | "inversiones"
  | "otros";

export type TransactionType = "ingreso" | "gasto" | "transferencia";

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: Currency;
  description: string;
  date: string;
  groupExpenseId?: string;
}

export type InvestmentType = "accion_cl" | "accion_us" | "fondo_mutuo" | "deposito_plazo" | "cripto" | "otro";

export interface Investment {
  id: string;
  name: string;
  symbol: string;
  type: InvestmentType;
  units: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: Currency;
  lastUpdate: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  familyName: string;
  email?: string;
}

export interface GroupExpense {
  id: string;
  groupId: string;
  payerId: string;
  description: string;
  amount: number;
  currency: Currency;
  date: string;
  splitAmong: string[]; // member IDs
  splitType: "equal" | "percentage" | "custom";
  customSplit?: Record<string, number>;
}

export interface ExpenseGroup {
  id: string;
  name: string;
  description: string;
  members: FamilyMember[];
  expenses: GroupExpense[];
  createdAt: string;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
  currency: Currency;
}

export interface AppState {
  accounts: BankAccount[];
  transactions: Transaction[];
  investments: Investment[];
  groups: ExpenseGroup[];
}
