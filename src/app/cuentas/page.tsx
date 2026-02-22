"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Trash2,
  RefreshCw,
  Landmark,
  Link2,
  CreditCard,
  Eye,
  Pencil,
} from "lucide-react";
import {
  loadState,
  saveState,
  addAccount,
  updateAccount,
  deleteAccount,
  formatCLP,
} from "@/store";
import {
  AppState,
  BankAccount,
  BankName,
  AccountType,
  Currency,
} from "@/types";

const bankOptions: { value: BankName; label: string; color: string }[] = [
  { value: "BancoEstado", label: "BancoEstado", color: "#00529B" },
  { value: "BancoChile", label: "Banco de Chile", color: "#D52B1E" },
  { value: "Santander", label: "Santander", color: "#EC0000" },
  { value: "BCI", label: "BCI", color: "#F37920" },
  { value: "Itaú", label: "Itaú", color: "#FF6600" },
  { value: "Scotiabank", label: "Scotiabank", color: "#EC1C24" },
  { value: "BancoFalabella", label: "Banco Falabella", color: "#8BC53F" },
  { value: "BancoRipley", label: "Banco Ripley", color: "#6D2077" },
  { value: "BICE", label: "BICE", color: "#003DA5" },
  { value: "Security", label: "Security", color: "#00447C" },
  { value: "Otro", label: "Otro", color: "#6B7280" },
];

const accountTypes: { value: AccountType; label: string }[] = [
  { value: "corriente", label: "Cuenta Corriente" },
  { value: "vista", label: "Cuenta Vista / RUT" },
  { value: "ahorro", label: "Cuenta de Ahorro" },
  { value: "credito", label: "Tarjeta de Crédito" },
  { value: "inversion", label: "Cuenta de Inversión" },
];

const emptyAccount: Omit<BankAccount, "id"> = {
  name: "",
  bank: "BancoEstado",
  type: "corriente",
  currency: "CLP",
  balance: 0,
  lastSync: null,
  fintocLinkId: null,
  color: "#00529B",
};

