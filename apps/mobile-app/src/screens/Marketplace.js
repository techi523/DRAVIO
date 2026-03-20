"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Marketplace;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const colors_1 = require("../theme/colors");
const TunnelMonitor_1 = __importDefault(require("../components/TunnelMonitor"));
const SELLERS = [
    { id: "1", name: "Alpha Relay #01", ping: "14ms", price: "$0.50/GB", location: "Nairobi, KE" },
    { id: "2", name: "Node X-Prime", ping: "22ms", price: "$0.45/GB", location: "Lagos, NG" },
    { id: "3", name: "Starlink B-7", ping: "45ms", price: "$1.20/GB", location: "Cape Town, ZA" },
];
function Marketplace() {
    return (<react_native_1.ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <react_native_1.View style={styles.hero}>
        <react_native_1.Text style={styles.heroTitle}>Limitless Data.</react_native_1.Text>
        <react_native_1.Text style={styles.heroSubTitle}>Connected globally. Secured locally.</react_native_1.Text>
      </react_native_1.View>

      <TunnelMonitor_1.default />

      <react_native_1.Text style={styles.sectionTitle}>High Reliability Sellers</react_native_1.Text>
      {SELLERS.map(s => (<react_native_1.TouchableOpacity key={s.id} style={styles.card}>
          <react_native_1.View style={styles.cardHeader}>
            <react_native_1.View style={styles.relayIcon}/>
            <react_native_1.View>
              <react_native_1.Text style={styles.relayName}>{s.name}</react_native_1.Text>
              <react_native_1.Text style={styles.relayMeta}>{s.location} • {s.ping}</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>
          <react_native_1.View style={styles.cardPrice}>
            <react_native_1.Text style={styles.priceText}>{s.price}</react_native_1.Text>
            <react_native_1.TouchableOpacity style={styles.buyBtn}>
              <react_native_1.Text style={styles.buyBtnText}>BUY</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>
        </react_native_1.TouchableOpacity>))}
    </react_native_1.ScrollView>);
}
const styles = react_native_1.StyleSheet.create({
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
        color: colors_1.Colors.foreground,
        lineHeight: 44,
    },
    heroSubTitle: {
        fontSize: 14,
        color: colors_1.Colors.textMuted,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: colors_1.Colors.foreground,
        marginTop: 32,
        marginBottom: 16,
    },
    card: {
        backgroundColor: colors_1.Colors.surfaceMid,
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
        backgroundColor: colors_1.Colors.surfaceHigh,
        marginRight: 16,
    },
    relayName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors_1.Colors.foreground,
    },
    relayMeta: {
        fontSize: 12,
        color: colors_1.Colors.textMuted,
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
        color: colors_1.Colors.foreground,
    },
    buyBtn: {
        backgroundColor: colors_1.Colors.primary,
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
