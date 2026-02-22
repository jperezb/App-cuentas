import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { v4 as uuidv4 } from "uuid";
import {
  loadState,
  saveState,
  addTransaction,
  deleteTransaction,
  formatCLP,
} from "../store";
import { AppState, Transaction, TransactionType, TransactionCategory } from "../types";
import { Colors, categoryLabels, categoryEmojis } from "../theme";

const categories: TransactionCategory[] = [
  "alimentacion", "transporte", "vivienda", "salud", "educacion",
  "entretenimiento", "ropa", "servicios", "sueldo", "freelance", "inversiones", "otros",
];

export default function TransactionsScreen() {
  const [state, setState] = useState<AppState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({
    type: "gasto" as TransactionType,
    category: "otros" as TransactionCategory,
    amount: "",
    description: "",
    accountId: "",
  });

  const load = useCallback(async () => { setState(await loadState()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!state) return <View style={styles.center}><Text>Cargando...</Text></View>;

  const sorted = [...state.transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const ingresos = sorted.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const gastos = sorted.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);

  async function handleSave() {
    const accountId = form.accountId || state!.accounts[0]?.id;
    if (!form.description.trim() || !accountId || !Number(form.amount)) return;
    const tx: Transaction = {
      id: uuidv4(),
      accountId,
      type: form.type,
      category: form.category,
      amount: Number(form.amount),
      currency: "CLP",
      description: form.description,
      date: new Date().toISOString().split("T")[0],
    };
    const next = addTransaction(state!, tx);
    await saveState(next);
    setState(next);
    setShowModal(false);
    setForm({ type: "gasto", category: "otros", amount: "", description: "", accountId: "" });
  }

  async function handleDelete(id: string) {
    Alert.alert("Eliminar", "¿Eliminar esta transacción?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          const next = deleteTransaction(state!, id);
          await saveState(next);
          setState(next);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.success }]}>
            <Text style={styles.summaryLabel}>Ingresos</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>{formatCLP(ingresos)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.danger }]}>
            <Text style={styles.summaryLabel}>Gastos</Text>
            <Text style={[styles.summaryValue, { color: Colors.danger }]}>{formatCLP(gastos)}</Text>
          </View>
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color={Colors.slate300} />
            <Text style={styles.emptyText}>No hay transacciones</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {sorted.map((tx, i) => (
              <TouchableOpacity
                key={tx.id}
                style={[styles.txItem, i < sorted.length - 1 && styles.txBorder]}
                onLongPress={() => handleDelete(tx.id)}
              >
                <View style={styles.txLeft}>
                  <Text style={styles.txEmoji}>{categoryEmojis[tx.category] || "📋"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txDesc}>{tx.description}</Text>
                    <Text style={styles.txMeta}>
                      {categoryLabels[tx.category]} · {new Date(tx.date).toLocaleDateString("es-CL")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === "ingreso" ? Colors.success : Colors.danger }]}>
                  {tx.type === "ingreso" ? "+" : "-"}{formatCLP(tx.amount)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => {
        if (state.accounts.length === 0) {
          Alert.alert("Sin cuentas", "Crea una cuenta primero en la pestaña Cuentas.");
          return;
        }
        setForm({ ...form, accountId: state.accounts[0].id });
        setShowModal(true);
      }}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nueva Transacción</Text>

            {/* Type selector */}
            <View style={styles.typeRow}>
              {(["gasto", "ingreso"] as TransactionType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    form.type === t && {
                      backgroundColor: t === "ingreso" ? Colors.success + "20" : Colors.danger + "20",
                      borderColor: t === "ingreso" ? Colors.success : Colors.danger,
                    },
                  ]}
                  onPress={() => setForm({ ...form, type: t })}
                >
                  <Text style={[
                    styles.typeText,
                    form.type === t && { color: t === "ingreso" ? Colors.success : Colors.danger },
                  ]}>
                    {t === "ingreso" ? "Ingreso" : "Gasto"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Supermercado"
              value={form.description}
              onChangeText={(t) => setForm({ ...form, description: t })}
            />

            <Text style={styles.label}>Monto (CLP)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
              value={form.amount}
              onChangeText={(t) => setForm({ ...form, amount: t })}
            />

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.catGrid}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catBtn, form.category === c && styles.catBtnActive]}
                  onPress={() => setForm({ ...form, category: c })}
                >
                  <Text style={styles.catEmoji}>{categoryEmojis[c]}</Text>
                  <Text style={[styles.catText, form.category === c && styles.catTextActive]}>
                    {categoryLabels[c]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {state.accounts.length > 1 && (
              <>
                <Text style={styles.label}>Cuenta</Text>
                <View style={styles.catGrid}>
                  {state.accounts.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.catBtn, form.accountId === a.id && styles.catBtnActive]}
                      onPress={() => setForm({ ...form, accountId: a.id })}
                    >
                      <Text style={[styles.catText, form.accountId === a.id && styles.catTextActive]}>{a.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
                <Text style={styles.btnPrimaryText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setShowModal(false)}>
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderLeftWidth: 4,
  },
  summaryLabel: { fontSize: 11, fontWeight: "600", color: Colors.slate500, textTransform: "uppercase" },
  summaryValue: { fontSize: 18, fontWeight: "700", marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 12 },
  emptyCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 32, alignItems: "center" },
  emptyText: { fontSize: 14, color: Colors.slate400, marginTop: 8 },
  txItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
  txLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  txEmoji: { fontSize: 20 },
  txDesc: { fontSize: 14, fontWeight: "500", color: Colors.foreground },
  txMeta: { fontSize: 11, color: Colors.slate400, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: "700" },
  fab: {
    position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.slate500, marginTop: 12, marginBottom: 4, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 12, fontSize: 14 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: "center" },
  typeText: { fontWeight: "600", fontSize: 14, color: Colors.slate500 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder, flexDirection: "row", alignItems: "center", gap: 4 },
  catBtnActive: { backgroundColor: Colors.accent + "15", borderColor: Colors.accent },
  catEmoji: { fontSize: 14 },
  catText: { fontSize: 12, color: Colors.slate500 },
  catTextActive: { color: Colors.accent, fontWeight: "600" },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 20 },
  btnPrimary: { flex: 1, backgroundColor: Colors.accent, borderRadius: 10, padding: 14, alignItems: "center" },
  btnPrimaryText: { color: Colors.white, fontWeight: "600", fontSize: 15 },
  btnOutline: { flex: 0.6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 14, alignItems: "center" },
  btnOutlineText: { color: Colors.foreground, fontWeight: "500", fontSize: 15 },
});
