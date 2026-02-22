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
  addInvestment,
  deleteInvestment,
  formatCLP,
  formatCurrency,
} from "../store";
import { AppState, Investment, InvestmentType, Currency } from "../types";
import { Colors } from "../theme";

const investmentTypes: { value: InvestmentType; label: string }[] = [
  { value: "accion_cl", label: "Acción Chile" },
  { value: "accion_us", label: "Acción USA" },
  { value: "fondo_mutuo", label: "Fondo Mutuo" },
  { value: "deposito_plazo", label: "Depósito a Plazo" },
  { value: "cripto", label: "Cripto" },
  { value: "otro", label: "Otro" },
];

export default function InvestmentsScreen() {
  const [state, setState] = useState<AppState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    type: "accion_cl" as InvestmentType,
    units: "",
    avgBuyPrice: "",
    currentPrice: "",
    currency: "CLP" as Currency,
  });

  const load = useCallback(async () => { setState(await loadState()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!state) return <View style={styles.center}><Text>Cargando...</Text></View>;

  const totalValue = state.investments.reduce((s, i) => s + i.units * i.currentPrice, 0);
  const totalCost = state.investments.reduce((s, i) => s + i.units * i.avgBuyPrice, 0);
  const totalGain = totalValue - totalCost;
  const totalReturn = totalCost > 0 ? ((totalGain / totalCost) * 100) : 0;

  async function handleSave() {
    if (!form.name.trim() || !form.symbol.trim()) return;
    const inv: Investment = {
      id: uuidv4(),
      name: form.name,
      symbol: form.symbol.toUpperCase(),
      type: form.type,
      units: Number(form.units) || 0,
      avgBuyPrice: Number(form.avgBuyPrice) || 0,
      currentPrice: Number(form.currentPrice) || 0,
      currency: form.currency,
      lastUpdate: new Date().toISOString(),
    };
    const next = addInvestment(state!, inv);
    await saveState(next);
    setState(next);
    setShowModal(false);
    setForm({ name: "", symbol: "", type: "accion_cl", units: "", avgBuyPrice: "", currentPrice: "", currency: "CLP" });
  }

  async function handleDelete(id: string) {
    Alert.alert("Eliminar", "¿Eliminar esta inversión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          const next = deleteInvestment(state!, id);
          await saveState(next);
          setState(next);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Portfolio summary */}
        {state.investments.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { borderLeftColor: Colors.purple }]}>
              <Text style={styles.summaryLabel}>Valor Total</Text>
              <Text style={styles.summaryValue}>{formatCLP(totalValue)}</Text>
            </View>
            <View style={[styles.summaryCard, { borderLeftColor: totalGain >= 0 ? Colors.success : Colors.danger }]}>
              <Text style={styles.summaryLabel}>Retorno</Text>
              <Text style={[styles.summaryValue, { color: totalGain >= 0 ? Colors.success : Colors.danger }]}>
                {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(1)}%
              </Text>
              <Text style={[styles.gainText, { color: totalGain >= 0 ? Colors.success : Colors.danger }]}>
                {totalGain >= 0 ? "+" : ""}{formatCLP(Math.abs(totalGain))}
              </Text>
            </View>
          </View>
        )}

        {state.investments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bar-chart-outline" size={40} color={Colors.slate300} />
            <Text style={styles.emptyText}>No hay inversiones registradas</Text>
            <Text style={styles.emptySubtext}>Acciones, fondos mutuos, depósitos a plazo y más</Text>
          </View>
        ) : (
          state.investments.map((inv) => {
            const value = inv.units * inv.currentPrice;
            const cost = inv.units * inv.avgBuyPrice;
            const gain = value - cost;
            const ret = cost > 0 ? ((gain / cost) * 100) : 0;
            return (
              <TouchableOpacity
                key={inv.id}
                style={styles.card}
                onLongPress={() => handleDelete(inv.id)}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.symbol}>{inv.symbol}</Text>
                    <Text style={styles.invName}>{inv.name}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: ret >= 0 ? Colors.success + "20" : Colors.danger + "20" }]}>
                    <Text style={[styles.badgeText, { color: ret >= 0 ? Colors.success : Colors.danger }]}>
                      {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <View style={styles.invDetails}>
                  <View style={styles.invDetailItem}>
                    <Text style={styles.detailLabel}>Unidades</Text>
                    <Text style={styles.detailValue}>{inv.units}</Text>
                  </View>
                  <View style={styles.invDetailItem}>
                    <Text style={styles.detailLabel}>Precio Actual</Text>
                    <Text style={styles.detailValue}>{formatCurrency(inv.currentPrice, inv.currency)}</Text>
                  </View>
                  <View style={styles.invDetailItem}>
                    <Text style={styles.detailLabel}>Valor Total</Text>
                    <Text style={[styles.detailValue, { fontWeight: "700" }]}>{formatCurrency(value, inv.currency)}</Text>
                  </View>
                </View>
                <View style={[styles.gainRow, { backgroundColor: gain >= 0 ? Colors.success + "10" : Colors.danger + "10" }]}>
                  <Text style={[styles.gainLabel, { color: gain >= 0 ? Colors.success : Colors.danger }]}>
                    {gain >= 0 ? "Ganancia" : "Pérdida"}
                  </Text>
                  <Text style={[styles.gainAmount, { color: gain >= 0 ? Colors.success : Colors.danger }]}>
                    {gain >= 0 ? "+" : ""}{formatCurrency(gain, inv.currency)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal}>
            <Text style={styles.modalTitle}>Nueva Inversión</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} placeholder="Ej: Banco Santander Chile" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />

            <Text style={styles.label}>Símbolo / Ticker</Text>
            <TextInput style={styles.input} placeholder="Ej: BSAN, AAPL" value={form.symbol} onChangeText={(t) => setForm({ ...form, symbol: t.toUpperCase() })} autoCapitalize="characters" />

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeGrid}>
              {investmentTypes.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeBtn, form.type === t.value && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, type: t.value })}
                >
                  <Text style={[styles.typeText, form.type === t.value && styles.typeTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Moneda</Text>
            <View style={styles.typeGrid}>
              {(["CLP", "USD", "UF"] as Currency[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.typeBtn, form.currency === c && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, currency: c })}
                >
                  <Text style={[styles.typeText, form.currency === c && styles.typeTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Unidades</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={form.units} onChangeText={(t) => setForm({ ...form, units: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Precio Compra</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={form.avgBuyPrice} onChangeText={(t) => setForm({ ...form, avgBuyPrice: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Precio Actual</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={form.currentPrice} onChangeText={(t) => setForm({ ...form, currentPrice: t })} />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
                <Text style={styles.btnPrimaryText}>Agregar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setShowModal(false)}>
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderLeftWidth: 4 },
  summaryLabel: { fontSize: 11, fontWeight: "600", color: Colors.slate500, textTransform: "uppercase" },
  summaryValue: { fontSize: 20, fontWeight: "700", marginTop: 2, color: Colors.foreground },
  gainText: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  symbol: { fontSize: 18, fontWeight: "700", color: Colors.foreground },
  invName: { fontSize: 12, color: Colors.slate400, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  invDetails: { flexDirection: "row", marginTop: 12, gap: 8 },
  invDetailItem: { flex: 1 },
  detailLabel: { fontSize: 10, fontWeight: "600", color: Colors.slate400, textTransform: "uppercase" },
  detailValue: { fontSize: 14, fontWeight: "500", color: Colors.foreground, marginTop: 2 },
  gainRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, padding: 10, borderRadius: 8 },
  gainLabel: { fontSize: 13, fontWeight: "500" },
  gainAmount: { fontSize: 13, fontWeight: "700" },
  emptyCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 32, alignItems: "center" },
  emptyText: { fontSize: 14, color: Colors.slate400, marginTop: 8 },
  emptySubtext: { fontSize: 12, color: Colors.slate300, marginTop: 2 },
  fab: {
    position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.slate500, marginTop: 12, marginBottom: 4, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 12, fontSize: 14 },
  inputRow: { flexDirection: "row", gap: 8 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  typeBtnActive: { backgroundColor: Colors.accent + "15", borderColor: Colors.accent },
  typeText: { fontSize: 12, color: Colors.slate500 },
  typeTextActive: { color: Colors.accent, fontWeight: "600" },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 20 },
  btnPrimary: { flex: 1, backgroundColor: Colors.accent, borderRadius: 10, padding: 14, alignItems: "center" },
  btnPrimaryText: { color: Colors.white, fontWeight: "600", fontSize: 15 },
  btnOutline: { flex: 0.6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 14, alignItems: "center" },
  btnOutlineText: { color: Colors.foreground, fontWeight: "500", fontSize: 15 },
});
