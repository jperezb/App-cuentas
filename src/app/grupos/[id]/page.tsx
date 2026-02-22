"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowLeft,
  Plus,
  Trash2,
  UserPlus,
  Receipt,
  ArrowRight,
  Users,
  Calculator,
  CheckCircle2,
} from "lucide-react";
import {
  loadState,
  addMemberToGroup,
  addExpenseToGroup,
  deleteExpenseFromGroup,
  updateGroup,
  calculateSettlements,
  formatCLP,
} from "@/store";
import {
  AppState,
  ExpenseGroup,
  FamilyMember,
  GroupExpense,
  Settlement,
} from "@/types";
import Link from "next/link";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [state, setState] = useState<AppState | null>(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: "", familyName: "", email: "" });
  const [expenseForm, setExpenseForm] = useState({
    payerId: "",
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    splitAmong: [] as string[],
    splitType: "equal" as "equal" | "percentage" | "custom",
    customSplit: {} as Record<string, number>,
  });

  useEffect(() => {
    setState(loadState());
  }, []);

  const group = useMemo(() => {
    if (!state) return null;
    return state.groups.find((g) => g.id === groupId) || null;
  }, [state, groupId]);

  const settlements = useMemo(() => {
    if (!group) return [];
    return calculateSettlements(group);
  }, [group]);

  const memberTotals = useMemo(() => {
    if (!group) return {};
    const totals: Record<string, { paid: number; owes: number }> = {};
    for (const m of group.members) {
      totals[m.id] = { paid: 0, owes: 0 };
    }
    for (const exp of group.expenses) {
      if (totals[exp.payerId]) {
        totals[exp.payerId].paid += exp.amount;
      }
      if (exp.splitType === "equal") {
        const share = exp.amount / exp.splitAmong.length;
        for (const mid of exp.splitAmong) {
          if (totals[mid]) {
            totals[mid].owes += share;
          }
        }
      } else if (exp.splitType === "custom" && exp.customSplit) {
        for (const [mid, amount] of Object.entries(exp.customSplit)) {
          if (totals[mid]) {
            totals[mid].owes += amount;
          }
        }
      }
    }
    return totals;
  }, [group]);

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-500">Grupo no encontrado</p>
        <Link href="/grupos" className="btn btn-primary mt-4">
          Volver a Grupos
        </Link>
      </div>
    );
  }

  const totalExpenses = group.expenses.reduce((s, e) => s + e.amount, 0);

  function getMemberName(id: string) {
    return group!.members.find((m) => m.id === id)?.name || "Desconocido";
  }

  function getMemberFamily(id: string) {
    return group!.members.find((m) => m.id === id)?.familyName || "";
  }

  function handleAddMember() {
    if (!memberForm.name.trim() || !memberForm.familyName.trim()) return;
    const member: FamilyMember = {
      id: uuidv4(),
      name: memberForm.name,
      familyName: memberForm.familyName,
      email: memberForm.email || undefined,
    };
    setState(addMemberToGroup(state!, groupId, member));
    setShowMemberForm(false);
    setMemberForm({ name: "", familyName: "", email: "" });
  }

  function handleRemoveMember(memberId: string) {
    if (!group) return;
    const hasExpenses = group.expenses.some(
      (e) => e.payerId === memberId || e.splitAmong.includes(memberId)
    );
    if (hasExpenses) {
      alert("No se puede eliminar un miembro que tiene gastos asociados.");
      return;
    }
    const updated = {
      ...group,
      members: group.members.filter((m) => m.id !== memberId),
    };
    setState(updateGroup(state!, updated));
  }

  function handleAddExpense() {
    if (
      !expenseForm.description.trim() ||
      !expenseForm.payerId ||
      expenseForm.amount <= 0 ||
      expenseForm.splitAmong.length === 0
    )
      return;

    const expense: GroupExpense = {
      id: uuidv4(),
      groupId,
      payerId: expenseForm.payerId,
      description: expenseForm.description,
      amount: expenseForm.amount,
      currency: "CLP",
      date: expenseForm.date,
      splitAmong: expenseForm.splitAmong,
      splitType: expenseForm.splitType,
      customSplit:
        expenseForm.splitType === "custom"
          ? expenseForm.customSplit
          : undefined,
    };
    setState(addExpenseToGroup(state!, groupId, expense));
    setShowExpenseForm(false);
    setExpenseForm({
      payerId: group!.members[0]?.id || "",
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      splitAmong: [],
      splitType: "equal",
      customSplit: {},
    });
  }

  function handleDeleteExpense(expenseId: string) {
    if (confirm("¿Eliminar este gasto?")) {
      setState(deleteExpenseFromGroup(state!, groupId, expenseId));
    }
  }

  function toggleSplitMember(memberId: string) {
    setExpenseForm((prev) => ({
      ...prev,
      splitAmong: prev.splitAmong.includes(memberId)
        ? prev.splitAmong.filter((id) => id !== memberId)
        : [...prev.splitAmong, memberId],
    }));
  }

  function selectAllMembers() {
    setExpenseForm((prev) => ({
      ...prev,
      splitAmong: group!.members.map((m) => m.id),
    }));
  }

  // Group members by family
  const families = useMemo(() => {
    if (!group) return {};
    const fam: Record<string, FamilyMember[]> = {};
    for (const m of group.members) {
      if (!fam[m.familyName]) fam[m.familyName] = [];
      fam[m.familyName].push(m);
    }
    return fam;
  }, [group]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/grupos"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.description && (
            <p className="text-slate-500 text-sm">{group.description}</p>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 mt-6">
        <div className="card stat-blue">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Gastado</p>
          <p className="text-2xl font-bold mt-1">{formatCLP(totalExpenses)}</p>
        </div>
        <div className="card stat-purple">
          <p className="text-xs font-semibold text-slate-500 uppercase">Familias</p>
          <p className="text-2xl font-bold mt-1">{Object.keys(families).length}</p>
        </div>
        <div className="card stat-amber">
          <p className="text-xs font-semibold text-slate-500 uppercase">Promedio por Persona</p>
          <p className="text-2xl font-bold mt-1">
            {group.members.length > 0
              ? formatCLP(Math.round(totalExpenses / group.members.length))
              : "$0"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Members + Settlements */}
        <div className="space-y-6">
          {/* Members */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Miembros</h3>
              <button
                onClick={() => setShowMemberForm(true)}
                className="btn btn-outline text-xs py-1 px-2"
              >
                <UserPlus size={14} />
                Agregar
              </button>
            </div>

            {group.members.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Agrega miembros para comenzar
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(families).map(([familyName, members]) => (
                  <div key={familyName}>
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                      Familia {familyName}
                    </p>
                    <div className="space-y-2">
                      {members.map((m) => {
                        const totals = memberTotals[m.id];
                        const balance = totals
                          ? totals.paid - totals.owes
                          : 0;
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{m.name}</p>
                                {totals && (
                                  <p className="text-xs text-slate-400">
                                    Pagó: {formatCLP(totals.paid)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-semibold ${
                                  balance >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {balance >= 0 ? "+" : ""}
                                {formatCLP(Math.round(balance))}
                              </span>
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Settlements */}
          {settlements.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Calculator size={18} className="text-amber-500" />
                <h3 className="font-semibold">Liquidación</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Transferencias necesarias para saldar cuentas:
              </p>
              <div className="space-y-3">
                {settlements.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-amber-50 rounded-lg p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-red-600">
                          {getMemberName(s.from)}
                        </span>
                        <ArrowRight size={14} className="text-slate-400" />
                        <span className="text-sm font-medium text-green-600">
                          {getMemberName(s.to)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {getMemberFamily(s.from)} → {getMemberFamily(s.to)}
                      </p>
                    </div>
                    <span className="font-bold text-amber-700">
                      {formatCLP(s.amount)}
                    </span>
                  </div>
                ))}
              </div>
              {settlements.length === 0 && (
                <div className="flex items-center gap-2 text-green-600 justify-center py-4">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-medium">
                    Todas las cuentas están saldadas
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: Expenses */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Gastos del Grupo</h3>
              <button
                onClick={() => {
                  if (group.members.length < 2) {
                    alert("Necesitas al menos 2 miembros para agregar gastos.");
                    return;
                  }
                  setExpenseForm({
                    payerId: group.members[0].id,
                    description: "",
                    amount: 0,
                    date: new Date().toISOString().split("T")[0],
                    splitAmong: group.members.map((m) => m.id),
                    splitType: "equal",
                    customSplit: {},
                  });
                  setShowExpenseForm(true);
                }}
                className="btn btn-primary text-xs py-1.5 px-3"
              >
                <Plus size={14} />
                Agregar Gasto
              </button>
            </div>

            {group.expenses.length === 0 ? (
              <div className="text-center py-8">
                <Receipt size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">
                  No hay gastos registrados en este grupo
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th>Pagó</th>
                      <th>División</th>
                      <th>Monto</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...group.expenses]
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime()
                      )
                      .map((exp) => (
                        <tr key={exp.id}>
                          <td className="whitespace-nowrap text-xs">
                            {new Date(exp.date).toLocaleDateString("es-CL")}
                          </td>
                          <td>
                            <p className="font-medium text-sm">
                              {exp.description}
                            </p>
                          </td>
                          <td>
                            <span className="text-sm">
                              {getMemberName(exp.payerId)}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {exp.splitAmong.map((mid) => (
                                <span
                                  key={mid}
                                  className="badge bg-slate-100 text-slate-500 text-xs"
                                >
                                  {getMemberName(mid).split(" ")[0]}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="font-semibold whitespace-nowrap">
                            {formatCLP(exp.amount)}
                          </td>
                          <td>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add member modal */}
      {showMemberForm && (
        <div
          className="modal-overlay"
          onClick={() => setShowMemberForm(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Agregar Miembro</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  className="input"
                  placeholder="Ej: Juan Pérez"
                  value={memberForm.name}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Familia</label>
                <input
                  className="input"
                  placeholder="Ej: Pérez"
                  value={memberForm.familyName}
                  onChange={(e) =>
                    setMemberForm({
                      ...memberForm,
                      familyName: e.target.value,
                    })
                  }
                />
                {Object.keys(families).length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {Object.keys(families).map((f) => (
                      <button
                        key={f}
                        onClick={() =>
                          setMemberForm({ ...memberForm, familyName: f })
                        }
                        className="badge bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Email (opcional)</label>
                <input
                  className="input"
                  type="email"
                  placeholder="juan@email.com"
                  value={memberForm.email}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, email: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddMember}
                  className="btn btn-primary flex-1"
                >
                  Agregar Miembro
                </button>
                <button
                  onClick={() => setShowMemberForm(false)}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add expense modal */}
      {showExpenseForm && (
        <div
          className="modal-overlay"
          onClick={() => setShowExpenseForm(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Agregar Gasto</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Descripción</label>
                <input
                  className="input"
                  placeholder="Ej: Almuerzo restaurante"
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      description: e.target.value,
                    })
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
                    value={expenseForm.amount || ""}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        amount: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={expenseForm.date}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="label">¿Quién pagó?</label>
                <select
                  className="input"
                  value={expenseForm.payerId}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      payerId: e.target.value,
                    })
                  }
                >
                  {group.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.familyName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tipo de división</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      setExpenseForm({ ...expenseForm, splitType: "equal" })
                    }
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      expenseForm.splitType === "equal"
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    Partes Iguales
                  </button>
                  <button
                    onClick={() =>
                      setExpenseForm({ ...expenseForm, splitType: "custom" })
                    }
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      expenseForm.splitType === "custom"
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    Montos Personalizados
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">¿Entre quiénes se divide?</label>
                  <button
                    onClick={selectAllMembers}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Seleccionar todos
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {group.members.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={expenseForm.splitAmong.includes(m.id)}
                        onChange={() => toggleSplitMember(m.id)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {m.name}{" "}
                        <span className="text-slate-400">
                          ({m.familyName})
                        </span>
                      </span>
                      {expenseForm.splitType === "custom" &&
                        expenseForm.splitAmong.includes(m.id) && (
                          <input
                            type="number"
                            className="input w-28 ml-auto"
                            placeholder="Monto"
                            value={expenseForm.customSplit[m.id] || ""}
                            onChange={(e) =>
                              setExpenseForm({
                                ...expenseForm,
                                customSplit: {
                                  ...expenseForm.customSplit,
                                  [m.id]: Number(e.target.value),
                                },
                              })
                            }
                          />
                        )}
                    </label>
                  ))}
                </div>
                {expenseForm.splitType === "equal" &&
                  expenseForm.splitAmong.length > 0 &&
                  expenseForm.amount > 0 && (
                    <p className="text-xs text-slate-400 mt-2">
                      Cada persona paga:{" "}
                      <strong>
                        {formatCLP(
                          Math.round(
                            expenseForm.amount /
                              expenseForm.splitAmong.length
                          )
                        )}
                      </strong>
                    </p>
                  )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddExpense}
                  className="btn btn-primary flex-1"
                >
                  Agregar Gasto
                </button>
                <button
                  onClick={() => setShowExpenseForm(false)}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
