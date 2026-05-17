import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary
 * Catches runtime JS errors anywhere in the component tree and shows a
 * clean recovery screen instead of a white crash. Required for production.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production: send to crash analytics (e.g. Firebase Crashlytics)
    if (!__DEV__) {
      console.error('[DRAVIO] Uncaught error:', error.message, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            An unexpected error occurred. Your data is safe.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.devError}>{this.state.error.message}</Text>
          )}
          <TouchableOpacity
            style={styles.btn}
            onPress={this.handleReset}
            accessibilityLabel="Retry"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  icon: { fontSize: 56, marginBottom: 24 },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.foreground,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  devError: {
    fontSize: 11,
    color: Colors.danger,
    fontFamily: 'monospace',
    marginBottom: 20,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  btnText: { color: '#000', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
});
