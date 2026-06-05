import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { FileListItem } from '@/types';

interface Props {
  item: FileListItem;
}

export function MovieCard({ item }: Props) {
  const meta = item.custom_metadata;
  const poster = meta?.poster_url ?? item.link_image_url;
  const title  = item.display_name ?? item.original_name;
  const year   = meta?.year;
  const rating = meta?.rating_kp;
  const genres = meta?.genres?.slice(0, 2) ?? [];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/files/${item.id}` as any)}
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
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {(year || rating) && (
          <Text style={styles.meta}>
            {year ? String(year) : ''}
            {year && rating ? '  ·  ' : ''}
            {rating ? `★ ${rating}` : ''}
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
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
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
});
