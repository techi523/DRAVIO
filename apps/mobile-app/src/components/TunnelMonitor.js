"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TunnelMonitor;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const colors_1 = require("../theme/colors");
function TunnelMonitor() {
    return (<react_native_1.View style={styles.container}>
      <react_native_1.View style={styles.header}>
        <react_native_1.View>
          <react_native_1.Text style={styles.label}>Active Session</react_native_1.Text>
          <react_native_1.Text style={styles.nodeName}>Alpha Relay #01</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.View style={styles.pulseContainer}>
          <react_native_1.View style={styles.pulse}/>
          <react_native_1.Text style={styles.liveText}>LIVE</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      <react_native_1.View style={styles.stats}>
        <react_native_1.View>
          <react_native_1.Text style={styles.statLabel}>Usage</react_native_1.Text>
          <react_native_1.Text style={styles.statValue}>412.5 <react_native_1.Text style={styles.unit}>MB</react_native_1.Text></react_native_1.Text>
        </react_native_1.View>
        <react_native_1.View>
          <react_native_1.Text style={styles.statLabel}>Speed</react_native_1.Text>
          <react_native_1.Text style={styles.statValue}>12.4 <react_native_1.Text style={styles.unit}>Mbps</react_native_1.Text></react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      <react_native_1.View style={styles.progressBg}>
        <react_native_1.View style={styles.progressFill}/>
      </react_native_1.View>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    container: {
        backgroundColor: colors_1.Colors.surfaceHigh,
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,242,255,0.2)',
        shadowColor: colors_1.Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: colors_1.Colors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    nodeName: {
        fontSize: 20,
        fontWeight: '900',
        color: colors_1.Colors.foreground,
    },
    pulseContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,242,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    pulse: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors_1.Colors.primary,
        marginRight: 6,
    },
    liveText: {
        color: colors_1.Colors.primary,
        fontSize: 10,
        fontWeight: 'bold',
    },
    stats: {
        flexDirection: 'row',
        gap: 40,
        marginBottom: 20,
    },
    statLabel: {
        fontSize: 10,
        color: colors_1.Colors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '900',
        color: colors_1.Colors.foreground,
    },
    unit: {
        fontSize: 12,
        color: colors_1.Colors.textMuted,
    },
    progressBg: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        width: '40%',
        backgroundColor: colors_1.Colors.primary,
        shadowColor: colors_1.Colors.primary,
        shadowRadius: 5,
        shadowOpacity: 0.5,
    }
});
