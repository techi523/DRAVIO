import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import TunnelMonitor from '../components/TunnelMonitor';

const SELLERS = [
  { id: "1", name: "Alpha Relay #01", ping: "14ms", price: "$0.50/GB", location: "Nairobi, KE" },
  { id: "2", name: "Node X-Prime", ping: "22ms", price: "$0.45/GB", location: "Lagos, NG" },
  { id: "3", name: "Starlink B-7", ping: "45ms", price: "$1.20/GB", location: "Cape Town, ZA" },
];

export default function Marketplace() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 40}}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Limitless Data.</Text>
        <Text style={styles.heroSubTitle}>Connected globally. Secured locally.</Text>
      </View>

      <TunnelMonitor />

      <Text style={styles.sectionTitle}>High Reliability Sellers</Text>
      {SELLERS.map(s => (
        <TouchableOpacity key={s.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.relayIcon} />
            <View>
              <Text style={styles.relayName}>{s.name}</Text>
              <Text style={styles.relayMeta}>{s.location} • {s.ping}</Text>
            </View>
          </View>
          <View style={styles.cardPrice}>
            <Text style={styles.priceText}>{s.price}</Text>
            <TouchableOpacity style={styles.buyBtn}>
              <Text style={styles.buyBtnText}>BUY</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  hero: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.foreground,
    lineHeight: 44,
  },
  heroSubTitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.foreground,
    marginTop: 32,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.surfaceMid,
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  relayIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
    marginRight: 16,
  },
  relayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.foreground,
  },
  relayMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cardPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.foreground,
  },
  buyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buyBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  }
});
