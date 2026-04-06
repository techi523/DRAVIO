import React, { useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, AuthContext } from './src/services/AuthContext';
import { Colors } from './src/theme/colors';

// Screens
import Login from './src/screens/Login';
import Register from './src/screens/Register';
import Marketplace from './src/screens/Marketplace';
import Wallet from './src/screens/Wallet';
import Relay from './src/screens/Relay';
import Profile from './src/screens/Profile';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator for Main App Flow
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surfaceLow,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.05)',
          height: 80,
          paddingBottom: 20,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
        }
      }}
    >
      <Tab.Screen name="Market" component={Marketplace} />
      <Tab.Screen name="Wallet" component={Wallet} />
      <Tab.Screen name="Relay" component={Relay} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

// Authentication Stack
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
    </Stack.Navigator>
  );
}

// Custom Dark Theme for React Navigation
const MyTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surfaceLow,
    text: Colors.foreground,
    border: 'rgba(255,255,255,0.05)',
    notification: Colors.danger,
  },
  fonts: {
    ...DarkTheme.fonts,
    regular: { fontFamily: 'sans-serif', fontWeight: 'normal' as const },
    medium: { fontFamily: 'sans-serif-medium', fontWeight: '500' as const },
    bold: { fontFamily: 'sans-serif', fontWeight: 'bold' as const },
    heavy: { fontFamily: 'sans-serif', fontWeight: '900' as const },
  },
};

// Main Navigation Wrapper connecting to Auth Context
function Navigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={MyTheme}>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

// Root App Component
export default function App() {
  return (
    <AuthProvider>
      <Navigator />
    </AuthProvider>
  );
}
