import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import TunnelMonitor from '../components/TunnelMonitor';
import { api } from '../services/api';

export default function Marketplace() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const data = await api.get<any>('/v1/marketplace/search?lat=0&lon=0');
        setSellers(data.results || []);
      } catch (err) {
        console.error('Failed to fetch sellers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSellers();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 40}}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Limitless Data.</Text>
        <Text style={styles.heroSubTitle}>Connected globally. Secured locally.</Text>
      </View>

      <TunnelMonitor />

      <Text style={styles.sectionTitle}>High Reliability Sellers</Text>
      
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" />
      ) : (
        sellers.map(s => (
          <TouchableOpacity key={s.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.relayIcon} />
              <View>
                <Text style={styles.relayName}>{s.name || `Relay #${s.id.slice(0,4)}`}</Text>
                <Text style={styles.relayMeta}>{s.location || 'Nairobi, KE'} • {s.distance?.toFixed(1) || '0.5'}{s.unit || 'km'}</Text>
              </View>
            </View>
            <View style={styles.cardPrice}>
              <Text style={styles.priceText}>${s.price_per_gb?.toFixed(2) || '0.50'}/GB</Text>
              <TouchableOpacity style={styles.buyBtn}>
                <Text style={styles.buyBtnText}>BUY</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}
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
    backgroundColor: 'rgba(20, 22, 46, 0.7)',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  relayIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    marginRight: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
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
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 100,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buyBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  }
});
