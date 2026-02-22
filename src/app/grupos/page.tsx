"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Plus, Users, ChevronRight } from "lucide-react";
import { loadState, addGroup, deleteGroup, formatCLP } from "@/store";
import { AppState, ExpenseGroup } from "@/types";
import Link from "next/link";

export default function GruposPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

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

  function handleCreate() {
    if (!form.name.trim()) return;
    const group: ExpenseGroup = {
      id: uuidv4(),
      name: form.name,
      description: form.description,
      members: [],
      expenses: [],
      createdAt: new Date().toISOString(),
    };
    setState(addGroup(state!, group));
    setShowForm(false);
    setForm({ name: "", description: "" });
  }

  function handleDelete(id: string) {
    if (confirm("¿Eliminar este grupo y todos sus gastos?")) {
      setState(deleteGroup(state!, id));
    }
  }

  function getGroupTotal(group: ExpenseGroup) {
    return group.expenses.reduce((s, e) => s + e.amount, 0);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Gastos Grupales</h1>
          <p className="text-slate-500 text-sm mt-1">
            Divide gastos entre familias y amigos
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={16} />
          Nuevo Grupo
        </button>
      </div>

      {state.groups.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            Sin grupos de gastos
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            Crea un grupo para un paseo, viaje, evento o cualquier actividad
            donde varias familias comparten gastos. El sistema calcula
            automáticamente quién le debe a quién.
          </p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus size={16} />
            Crear Primer Grupo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.groups.map((group) => (
            <Link
              key={group.id}
              href={`/grupos/${group.id}`}
              className="card hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{group.name}</h3>
                  {group.description && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {group.description}
                    </p>
                  )}
                </div>
                <ChevronRight
                  size={18}
                  className="text-slate-300 group-hover:text-slate-500 transition-colors mt-1"
                />
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>
                    {group.members.length}{" "}
                    {group.members.length === 1 ? "miembro" : "miembros"}
                  </span>
                </div>
                <span>·</span>
                <span>{group.expenses.length} gastos</span>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Total gastado</span>
                  <span className="font-bold text-lg">
                    {formatCLP(getGroupTotal(group))}
                  </span>
                </div>
              </div>

              {/* Member avatars */}
              {group.members.length > 0 && (
                <div className="flex -space-x-2 mt-3">
                  {group.members.slice(0, 5).map((m, i) => (
                    <div
                      key={m.id}
                      className="w-7 h-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-bold text-blue-600"
                      title={m.name}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {group.members.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-500">
                      +{group.members.length - 5}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-300 mt-3">
                Creado: {new Date(group.createdAt).toLocaleDateString("es-CL")}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* New group modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Nuevo Grupo de Gastos</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre del Grupo</label>
                <input
                  className="input"
                  placeholder="Ej: Paseo a la playa 2026"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Descripción (opcional)</label>
                <input
                  className="input"
                  placeholder="Ej: Vacaciones de verano, 3 familias"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleCreate} className="btn btn-primary flex-1">
                  Crear Grupo
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
    </div>
  );
}
