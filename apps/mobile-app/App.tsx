import React, { useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, AuthContext } from './src/services/AuthContext';
import { Colors } from './src/theme/colors';
import { useThemeColors } from './src/theme/useThemeColors';
import ErrorBoundary from './src/components/ErrorBoundary';
import './src/i18n'; // Initialize i18n

// Screens
import Login from './src/screens/Login';
import Register from './src/screens/Register';
import Marketplace from './src/screens/Marketplace';
import Wallet from './src/screens/Wallet';
import Relay from './src/screens/Relay';
import Profile from './src/screens/Profile';
import AdminDashboard from './src/screens/AdminDashboard';
import { PrivacyPolicyScreen, TermsOfServiceScreen } from './src/screens/Legal';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ----------------------------------------------------
// 1. BUYER PORTAL TABS (Cyan Theme)
// ----------------------------------------------------
function BuyerTabs() {
  const colors = useThemeColors();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceLow,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 80,
          paddingBottom: 20,
        },
        tabBarActiveTintColor: colors.primary, // Cyan
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '900' },
      }}
    >
      <Tab.Screen
        name="Market"
        component={Marketplace}
        options={{
          tabBarLabel: 'Market',
          tabBarAccessibilityLabel: 'Marketplace discovery tab',
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={Wallet}
        options={{ tabBarAccessibilityLabel: 'Buyer Wallet tab' }}
      />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{ tabBarAccessibilityLabel: 'Buyer Profile tab' }}
      />
    </Tab.Navigator>
  );
}

// ----------------------------------------------------
// 2. SELLER PORTAL TABS (Emerald Success Green Theme)
// ----------------------------------------------------
function SellerTabs() {
  const colors = useThemeColors();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceLow,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 80,
          paddingBottom: 20,
        },
        tabBarActiveTintColor: colors.success, // Emerald Green
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '900' },
      }}
    >
      <Tab.Screen
        name="Relay"
        component={Relay}
        options={{
          tabBarLabel: 'Operator Node',
          tabBarAccessibilityLabel: 'Broadcasting telemetry dashboard',
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={Wallet}
        options={{ tabBarAccessibilityLabel: 'Seller Earnings tab' }}
      />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{ tabBarAccessibilityLabel: 'Seller Settings tab' }}
      />
    </Tab.Navigator>
  );
}

// ----------------------------------------------------
// 3. ADMIN PORTAL STACK (Security Operations Red)
// ----------------------------------------------------
function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsOfServiceScreen} />
    </Stack.Navigator>
  );
}

// ----------------------------------------------------
// 4. AUTHENTICATION FLOW
// ----------------------------------------------------
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
      <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsOfServiceScreen} />
    </Stack.Navigator>
  );
}

// ----------------------------------------------------
// 5. MASTER APP STACKS (Buyer vs Seller dynamic routes)
// ----------------------------------------------------
function BuyerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={BuyerTabs} />
      <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsOfServiceScreen} />
    </Stack.Navigator>
  );
}

function SellerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={SellerTabs} />
      <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsOfServiceScreen} />
    </Stack.Navigator>
  );
}

function Navigator() {
  const { user, loading } = useContext(AuthContext);
  const colors = useThemeColors();

  const AppTheme = {
    ...DarkTheme, // Base off dark theme for fonts etc, but override colors completely
    colors: {
      ...DarkTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surfaceLow,
      text: colors.foreground,
      border: colors.border,
      notification: colors.danger,
    },
    fonts: {
      ...DarkTheme.fonts,
      regular: { fontFamily: 'sans-serif', fontWeight: 'normal' as const },
      medium: { fontFamily: 'sans-serif-medium', fontWeight: '500' as const },
      bold: { fontFamily: 'sans-serif', fontWeight: 'bold' as const },
      heavy: { fontFamily: 'sans-serif', fontWeight: '900' as const },
    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <NavigationContainer theme={AppTheme}>
        <AuthStack />
      </NavigationContainer>
    );
  }

  // Pure Role-Based Route Splitting
  const renderRoleFlow = () => {
    switch (user.role) {
      case 'admin':
        return <AdminStack />;
      case 'seller':
        return <SellerStack />;
      case 'buyer':
      default:
        return <BuyerStack />;
    }
  };

  return (
    <NavigationContainer theme={AppTheme}>
      {renderRoleFlow()}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Navigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
