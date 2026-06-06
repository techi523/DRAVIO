import { useThemeColors } from '../theme/useThemeColors';
import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { Colors } from '../theme/colors';
import { storage } from '../services/storage';

export const VPN_CONSENT_KEY = 'dravio_vpn_consent_v1';

interface VpnDisclosureProps {
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * VpnDisclosureScreen
 *
 * Required by Google Play VPN policy (September 2024):
 * Apps using VpnService must show a prominent disclosure screen explaining
 * exactly what data is processed and why before the VPN tunnel is activated.
 */
export default function VpnDisclosure({ onAccept, onDecline }: VpnDisclosureProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleAccept = async () => {
    await storage.setItem(VPN_CONSENT_KEY, 'true');
    onAccept();
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      setScrolledToBottom(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>VPN Service Disclosure</Text>
        <Text style={styles.subtitle}>
          DRAVIO uses Android's VPN Service to enable peer-to-peer internet sharing.
          Please read the following disclosure carefully before enabling.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={true}
      >
        <DisclosureSection
          icon="🌐"
          title="What This App Does"
          body="When you activate internet sharing as a Seller, DRAVIO routes Buyer traffic through your device using Android's VPN Service API. When you connect as a Buyer, your traffic is routed through a Seller's device."
        />

        <DisclosureSection
          icon="📡"
          title="Traffic Handling"
          body="DRAVIO routes only general internet traffic for Buyers connected to your session. The platform uses WireGuard-based encrypted tunnels. DRAVIO does NOT inspect, log, or sell the content of routed traffic."
        />

        <DisclosureSection
          icon="🔒"
          title="Encryption"
          body="All VPN tunnels are encrypted using the WireGuard protocol with industry-standard elliptic-curve cryptography. Your data is protected in transit."
        />

        <DisclosureSection
          icon="⚡"
          title="Battery & Performance"
          body="Active VPN tunnels may increase battery usage and data consumption. A persistent notification will be shown while the VPN is active so you always know it is running."
        />

        <DisclosureSection
          icon="💰"
          title="Billing"
          body="Data usage is metered in real-time. As a Seller you earn per GB shared. As a Buyer your wallet is charged per GB consumed. All transactions are recorded transparently in your wallet history."
        />

        <DisclosureSection
          icon="🛑"
          title="Your Control"
          body="You can stop the VPN at any time by tapping Stop in the app or from the Android Quick Settings panel. DRAVIO never starts a VPN session without your explicit action."
        />

        <DisclosureSection
          icon="📋"
          title="Data We Collect"
          body="We collect: session start/end times, data transferred (in MB), your device's assigned VPN IP (temporary), and billing records. We do NOT collect browsing history or traffic content."
        />

        <TouchableOpacity
          onPress={() => Linking.openURL('https://dravio.app/privacy')}
          style={styles.policyLink}
        >
          <Text style={styles.policyLinkText}>
            Read our full Privacy Policy → dravio.app/privacy
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.actions}>
        {!scrolledToBottom && (
          <Text style={styles.scrollHint}>↓ Scroll down to read the full disclosure</Text>
        )}
        <TouchableOpacity
          style={[styles.acceptBtn, !scrolledToBottom && styles.btnDisabled]}
          onPress={handleAccept}
          disabled={!scrolledToBottom}
          accessibilityLabel="I understand and agree to the VPN disclosure"
          accessibilityRole="button"
        >
          <Text style={styles.acceptBtnText}>I UNDERSTAND — ENABLE VPN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.declineBtn}
          onPress={onDecline}
          accessibilityLabel="Decline VPN and go back"
          accessibilityRole="button"
        >
          <Text style={styles.declineBtnText}>No thanks, go back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DisclosureSection({ icon, title, body }: { icon: string; title: string; body: string }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollArea: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 24,
    backgroundColor: colors.surfaceMid,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  sectionIcon: { fontSize: 20 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.foreground,
  },
  sectionBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
  },
  policyLink: { marginBottom: 40, alignItems: 'center', paddingVertical: 12 },
  policyLinkText: { color: colors.primary, fontSize: 13 },
  actions: {
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  scrollHint: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 12,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.4 },
  acceptBtnText: { color: colors.background, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  declineBtn: { alignItems: 'center', padding: 12 },
  declineBtnText: { color: colors.textMuted, fontSize: 14 },
});
