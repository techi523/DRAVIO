import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';

export default function Profile() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AD</Text>
        </View>
        <Text style={styles.name}>Alex Dravio</Text>
        <Text style={styles.email}>alex@example.com</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PRO SELLER</Text>
        </View>
      </View>

      {/* Settings Sections */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowText}>Personal Information</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowText}>Payment Methods</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowText}>Security & Privacy</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowText}>Notifications</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowText}>Data Usage Limits</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn}>
        <Text style={styles.logoutBtnText}>LOG OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,242,255,0.1)',
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.foreground,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: 'rgba(112,0,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  badgeText: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  section: {
    backgroundColor: 'rgba(20, 22, 46, 0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 28,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.foreground,
  },
  rowChevron: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '300',
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,0,85,0.3)',
    backgroundColor: 'rgba(255,0,85,0.05)',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutBtnText: {
    color: Colors.danger,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
  },
});
