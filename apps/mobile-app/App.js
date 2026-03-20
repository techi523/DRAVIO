"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const colors_1 = require("./src/theme/colors");
const Marketplace_1 = __importDefault(require("./src/screens/Marketplace"));
function App() {
    return (<react_native_1.SafeAreaView style={styles.container}>
      <react_native_1.StatusBar barStyle="light-content"/>
      <react_native_1.View style={styles.header}>
        <react_native_1.Text style={styles.logo}>DRAVIO</react_native_1.Text>
        <react_native_1.View style={styles.statusBadge}>
          <react_native_1.View style={styles.dot}/>
          <react_native_1.Text style={styles.statusText}>SECURE_TUNNEL</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>
      
      <Marketplace_1.default />
      
      <react_native_1.View style={styles.navBar}>
        <react_native_1.Text style={[styles.navItem, { color: colors_1.Colors.primary }]}>MARKET</react_native_1.Text>
        <react_native_1.Text style={styles.navItem}>WALLET</react_native_1.Text>
        <react_native_1.Text style={styles.navItem}>RELAY</react_native_1.Text>
        <react_native_1.Text style={styles.navItem}>PROFILE</react_native_1.Text>
      </react_native_1.View>
    </react_native_1.SafeAreaView>);
}
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors_1.Colors.background,
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
        color: colors_1.Colors.primary,
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
        backgroundColor: colors_1.Colors.primary,
        marginRight: 6,
    },
    statusText: {
        color: colors_1.Colors.primary,
        fontSize: 10,
        fontWeight: '900',
    },
    navBar: {
        height: 80,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: colors_1.Colors.surfaceLow,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    navItem: {
        fontSize: 10,
        fontWeight: '900',
        color: colors_1.Colors.textMuted,
    }
});
