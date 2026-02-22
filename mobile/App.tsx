import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "./src/theme";

import DashboardScreen from "./src/screens/DashboardScreen";
import AccountsScreen from "./src/screens/AccountsScreen";
import TransactionsScreen from "./src/screens/TransactionsScreen";
import InvestmentsScreen from "./src/screens/InvestmentsScreen";
import GroupsScreen from "./src/screens/GroupsScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.slate400,
          tabBarStyle: {
            backgroundColor: Colors.white,
            borderTopColor: Colors.cardBorder,
            paddingBottom: 4,
            height: 56,
          },
          headerStyle: {
            backgroundColor: Colors.white,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.cardBorder,
          },
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18,
            color: Colors.foreground,
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
            headerTitle: "MisCuentas",
          }}
        />
        <Tab.Screen
          name="Cuentas"
          component={AccountsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="wallet-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Gastos"
          component={TransactionsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt-outline" size={size} color={color} />
            ),
            headerTitle: "Transacciones",
          }}
        />
        <Tab.Screen
          name="Inversiones"
          component={InvestmentsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trending-up-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Grupos"
          component={GroupsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
            headerTitle: "Gastos Grupales",
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
