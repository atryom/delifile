import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { FileListItem } from '@/types';

interface Props {
  item: FileListItem;
  onDelete?: () => void;
  onWatchedToggle?: (watched: boolean) => void;
  onRatingChange?: (rating: number | null) => void;
}

export function MovieCard({ item, onDelete, onWatchedToggle, onRatingChange }: Props) {
  const meta   = item.custom_metadata;
  const poster = meta?.poster_url ?? item.link_image_url;
  const title  = item.display_name ?? item.original_name;
  const year   = meta?.year;
  const rating = meta?.rating_kp;
  const genres = meta?.genres?.slice(0, 2) ?? [];

  const watched        = !!(meta as any)?.watched;
  const personalRating = (meta as any)?.personal_rating as number | null | undefined;

  const [editingRating, setEditingRating] = useState(false);
  const [ratingDraft,   setRatingDraft]   = useState('');

  function handleLongPress() {
    const actions: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];

    if (onWatchedToggle) {
      actions.push({
        text: watched ? 'Убрать отметку «Смотрел»' : 'Отметить как просмотренный',
        onPress: () => onWatchedToggle(!watched),
      });
    }
    if (onRatingChange) {
      actions.push({ text: 'Изменить оценку', onPress: openRatingEdit });
    }
    if (onDelete) {
      actions.push({ text: 'Удалить из списка', style: 'destructive', onPress: onDelete });
    }
    actions.push({ text: 'Отмена', style: 'cancel' });

    Alert.alert(title, undefined, actions);
  }

  function openRatingEdit() {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Личная оценка',
        'Введите оценку от 0 до 10',
        (text) => {
          if (text === null || text === undefined) return;
          const trimmed = text.trim();
          if (trimmed === '') { onRatingChange?.(null); return; }
          const num = parseFloat(trimmed);
          if (!isNaN(num)) onRatingChange?.(Math.min(10, Math.max(0, num)));
        },
        'plain-text',
        personalRating !== null && personalRating !== undefined ? String(personalRating) : '',
        'numeric',
      );
    } else {
      setRatingDraft(personalRating !== null && personalRating !== undefined ? String(personalRating) : '');
      setEditingRating(true);
    }
  }

  function commitRating() {
    const trimmed = ratingDraft.trim();
    if (trimmed === '') { onRatingChange?.(null); }
    else {
      const num = parseFloat(trimmed);
      if (!isNaN(num)) onRatingChange?.(Math.min(10, Math.max(0, num)));
    }
    setEditingRating(false);
  }

  return (
    <TouchableOpacity
      style={[styles.card, watched && styles.cardWatched]}
      onPress={() => router.push(`/(app)/files/${item.id}` as any)}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: poster ?? undefined }}
        style={styles.poster}
        contentFit="cover"
        placeholderContentFit="cover"
        transition={150}
      />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {watched && <Text style={styles.watchedBadge}>👁</Text>}
        </View>
        {(year || rating) && (
          <Text style={styles.meta}>
            {year ? String(year) : ''}
            {year && rating ? '  ·  ' : ''}
            {rating ? `★ ${rating}` : ''}
            {personalRating !== null && personalRating !== undefined
              ? `  ·  👤 ${personalRating}/10`
              : ''}
          </Text>
        )}
        {genres.length > 0 && (
          <View style={styles.genres}>
            {genres.map((g) => (
              <View key={g} style={styles.genreTag}>
                <Text style={styles.genreText}>{g}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick action buttons */}
        {(onWatchedToggle || onRatingChange) && (
          <View style={styles.actions}>
            {onWatchedToggle && (
              <Pressable
                style={[styles.actionBtn, watched && styles.actionBtnActive]}
                onPress={(e) => { e.stopPropagation?.(); onWatchedToggle(!watched); }}
                accessibilityLabel={watched ? 'Убрать отметку просмотрено' : 'Отметить как просмотренный'}
              >
                <Text style={[styles.actionBtnText, watched && styles.actionBtnTextActive]}>
                  {watched ? '👁 Смотрел' : '👁 Отметить'}
                </Text>
              </Pressable>
            )}
            {onRatingChange && !editingRating && (
              <Pressable
                style={styles.actionBtn}
                onPress={(e) => { e.stopPropagation?.(); openRatingEdit(); }}
                accessibilityLabel="Изменить личную оценку"
              >
                <Text style={styles.actionBtnText}>
                  {personalRating !== null && personalRating !== undefined
                    ? `⭐ ${personalRating}/10`
                    : '⭐ Оценить'}
                </Text>
              </Pressable>
            )}
            {editingRating && (
              <View style={styles.ratingInputRow}>
                <TextInput
                  style={styles.ratingInput}
                  value={ratingDraft}
                  onChangeText={setRatingDraft}
                  keyboardType="numeric"
                  placeholder="0–10"
                  autoFocus
                  onSubmitEditing={commitRating}
                  onBlur={commitRating}
                  maxLength={4}
                />
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardWatched: {
    opacity: 0.6,
  },
  poster: {
    width: 80,
    height: 120,
    backgroundColor: '#E2E8F0',
  },
  info: {
    flex: 1,
    padding: 12,
    gap: 6,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
  },
  watchedBadge: {
    fontSize: 14,
    marginTop: 2,
  },
  meta: {
    fontSize: 13,
    color: '#64748B',
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  genreTag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  genreText: {
    fontSize: 11,
    color: '#475569',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionBtnActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EDE9FE',
  },
  actionBtnText: {
    fontSize: 11,
    color: '#64748B',
  },
  actionBtnTextActive: {
    color: '#6366F1',
  },
  ratingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingInput: {
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 13,
    width: 60,
    color: '#1E293B',
  },
});
