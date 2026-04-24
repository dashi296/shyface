import { Tabs } from 'expo-router'
import React from 'react'
import { Text } from 'react-native'
import Constants from 'expo-constants'

const IS_DEV = Constants.expoConfig?.extra?.isDev === true

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📷</Text>,
          headerTitle: 'shyface',
        }}
      />
      <Tabs.Screen
        name="persons/index"
        options={{
          title: '人物管理',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
          headerTitle: '登録人物',
        }}
      />
      <Tabs.Screen
        name="debug"
        options={{
          title: 'Debug',
          href: IS_DEV ? undefined : null,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔧</Text>,
          headerTitle: 'Debug Settings',
        }}
      />
    </Tabs>
  )
}
