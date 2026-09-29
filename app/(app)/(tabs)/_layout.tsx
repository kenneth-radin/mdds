import React from 'react';
import { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../components/theme';

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTitleStyle: { color: theme.text, fontSize: 17, fontWeight: '700' },
        headerTintColor: theme.primary,
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('speedometer-outline') }} />
      <Tabs.Screen name="machines" options={{ title: 'Machines', tabBarIcon: icon('construct-outline') }} />
      <Tabs.Screen name="cases" options={{ title: 'Cases', tabBarIcon: icon('clipboard-outline') }} />
      <Tabs.Screen name="testing" options={{ title: 'Testing', tabBarIcon: icon('flask-outline') }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: icon('bar-chart-outline') }} />
      {/* Reachable from the Dashboard and Settings; kept out of the bar so the six
          working tabs keep readable labels on a phone-sized screen. */}
      <Tabs.Screen name="models" options={{ title: 'ML models', href: null }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
