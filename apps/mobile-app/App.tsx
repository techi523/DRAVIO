import React from 'react';
import { StyleSheet, View, Text, StatusBar, SafeAreaView } from 'react-native';
import { Colors } from './src/theme/colors';
import Marketplace from './src/screens/Marketplace';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.logo}>DRAVIO</Text>
        <View style={styles.statusBadge}>
          <View style={styles.dot} />
          <Text style={styles.statusText}>SECURE_TUNNEL</Text>
        </View>
      </View>
      
      <Marketplace />
      
      <View style={styles.navBar}>
        <Text style={[styles.navItem, {color: Colors.primary}]}>MARKET</Text>
        <Text style={styles.navItem}>WALLET</Text>
        <Text style={styles.navItem}>RELAY</Text>
        <Text style={styles.navItem}>PROFILE</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logo: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,242,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginRight: 6,
  },
  statusText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  navBar: {
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLow,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  navItem: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textMuted,
  }
});