export default function CuentasPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAccount);
  const [showFintocInfo, setShowFintocInfo] = useState(false);

  useEffect(() => {
    setState(loadState());
  }, []);

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  const totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);

  function openCreate() {
    setForm(emptyAccount);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(acc: BankAccount) {
    setForm({
      name: acc.name,
      bank: acc.bank,
      type: acc.type,
      currency: acc.currency,
      balance: acc.balance,
      lastSync: acc.lastSync,
      fintocLinkId: acc.fintocLinkId,
      color: acc.color,
    });
    setEditId(acc.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editId) {
      const updated: BankAccount = { ...form, id: editId };
      setState(updateAccount(state!, updated));
    } else {
      const bank = bankOptions.find((b) => b.value === form.bank);
      const newAcc: BankAccount = {
        ...form,
        id: uuidv4(),
        color: bank?.color || "#6B7280",
      };
      setState(addAccount(state!, newAcc));
    }
    setShowForm(false);
    setEditId(null);
  }

  function handleDelete(id: string) {
    if (confirm("¿Eliminar esta cuenta y todas sus transacciones?")) {
      setState(deleteAccount(state!, id));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Cuentas Bancarias</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestiona tus cuentas y conecta bancos chilenos
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFintocInfo(true)} className="btn btn-outline">
            <Link2 size={16} />
            Conectar Banco
          </button>
          <button onClick={openCreate} className="btn btn-primary">
            <Plus size={16} />
            Nueva Cuenta
          </button>
        </div>
      </div>

      {/* Balance total */}
      <div className="card stat-blue mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Balance Total de Cuentas
            </p>
            <p className="text-3xl font-bold mt-1">{formatCLP(totalBalance)}</p>
          </div>
          <Landmark size={32} className="text-blue-400" />
        </div>
      </div>

      {/* Account list */}
      {state.accounts.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">
            No tienes cuentas registradas. Agrega una cuenta manual o conecta tu
            banco.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.accounts.map((acc) => (
            <div key={acc.id} className="card relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: acc.color }}
                  >
                    {acc.bank.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{acc.name}</p>
                    <p className="text-xs text-slate-400">
                      {bankOptions.find((b) => b.value === acc.bank)?.label || acc.bank}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(acc)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">
                    {accountTypes.find((t) => t.value === acc.type)?.label}
                  </p>
                  <p className="text-xl font-bold mt-0.5">
                    {formatCLP(acc.balance)}
                  </p>
                </div>
                {acc.fintocLinkId && (
                  <span className="badge bg-green-100 text-green-700">
                    <RefreshCw size={10} className="mr-1" />
                    Conectada
                  </span>
                )}
              </div>
              {acc.lastSync && (
                <p className="text-xs text-slate-400 mt-2">
                  Última sync:{" "}
                  {new Date(acc.lastSync).toLocaleDateString("es-CL")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">
              {editId ? "Editar Cuenta" : "Nueva Cuenta"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre de la cuenta</label>
                <input
                  className="input"
                  placeholder="Ej: Cuenta Corriente Personal"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Banco</label>
                  <select
                    className="input"
                    value={form.bank}
                    onChange={(e) =>
                      setForm({ ...form, bank: e.target.value as BankName })
                    }
                  >
                    {bankOptions.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Tipo de Cuenta</label>
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value as AccountType,
                      })
                    }
                  >
                    {accountTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={form.currency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        currency: e.target.value as Currency,
                      })
                    }
                  >
                    <option value="CLP">CLP (Peso Chileno)</option>
                    <option value="USD">USD (Dólar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="UF">UF</option>
                  </select>
                </div>
                <div>
                  <label className="label">Balance Actual</label>
                  <input
                    type="number"
                    className="input"
                    value={form.balance}
                    onChange={(e) =>
                      setForm({ ...form, balance: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className="btn btn-primary flex-1">
                  {editId ? "Guardar Cambios" : "Crear Cuenta"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fintoc info modal */}
      {showFintocInfo && (
        <div
          className="modal-overlay"
          onClick={() => setShowFintocInfo(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">
              <Link2 size={20} className="inline mr-2 text-blue-500" />
              Conectar Banco con Fintoc
            </h2>
            <div className="space-y-4 text-sm text-slate-600">
              <p>
                <strong>Fintoc</strong> es la plataforma de Open Banking líder
                en Chile que permite conectar de forma segura tus cuentas
                bancarias.
              </p>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="font-semibold text-blue-800 mb-2">
                  Bancos compatibles:
                </p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Banco de Chile</li>
                  <li>BancoEstado</li>
                  <li>Santander</li>
                  <li>BCI</li>
                  <li>Itaú</li>
                  <li>Scotiabank</li>
                  <li>Banco Falabella</li>
                  <li>BICE</li>
                  <li>Security</li>
                </ul>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="font-semibold text-amber-800 mb-2">
                  Para activar la integración:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-amber-700">
                  <li>
                    Crea una cuenta en{" "}
                    <span className="font-mono">fintoc.com</span>
                  </li>
                  <li>Obtén tu API Key (secret key y public key)</li>
                  <li>
                    Configura las variables de entorno:
                    <code className="block mt-1 bg-amber-100 p-2 rounded text-xs">
                      NEXT_PUBLIC_FINTOC_PUBLIC_KEY=tu_public_key
                      <br />
                      FINTOC_SECRET_KEY=tu_secret_key
                    </code>
                  </li>
                  <li>Reinicia la aplicación</li>
                </ol>
              </div>
              <p className="text-xs text-slate-400">
                Los datos se transmiten de forma encriptada y Fintoc cumple con
                las regulaciones de la CMF (Comisión para el Mercado
                Financiero).
              </p>
            </div>
            <button
              onClick={() => setShowFintocInfo(false)}
              className="btn btn-primary w-full mt-4"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
