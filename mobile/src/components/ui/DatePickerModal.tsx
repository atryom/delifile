import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

export function isoToDisplayRu(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function isoToDate(iso: string | null): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

function dateToIso(date: Date): string {
  return date.toISOString();
}

interface Props {
  visible: boolean;
  value: string | null;
  onConfirm: (iso: string) => void;
  onCancel: () => void;
}

// Android: shows date dialog first, then time dialog sequentially
// iOS: Modal with inline spinner + Done/Cancel buttons
export function DatePickerModal({ visible, value, onConfirm, onCancel }: Props) {
  const [phase, setPhase] = useState<'date' | 'time'>('date');
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [iosDate, setIosDate] = useState<Date>(isoToDate(value));

  // Reset iOS local state when picker opens
  useEffect(() => {
    if (visible) {
      setIosDate(isoToDate(value));
    }
  }, [visible, value]);

  if (!visible) return null;

  const currentValue = isoToDate(value);

  if (Platform.OS === 'android') {
    if (phase === 'date') {
      return (
        <DateTimePicker
          value={currentValue}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            if (event.type === 'dismissed') {
              onCancel();
              return;
            }
            if (selectedDate) {
              setPendingDate(selectedDate);
              setPhase('time');
            } else {
              onCancel();
            }
          }}
        />
      );
    }
    // time phase
    const baseDate = pendingDate ?? currentValue;
    return (
      <DateTimePicker
        value={baseDate}
        mode="time"
        display="default"
        is24Hour
        onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
          setPhase('date');
          setPendingDate(null);
          if (event.type === 'dismissed') {
            const d = new Date(baseDate);
            d.setHours(0, 0, 0, 0);
            onConfirm(dateToIso(d));
            return;
          }
          if (selectedDate) {
            onConfirm(dateToIso(selectedDate));
          } else {
            onCancel();
          }
        }}
      />
    );
  }

  // iOS — modal wrapper with Done/Cancel
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Выберите дату</Text>
            <TouchableOpacity onPress={() => onConfirm(dateToIso(iosDate))} style={styles.headerBtn}>
              <Text style={styles.doneText}>Готово</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={iosDate}
            mode="datetime"
            display="spinner"
            locale="ru_RU"
            style={styles.picker}
            onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
              if (selectedDate) setIosDate(selectedDate);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { minWidth: 64 },
  title: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  cancelText: { fontSize: 16, color: '#64748B' },
  doneText: { fontSize: 16, fontWeight: '600', color: '#2563EB', textAlign: 'right' },
  picker: { height: 200 },
});
