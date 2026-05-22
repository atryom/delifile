import { useRef, useState } from 'react';
import {
  Alert, Linking, ScrollView, Share, StyleSheet, Switch,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  useFile, useDownloadUrl, useToggleFavorite,
  useSetTags, useMoveFolder, useShareToContact, useCreateLink, useDeleteFile,
  useVersionDownload, useActivateVersion,
} from '@/hooks/useFiles';
import { useTags } from '@/hooks/useTags';
import { useFolderTree } from '@/hooks/useFolders';
import type { FolderTreeNode } from '@/types';
import { useContacts } from '@/hooks/useContacts';
import { filesApi } from '@/api/files';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useNetworkStore } from '@/store/network';
import { formatFileSize, formatDateTime } from '@/utils/format';

type ActionPanel = 'tags' | 'folder' | 'share' | 'link' | 'versions';

function flattenTree(
  nodes: FolderTreeNode[],
  depth = 0,
): Array<{ node: FolderTreeNode; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}

const TTL_OPTIONS = [
  { label: '12 часов', hours: 12 },
  { label: '24 часа', hours: 24 },
  { label: '3 дня', hours: 72 },
  { label: '7 дней', hours: 168 },
];

export default function FileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: file, isLoading, isError } = useFile(id);
  const downloadUrl = useDownloadUrl(id);
  const toggleFavorite = useToggleFavorite();
  const setTags = useSetTags(id);
  const moveFolder = useMoveFolder(id);
  const shareToContact = useShareToContact(id);
  const createLink = useCreateLink(id);
  const deleteFile = useDeleteFile();
  const versionDownload = useVersionDownload(id);
  const activateVersion = useActivateVersion(id);
  const isOnline = useNetworkStore((s) => s.isOnline);

  // Version upload state
  type VersionUploadState =
    | { phase: 'idle' }
    | { phase: 'uploading'; name: string; progress: number }
    | { phase: 'error'; name: string; message: string };
  const [versionUpload, setVersionUpload] = useState<VersionUploadState>({ phase: 'idle' });
  const versionTaskRef = useRef<FileSystemLegacy.UploadTask | null>(null);
  const pendingVersionIdRef = useRef<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Action panels
  const [panel, setPanel] = useState<ActionPanel | null>(null);

  // Tags panel
  const { data: allTags } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Folder panel
  const { data: folderTree } = useFolderTree();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Share panel
  const { data: contacts } = useContacts();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Link panel
  const [ttlHours, setTtlHours] = useState(24);
  const [allowSave, setAllowSave] = useState(false);
  const [createdLink, setCreatedLink] = useState<{ url: string; expires_at: string | null } | null>(null);

  function openPanel(p: ActionPanel) {
    if (p === 'tags') setSelectedTagIds(file?.tags.map((t) => t.id) ?? []);
    if (p === 'folder') setSelectedFolderId(file?.folder_id ?? null);
    if (p === 'share') { setSelectedContactId(null); setCanEdit(false); }
    if (p === 'link') { setTtlHours(24); setAllowSave(false); setCreatedLink(null); }
    setPanel(p);
  }

  async function handleDownload() {
    if (!isOnline) {
      Alert.alert('Нет подключения', 'Для скачивания необходимо подключение к сети.');
      return;
    }
    setDownloading(true);
    try {
      const presignedUrl = await downloadUrl.mutateAsync();
      const fileName = file?.display_name ?? file?.original_name ?? 'file';
      const localUri = FileSystemLegacy.cacheDirectory + encodeURIComponent(fileName);

      const { status } = await FileSystemLegacy.downloadAsync(presignedUrl, localUri);
      if (status !== 200) {
        Alert.alert('Ошибка', 'Не удалось скачать файл');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, { dialogTitle: 'Сохранить файл' });
      } else {
        Alert.alert('Готово', 'Файл загружен во временную папку');
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось скачать файл');
    } finally {
      setDownloading(false);
    }
  }

  async function handleSaveTags() {
    try {
      await setTags.mutateAsync(selectedTagIds);
      setPanel(null);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось сохранить теги');
    }
  }

  async function handleMoveFolder() {
    try {
      await moveFolder.mutateAsync(selectedFolderId);
      setPanel(null);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось переместить файл');
    }
  }

  async function handleShare() {
    if (!selectedContactId) return;
    try {
      await shareToContact.mutateAsync({ contact_id: selectedContactId, can_edit: canEdit });
      Alert.alert('Готово', 'Файл отправлен контакту');
      setPanel(null);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось поделиться файлом');
    }
  }

  async function handleVersionDownload(versionId: string, name: string) {
    if (!isOnline) { Alert.alert('Нет подключения', 'Для скачивания нужна сеть.'); return; }
    try {
      const url = await versionDownload.mutateAsync(versionId);
      const localUri = FileSystemLegacy.cacheDirectory + encodeURIComponent(name);
      const { status } = await FileSystemLegacy.downloadAsync(url, localUri);
      if (status !== 200) { Alert.alert('Ошибка', 'Не удалось скачать версию'); return; }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(localUri, { dialogTitle: 'Сохранить файл' });
    } catch {
      Alert.alert('Ошибка', 'Не удалось скачать версию');
    }
  }

  async function handleActivateVersion(versionId: string) {
    try {
      await activateVersion.mutateAsync(versionId);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось переключить версию');
    }
  }

  async function handleVersionUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setVersionUpload({ phase: 'uploading', name: asset.name, progress: 0 });

      let versionId: string;
      let putUrl: string;
      let putHeaders: Record<string, string>;
      try {
        const initRes = await filesApi.initVersionUpload(id, {
          original_name: asset.name,
          size: asset.size ?? 0,
          mime_type: asset.mimeType ?? 'application/octet-stream',
        });
        versionId = initRes.data.data.version.id;
        putUrl = initRes.data.data.upload.url;
        putHeaders = initRes.data.data.upload.headers;
      } catch (e: any) {
        setVersionUpload({ phase: 'error', name: asset.name, message: e.response?.data?.message ?? 'Ошибка инициализации' });
        return;
      }

      pendingVersionIdRef.current = versionId;

      const task = FileSystemLegacy.createUploadTask(
        putUrl, asset.uri,
        { httpMethod: 'PUT', uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT, headers: putHeaders },
        (p) => {
          if (p.totalBytesExpectedToSend > 0) {
            setVersionUpload({ phase: 'uploading', name: asset.name, progress: p.totalBytesSent / p.totalBytesExpectedToSend });
          }
        },
      );
      versionTaskRef.current = task;

      let uploadResult: FileSystemLegacy.FileSystemUploadResult | null | undefined;
      try {
        uploadResult = await task.uploadAsync();
      } catch {
        if (pendingVersionIdRef.current) {
          filesApi.cancelUpload(pendingVersionIdRef.current).catch(() => {});
          pendingVersionIdRef.current = null;
        }
        setVersionUpload({ phase: 'idle' });
        return;
      }
      versionTaskRef.current = null;

      if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
        setVersionUpload({ phase: 'error', name: asset.name, message: `Ошибка S3 (${uploadResult?.status ?? '?'})` });
        filesApi.cancelUpload(versionId).catch(() => {});
        return;
      }

      try {
        await filesApi.completeVersionUpload(id, versionId);
      } catch {
        setVersionUpload({ phase: 'error', name: asset.name, message: 'Файл загружен, но не подтверждён. Попробуйте снова.' });
        return;
      }

      pendingVersionIdRef.current = null;
      setVersionUpload({ phase: 'idle' });
      qc.invalidateQueries({ queryKey: ['file', id] });
      qc.invalidateQueries({ queryKey: ['files'] });
    } catch {
      setVersionUpload({ phase: 'error', name: '', message: 'Произошла ошибка. Попробуйте снова.' });
    }
  }

  function handleCancelVersionUpload() {
    versionTaskRef.current?.cancelAsync().catch(() => {});
    versionTaskRef.current = null;
    if (pendingVersionIdRef.current) {
      filesApi.cancelUpload(pendingVersionIdRef.current).catch(() => {});
      pendingVersionIdRef.current = null;
    }
    setVersionUpload({ phase: 'idle' });
  }

  function handleDeleteConfirm() {
    const isOwner = file?.is_owner;
    Alert.alert(
      isOwner ? 'Удалить файл?' : 'Убрать из моих файлов?',
      isOwner
        ? 'Файл будет удалён для всех пользователей. Это действие нельзя отменить.'
        : 'Файл будет убран из ваших файлов, но останется у владельца.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: isOwner ? 'Удалить' : 'Убрать',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFile.mutateAsync(id);
              router.back();
            } catch (e: any) {
              Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось удалить файл');
            }
          },
        },
      ],
    );
  }

  async function handleCreateLink() {
    try {
      const link = await createLink.mutateAsync({ ttl_hours: ttlHours, allow_save: allowSave });
      setCreatedLink(link);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось создать ссылку');
    }
  }

  if (isLoading) return <Spinner />;

  if (isError || !file) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Не удалось загрузить файл</Text>
        <Button title="Назад" variant="secondary" onPress={() => router.back()} style={styles.btn} />
      </View>
    );
  }

  const name = file.display_name ?? file.original_name;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: name }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => toggleFavorite.mutate({ id: file.id, isFavorite: file.is_favorite })}
            style={styles.iconBtn}
          >
            <Text style={file.is_favorite ? styles.starActive : styles.star}>★</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        {file.content_kind === 'binary_file' && (
          <Row label="Размер" value={formatFileSize(file.size)} />
        )}
        {file.mime_type && <Row label="Тип" value={file.mime_type} />}
        {file.uploaded_at && <Row label="Загружен" value={formatDateTime(file.uploaded_at)} />}
        {file.owner && <Row label="Владелец" value={file.owner.name ?? file.owner.email} />}
        {file.description && <Row label="Описание" value={file.description} />}
        {file.tags.length > 0 && (
          <View style={styles.tags}>
            {file.tags.map((t) => (
              <View key={t.id} style={styles.tag}>
                <Text style={styles.tagText}>{t.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Main action — only when no sub-panel open */}
      {!panel && (
        <>
          {file.content_kind === 'url_file' && file.link_url ? (
            <Button title="Открыть ссылку" onPress={() => Linking.openURL(file.link_url!)} style={styles.btn} />
          ) : (
            <Button
              title={downloading ? 'Скачивание...' : 'Скачать'}
              onPress={handleDownload}
              loading={downloading || downloadUrl.isPending}
              style={styles.btn}
            />
          )}

          {/* Action buttons grid */}
          <View style={styles.actionGrid}>
            <ActionBtn label="🏷 Теги" onPress={() => openPanel('tags')} />
            <ActionBtn label="📁 Переместить" onPress={() => openPanel('folder')} />
            {file.is_owner && <ActionBtn label="👤 Поделиться" onPress={() => openPanel('share')} />}
            {file.is_owner && <ActionBtn label="🔗 Публичная ссылка" onPress={() => openPanel('link')} />}
            {file.content_kind === 'binary_file' && (file.has_versions || file.is_owner) && (
              <ActionBtn label="🕓 Версии" onPress={() => openPanel('versions')} />
            )}
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteConfirm}>
            <Text style={styles.deleteBtnText}>
              {file.is_owner ? '🗑 Удалить файл' : '✕ Убрать из моих файлов'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Versions panel */}
      {panel === 'versions' && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => { setPanel(null); setVersionUpload({ phase: 'idle' }); }} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Версии файла</Text>

          {file.versions.length === 0 && (
            <Text style={styles.emptyText}>Версий пока нет. Загрузите первую версию.</Text>
          )}

          {file.versions
            .slice()
            .sort((a, b) => b.version_number - a.version_number)
            .map((v) => (
              <View key={v.id} style={styles.versionCard}>
                <View style={styles.versionHeader}>
                  <View style={styles.versionBadgeRow}>
                    <View style={styles.versionBadge}>
                      <Text style={styles.versionBadgeText}>v{v.version_number}</Text>
                    </View>
                    {v.is_active && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>активная</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.versionName} numberOfLines={1}>{v.original_name}</Text>
                  <Text style={styles.versionMeta}>
                    {formatFileSize(v.size)}{v.created_at ? ` · ${formatDateTime(v.created_at)}` : ''}
                  </Text>
                </View>
                <View style={styles.versionActions}>
                  <TouchableOpacity
                    style={styles.versionBtn}
                    onPress={() => handleVersionDownload(v.id, v.original_name)}
                  >
                    <Text style={styles.versionBtnText}>⬇ Скачать</Text>
                  </TouchableOpacity>
                  {file.is_owner && !v.is_active && (
                    <TouchableOpacity
                      style={[styles.versionBtn, styles.versionBtnPrimary]}
                      onPress={() => handleActivateVersion(v.id)}
                      disabled={activateVersion.isPending}
                    >
                      <Text style={[styles.versionBtnText, styles.versionBtnPrimaryText]}>
                        {activateVersion.isPending ? '...' : '✓ Активировать'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

          {file.is_owner && (
            <>
              {versionUpload.phase === 'idle' && (
                <Button title="⬆ Загрузить новую версию" onPress={handleVersionUpload} style={styles.btn} />
              )}
              {versionUpload.phase === 'uploading' && (
                <View style={styles.versionUploadBox}>
                  <Text style={styles.uploadName} numberOfLines={1}>{versionUpload.name}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(versionUpload.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>{Math.round(versionUpload.progress * 100)}%</Text>
                  <TouchableOpacity style={styles.cancelUploadBtn} onPress={handleCancelVersionUpload}>
                    <Text style={styles.cancelUploadText}>Отмена</Text>
                  </TouchableOpacity>
                </View>
              )}
              {versionUpload.phase === 'error' && (
                <View style={styles.versionUploadBox}>
                  <Text style={styles.uploadErrorText}>{versionUpload.message}</Text>
                  <Button title="Попробовать снова" onPress={() => setVersionUpload({ phase: 'idle' })} style={styles.btn} />
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Tags panel */}
      {panel === 'tags' && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setPanel(null)} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Теги файла</Text>
          {(allTags?.items ?? []).length === 0 && (
            <Text style={styles.emptyText}>У вас нет тегов. Создайте теги в Настройках.</Text>
          )}
          {(allTags?.items ?? []).map((tag) => {
            const selected = selectedTagIds.includes(tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                style={styles.checkRow}
                onPress={() =>
                  setSelectedTagIds((prev) =>
                    selected ? prev.filter((x) => x !== tag.id) : [...prev, tag.id],
                  )
                }
              >
                <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>{tag.name}</Text>
              </TouchableOpacity>
            );
          })}
          <Button title="Сохранить" onPress={handleSaveTags} loading={setTags.isPending} style={styles.btn} />
        </View>
      )}

      {/* Folder panel */}
      {panel === 'folder' && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setPanel(null)} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Переместить в папку</Text>
          <TouchableOpacity
            style={styles.radioRow}
            onPress={() => setSelectedFolderId(null)}
          >
            <View style={[styles.radio, selectedFolderId === null && styles.radioActive]} />
            <Text style={styles.checkLabel}>Корень (без папки)</Text>
          </TouchableOpacity>
          {flattenTree(folderTree ?? []).map(({ node, depth }) => (
            <TouchableOpacity
              key={node.id}
              style={[styles.radioRow, { paddingLeft: depth * 20 }]}
              onPress={() => setSelectedFolderId(node.id)}
            >
              <View style={[styles.radio, selectedFolderId === node.id && styles.radioActive]} />
              <Text style={styles.checkLabel}>{node.name}</Text>
            </TouchableOpacity>
          ))}
          <Button title="Переместить" onPress={handleMoveFolder} loading={moveFolder.isPending} style={styles.btn} />
        </View>
      )}

      {/* Share panel */}
      {panel === 'share' && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setPanel(null)} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Поделиться с контактом</Text>
          {(contacts ?? []).length === 0 && (
            <Text style={styles.emptyText}>Нет контактов. Добавьте контакты во вкладке «Связи».</Text>
          )}
          {(contacts ?? []).map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.radioRow}
              onPress={() => setSelectedContactId(c.id)}
            >
              <View style={[styles.radio, selectedContactId === c.id && styles.radioActive]} />
              <View>
                <Text style={styles.checkLabel}>{c.name}</Text>
                {c.email && <Text style={styles.subLabel}>{c.email}</Text>}
              </View>
            </TouchableOpacity>
          ))}
          <View style={styles.switchRow}>
            <Text style={styles.checkLabel}>Разрешить редактирование</Text>
            <Switch value={canEdit} onValueChange={setCanEdit} />
          </View>
          <Button
            title="Отправить"
            onPress={handleShare}
            loading={shareToContact.isPending}
            disabled={!selectedContactId}
            style={styles.btn}
          />
        </View>
      )}

      {/* Link panel */}
      {panel === 'link' && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setPanel(null)} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Публичная ссылка</Text>

          {!createdLink ? (
            <>
              <Text style={styles.fieldLabel}>Срок действия</Text>
              <View style={styles.ttlGrid}>
                {TTL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.hours}
                    style={[styles.ttlBtn, ttlHours === opt.hours && styles.ttlBtnActive]}
                    onPress={() => setTtlHours(opt.hours)}
                  >
                    <Text style={[styles.ttlLabel, ttlHours === opt.hours && styles.ttlLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.checkLabel}>Разрешить сохранение</Text>
                <Switch value={allowSave} onValueChange={setAllowSave} />
              </View>
              <Button title="Создать ссылку" onPress={handleCreateLink} loading={createLink.isPending} style={styles.btn} />
            </>
          ) : (
            <>
              <Text style={styles.linkUrl} selectable>{createdLink.url}</Text>
              {createdLink.expires_at && (
                <Text style={styles.subLabel}>
                  Действует до: {formatDateTime(createdLink.expires_at)}
                </Text>
              )}
              <Button
                title="Поделиться ссылкой"
                onPress={() => Share.share({ message: createdLink.url })}
                style={styles.btn}
              />
              <Button
                title="Создать ещё одну"
                variant="secondary"
                onPress={() => setCreatedLink(null)}
                style={styles.btn}
              />
            </>
          )}
        </View>
      )}

      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Назад</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ActionBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1E293B', lineHeight: 28 },
  actions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  star: { fontSize: 22, color: '#CBD5E1' },
  starActive: { fontSize: 22, color: '#F59E0B' },
  meta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontSize: 14, color: '#94A3B8', flex: 1 },
  rowValue: { fontSize: 14, color: '#1E293B', flex: 2, textAlign: 'right' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  btn: { marginTop: 4 },
  back: { paddingVertical: 8 },
  backText: { color: '#2563EB', fontSize: 15 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },

  // Action grid
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  actionBtnText: { fontSize: 14, color: '#1E293B', fontWeight: '500' },

  // Panels
  panel: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  panelTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },

  // Checkboxes
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 15, color: '#1E293B' },
  subLabel: { fontSize: 12, color: '#94A3B8', marginTop: 1 },

  // Radio
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1' },
  radioActive: { borderColor: '#2563EB', backgroundColor: '#2563EB' },

  // Switch row
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },

  // TTL
  fieldLabel: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  ttlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ttlBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  ttlBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  ttlLabel: { fontSize: 13, color: '#64748B' },
  ttlLabelActive: { color: '#2563EB', fontWeight: '600' },

  // Versions
  versionCard: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  versionHeader: { gap: 3 },
  versionBadgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 2 },
  versionBadge: { backgroundColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  versionBadgeText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  activeBadge: { backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { fontSize: 12, fontWeight: '600', color: '#065F46' },
  versionName: { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  versionMeta: { fontSize: 12, color: '#94A3B8' },
  versionActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  versionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  versionBtnPrimary: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  versionBtnText: { fontSize: 13, color: '#475569' },
  versionBtnPrimaryText: { color: '#2563EB', fontWeight: '600' },
  versionUploadBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  uploadName: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  progressTrack: { width: '100%', height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 4 },
  progressLabel: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  cancelUploadBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelUploadText: { fontSize: 14, color: '#64748B' },
  uploadErrorText: { fontSize: 13, color: '#EF4444', textAlign: 'center' },

  // Created link
  linkUrl: { fontSize: 13, color: '#2563EB', backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12, lineHeight: 20 },

  // Delete
  deleteBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  deleteBtnText: { fontSize: 15, color: '#EF4444', fontWeight: '500' },
});
