import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import { colors } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: 'Fraunces_600SemiBold', color: colors.ink },
        tabBarActiveTintColor: colors.pine,
        tabBarInactiveTintColor: colors.taupe,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.hairline,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Feather name="sun" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="medicines"
        options={{
          title: 'Medicines',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="thermometer" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Records',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Feather name="folder" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
