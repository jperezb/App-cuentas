"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { loadState, formatCLP } from "@/store";
import { AppState } from "@/types";

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className={`card ${colorClass}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </span>
        <Icon size={18} className="text-slate-400" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          {trend.positive ? (
            <ArrowUpRight size={14} className="text-green-500" />
          ) : (
            <ArrowDownRight size={14} className="text-red-500" />
          )}
          <span
            className={`text-xs font-medium ${
              trend.positive ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  const stats = useMemo(() => {
    if (!state) return null;

    const totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthTx = state.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const ingresos = monthTx
      .filter((t) => t.type === "ingreso")
      .reduce((s, t) => s + t.amount, 0);
    const gastos = monthTx
      .filter((t) => t.type === "gasto")
      .reduce((s, t) => s + t.amount, 0);

    const investmentValue = state.investments.reduce(
      (s, i) => s + i.units * i.currentPrice,
      0
    );
    const investmentCost = state.investments.reduce(
      (s, i) => s + i.units * i.avgBuyPrice,
      0
    );
    const investmentReturn =
      investmentCost > 0
        ? (((investmentValue - investmentCost) / investmentCost) * 100).toFixed(1)
        : "0";

    return { totalBalance, ingresos, gastos, investmentValue, investmentReturn };
  }, [state]);

  const recentTransactions = useMemo(() => {
    if (!state) return [];
    return [...state.transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [state]);

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  const categoryLabels: Record<string, string> = {
    alimentacion: "Alimentación",
    transporte: "Transporte",
    vivienda: "Vivienda",
    salud: "Salud",
    educacion: "Educación",
    entretenimiento: "Entretenimiento",
    ropa: "Ropa",
    servicios: "Servicios",
    transferencia: "Transferencia",
    sueldo: "Sueldo",
    freelance: "Freelance",
    inversiones: "Inversiones",
    otros: "Otros",
  };

  const hasData =
    state.accounts.length > 0 ||
    state.transactions.length > 0 ||
    state.investments.length > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Resumen de tu situación financiera
        </p>
      </div>

      {!hasData ? (
        <div className="card text-center py-16">
          <PiggyBank size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            Bienvenido a MisCuentas
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            Comienza agregando tus cuentas bancarias para ver tu resumen
            financiero. Puedes conectar bancos chilenos a través de Fintoc o
            agregar cuentas manualmente.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="/cuentas" className="btn btn-primary">
              <Wallet size={16} />
              Agregar Cuenta
            </a>
            <a href="/inversiones" className="btn btn-outline">
              <TrendingUp size={16} />
              Agregar Inversión
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Balance Total"
              value={formatCLP(stats?.totalBalance || 0)}
              icon={Wallet}
              colorClass="stat-blue"
            />
            <StatCard
              label="Ingresos del Mes"
              value={formatCLP(stats?.ingresos || 0)}
              icon={TrendingUp}
              colorClass="stat-green"
              trend={
                stats && stats.ingresos > 0
                  ? { value: "este mes", positive: true }
                  : undefined
              }
            />
            <StatCard
              label="Gastos del Mes"
              value={formatCLP(stats?.gastos || 0)}
              icon={TrendingDown}
              colorClass="stat-red"
            />
            <StatCard
              label="Inversiones"
              value={formatCLP(stats?.investmentValue || 0)}
              icon={PiggyBank}
              colorClass="stat-purple"
              trend={
                stats
                  ? {
                      value: `${stats.investmentReturn}%`,
                      positive: Number(stats.investmentReturn) >= 0,
                    }
                  : undefined
              }
            />
          </div>

          {/* Accounts summary + Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="card">
              <h3 className="font-semibold mb-4">Mis Cuentas</h3>
              {state.accounts.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No hay cuentas registradas
                </p>
              ) : (
                <div className="space-y-3">
                  {state.accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ background: acc.color }}
                        />
                        <div>
                          <p className="text-sm font-medium">{acc.name}</p>
                          <p className="text-xs text-slate-400">
                            {acc.bank} - {acc.type}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatCLP(acc.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold mb-4">Últimas Transacciones</h3>
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No hay transacciones registradas
                </p>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-slate-400">
                          {categoryLabels[tx.category] || tx.category} ·{" "}
                          {new Date(tx.date).toLocaleDateString("es-CL")}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          tx.type === "ingreso"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {tx.type === "ingreso" ? "+" : "-"}
                        {formatCLP(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Investments summary */}
          {state.investments.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4">Portafolio de Inversiones</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Instrumento</th>
                      <th>Unidades</th>
                      <th>Precio Actual</th>
                      <th>Valor Total</th>
                      <th>Retorno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.investments.map((inv) => {
                      const total = inv.units * inv.currentPrice;
                      const cost = inv.units * inv.avgBuyPrice;
                      const ret =
                        cost > 0
                          ? (((total - cost) / cost) * 100).toFixed(1)
                          : "0";
                      return (
                        <tr key={inv.id}>
                          <td>
                            <div>
                              <p className="font-medium">{inv.symbol}</p>
                              <p className="text-xs text-slate-400">
                                {inv.name}
                              </p>
                            </div>
                          </td>
                          <td>{inv.units}</td>
                          <td>{formatCLP(inv.currentPrice)}</td>
                          <td className="font-semibold">{formatCLP(total)}</td>
                          <td>
                            <span
                              className={`badge ${
                                Number(ret) >= 0
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {Number(ret) >= 0 ? "+" : ""}
                              {ret}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
