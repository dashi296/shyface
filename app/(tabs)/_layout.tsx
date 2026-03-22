import { Tabs } from 'expo-router'
import React from 'react'
import { Text } from 'react-native'

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
    </Tabs>
  )
}
