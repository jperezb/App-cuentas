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
  addGroup,
  deleteGroup,
  addMemberToGroup,
  addExpenseToGroup,
  deleteExpenseFromGroup,
  calculateSettlements,
  formatCLP,
} from "../store";
import {
  AppState,
  ExpenseGroup,
  FamilyMember,
  GroupExpense,
} from "../types";
import { Colors } from "../theme";

type Screen = "list" | "detail";

export default function GroupsScreen() {
  const [state, setState] = useState<AppState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Modals
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [memberForm, setMemberForm] = useState({ name: "", familyName: "" });
  const [expenseForm, setExpenseForm] = useState({
    payerId: "",
    description: "",
    amount: "",
    splitAmong: [] as string[],
  });

  const load = useCallback(async () => { setState(await loadState()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!state) return <View style={styles.center}><Text>Cargando...</Text></View>;

  const group = selectedGroupId ? state.groups.find((g) => g.id === selectedGroupId) : null;

  // ---- LIST SCREEN ----
  if (screen === "list") {
    return (
      <View style={styles.container}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {state.groups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={48} color={Colors.slate300} />
              <Text style={styles.emptyTitle}>Sin grupos de gastos</Text>
              <Text style={styles.emptyText}>
                Crea un grupo para dividir gastos entre familias en paseos, viajes o eventos.
              </Text>
            </View>
          ) : (
            state.groups.map((g) => {
              const total = g.expenses.reduce((s, e) => s + e.amount, 0);
              const familySet = new Set(g.members.map((m) => m.familyName));
              return (
                <TouchableOpacity
                  key={g.id}
                  style={styles.groupCard}
                  onPress={() => { setSelectedGroupId(g.id); setScreen("detail"); }}
                  onLongPress={() => {
                    Alert.alert("Eliminar grupo", `¿Eliminar "${g.name}"?`, [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Eliminar", style: "destructive",
                        onPress: async () => {
                          const next = deleteGroup(state, g.id);
                          await saveState(next);
                          setState(next);
                        },
                      },
                    ]);
                  }}
                >
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={Colors.slate300} />
                  </View>
                  {g.description ? <Text style={styles.groupDesc}>{g.description}</Text> : null}
                  <View style={styles.groupMeta}>
                    <Text style={styles.groupMetaText}>
                      {familySet.size} familias · {g.members.length} miembros · {g.expenses.length} gastos
                    </Text>
                  </View>
                  <View style={styles.groupTotalRow}>
                    <Text style={styles.groupTotalLabel}>Total</Text>
                    <Text style={styles.groupTotalValue}>{formatCLP(total)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 80 }} />
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setShowNewGroup(true)}>
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>

        {/* New group modal */}
        <Modal visible={showNewGroup} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Nuevo Grupo</Text>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} placeholder="Ej: Paseo a la playa" value={groupForm.name} onChangeText={(t) => setGroupForm({ ...groupForm, name: t })} />
              <Text style={styles.label}>Descripción</Text>
              <TextInput style={styles.input} placeholder="Opcional" value={groupForm.description} onChangeText={(t) => setGroupForm({ ...groupForm, description: t })} />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.btnPrimary} onPress={async () => {
                  if (!groupForm.name.trim()) return;
                  const g: ExpenseGroup = {
                    id: uuidv4(), name: groupForm.name, description: groupForm.description,
                    members: [], expenses: [], createdAt: new Date().toISOString(),
                  };
                  const next = addGroup(state, g);
                  await saveState(next);
                  setState(next);
                  setShowNewGroup(false);
                  setGroupForm({ name: "", description: "" });
                  setSelectedGroupId(g.id);
                  setScreen("detail");
                }}>
                  <Text style={styles.btnPrimaryText}>Crear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnOutline} onPress={() => setShowNewGroup(false)}>
                  <Text style={styles.btnOutlineText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- DETAIL SCREEN ----
  if (!group) {
    setScreen("list");
    return null;
  }

  const totalExpenses = group.expenses.reduce((s, e) => s + e.amount, 0);
  const settlements = calculateSettlements(group);
  const families: Record<string, FamilyMember[]> = {};
  for (const m of group.members) {
    if (!families[m.familyName]) families[m.familyName] = [];
    families[m.familyName].push(m);
  }

  // Calculate per-member balances
  const balances: Record<string, number> = {};
  for (const m of group.members) balances[m.id] = 0;
  for (const exp of group.expenses) {
    balances[exp.payerId] = (balances[exp.payerId] || 0) + exp.amount;
    if (exp.splitType === "equal") {
      const share = exp.amount / exp.splitAmong.length;
      for (const mid of exp.splitAmong) balances[mid] = (balances[mid] || 0) - share;
    }
  }

  const getMemberName = (id: string) => group.members.find((m) => m.id === id)?.name || "?";

  function toggleExpenseMember(id: string) {
    setExpenseForm((prev) => ({
      ...prev,
      splitAmong: prev.splitAmong.includes(id)
        ? prev.splitAmong.filter((x) => x !== id)
        : [...prev.splitAmong, id],
    }));
  }

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Back + Title */}
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen("list")}>
          <Ionicons name="arrow-back" size={20} color={Colors.accent} />
          <Text style={styles.backText}>Grupos</Text>
        </TouchableOpacity>

        <Text style={styles.detailTitle}>{group.name}</Text>
        {group.description ? <Text style={styles.detailDesc}>{group.description}</Text> : null}

        {/* Stats */}
        <View style={styles.detailStats}>
          <View style={[styles.detailStat, { borderLeftColor: Colors.accent }]}>
            <Text style={styles.detailStatLabel}>Total</Text>
            <Text style={styles.detailStatValue}>{formatCLP(totalExpenses)}</Text>
          </View>
          <View style={[styles.detailStat, { borderLeftColor: Colors.purple }]}>
            <Text style={styles.detailStatLabel}>Por persona</Text>
            <Text style={styles.detailStatValue}>
              {group.members.length > 0 ? formatCLP(Math.round(totalExpenses / group.members.length)) : "$0"}
            </Text>
          </View>
        </View>

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Miembros</Text>
            <TouchableOpacity style={styles.smallBtn} onPress={() => setShowAddMember(true)}>
              <Ionicons name="person-add-outline" size={14} color={Colors.accent} />
              <Text style={styles.smallBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {group.members.length === 0 ? (
            <Text style={styles.emptySmall}>Agrega miembros para comenzar</Text>
          ) : (
            Object.entries(families).map(([familyName, members]) => (
              <View key={familyName} style={{ marginBottom: 10 }}>
                <Text style={styles.familyLabel}>Familia {familyName}</Text>
                {members.map((m) => {
                  const bal = balances[m.id] || 0;
                  return (
                    <View key={m.id} style={styles.memberRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={[styles.memberBalance, { color: bal >= 0 ? Colors.success : Colors.danger }]}>
                        {bal >= 0 ? "+" : ""}{formatCLP(Math.round(bal))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>

        {/* Settlements */}
        {settlements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Liquidación</Text>
            <Text style={styles.settlementHint}>Transferencias para saldar cuentas:</Text>
            {settlements.map((s, i) => (
              <View key={i} style={styles.settlementRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settlementNames}>
                    <Text style={{ color: Colors.danger }}>{getMemberName(s.from)}</Text>
                    {" → "}
                    <Text style={{ color: Colors.success }}>{getMemberName(s.to)}</Text>
                  </Text>
                </View>
                <Text style={styles.settlementAmount}>{formatCLP(s.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Expenses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gastos</Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => {
                if (group.members.length < 2) {
                  Alert.alert("Faltan miembros", "Agrega al menos 2 miembros.");
                  return;
                }
                setExpenseForm({
                  payerId: group.members[0].id,
                  description: "",
                  amount: "",
                  splitAmong: group.members.map((m) => m.id),
                });
                setShowAddExpense(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={14} color={Colors.accent} />
              <Text style={styles.smallBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {group.expenses.length === 0 ? (
            <Text style={styles.emptySmall}>No hay gastos en este grupo</Text>
          ) : (
            [...group.expenses]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((exp) => (
                <TouchableOpacity
                  key={exp.id}
                  style={styles.expenseRow}
                  onLongPress={() => {
                    Alert.alert("Eliminar gasto", `¿Eliminar "${exp.description}"?`, [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Eliminar", style: "destructive",
                        onPress: async () => {
                          const next = deleteExpenseFromGroup(state, group.id, exp.id);
                          await saveState(next);
                          setState(next);
                        },
                      },
                    ]);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseDesc}>{exp.description}</Text>
                    <Text style={styles.expenseMeta}>
                      Pagó: {getMemberName(exp.payerId)} · {new Date(exp.date).toLocaleDateString("es-CL")}
                    </Text>
                    <View style={styles.splitBadges}>
                      {exp.splitAmong.map((mid) => (
                        <View key={mid} style={styles.splitBadge}>
                          <Text style={styles.splitBadgeText}>{getMemberName(mid).split(" ")[0]}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Text style={styles.expenseAmount}>{formatCLP(exp.amount)}</Text>
                </TouchableOpacity>
              ))
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add member modal */}
      <Modal visible={showAddMember} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Agregar Miembro</Text>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} placeholder="Ej: Juan Pérez" value={memberForm.name} onChangeText={(t) => setMemberForm({ ...memberForm, name: t })} />
            <Text style={styles.label}>Familia</Text>
            <TextInput style={styles.input} placeholder="Ej: Pérez" value={memberForm.familyName} onChangeText={(t) => setMemberForm({ ...memberForm, familyName: t })} />
            {Object.keys(families).length > 0 && (
              <View style={styles.familyChips}>
                {Object.keys(families).map((f) => (
                  <TouchableOpacity key={f} style={styles.familyChip} onPress={() => setMemberForm({ ...memberForm, familyName: f })}>
                    <Text style={styles.familyChipText}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnPrimary} onPress={async () => {
                if (!memberForm.name.trim() || !memberForm.familyName.trim()) return;
                const member: FamilyMember = { id: uuidv4(), name: memberForm.name, familyName: memberForm.familyName };
                const next = addMemberToGroup(state, group.id, member);
                await saveState(next);
                setState(next);
                setShowAddMember(false);
                setMemberForm({ name: "", familyName: "" });
              }}>
                <Text style={styles.btnPrimaryText}>Agregar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setShowAddMember(false)}>
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add expense modal */}
      <Modal visible={showAddExpense} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal}>
            <Text style={styles.modalTitle}>Agregar Gasto</Text>
            <Text style={styles.label}>Descripción</Text>
            <TextInput style={styles.input} placeholder="Ej: Almuerzo" value={expenseForm.description} onChangeText={(t) => setExpenseForm({ ...expenseForm, description: t })} />
            <Text style={styles.label}>Monto (CLP)</Text>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="0" value={expenseForm.amount} onChangeText={(t) => setExpenseForm({ ...expenseForm, amount: t })} />
            <Text style={styles.label}>¿Quién pagó?</Text>
            <View style={styles.payerGrid}>
              {group.members.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.payerBtn, expenseForm.payerId === m.id && styles.payerBtnActive]}
                  onPress={() => setExpenseForm({ ...expenseForm, payerId: m.id })}
                >
                  <Text style={[styles.payerText, expenseForm.payerId === m.id && styles.payerTextActive]}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.splitHeader}>
              <Text style={styles.label}>Dividir entre:</Text>
              <TouchableOpacity onPress={() => setExpenseForm({ ...expenseForm, splitAmong: group.members.map((m) => m.id) })}>
                <Text style={styles.selectAll}>Todos</Text>
              </TouchableOpacity>
            </View>
            {group.members.map((m) => (
              <TouchableOpacity key={m.id} style={styles.checkRow} onPress={() => toggleExpenseMember(m.id)}>
                <Ionicons
                  name={expenseForm.splitAmong.includes(m.id) ? "checkbox" : "square-outline"}
                  size={20}
                  color={expenseForm.splitAmong.includes(m.id) ? Colors.accent : Colors.slate300}
                />
                <Text style={styles.checkName}>{m.name} ({m.familyName})</Text>
              </TouchableOpacity>
            ))}
            {expenseForm.splitAmong.length > 0 && Number(expenseForm.amount) > 0 && (
              <Text style={styles.perPersonText}>
                Cada persona: {formatCLP(Math.round(Number(expenseForm.amount) / expenseForm.splitAmong.length))}
              </Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnPrimary} onPress={async () => {
                if (!expenseForm.description.trim() || !expenseForm.payerId || !Number(expenseForm.amount) || expenseForm.splitAmong.length === 0) return;
                const expense: GroupExpense = {
                  id: uuidv4(), groupId: group.id, payerId: expenseForm.payerId,
                  description: expenseForm.description, amount: Number(expenseForm.amount),
                  currency: "CLP", date: new Date().toISOString().split("T")[0],
                  splitAmong: expenseForm.splitAmong, splitType: "equal",
                };
                const next = addExpenseToGroup(state, group.id, expense);
                await saveState(next);
                setState(next);
                setShowAddExpense(false);
              }}>
                <Text style={styles.btnPrimaryText}>Agregar Gasto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setShowAddExpense(false)}>
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
  emptyCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 32, alignItems: "center", marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 12, color: Colors.foreground },
  emptyText: { fontSize: 14, color: Colors.slate500, textAlign: "center", marginTop: 6, lineHeight: 20 },
  groupCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 10 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  groupName: { fontSize: 17, fontWeight: "700", color: Colors.foreground },
  groupDesc: { fontSize: 12, color: Colors.slate400, marginTop: 2 },
  groupMeta: { marginTop: 8 },
  groupMetaText: { fontSize: 12, color: Colors.slate400 },
  groupTotalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.slate100 },
  groupTotalLabel: { fontSize: 12, color: Colors.slate400 },
  groupTotalValue: { fontSize: 20, fontWeight: "700", color: Colors.foreground },
  fab: {
    position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  // Detail
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  backText: { color: Colors.accent, fontWeight: "500", fontSize: 14 },
  detailTitle: { fontSize: 24, fontWeight: "700", color: Colors.foreground },
  detailDesc: { fontSize: 13, color: Colors.slate400, marginTop: 2 },
  detailStats: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 16 },
  detailStat: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderLeftWidth: 4 },
  detailStatLabel: { fontSize: 11, fontWeight: "600", color: Colors.slate500, textTransform: "uppercase" },
  detailStatValue: { fontSize: 20, fontWeight: "700", marginTop: 2, color: Colors.foreground },
  section: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.foreground },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  smallBtnText: { fontSize: 12, color: Colors.accent, fontWeight: "500" },
  emptySmall: { fontSize: 13, color: Colors.slate400, textAlign: "center", paddingVertical: 12 },
  familyLabel: { fontSize: 11, fontWeight: "600", color: Colors.slate400, textTransform: "uppercase", marginBottom: 6 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accent + "20", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "700", color: Colors.accent },
  memberName: { flex: 1, fontSize: 14, fontWeight: "500", color: Colors.foreground },
  memberBalance: { fontSize: 13, fontWeight: "600" },
  // Settlements
  settlementHint: { fontSize: 12, color: Colors.slate400, marginBottom: 8 },
  settlementRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.warning + "15", padding: 12, borderRadius: 8, marginBottom: 6 },
  settlementNames: { fontSize: 14, fontWeight: "500" },
  settlementAmount: { fontSize: 15, fontWeight: "700", color: "#92400e" },
  // Expenses
  expenseRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
  expenseDesc: { fontSize: 14, fontWeight: "500", color: Colors.foreground },
  expenseMeta: { fontSize: 11, color: Colors.slate400, marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: "700", color: Colors.foreground },
  splitBadges: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  splitBadge: { backgroundColor: Colors.slate100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  splitBadgeText: { fontSize: 10, color: Colors.slate500 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.slate500, marginTop: 12, marginBottom: 4, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 12, fontSize: 14 },
  familyChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  familyChip: { backgroundColor: Colors.slate100, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  familyChipText: { fontSize: 12, color: Colors.slate600 },
  payerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  payerBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  payerBtnActive: { backgroundColor: Colors.accent + "15", borderColor: Colors.accent },
  payerText: { fontSize: 13, color: Colors.slate500 },
  payerTextActive: { color: Colors.accent, fontWeight: "600" },
  splitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectAll: { fontSize: 12, color: Colors.accent, fontWeight: "500" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  checkName: { fontSize: 14, color: Colors.foreground },
  perPersonText: { fontSize: 12, color: Colors.slate500, marginTop: 6, fontStyle: "italic" },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 20 },
  btnPrimary: { flex: 1, backgroundColor: Colors.accent, borderRadius: 10, padding: 14, alignItems: "center" },
  btnPrimaryText: { color: Colors.white, fontWeight: "600", fontSize: 15 },
  btnOutline: { flex: 0.6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 14, alignItems: "center" },
  btnOutlineText: { color: Colors.foreground, fontWeight: "500", fontSize: 15 },
});
