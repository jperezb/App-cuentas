"use client";

import { useEffect, useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Pencil,
  BarChart3,
  DollarSign,
} from "lucide-react";
import {
  loadState,
  addInvestment,
  updateInvestment,
  deleteInvestment,
  formatCLP,
  formatCurrency,
} from "@/store";
import { AppState, Investment, InvestmentType, Currency } from "@/types";

const investmentTypes: { value: InvestmentType; label: string }[] = [
  { value: "accion_cl", label: "Acción Chile (BCS)" },
  { value: "accion_us", label: "Acción USA (NYSE/NASDAQ)" },
  { value: "fondo_mutuo", label: "Fondo Mutuo" },
  { value: "deposito_plazo", label: "Depósito a Plazo" },
  { value: "cripto", label: "Criptomoneda" },
  { value: "otro", label: "Otro" },
];

const emptyInvestment = {
  name: "",
  symbol: "",
  type: "accion_cl" as InvestmentType,
  units: 0,
  avgBuyPrice: 0,
  currentPrice: 0,
  currency: "CLP" as Currency,
};

export default function InversionesPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyInvestment);

  useEffect(() => {
    setState(loadState());
  }, []);

  const portfolio = useMemo(() => {
    if (!state) return null;
    const totalValue = state.investments.reduce(
      (s, i) => s + i.units * i.currentPrice,
      0
    );
    const totalCost = state.investments.reduce(
      (s, i) => s + i.units * i.avgBuyPrice,
      0
    );
    const totalReturn = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
    const totalGain = totalValue - totalCost;

    // Group by type
    const byType: Record<string, number> = {};
    for (const inv of state.investments) {
      const val = inv.units * inv.currentPrice;
      byType[inv.type] = (byType[inv.type] || 0) + val;
    }

    return { totalValue, totalCost, totalReturn, totalGain, byType };
  }, [state]);

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  function openCreate() {
    setForm(emptyInvestment);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(inv: Investment) {
    setForm({
      name: inv.name,
      symbol: inv.symbol,
      type: inv.type,
      units: inv.units,
      avgBuyPrice: inv.avgBuyPrice,
      currentPrice: inv.currentPrice,
      currency: inv.currency,
    });
    setEditId(inv.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim() || !form.symbol.trim()) return;
    if (editId) {
      const updated: Investment = {
        ...form,
        id: editId,
        lastUpdate: new Date().toISOString(),
      };
      setState(updateInvestment(state!, updated));
    } else {
      const newInv: Investment = {
        ...form,
        id: uuidv4(),
        lastUpdate: new Date().toISOString(),
      };
      setState(addInvestment(state!, newInv));
    }
    setShowForm(false);
    setEditId(null);
  }

  function handleDelete(id: string) {
    if (confirm("¿Eliminar esta inversión?")) {
      setState(deleteInvestment(state!, id));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Inversiones</h1>
          <p className="text-slate-500 text-sm mt-1">
            Seguimiento de acciones, fondos mutuos y más
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={16} />
          Nueva Inversión
        </button>
      </div>

      {/* Portfolio summary */}
      {portfolio && state.investments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card stat-purple">
            <p className="text-xs font-semibold text-slate-500 uppercase">Valor Total</p>
            <p className="text-2xl font-bold mt-1">
              {formatCLP(portfolio.totalValue)}
            </p>
          </div>
          <div className="card stat-blue">
            <p className="text-xs font-semibold text-slate-500 uppercase">Costo Total</p>
            <p className="text-2xl font-bold mt-1">
              {formatCLP(portfolio.totalCost)}
            </p>
          </div>
          <div className={`card ${portfolio.totalGain >= 0 ? "stat-green" : "stat-red"}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase">Ganancia/Pérdida</p>
            <p className={`text-2xl font-bold mt-1 flex items-center gap-1 ${portfolio.totalGain >= 0 ? "text-green-600" : "text-red-600"}`}>
              {portfolio.totalGain >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              {formatCLP(Math.abs(portfolio.totalGain))}
            </p>
          </div>
          <div className={`card ${portfolio.totalReturn >= 0 ? "stat-green" : "stat-red"}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase">Retorno</p>
            <p className={`text-2xl font-bold mt-1 ${portfolio.totalReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
              {portfolio.totalReturn >= 0 ? "+" : ""}{portfolio.totalReturn.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Distribution by type */}
      {portfolio && state.investments.length > 0 && (
        <div className="card mb-8">
          <h3 className="font-semibold mb-4">Distribución por Tipo</h3>
          <div className="space-y-3">
            {Object.entries(portfolio.byType).map(([type, value]) => {
              const pct = portfolio.totalValue > 0 ? (value / portfolio.totalValue) * 100 : 0;
              const label = investmentTypes.find((t) => t.value === type)?.label || type;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{label}</span>
                    <span className="font-medium">
                      {formatCLP(value)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Investments table */}
      {state.investments.length === 0 ? (
        <div className="card text-center py-12">
          <BarChart3 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm mb-1">No tienes inversiones registradas</p>
          <p className="text-slate-400 text-xs">
            Agrega acciones del IPSA, NYSE, fondos mutuos, depósitos a plazo y más
          </p>
        </div>
      ) : (
        <div className="card table-container">
          <table>
            <thead>
              <tr>
                <th>Instrumento</th>
                <th>Tipo</th>
                <th>Unidades</th>
                <th>Precio Compra</th>
                <th>Precio Actual</th>
                <th>Valor Total</th>
                <th>Retorno</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.investments.map((inv) => {
                const total = inv.units * inv.currentPrice;
                const cost = inv.units * inv.avgBuyPrice;
                const ret = cost > 0 ? ((total - cost) / cost) * 100 : 0;
                const gain = total - cost;
                return (
                  <tr key={inv.id}>
                    <td>
                      <div>
                        <p className="font-semibold">{inv.symbol}</p>
                        <p className="text-xs text-slate-400">{inv.name}</p>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-600 text-xs">
                        {investmentTypes.find((t) => t.value === inv.type)?.label}
                      </span>
                    </td>
                    <td>{inv.units.toLocaleString("es-CL")}</td>
                    <td>{formatCurrency(inv.avgBuyPrice, inv.currency)}</td>
                    <td>{formatCurrency(inv.currentPrice, inv.currency)}</td>
                    <td className="font-semibold">{formatCurrency(total, inv.currency)}</td>
                    <td>
                      <div>
                        <span className={`badge ${ret >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
                        </span>
                        <p className={`text-xs mt-0.5 ${gain >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {gain >= 0 ? "+" : ""}{formatCurrency(gain, inv.currency)}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(inv)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">
              {editId ? "Editar Inversión" : "Nueva Inversión"}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre</label>
                  <input
                    className="input"
                    placeholder="Ej: Banco Santander Chile"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Símbolo / Ticker</label>
                  <input
                    className="input"
                    placeholder="Ej: BSAN, AAPL"
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo de Inversión</label>
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as InvestmentType })
                    }
                  >
                    {investmentTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value as Currency })
                    }
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="UF">UF</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Unidades</label>
                  <input
                    type="number"
                    className="input"
                    value={form.units || ""}
                    onChange={(e) => setForm({ ...form, units: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Precio de Compra</label>
                  <input
                    type="number"
                    className="input"
                    value={form.avgBuyPrice || ""}
                    onChange={(e) => setForm({ ...form, avgBuyPrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Precio Actual</label>
                  <input
                    type="number"
                    className="input"
                    value={form.currentPrice || ""}
                    onChange={(e) => setForm({ ...form, currentPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Quick preview */}
              {form.units > 0 && form.currentPrice > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Valor total:</span>
                    <span className="font-semibold">
                      {formatCurrency(form.units * form.currentPrice, form.currency)}
                    </span>
                  </div>
                  {form.avgBuyPrice > 0 && (
                    <>
                      <div className="flex justify-between mt-1">
                        <span className="text-slate-500">Costo total:</span>
                        <span>{formatCurrency(form.units * form.avgBuyPrice, form.currency)}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-slate-500">Ganancia:</span>
                        <span className={form.currentPrice >= form.avgBuyPrice ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                          {formatCurrency(form.units * (form.currentPrice - form.avgBuyPrice), form.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className="btn btn-primary flex-1">
                  {editId ? "Guardar Cambios" : "Agregar Inversión"}
                </button>
                <button onClick={() => setShowForm(false)} className="btn btn-outline">
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
