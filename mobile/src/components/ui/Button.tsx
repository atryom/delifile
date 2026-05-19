import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

interface Props extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({ title, variant = 'primary', loading, style, disabled, ...rest }: Props) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#2563EB'} />
      ) : (
        <Text style={[styles.text, variant !== 'primary' && styles.textAlt]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: '#2563EB' },
  secondary: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  danger: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  disabled: { opacity: 0.5 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
  textAlt: { color: '#2563EB' },
});
