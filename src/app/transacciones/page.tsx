"use client";

import { useEffect, useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Trash2,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
} from "lucide-react";
import {
  loadState,
  addTransaction,
  deleteTransaction,
  formatCLP,
} from "@/store";
import {
  AppState,
  Transaction,
  TransactionType,
  TransactionCategory,
} from "@/types";

const categoryOptions: { value: TransactionCategory; label: string; emoji: string }[] = [
  { value: "alimentacion", label: "Alimentación", emoji: "🍔" },
  { value: "transporte", label: "Transporte", emoji: "🚗" },
  { value: "vivienda", label: "Vivienda", emoji: "🏠" },
  { value: "salud", label: "Salud", emoji: "🏥" },
  { value: "educacion", label: "Educación", emoji: "📚" },
  { value: "entretenimiento", label: "Entretenimiento", emoji: "🎬" },
  { value: "ropa", label: "Ropa", emoji: "👕" },
  { value: "servicios", label: "Servicios", emoji: "💡" },
  { value: "transferencia", label: "Transferencia", emoji: "🔄" },
  { value: "sueldo", label: "Sueldo", emoji: "💰" },
  { value: "freelance", label: "Freelance", emoji: "💻" },
  { value: "inversiones", label: "Inversiones", emoji: "📈" },
  { value: "otros", label: "Otros", emoji: "📋" },
];

const typeOptions: { value: TransactionType; label: string }[] = [
  { value: "gasto", label: "Gasto" },
  { value: "ingreso", label: "Ingreso" },
  { value: "transferencia", label: "Transferencia" },
];

export default function TransaccionesPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("");

  const [form, setForm] = useState({
    accountId: "",
    type: "gasto" as TransactionType,
    category: "otros" as TransactionCategory,
    amount: 0,
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    const s = loadState();
    setState(s);
    if (s.accounts.length > 0) {
      setForm((f) => ({ ...f, accountId: s.accounts[0].id }));
    }
  }, []);

  const filtered = useMemo(() => {
    if (!state) return [];
    let txs = [...state.transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      txs = txs.filter((t) => t.description.toLowerCase().includes(term));
    }
    if (filterCategory !== "all") {
      txs = txs.filter((t) => t.category === filterCategory);
    }
    if (filterType !== "all") {
      txs = txs.filter((t) => t.type === filterType);
    }
    if (filterMonth) {
      txs = txs.filter((t) => t.date.startsWith(filterMonth));
    }
    return txs;
  }, [state, searchTerm, filterCategory, filterType, filterMonth]);

  const summary = useMemo(() => {
    const ingresos = filtered
      .filter((t) => t.type === "ingreso")
      .reduce((s, t) => s + t.amount, 0);
    const gastos = filtered
      .filter((t) => t.type === "gasto")
      .reduce((s, t) => s + t.amount, 0);
    return { ingresos, gastos, balance: ingresos - gastos };
  }, [filtered]);

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  function handleSave() {
    if (!form.description.trim() || !form.accountId || form.amount <= 0) return;
    const tx: Transaction = {
      ...form,
      id: uuidv4(),
      currency: "CLP",
    };
    setState(addTransaction(state!, tx));
    setShowForm(false);
    setForm({
      accountId: state!.accounts[0]?.id || "",
      type: "gasto",
      category: "otros",
      amount: 0,
      description: "",
      date: new Date().toISOString().split("T")[0],
    });
  }

  function handleDelete(id: string) {
    if (confirm("¿Eliminar esta transacción?")) {
      setState(deleteTransaction(state!, id));
    }
  }

  function getAccountName(id: string) {
    return state!.accounts.find((a) => a.id === id)?.name || "—";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Transacciones</h1>
          <p className="text-slate-500 text-sm mt-1">
            Registro de ingresos y gastos
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={16} />
          Nueva Transacción
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card stat-green">
          <p className="text-xs font-semibold text-slate-500 uppercase">Ingresos</p>
          <p className="text-xl font-bold text-green-600 flex items-center gap-1">
            <ArrowUpRight size={18} />
            {formatCLP(summary.ingresos)}
          </p>
        </div>
        <div className="card stat-red">
          <p className="text-xs font-semibold text-slate-500 uppercase">Gastos</p>
          <p className="text-xl font-bold text-red-600 flex items-center gap-1">
            <ArrowDownRight size={18} />
            {formatCLP(summary.gastos)}
          </p>
        </div>
        <div className="card stat-blue">
          <p className="text-xs font-semibold text-slate-500 uppercase">Balance</p>
          <p className={`text-xl font-bold ${summary.balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {formatCLP(summary.balance)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Buscar transacción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Todos los tipos</option>
            {typeOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            className="input"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="month"
            className="input"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </div>
      </div>

      {/* Transactions table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Receipt size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No hay transacciones</p>
        </div>
      ) : (
        <div className="card table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Cuenta</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => {
                const cat = categoryOptions.find((c) => c.value === tx.category);
                return (
                  <tr key={tx.id}>
                    <td className="whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString("es-CL")}
                    </td>
                    <td>
                      <p className="font-medium">{tx.description}</p>
                    </td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-600">
                        {cat?.emoji} {cat?.label || tx.category}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">
                      {getAccountName(tx.accountId)}
                    </td>
                    <td>
                      <span
                        className={`font-semibold ${
                          tx.type === "ingreso"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {tx.type === "ingreso" ? "+" : "-"}
                        {formatCLP(tx.amount)}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New transaction modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Nueva Transacción</h2>
            {state.accounts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-slate-500 text-sm mb-3">
                  Necesitas al menos una cuenta para registrar transacciones.
                </p>
                <a href="/cuentas" className="btn btn-primary">
                  Crear Cuenta
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label">Tipo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {typeOptions.map((t) => (
                      <button
                        key={t.value}
                        onClick={() =>
                          setForm({ ...form, type: t.value })
                        }
                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                          form.type === t.value
                            ? t.value === "ingreso"
                              ? "bg-green-100 border-green-300 text-green-700"
                              : t.value === "gasto"
                              ? "bg-red-100 border-red-300 text-red-700"
                              : "bg-blue-100 border-blue-300 text-blue-700"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Descripción</label>
                  <input
                    className="input"
                    placeholder="Ej: Compra en supermercado"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Monto (CLP)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="0"
                      value={form.amount || ""}
                      onChange={(e) =>
                        setForm({ ...form, amount: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Fecha</label>
                    <input
                      type="date"
                      className="input"
                      value={form.date}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Categoría</label>
                    <select
                      className="input"
                      value={form.category}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category: e.target.value as TransactionCategory,
                        })
                      }
                    >
                      {categoryOptions.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.emoji} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Cuenta</label>
                    <select
                      className="input"
                      value={form.accountId}
                      onChange={(e) =>
                        setForm({ ...form, accountId: e.target.value })
                      }
                    >
                      {state.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    className="btn btn-primary flex-1"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="btn btn-outline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
