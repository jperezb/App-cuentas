import { AppState, BankAccount, Transaction, Investment, ExpenseGroup, GroupExpense, FamilyMember, Settlement } from "@/types";

const STORAGE_KEY = "app-cuentas-data";

const defaultState: AppState = {
  accounts: [],
  transactions: [],
  investments: [],
  groups: [],
};

export function loadState(): AppState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return JSON.parse(raw) as AppState;
  } catch {
    return defaultState;
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Account helpers ---

export function addAccount(state: AppState, account: BankAccount): AppState {
  const next = { ...state, accounts: [...state.accounts, account] };
  saveState(next);
  return next;
}

export function updateAccount(state: AppState, account: BankAccount): AppState {
  const next = {
    ...state,
    accounts: state.accounts.map((a) => (a.id === account.id ? account : a)),
  };
  saveState(next);
  return next;
}

export function deleteAccount(state: AppState, id: string): AppState {
  const next = {
    ...state,
    accounts: state.accounts.filter((a) => a.id !== id),
    transactions: state.transactions.filter((t) => t.accountId !== id),
  };
  saveState(next);
  return next;
}

// --- Transaction helpers ---

export function addTransaction(state: AppState, tx: Transaction): AppState {
  const next = { ...state, transactions: [...state.transactions, tx] };
  // Update account balance
  const acc = next.accounts.find((a) => a.id === tx.accountId);
  if (acc) {
    const delta = tx.type === "ingreso" ? tx.amount : -tx.amount;
    acc.balance += delta;
  }
  saveState(next);
  return next;
}

export function deleteTransaction(state: AppState, id: string): AppState {
  const tx = state.transactions.find((t) => t.id === id);
  const next = {
    ...state,
    transactions: state.transactions.filter((t) => t.id !== id),
  };
  if (tx) {
    const acc = next.accounts.find((a) => a.id === tx.accountId);
    if (acc) {
      const delta = tx.type === "ingreso" ? -tx.amount : tx.amount;
      acc.balance += delta;
    }
  }
  saveState(next);
  return next;
}

// --- Investment helpers ---

export function addInvestment(state: AppState, inv: Investment): AppState {
  const next = { ...state, investments: [...state.investments, inv] };
  saveState(next);
  return next;
}

export function updateInvestment(state: AppState, inv: Investment): AppState {
  const next = {
    ...state,
    investments: state.investments.map((i) => (i.id === inv.id ? inv : i)),
  };
  saveState(next);
  return next;
}

export function deleteInvestment(state: AppState, id: string): AppState {
  const next = {
    ...state,
    investments: state.investments.filter((i) => i.id !== id),
  };
  saveState(next);
  return next;
}

// --- Group helpers ---

export function addGroup(state: AppState, group: ExpenseGroup): AppState {
  const next = { ...state, groups: [...state.groups, group] };
  saveState(next);
  return next;
}

export function updateGroup(state: AppState, group: ExpenseGroup): AppState {
  const next = {
    ...state,
    groups: state.groups.map((g) => (g.id === group.id ? group : g)),
  };
  saveState(next);
  return next;
}

export function deleteGroup(state: AppState, id: string): AppState {
  const next = {
    ...state,
    groups: state.groups.filter((g) => g.id !== id),
  };
  saveState(next);
  return next;
}

export function addMemberToGroup(state: AppState, groupId: string, member: FamilyMember): AppState {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return state;
  const updated = { ...group, members: [...group.members, member] };
  return updateGroup(state, updated);
}

export function addExpenseToGroup(state: AppState, groupId: string, expense: GroupExpense): AppState {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return state;
  const updated = { ...group, expenses: [...group.expenses, expense] };
  return updateGroup(state, updated);
}

export function deleteExpenseFromGroup(state: AppState, groupId: string, expenseId: string): AppState {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return state;
  const updated = { ...group, expenses: group.expenses.filter((e) => e.id !== expenseId) };
  return updateGroup(state, updated);
}

// --- Settlement calculator ---

export function calculateSettlements(group: ExpenseGroup): Settlement[] {
  const balances: Record<string, number> = {};

  // Initialize balances
  for (const m of group.members) {
    balances[m.id] = 0;
  }

  // Calculate how much each person paid vs owed
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

  // Simplify debts
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance < -0.01) {
      debtors.push({ id, amount: -balance });
    } else if (balance > 0.01) {
      creditors.push({ id, amount: balance });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0.01) {
      settlements.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: Math.round(amount),
        currency: "CLP",
      });
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
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(amount);
}

export function formatCurrency(amount: number, currency: string): string {
  if (currency === "CLP") return formatCLP(amount);
  if (currency === "UF") return `UF ${amount.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(amount);
}
