import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useThemeColors } from '../theme/useThemeColors';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  passwordToggle?: boolean;
  leftElement?: React.ReactNode;
}

export default function Input({
  label,
  error,
  containerStyle,
  passwordToggle,
  leftElement,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const isActuallySecure = passwordToggle ? !isPasswordVisible : secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>}
      
      <View style={[
        styles.inputWrapper,
        {
          backgroundColor: colors.inputBackground,
          borderColor: error ? colors.danger : isFocused ? colors.inputFocusBorder : colors.inputBorder,
        }
      ]}>
        {leftElement && <View style={styles.leftElementContainer}>{leftElement}</View>}
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <TextInput
          style={[
            styles.input,
            { color: colors.inputText },
            style,
          ]}
          placeholderTextColor={colors.inputPlaceholder}
          selectionColor={colors.cursor}
          secureTextEntry={isActuallySecure}
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize}
          autoCorrect={props.autoCorrect}
          returnKeyType={props.returnKeyType}
          accessibilityLabel={props.accessibilityLabel}
          onSubmitEditing={props.onSubmitEditing}
          autoFocus={props.autoFocus}
          maxLength={props.maxLength}
        />
        {passwordToggle && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={togglePasswordVisibility}
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 16, color: colors.textMuted }}>
              {isPasswordVisible ? '👁️' : '🙈'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  leftElementContainer: {
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
});
