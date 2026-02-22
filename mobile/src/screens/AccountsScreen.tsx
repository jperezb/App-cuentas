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
  addAccount,
  deleteAccount,
  formatCLP,
} from "../store";
import { AppState, BankAccount, BankName, AccountType } from "../types";
import { Colors, bankColors } from "../theme";

const banks: { value: BankName; label: string }[] = [
  { value: "BancoEstado", label: "BancoEstado" },
  { value: "BancoChile", label: "Banco de Chile" },
  { value: "Santander", label: "Santander" },
  { value: "BCI", label: "BCI" },
  { value: "Itaú", label: "Itaú" },
  { value: "Scotiabank", label: "Scotiabank" },
  { value: "BancoFalabella", label: "Banco Falabella" },
  { value: "BancoRipley", label: "Banco Ripley" },
  { value: "BICE", label: "BICE" },
  { value: "Security", label: "Security" },
  { value: "Otro", label: "Otro" },
];

const types: { value: AccountType; label: string }[] = [
  { value: "corriente", label: "Corriente" },
  { value: "vista", label: "Vista / RUT" },
  { value: "ahorro", label: "Ahorro" },
  { value: "credito", label: "Crédito" },
  { value: "inversion", label: "Inversión" },
];

export default function AccountsScreen() {
  const [state, setState] = useState<AppState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    bank: "BancoEstado" as BankName,
    type: "corriente" as AccountType,
    balance: "",
  });
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const load = useCallback(async () => {
    setState(await loadState());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!state) return <View style={styles.center}><Text style={styles.loading}>Cargando...</Text></View>;

  const totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);

  async function handleSave() {
    if (!form.name.trim()) return;
    const acc: BankAccount = {
      id: uuidv4(),
      name: form.name,
      bank: form.bank,
      type: form.type,
      currency: "CLP",
      balance: Number(form.balance) || 0,
      lastSync: null,
      fintocLinkId: null,
      color: bankColors[form.bank] || "#6B7280",
    };
    const next = addAccount(state!, acc);
    await saveState(next);
    setState(next);
    setShowModal(false);
    setForm({ name: "", bank: "BancoEstado", type: "corriente", balance: "" });
  }

  async function handleDelete(id: string) {
    Alert.alert("Eliminar cuenta", "¿Eliminar esta cuenta y sus transacciones?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const next = deleteAccount(state!, id);
          await saveState(next);
          setState(next);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Total */}
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: Colors.accent }]}>
          <Text style={styles.statLabel}>Balance Total</Text>
          <Text style={styles.statValue}>{formatCLP(totalBalance)}</Text>
        </View>

        {/* Accounts */}
        {state.accounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="card-outline" size={40} color={Colors.slate300} />
            <Text style={styles.emptyText}>No hay cuentas registradas</Text>
          </View>
        ) : (
          state.accounts.map((acc) => (
            <View key={acc.id} style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.bankIcon, { backgroundColor: acc.color }]}>
                  <Text style={styles.bankIconText}>{acc.bank.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accName}>{acc.name}</Text>
                  <Text style={styles.accSub}>
                    {banks.find((b) => b.value === acc.bank)?.label} · {types.find((t) => t.value === acc.type)?.label}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(acc.id)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.slate400} />
                </TouchableOpacity>
              </View>
              <Text style={styles.accBalance}>{formatCLP(acc.balance)}</Text>
            </View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nueva Cuenta</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Cuenta Corriente"
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
            />

            <Text style={styles.label}>Banco</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowBankPicker(!showBankPicker)}>
              <Text>{banks.find((b) => b.value === form.bank)?.label}</Text>
            </TouchableOpacity>
            {showBankPicker && (
              <View style={styles.picker}>
                {banks.map((b) => (
                  <TouchableOpacity
                    key={b.value}
                    style={[styles.pickerItem, form.bank === b.value && styles.pickerItemActive]}
                    onPress={() => { setForm({ ...form, bank: b.value }); setShowBankPicker(false); }}
                  >
                    <Text style={form.bank === b.value ? styles.pickerTextActive : undefined}>{b.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Tipo</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowTypePicker(!showTypePicker)}>
              <Text>{types.find((t) => t.value === form.type)?.label}</Text>
            </TouchableOpacity>
            {showTypePicker && (
              <View style={styles.picker}>
                {types.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.pickerItem, form.type === t.value && styles.pickerItemActive]}
                    onPress={() => { setForm({ ...form, type: t.value }); setShowTypePicker(false); }}
                  >
                    <Text style={form.type === t.value ? styles.pickerTextActive : undefined}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Balance Actual</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
              value={form.balance}
              onChangeText={(t) => setForm({ ...form, balance: t })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
                <Text style={styles.btnPrimaryText}>Crear Cuenta</Text>
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
  loading: { color: Colors.slate400 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 10 },
  statLabel: { fontSize: 11, fontWeight: "600", color: Colors.slate500, textTransform: "uppercase" },
  statValue: { fontSize: 24, fontWeight: "700", color: Colors.foreground, marginTop: 4 },
  emptyCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 32, alignItems: "center", marginTop: 8 },
  emptyText: { fontSize: 14, color: Colors.slate400, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  bankIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bankIconText: { color: Colors.white, fontWeight: "700", fontSize: 13 },
  accName: { fontSize: 15, fontWeight: "600", color: Colors.foreground },
  accSub: { fontSize: 12, color: Colors.slate400, marginTop: 1 },
  accBalance: { fontSize: 22, fontWeight: "700", color: Colors.foreground, marginTop: 8 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.slate500, marginTop: 12, marginBottom: 4, textTransform: "uppercase" },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: Colors.white,
  },
  picker: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, marginTop: 4, maxHeight: 180 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
  pickerItemActive: { backgroundColor: Colors.accent + "15" },
  pickerTextActive: { color: Colors.accent, fontWeight: "600" },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 20 },
  btnPrimary: { flex: 1, backgroundColor: Colors.accent, borderRadius: 10, padding: 14, alignItems: "center" },
  btnPrimaryText: { color: Colors.white, fontWeight: "600", fontSize: 15 },
  btnOutline: { flex: 0.6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 14, alignItems: "center" },
  btnOutlineText: { color: Colors.foreground, fontWeight: "500", fontSize: 15 },
});
