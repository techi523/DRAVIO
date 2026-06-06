import { useThemeColors } from '../theme/useThemeColors';
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';

export function PrivacyPolicyScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.date}>Last updated: May 2026</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Section title="1. Who We Are">
          DRAVIO ("we", "our", "us") operates the DRAVIO decentralized internet marketplace platform.
          Contact: privacy@dravio.app
        </Section>

        <Section title="2. Data We Collect">
          {'• Account data: email address, encrypted password hash\n' +
           '• Session data: VPN session start/end time, data transferred (MB)\n' +
           '• Billing data: wallet balance, transaction history\n' +
           '• Device data: platform OS, app version (no device identifiers)\n' +
           '• We do NOT collect: browsing history, DNS queries, or traffic content'}
        </Section>

        <Section title="3. How We Use Your Data">
          {'• To authenticate your account\n' +
           '• To process real-time billing for data sessions\n' +
           '• To calculate Seller earnings\n' +
           '• To detect fraud and abuse\n' +
           '• To improve app reliability'}
        </Section>

        <Section title="4. VPN Traffic">
          When acting as a Seller, internet traffic from Buyers is routed through your device via
          an encrypted WireGuard tunnel. We do NOT log, inspect, or store the content of this traffic.
          Only the total bytes transferred per session are recorded for billing purposes.
        </Section>

        <Section title="5. Data Sharing">
          {'We do not sell your data. We may share data with:\n' +
           '• Payment processors (for wallet top-ups)\n' +
           '• Infrastructure providers (encrypted, under strict agreements)\n' +
           '• Law enforcement (only when legally required)'}
        </Section>

        <Section title="6. Data Retention">
          Account data is retained while your account is active. Session records are retained for
          12 months for billing disputes. You may request deletion at any time.
        </Section>

        <Section title="7. Your Rights">
          {'You have the right to:\n' +
           '• Access your personal data\n' +
           '• Correct inaccurate data\n' +
           '• Delete your account and data\n' +
           '• Export your data\n\n' +
           'Contact: privacy@dravio.app'}
        </Section>

        <Section title="8. Security">
          All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Auth tokens are stored
          in Android Keystore via expo-secure-store.
        </Section>

        <Section title="9. Children">
          DRAVIO is not intended for users under 16 years of age. We do not knowingly collect data
          from children.
        </Section>

        <Section title="10. Changes">
          We will notify you of material changes via in-app notification. Continued use constitutes
          acceptance.
        </Section>

      </ScrollView>
    </View>
  );
}

export function TermsOfServiceScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.date}>Last updated: May 2026</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Section title="1. Acceptance">
          By creating a DRAVIO account, you agree to these Terms of Service and our Privacy Policy.
          If you do not agree, do not use the app.
        </Section>

        <Section title="2. Eligibility">
          You must be at least 16 years old to use DRAVIO. By registering, you confirm you meet
          this requirement.
        </Section>

        <Section title="3. Seller Responsibilities">
          {'As a Seller, you:\n' +
           '• Must own or have rights to the internet connection you share\n' +
           '• Are responsible for your own data plan costs\n' +
           '• Must not share connections that are metered beyond their limits\n' +
           '• Must comply with your ISP\'s terms of service'}
        </Section>

        <Section title="4. Buyer Responsibilities">
          {'As a Buyer, you:\n' +
           '• Must use purchased internet access only for lawful purposes\n' +
           '• Must not use the platform for illegal activities\n' +
           '• Accept that connection speed/quality depends on Seller\'s network'}
        </Section>

        <Section title="5. Prohibited Activities">
          {'The following are strictly prohibited:\n' +
           '• Illegal content distribution\n' +
           '• Network attacks or hacking\n' +
           '• Spam or phishing\n' +
           '• Fraudulent transactions\n' +
           '• Violating third-party rights'}
        </Section>

        <Section title="6. Wallet & Payments">
          Wallet balances are non-refundable except where required by law. Earnings are paid out
          weekly to verified accounts. DRAVIO takes a platform fee per session (displayed at time of transaction).
        </Section>

        <Section title="7. Termination">
          We reserve the right to suspend or terminate accounts that violate these Terms, with or
          without notice. You may delete your account at any time from the Profile screen.
        </Section>

        <Section title="8. Disclaimers">
          DRAVIO is provided "as is". We do not guarantee uptime, connection speed, or earnings.
          To the maximum extent permitted by law, we disclaim all warranties.
        </Section>

        <Section title="9. Governing Law">
          These Terms are governed by applicable law. Disputes shall be resolved through binding
          arbitration where permitted.
        </Section>

        <Section title="10. Contact">
          Legal inquiries: legal@dravio.app
        </Section>

      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: 24,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { marginBottom: 12 },
  backText: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '900', color: colors.foreground, marginBottom: 4 },
  date: { fontSize: 12, color: colors.textMuted },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 10,
  },
  sectionBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
