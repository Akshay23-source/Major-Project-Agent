import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme/colors";
import { Sidebar } from "../../src/components/ui/Sidebar";

export default function DriverLayout() {
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Sidebar />
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: Colors.primaryDark,
            tabBarInactiveTintColor: Colors.textLight,
            tabBarStyle: {
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
            }
          }}
        >
          <Tabs.Screen
            name="dashboard"
            options={{
              title: "Dashboard",
              tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color as string} />,
            }}
          />
          <Tabs.Screen
            name="deliveries"
            options={{
              title: "Deliveries",
              tabBarIcon: ({ color }) => <Ionicons name="cube" size={24} color={color as string} />,
            }}
          />
          {/* Hidden screens — accessible via navigation but not shown as tabs */}
          <Tabs.Screen
            name="incoming"
            options={{
              href: null,
              title: "Incoming Orders",
            }}
          />
          <Tabs.Screen
            name="awaiting"
            options={{
              href: null,
              title: "Awaiting Pickup",
            }}
          />
          <Tabs.Screen
            name="delivered-today"
            options={{
              href: null,
              title: "Delivered Today",
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}
