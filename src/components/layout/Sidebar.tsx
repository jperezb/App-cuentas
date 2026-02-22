"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  Receipt,
  TrendingUp,
  Users,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
  { href: "/transacciones", label: "Transacciones", icon: Receipt },
  { href: "/inversiones", label: "Inversiones", icon: TrendingUp },
  { href: "/grupos", label: "Gastos Grupales", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 md:hidden bg-sidebar-bg text-white p-2 rounded-lg"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-sidebar-bg text-sidebar-text z-40 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:static md:z-auto flex flex-col`}
      >
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Landmark size={24} className="text-blue-400" />
            MisCuentas
          </h1>
          <p className="text-xs text-slate-400 mt-1">Gestión Financiera Chile</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-active text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
              U
            </div>
            <div>
              <p className="text-sm font-medium text-white">Usuario</p>
              <p className="text-xs text-slate-400">Plan Gratuito</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
