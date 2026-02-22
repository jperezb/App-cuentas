import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
  BankAccount,
  Transaction,
  Investment,
  ExpenseGroup,
  GroupExpense,
  FamilyMember,
  Settlement,
} from "../types";

const STORAGE_KEY = "app-cuentas-data";

const defaultState: AppState = {
  accounts: [],
  transactions: [],
  investments: [],
  groups: [],
};

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return JSON.parse(raw) as AppState;
  } catch {
    return defaultState;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Account helpers ---

export function addAccount(state: AppState, account: BankAccount): AppState {
  return { ...state, accounts: [...state.accounts, account] };
}

export function updateAccount(state: AppState, account: BankAccount): AppState {
  return {
    ...state,
    accounts: state.accounts.map((a) => (a.id === account.id ? account : a)),
  };
}

export function deleteAccount(state: AppState, id: string): AppState {
  return {
    ...state,
    accounts: state.accounts.filter((a) => a.id !== id),
    transactions: state.transactions.filter((t) => t.accountId !== id),
  };
}

// --- Transaction helpers ---

export function addTransaction(state: AppState, tx: Transaction): AppState {
  const next = { ...state, transactions: [...state.transactions, tx] };
  const acc = next.accounts.find((a) => a.id === tx.accountId);
  if (acc) {
    const delta = tx.type === "ingreso" ? tx.amount : -tx.amount;
    next.accounts = next.accounts.map((a) =>
      a.id === acc.id ? { ...a, balance: a.balance + delta } : a
    );
  }
  return next;
}

export function deleteTransaction(state: AppState, id: string): AppState {
  const tx = state.transactions.find((t) => t.id === id);
  let accounts = state.accounts;
  if (tx) {
    const acc = accounts.find((a) => a.id === tx.accountId);
    if (acc) {
      const delta = tx.type === "ingreso" ? -tx.amount : tx.amount;
      accounts = accounts.map((a) =>
        a.id === acc.id ? { ...a, balance: a.balance + delta } : a
      );
    }
  }
  return {
    ...state,
    accounts,
    transactions: state.transactions.filter((t) => t.id !== id),
  };
}

// --- Investment helpers ---

export function addInvestment(state: AppState, inv: Investment): AppState {
  return { ...state, investments: [...state.investments, inv] };
}

export function updateInvestment(state: AppState, inv: Investment): AppState {
  return {
    ...state,
    investments: state.investments.map((i) => (i.id === inv.id ? inv : i)),
  };
}

export function deleteInvestment(state: AppState, id: string): AppState {
  return { ...state, investments: state.investments.filter((i) => i.id !== id) };
}

// --- Group helpers ---

export function addGroup(state: AppState, group: ExpenseGroup): AppState {
  return { ...state, groups: [...state.groups, group] };
}

export function updateGroup(state: AppState, group: ExpenseGroup): AppState {
  return {
    ...state,
    groups: state.groups.map((g) => (g.id === group.id ? group : g)),
  };
}

export function deleteGroup(state: AppState, id: string): AppState {
  return { ...state, groups: state.groups.filter((g) => g.id !== id) };
}

export function addMemberToGroup(state: AppState, groupId: string, member: FamilyMember): AppState {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return state;
  return updateGroup(state, { ...group, members: [...group.members, member] });
}

export function addExpenseToGroup(state: AppState, groupId: string, expense: GroupExpense): AppState {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return state;
  return updateGroup(state, { ...group, expenses: [...group.expenses, expense] });
}

export function deleteExpenseFromGroup(state: AppState, groupId: string, expenseId: string): AppState {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return state;
  return updateGroup(state, {
    ...group,
    expenses: group.expenses.filter((e) => e.id !== expenseId),
  });
}

// --- Settlement calculator ---

export function calculateSettlements(group: ExpenseGroup): Settlement[] {
  const balances: Record<string, number> = {};

  for (const m of group.members) {
    balances[m.id] = 0;
  }

  for (const exp of group.expenses) {
    balances[exp.payerId] = (balances[exp.payerId] || 0) + exp.amount;
    if (exp.splitType === "equal") {
      const share = exp.amount / exp.splitAmong.length;
      for (const memberId of exp.splitAmong) {
        balances[memberId] = (balances[memberId] || 0) - share;
      }
    } else if (exp.splitType === "custom" && exp.customSplit) {
      for (const [memberId, amount] of Object.entries(exp.customSplit)) {
        balances[memberId] = (balances[memberId] || 0) - amount;
      }
    }
  }

  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance < -0.01) debtors.push({ id, amount: -balance });
    else if (balance > 0.01) creditors.push({ id, amount: balance });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0.01) {
      settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(amount), currency: "CLP" });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return settlements;
}

// --- Formatters ---

export function formatCLP(amount: number): string {
  return "$" + Math.round(amount).toLocaleString("es-CL");
}

export function formatCurrency(amount: number, currency: string): string {
  if (currency === "CLP") return formatCLP(amount);
  if (currency === "UF") return `UF ${amount.toFixed(2)}`;
  if (currency === "USD") return `US$${amount.toLocaleString("es-CL")}`;
  return `${currency} ${amount.toLocaleString("es-CL")}`;
}
