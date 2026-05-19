import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor="#94A3B8"
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151' },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#EF4444' },
  error: { fontSize: 12, color: '#EF4444' },
});
