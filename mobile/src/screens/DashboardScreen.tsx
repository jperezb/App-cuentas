import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { loadState, formatCLP } from "../store";
import { AppState } from "../types";
import { Colors, categoryLabels } from "../theme";

export default function DashboardScreen() {
  const [state, setState] = useState<AppState | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await loadState();
    setState(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!state) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Cargando...</Text>
      </View>
    );
  }

  const totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
  const now = new Date();
  const monthTx = state.transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const ingresos = monthTx.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const gastos = monthTx.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);
  const investmentValue = state.investments.reduce((s, i) => s + i.units * i.currentPrice, 0);

  const recentTx = [...state.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  const hasData = state.accounts.length > 0 || state.transactions.length > 0 || state.investments.length > 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {!hasData ? (
        <View style={styles.emptyCard}>
          <Ionicons name="wallet-outline" size={48} color={Colors.slate300} />
          <Text style={styles.emptyTitle}>Bienvenido a MisCuentas</Text>
          <Text style={styles.emptyText}>
            Comienza agregando cuentas, transacciones o inversiones desde las pestañas inferiores.
          </Text>
        </View>
      ) : (
        <>
          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { borderLeftColor: Colors.accent }]}>
              <Text style={styles.statLabel}>Balance Total</Text>
              <Text style={styles.statValue}>{formatCLP(totalBalance)}</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: Colors.success }]}>
              <Text style={styles.statLabel}>Ingresos Mes</Text>
              <Text style={[styles.statValue, { color: Colors.success }]}>{formatCLP(ingresos)}</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: Colors.danger }]}>
              <Text style={styles.statLabel}>Gastos Mes</Text>
              <Text style={[styles.statValue, { color: Colors.danger }]}>{formatCLP(gastos)}</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: Colors.purple }]}>
              <Text style={styles.statLabel}>Inversiones</Text>
              <Text style={styles.statValue}>{formatCLP(investmentValue)}</Text>
            </View>
          </View>

          {/* Accounts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mis Cuentas</Text>
            {state.accounts.map((acc) => (
              <View key={acc.id} style={styles.listItem}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: acc.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{acc.name}</Text>
                    <Text style={styles.itemSub}>{acc.bank}</Text>
                  </View>
                  <Text style={styles.itemAmount}>{formatCLP(acc.balance)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Recent transactions */}
          {recentTx.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Últimas Transacciones</Text>
              {recentTx.map((tx) => (
                <View key={tx.id} style={styles.listItem}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{tx.description}</Text>
                      <Text style={styles.itemSub}>
                        {categoryLabels[tx.category] || tx.category} · {new Date(tx.date).toLocaleDateString("es-CL")}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.itemAmount,
                        { color: tx.type === "ingreso" ? Colors.success : Colors.danger },
                      ]}
                    >
                      {tx.type === "ingreso" ? "+" : "-"}{formatCLP(tx.amount)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { color: Colors.slate400 },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginTop: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 16, color: Colors.foreground },
  emptyText: { fontSize: 14, color: Colors.slate500, textAlign: "center", marginTop: 8, lineHeight: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  statCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    width: "48.5%",
    flexGrow: 1,
  },
  statLabel: { fontSize: 11, fontWeight: "600", color: Colors.slate500, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 20, fontWeight: "700", color: Colors.foreground, marginTop: 4 },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.foreground, marginBottom: 12 },
  listItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemName: { fontSize: 14, fontWeight: "500", color: Colors.foreground },
  itemSub: { fontSize: 12, color: Colors.slate400, marginTop: 1 },
  itemAmount: { fontSize: 14, fontWeight: "600", color: Colors.foreground },
});
