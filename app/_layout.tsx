import { Stack } from "expo-router";
import { AuthProvider } from "../src/providers/AuthProvider";
import { SidebarProvider } from "../src/providers/SidebarProvider";

export default function RootLayout() {
  return (
    <SidebarProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </AuthProvider>
    </SidebarProvider>
  );
}
