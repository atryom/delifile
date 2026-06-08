import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { FileListItem } from '@/types';

const RATINGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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

  const [showPicker, setShowPicker] = useState(false);

  function handleLongPress() {
    const actions: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];

    if (onWatchedToggle) {
      actions.push({
        text: watched ? 'Убрать отметку «Смотрел»' : 'Отметить как просмотренный',
        onPress: () => onWatchedToggle(!watched),
      });
    }
    if (onRatingChange) {
      actions.push({ text: 'Изменить оценку', onPress: () => setShowPicker(true) });
    }
    if (onDelete) {
      actions.push({ text: 'Удалить из списка', style: 'destructive', onPress: onDelete });
    }
    actions.push({ text: 'Отмена', style: 'cancel' });

    Alert.alert(title, undefined, actions);
  }

  function selectRating(r: number) {
    onRatingChange?.(r);
    setShowPicker(false);
  }

  function clearRating() {
    onRatingChange?.(null);
    setShowPicker(false);
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
        {(onWatchedToggle || onRatingChange) && !showPicker && (
          <View style={styles.actions}>
            {onWatchedToggle && (
              <Pressable
                style={[styles.actionBtn, watched && styles.actionBtnActive]}
                onPress={(e) => { e.stopPropagation?.(); onWatchedToggle(!watched); }}
              >
                <Text style={[styles.actionBtnText, watched && styles.actionBtnTextActive]}>
                  {watched ? '👁 Смотрел' : '👁 Отметить'}
                </Text>
              </Pressable>
            )}
            {onRatingChange && (
              <Pressable
                style={styles.actionBtn}
                onPress={(e) => { e.stopPropagation?.(); setShowPicker(true); }}
              >
                <Text style={styles.actionBtnText}>
                  {personalRating !== null && personalRating !== undefined
                    ? `⭐ ${personalRating}/10`
                    : '⭐ Оценить'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Inline rating picker — 0-10 integer buttons */}
        {showPicker && (
          <View style={styles.pickerWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {RATINGS.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.ratingBtn, personalRating === r && styles.ratingBtnActive]}
                  onPress={() => selectRating(r)}
                >
                  <Text style={[styles.ratingBtnText, personalRating === r && styles.ratingBtnTextActive]}>
                    {r}
                  </Text>
                </Pressable>
              ))}
              {personalRating !== null && personalRating !== undefined && (
                <Pressable style={styles.ratingClearBtn} onPress={clearRating}>
                  <Text style={styles.ratingClearText}>✕</Text>
                </Pressable>
              )}
            </ScrollView>
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
  cardWatched: { opacity: 0.6 },
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
  watchedBadge: { fontSize: 14, marginTop: 2 },
  meta: { fontSize: 13, color: '#64748B' },
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
  genreText: { fontSize: 11, color: '#475569' },
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
  actionBtnText: { fontSize: 11, color: '#64748B' },
  actionBtnTextActive: { color: '#6366F1' },

  pickerWrap: {
    marginTop: 4,
  },
  pickerScroll: {
    flexGrow: 0,
  },
  ratingBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  ratingBtnActive: {
    borderColor: '#6366F1',
    backgroundColor: '#6366F1',
  },
  ratingBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  ratingBtnTextActive: { color: '#fff' },
  ratingClearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingClearText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
});
