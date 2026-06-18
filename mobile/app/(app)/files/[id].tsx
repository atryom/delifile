import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, BackHandler, Linking, Platform, ScrollView, Share, StyleSheet, Switch,
  Text, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { pickFileAsset } from '@/utils/pickFileAsset';
import {
  useFile, useDownloadUrl, useToggleFavorite, useTogglePin,
  useSetTags, useShareToContact, useCreateLink, useDeleteFile,
  useVersionDownload, useActivateVersion,
  useFileLinks, useDisableFileLink, useFileAccesses, useRevokeAccess, useUpdateAccess,
  useUpdateTask,
} from '@/hooks/useFiles';
import { useTags } from '@/hooks/useTags';
import { useSharedFolderAllFlat } from '@/hooks/useSharedFolders';
import { commentsApi } from '@/api/comments';
import { sharedFoldersApi } from '@/api/shared-folders';
import type { SharedFolder, TaskStatus } from '@/types';
import { useContacts } from '@/hooks/useContacts';
import { filesApi } from '@/api/files';
import { Spinner } from '@/components/ui/Spinner';
import { GalleryViewer } from '@/components/ui/GalleryViewer';
import { Button } from '@/components/ui/Button';
import { DatePickerModal, isoToDisplayRu } from '@/components/ui/DatePickerModal';
import { Image } from 'expo-image';
import { useNetworkStore } from '@/store/network';
import { formatFileSize, formatDateTime } from '@/utils/format';
import { getApiError } from '@/utils/error';

type ActionPanel = 'tags' | 'folder' | 'versions' | 'access' | 'task' | 'links-list';

const TASK_STATUSES: Array<{ value: TaskStatus; label: string }> = [
  { value: 'template', label: 'Шаблон' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'under_review', label: 'На проверке' },
  { value: 'completed', label: 'Выполнено' },
];

const TTL_OPTIONS = [
  { label: '12 часов', hours: 12 },
  { label: '24 часа', hours: 24 },
  { label: '3 дня', hours: 72 },
  { label: '7 дней', hours: 168 },
];

export default function FileDetailScreen() {
  const { id, ctx_folder_id } = useLocalSearchParams<{ id: string; ctx_folder_id?: string }>();
  // ctx_folder_id — shared folder the file was opened from (passed by shared-folders/[id] screen)
  const contextFolderId = Array.isArray(ctx_folder_id) ? ctx_folder_id[0] : (ctx_folder_id || null);
  const qc = useQueryClient();
  const { data: file, isLoading, isError } = useFile(id);
  const downloadUrl = useDownloadUrl(id);
  const toggleFavorite = useToggleFavorite();
  const togglePin = useTogglePin();
  const setTags = useSetTags(id);
  const shareToContact = useShareToContact(id);
  const createLink = useCreateLink(id);
  const deleteFile = useDeleteFile();
  const versionDownload = useVersionDownload(id);
  const activateVersion = useActivateVersion(id);
  const isOnline = useNetworkStore((s) => s.isOnline);

  const { data: commentThreads } = useQuery({
    queryKey: ['comment-threads', id],
    queryFn: () => commentsApi.getThreads('file', id, contextFolderId ?? undefined).then((r) => r.data.data),
    enabled: !!id,
    staleTime: 1000 * 60,
  });
  const commentUnread = (commentThreads?.threads.shared?.unread_count ?? 0) +
    (commentThreads?.threads.private?.unread_count ?? 0);
  const fileLinks = useFileLinks(id);
  const disableFileLink = useDisableFileLink(id);
  const fileAccesses = useFileAccesses(id);
  const revokeAccess = useRevokeAccess(id);
  const updateAccess = useUpdateAccess(id);
  const updateTask = useUpdateTask(id);

  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);

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

  // Android back — close panel instead of navigating away
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panel !== null) {
        setPanel(null);
        setDatePickerTarget(null);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [panel]);

  // Tags panel
  const { data: allTags } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Folder panel: shared folders where user can write (excluding personal root, which isn't browsable in mobile)
  const { data: allFolders } = useSharedFolderAllFlat();
  const writableFolders = useMemo(
    () => (allFolders ?? []).filter((f) => !f.is_personal_root && (f.is_owner || f.my_access_type === 'edit')),
    [allFolders],
  );
  const folderTree = useMemo(() => buildFolderTree(writableFolders), [writableFolders]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Share panel
  const { data: contacts } = useContacts();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Link panel
  const [ttlHours, setTtlHours] = useState(24);
  const [allowSave, setAllowSave] = useState(false);
  const [createdLink, setCreatedLink] = useState<{ url: string; expires_at: string | null } | null>(null);

  // Task panel
  const [taskIsTask, setTaskIsTask] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('template');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssigneeUserId, setTaskAssigneeUserId] = useState<number | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'due' | null>(null);

  // Access panel — grant access sub-state
  const [grantContactId, setGrantContactId] = useState<string | null>(null);
  const [grantCanEdit, setGrantCanEdit] = useState(false);
  const [showingGrant, setShowingGrant] = useState(false);

  function openPanel(p: ActionPanel) {
    if (p === 'tags') setSelectedTagIds(file?.tags.map((t) => t.id) ?? []);
    if (p === 'folder') setSelectedFolderId(file?.folder_id ?? null);
    if (p === 'task') {
      setTaskIsTask(file?.is_task ?? false);
      setTaskStatus(file?.task_status ?? 'template');
      setTaskStartDate(file?.task_start_date ?? '');
      setTaskDueDate(file?.task_due_date ?? '');
      setTaskAssigneeUserId(file?.task_assigned_user ? Number(file.task_assigned_user.id) : null);
    }
    if (p === 'access') { setShowingGrant(false); setGrantContactId(null); setGrantCanEdit(false); }
    if (p === 'links-list') { setTtlHours(24); setAllowSave(false); setCreatedLink(null); }
    setPanel(p);
  }

  async function handleDownload() {
    if (!isOnline) {
      Alert.alert('Нет подключения', 'Для открытия необходимо подключение к сети.');
      return;
    }
    setDownloading(true);
    try {
      const presignedUrl = await downloadUrl.mutateAsync();
      // Download to cache first: avoids S3 URL re-encoding on iOS (SignatureDoesNotMatch)
      const fileName = (file?.display_name ?? file?.original_name ?? 'file')
        .replace(/[/\\?%*:|"<>]/g, '_');
      const localUri = FileSystemLegacy.cacheDirectory + fileName;
      const { status } = await FileSystemLegacy.downloadAsync(presignedUrl, localUri);
      if (status !== 200) { Alert.alert('Ошибка', 'Не удалось скачать файл'); return; }
      const mimeType = file?.mime_type ?? 'application/octet-stream';
      if (Platform.OS === 'android') {
        const contentUri = await FileSystemLegacy.getContentURIAsync(localUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: mimeType,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        });
      } else {
        await Sharing.shareAsync(localUri, { mimeType, dialogTitle: 'Открыть файл' });
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть файл');
    } finally {
      setDownloading(false);
    }
  }

  async function handleSaveTags() {
    try {
      await setTags.mutateAsync(selectedTagIds);
      setPanel(null);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось сохранить теги'));
    }
  }

  async function handleMoveFolder() {
    try {
      // file.folder_id may be null for files added to shared folders via other means;
      // fall back to contextFolderId (the folder the screen was opened from)
      const oldFolderId = file?.folder_id || contextFolderId || null;
      const isOwner = file?.is_owner ?? false;

      // Перемещение обратно в корень: убираем из текущей папки
      if (selectedFolderId === null) {
        const folderToRemoveFrom = oldFolderId || contextFolderId;
        if (!folderToRemoveFrom) return;
        await sharedFoldersApi.removeFile(folderToRemoveFrom, id);
        qc.invalidateQueries({ queryKey: ['file', id] });
        qc.invalidateQueries({ queryKey: ['shared-folders'] });
        qc.invalidateQueries({ queryKey: ['files'] });
        setPanel(null);
        return;
      }

      if (oldFolderId && oldFolderId !== selectedFolderId) {
        // Перемещение из одной общей папки в другую — последовательно для атомарности
        await sharedFoldersApi.removeFile(oldFolderId, id);
        try {
          await sharedFoldersApi.addFile(selectedFolderId, id);
        } catch (addErr) {
          // Откатываем: возвращаем файл в исходную папку
          await sharedFoldersApi.addFile(oldFolderId, id).catch(() => {});
          throw addErr;
        }
      } else if (isOwner) {
        // Владелец переносит из корня — { move: true } просит бэкенд убрать из личных файлов
        await sharedFoldersApi.addFile(selectedFolderId, id, true);
      } else {
        // Не владелец: сначала добавляем в папку, затем явно убираем личную копию
        await sharedFoldersApi.addFile(selectedFolderId, id);
        await filesApi.delete(id);
      }

      qc.removeQueries({ queryKey: ['file', id] });
      qc.invalidateQueries({ queryKey: ['shared-folders'] });
      qc.invalidateQueries({ queryKey: ['files'] });
      setPanel(null);
      router.back();
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось переместить файл'));
    }
  }

  async function handleShare() {
    if (!selectedContactId) return;
    try {
      await shareToContact.mutateAsync({ contact_id: selectedContactId, can_edit: canEdit });
      Alert.alert('Готово', 'Файл отправлен контакту');
      setPanel(null);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось поделиться файлом'));
    }
  }

  async function handleVersionDownload(versionId: string, name: string) {
    if (!isOnline) { Alert.alert('Нет подключения', 'Для скачивания нужна сеть.'); return; }
    try {
      const url = await versionDownload.mutateAsync(versionId);
      const safeFileName = name.replace(/[/\\?%*:|"<>]/g, '_');
      const localUri = FileSystemLegacy.cacheDirectory + safeFileName;
      const { status } = await FileSystemLegacy.downloadAsync(url, localUri);
      if (status !== 200) { Alert.alert('Ошибка', 'Не удалось скачать версию'); return; }
      const mimeType = file?.mime_type ?? 'application/octet-stream';
      await Sharing.shareAsync(localUri, { mimeType, dialogTitle: 'Открыть версию файла' });
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть версию');
    }
  }

  async function handleActivateVersion(versionId: string) {
    try {
      await activateVersion.mutateAsync(versionId);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось переключить версию'));
    }
  }

  async function handleVersionUpload() {
    try {
      const asset = await pickFileAsset();
      if (!asset) return;

      setVersionUpload({ phase: 'uploading', name: asset.name, progress: 0 });

      let versionId: string;
      let putUrl: string;
      let putHeaders: Record<string, string>;
      try {
        const initRes = await filesApi.initVersionUpload(id, {
          original_name: asset.name,
          size: asset.size,
          mime_type: asset.mimeType,
        });
        versionId = initRes.data.data.version.id;
        putUrl = initRes.data.data.upload.url;
        putHeaders = initRes.data.data.upload.headers;
      } catch (e) {
        setVersionUpload({ phase: 'error', name: asset.name, message: getApiError(e, 'Ошибка инициализации') });
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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              await deleteFile.mutateAsync(id);
              router.back();
            } catch (e) {
              Alert.alert('Ошибка', getApiError(e, 'Не удалось удалить файл'));
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
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось создать ссылку'));
    }
  }

  async function handleSaveTask() {
    try {
      await updateTask.mutateAsync({
        is_task: taskIsTask,
        task_status: taskIsTask ? taskStatus : null,
        task_start_date: taskIsTask && taskStartDate ? taskStartDate : null,
        task_due_date: taskIsTask && taskDueDate ? taskDueDate : null,
        task_assigned_user_id: taskIsTask ? taskAssigneeUserId : null,
      });
      setPanel(null);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось сохранить задачу'));
    }
  }

  async function handleGrantAccess() {
    if (!grantContactId) return;
    try {
      await shareToContact.mutateAsync({ contact_id: grantContactId, can_edit: grantCanEdit });
      setShowingGrant(false);
      setGrantContactId(null);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось предоставить доступ'));
    }
  }

  async function handleRevokeAccess(contactId: string, name: string) {
    Alert.alert(`Отозвать доступ у ${name}?`, undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Отозвать',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await revokeAccess.mutateAsync(contactId);
          } catch (e) {
            Alert.alert('Ошибка', getApiError(e, 'Не удалось отозвать доступ'));
          }
        },
      },
    ]);
  }

  async function handleDisableLink(linkId: string) {
    try {
      await disableFileLink.mutateAsync(linkId);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось деактивировать ссылку'));
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

  const rawName = file.display_name ?? file.original_name;
  const name = file.mime_type === 'text/markdown' ? rawName.replace(/\.md$/i, '') : rawName;
  const isMovie = file.content_kind === 'movie_item';
  const movie = isMovie ? (file as any).custom_metadata : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: isMovie ? (movie?.title ?? name) : name }} />

      {/* ── Movie hero block ── */}
      {isMovie && movie && (
        <View style={styles.movieHero}>
          {movie.poster_url ? (
            <Image
              source={{ uri: movie.poster_url }}
              style={styles.moviePoster}
              contentFit="cover"
              placeholderContentFit="cover"
            />
          ) : (
            <View style={[styles.moviePoster, styles.moviePosterPlaceholder]}>
              <Text style={styles.moviePosterEmoji}>🎬</Text>
            </View>
          )}
          <View style={styles.movieMeta}>
            <Text style={styles.movieTitle}>{movie.title ?? name}</Text>
            <View style={styles.movieRow}>
              {movie.year  && <Text style={styles.movieYear}>{movie.year}</Text>}
              {movie.rating_kp && <Text style={styles.movieRating}>★ {movie.rating_kp}</Text>}
            </View>
            {movie.director && (
              <Text style={styles.movieDirector}>Реж. {movie.director}</Text>
            )}
            {movie.genres?.length > 0 && (
              <View style={styles.movieGenres}>
                {movie.genres.slice(0, 4).map((g: string) => (
                  <View key={g} style={styles.genreTag}>
                    <Text style={styles.genreTagText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {isMovie && movie?.description && (
        <View style={styles.movieDescription}>
          <Text style={styles.movieDescriptionText}>{movie.description}</Text>
        </View>
      )}

      {isMovie && movie?.kp_url && (
        <TouchableOpacity
          style={styles.kpBtn}
          onPress={() => Linking.openURL(movie.kp_url)}
        >
          <Text style={styles.kpBtnText}>🎬 Открыть на Кинопоиске</Text>
        </TouchableOpacity>
      )}

      {/* Header (для не-фильмов — название и избранное) */}
      {!isMovie && (
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => togglePin.mutate({ id: file.id, isPinned: file.is_pinned ?? false })}
              style={styles.iconBtn}
            >
              <Text style={(file.is_pinned) ? styles.starActive : styles.star}>📌</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleFavorite.mutate({ id: file.id, isFavorite: file.is_favorite })}
              style={styles.iconBtn}
            >
              <Text style={file.is_favorite ? styles.starActive : styles.star}>★</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Баннер ограниченного доступа для не-владельцев */}
      {!isMovie && !file.is_owner && (
        <View style={styles.accessLimitBanner}>
          <Text style={styles.accessLimitText}>ℹ️ Ограниченный доступ — нельзя создать ссылку и удалить файл</Text>
        </View>
      )}

      {isMovie && (
        <View style={styles.movieFavoriteRow}>
          <TouchableOpacity
            onPress={() => toggleFavorite.mutate({ id: file.id, isFavorite: file.is_favorite })}
            style={styles.movieFavoriteBtn}
          >
            <Text style={[styles.star, file.is_favorite && styles.starActive]}>
              {file.is_favorite ? '★ В избранном' : '☆ В избранное'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Meta — скрываем техническую информацию для фильмов */}
      <View style={styles.meta}>
        {!isMovie && file.content_kind === 'binary_file' && (
          <Row label="Размер" value={formatFileSize(file.size)} />
        )}
        {!isMovie && file.mime_type && <Row label="Тип" value={file.mime_type} />}
        {!isMovie && file.uploaded_at && <Row label="Загружен" value={formatDateTime(file.uploaded_at)} />}
        {!isMovie && file.owner && <Row label="Владелец" value={file.owner.name ?? file.owner.email} />}
        {file.description && <Row label="Описание" value={file.description} />}
        {file.is_task && file.task_status && (
          <Row label="Задача" value={TASK_STATUSES.find((s) => s.value === file.task_status)?.label ?? file.task_status} />
        )}
        {file.is_task && file.task_assigned_user && (
          <Row label="Исполнитель" value={file.task_assigned_user.name ?? file.task_assigned_user.email} />
        )}
        {file.is_task && file.task_start_date && (
          <Row label="Начало" value={isoToDisplayRu(file.task_start_date)} />
        )}
        {file.is_task && file.task_due_date && (
          <Row label="Срок" value={isoToDisplayRu(file.task_due_date)} />
        )}
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
          {/* Markdown document actions */}
          {file.mime_type === 'text/markdown' && (
            <View style={styles.docActions}>
              <TouchableOpacity
                style={[styles.docBtn, styles.docBtnPrimary]}
                onPress={() => router.push(`/(app)/files/edit/${file.id}` as any)}
              >
                <Text style={styles.docBtnPrimaryText}>✏️ Редактировать</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.docBtn}
                onPress={() => router.push(`/(app)/files/view/${file.id}` as any)}
              >
                <Text style={styles.docBtnText}>👁 Просмотреть</Text>
              </TouchableOpacity>
            </View>
          )}

          {file.content_kind === 'url_file' && file.link_url ? (
            <Button title="Открыть ссылку" onPress={() => Linking.openURL(file.link_url!)} style={styles.btn} />
          ) : file.content_kind !== 'movie_item' && file.mime_type !== 'text/markdown' ? (
            <>
              {/* Image / video — inline preview + viewer */}
              {(file.mime_type?.startsWith('image/') || file.mime_type?.startsWith('video/')) && (
                <TouchableOpacity
                  style={styles.previewContainer}
                  onPress={() => setMediaViewerOpen(true)}
                  onLongPress={() => {
                    const isOwner = file?.is_owner ?? false;
                    const buttons: Parameters<typeof Alert.alert>[2] = [
                      { text: file.mime_type?.startsWith('video/') ? 'Воспроизвести' : 'Просмотреть', onPress: () => setMediaViewerOpen(true) },
                      { text: 'Переместить', onPress: () => setPanel('folder') },
                      { text: 'Поделиться', onPress: () => handleShare() },
                    ];
                    if (isOwner) buttons.push({ text: 'Удалить', style: 'destructive', onPress: handleDeleteConfirm });
                    buttons.push({ text: 'Отмена', style: 'cancel' });
                    Alert.alert(file.display_name ?? file.original_name, undefined, buttons);
                  }}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: file.preview_url ?? undefined }}
                    style={styles.previewImage}
                    contentFit="cover"
                  />
                  <View style={styles.previewOverlay}>
                    <Text style={styles.previewOverlayText}>
                      {file.mime_type?.startsWith('video/') ? '▶ Воспроизвести' : '🔍 Просмотреть'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              {/* PDF — превью + открытие в нативном приложении */}
              {file.mime_type === 'application/pdf' ? (
                <>
                  {file.preview_url && (
                    <TouchableOpacity
                      style={styles.previewContainer}
                      onPress={handleDownload}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: file.preview_url }}
                        style={styles.previewImage}
                        contentFit="cover"
                      />
                      <View style={styles.previewOverlay}>
                        <Text style={styles.previewOverlayText}>📄 Открыть PDF</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <Button
                    title={downloading ? 'Загрузка...' : '📄 Открыть PDF'}
                    onPress={handleDownload}
                    loading={downloading || downloadUrl.isPending}
                    style={styles.btn}
                  />
                </>
              ) : (
                <>
                  {Platform.OS === 'android' &&
                    (file.mime_type === 'application/vnd.android.package-archive' ||
                      (file.original_name ?? '').toLowerCase().endsWith('.apk')) ? (
                    <Button
                      title={downloading ? 'Загрузка...' : '📦 Установить APK'}
                      onPress={handleDownload}
                      loading={downloading || downloadUrl.isPending}
                      style={styles.btn}
                    />
                  ) : (
                    <Button
                      title={downloading ? 'Загрузка...' : 'Открыть'}
                      onPress={handleDownload}
                      loading={downloading || downloadUrl.isPending}
                      style={styles.btn}
                    />
                  )}
                </>
              )}
              {/* Gallery viewer modal */}
              {mediaViewerOpen && (
                <GalleryViewer
                  files={[file]}
                  initialIndex={0}
                  onClose={() => setMediaViewerOpen(false)}
                />
              )}
            </>
          ) : null}

          {/* Action menu */}
          <View style={styles.actionMenu}>
            {!isMovie && <ActionItem icon="🏷" label="Теги" onPress={() => openPanel('tags')} />}
            {!isMovie && <ActionItem icon="📁" label="Переместить в папку" onPress={() => openPanel('folder')} />}
            <ActionItem
              icon="💬"
              label="Комментарии"
              badge={commentUnread > 0 ? commentUnread : undefined}
              onPress={() => router.push({
                pathname: '/(app)/files/comments',
                params: { targetType: 'file', targetId: file.id, targetName: name },
              } as any)}
              last={isMovie || (!file.is_owner && !(file.is_owner || file.is_task) && !(file.content_kind === 'binary_file'))}
            />
            {!isMovie && (file.is_owner || file.is_task) && (
              <>
                <View style={styles.actionMenuDivider} />
                {file.is_owner && <ActionItem icon="🔐" label="Управление доступом" onPress={() => openPanel('access')} />}
                {file.is_owner && <ActionItem icon="🔗" label="Публичные ссылки" onPress={() => openPanel('links-list')} />}
                {file.content_kind === 'binary_file' && (file.has_versions || file.is_owner) && (
                  <ActionItem icon="🕓" label="Версии файла" onPress={() => openPanel('versions')} />
                )}
                <ActionItem
                  icon={file.is_task ? '✅' : '☐'}
                  label={file.is_task ? 'Настройки задачи' : 'Сделать задачей'}
                  onPress={() => openPanel('task')}
                  last
                />
              </>
            )}
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteConfirm}>
            <Text style={styles.deleteBtnText}>
              {isMovie ? '🗑 Удалить из коллекции' : file.is_owner ? '🗑 Удалить файл' : '✕ Убрать из моих файлов'}
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
          {(file.folder_id || contextFolderId) && (
            <TouchableOpacity style={styles.radioRow} onPress={() => setSelectedFolderId(null)}>
              <View style={[styles.radio, selectedFolderId === null && styles.radioActive]} />
              <Text style={styles.checkLabel}>🏠 Корень (убрать из папки)</Text>
            </TouchableOpacity>
          )}
          {folderTree.map(({ folder, depth }) => (
            <TouchableOpacity
              key={folder.id}
              style={[styles.radioRow, { paddingLeft: 16 + depth * 20 }]}
              onPress={() => setSelectedFolderId(folder.id)}
            >
              <View style={[styles.radio, selectedFolderId === folder.id && styles.radioActive]} />
              <Text style={styles.checkLabel}>
                {folder.is_personal_root ? '🏠 ' : folder.is_private ? '🔒 ' : '🗂 '}{folder.name}
              </Text>
            </TouchableOpacity>
          ))}
          {writableFolders.length === 0 && (
            <Text style={styles.emptyText}>Нет доступных папок для перемещения.</Text>
          )}
          <Button
            title="Переместить"
            onPress={handleMoveFolder}
            disabled={selectedFolderId === null && !(file.folder_id || contextFolderId)}
            style={styles.btn}
          />
        </View>
      )}

      {/* Task panel */}
      {panel === 'task' && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setPanel(null)} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Задача</Text>
          {file.is_owner && (
            <View style={styles.switchRow}>
              <Text style={styles.checkLabel}>Это задача</Text>
              <Switch value={taskIsTask} onValueChange={setTaskIsTask} />
            </View>
          )}
          {taskIsTask && (
            <>
              <Text style={styles.fieldLabel}>Статус</Text>
              <View style={styles.ttlGrid}>
                {TASK_STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.ttlBtn, taskStatus === s.value && styles.ttlBtnActive]}
                    onPress={() => setTaskStatus(s.value)}
                  >
                    <Text style={[styles.ttlLabel, taskStatus === s.value && styles.ttlLabelActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Дата начала</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity style={[styles.datePicker, { flex: 1 }]} onPress={() => setDatePickerTarget('start')}>
                  <Text style={taskStartDate ? styles.datePickerValue : styles.datePickerPlaceholder}>
                    {taskStartDate ? isoToDisplayRu(taskStartDate) : 'Не выбрана'}
                  </Text>
                  <Text style={styles.datePickerIcon}>📅</Text>
                </TouchableOpacity>
                {taskStartDate ? (
                  <TouchableOpacity style={styles.dateClearBtn} onPress={() => setTaskStartDate('')}>
                    <Text style={styles.dateClearBtnText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.fieldLabel}>Срок выполнения</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity style={[styles.datePicker, { flex: 1 }]} onPress={() => setDatePickerTarget('due')}>
                  <Text style={taskDueDate ? styles.datePickerValue : styles.datePickerPlaceholder}>
                    {taskDueDate ? isoToDisplayRu(taskDueDate) : 'Не выбран'}
                  </Text>
                  <Text style={styles.datePickerIcon}>📅</Text>
                </TouchableOpacity>
                {taskDueDate ? (
                  <TouchableOpacity style={styles.dateClearBtn} onPress={() => setTaskDueDate('')}>
                    <Text style={styles.dateClearBtnText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {file.is_owner && (() => {
                const accessUsers = (fileAccesses.data ?? []).filter(
                  (a) => a.access_type !== 'owner' && a.user && !a.is_pending,
                );
                return (
                  <>
                    <Text style={styles.fieldLabel}>Исполнитель</Text>
                    <TouchableOpacity
                      style={styles.radioRow}
                      onPress={() => setTaskAssigneeUserId(null)}
                    >
                      <View style={[styles.radio, taskAssigneeUserId === null && styles.radioActive]} />
                      <Text style={styles.checkLabel}>Я (владелец)</Text>
                    </TouchableOpacity>
                    {accessUsers.map((acc) => {
                      const userId = acc.user!.id;
                      const displayName = acc.user!.name ?? acc.user!.email;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={styles.radioRow}
                          onPress={() => setTaskAssigneeUserId(userId)}
                        >
                          <View style={[styles.radio, taskAssigneeUserId === userId && styles.radioActive]} />
                          <View>
                            <Text style={styles.checkLabel}>{displayName}</Text>
                            {acc.user!.name && <Text style={styles.subLabel}>{acc.user!.email}</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {accessUsers.length === 0 && (
                      <Text style={styles.subLabel}>Предоставьте доступ к файлу, чтобы назначить исполнителя.</Text>
                    )}
                  </>
                );
              })()}
            </>
          )}
          <Button title="Сохранить" onPress={handleSaveTask} loading={updateTask.isPending} style={styles.btn} />
        </View>
      )}

      <DatePickerModal
        visible={datePickerTarget !== null}
        value={datePickerTarget === 'start' ? taskStartDate : taskDueDate}
        onConfirm={(iso) => {
          if (datePickerTarget === 'start') setTaskStartDate(iso);
          else setTaskDueDate(iso);
          setDatePickerTarget(null);
        }}
        onCancel={() => setDatePickerTarget(null)}
      />

      {/* Access panel */}
      {panel === 'access' && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setPanel(null)} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Кто имеет доступ</Text>
          {fileAccesses.isLoading && <Spinner />}
          {(fileAccesses.data ?? []).map((acc) => {
            const displayName = acc.user?.name ?? acc.user?.email ?? 'Неизвестный';
            const isOwnerEntry = acc.access_type === 'owner';
            const isPending = acc.is_pending ?? false;
            return (
              <View key={acc.id} style={styles.accessRow}>
                <View style={styles.accessInfo}>
                  <Text style={styles.checkLabel}>{displayName}</Text>
                  <View style={styles.accessBadges}>
                    {isOwnerEntry && <View style={styles.badgeOwner}><Text style={styles.badgeText}>Владелец</Text></View>}
                    {isPending && <View style={styles.badgePending}><Text style={styles.badgeText}>Ожидает</Text></View>}
                    {!isOwnerEntry && !isPending && (
                      <View style={[styles.badgeAccess, acc.can_edit && styles.badgeEdit]}>
                        <Text style={styles.badgeText}>{acc.can_edit ? 'Редактор' : 'Просмотр'}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {!isOwnerEntry && acc.contact_id && (
                  <View style={styles.accessActions}>
                    {!isPending && (
                      <TouchableOpacity
                        style={styles.accessToggle}
                        onPress={() => updateAccess.mutate({ accessId: acc.id, canEdit: !(acc.can_edit ?? false) })}
                        disabled={updateAccess.isPending}
                      >
                        <Text style={styles.accessToggleText}>{acc.can_edit ? '→ Просмотр' : '→ Редактор'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.revokeBtn}
                      onPress={() => handleRevokeAccess(acc.contact_id!, displayName)}
                      disabled={revokeAccess.isPending}
                    >
                      <Text style={styles.revokeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
          {(fileAccesses.data ?? []).filter((a) => a.access_type !== 'owner').length === 0 && !fileAccesses.isLoading && (
            <Text style={styles.emptyText}>Доступ не предоставлен никому кроме вас.</Text>
          )}

          {/* Grant access section */}
          {!showingGrant ? (
            <TouchableOpacity style={styles.grantBtn} onPress={() => setShowingGrant(true)}>
              <Text style={styles.grantBtnText}>+ Предоставить доступ</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.grantForm}>
              <Text style={styles.fieldLabel}>Выберите контакт</Text>
              {(contacts ?? []).map((c) => (
                <TouchableOpacity key={c.id} style={styles.radioRow} onPress={() => setGrantContactId(c.id)}>
                  <View style={[styles.radio, grantContactId === c.id && styles.radioActive]} />
                  <View>
                    <Text style={styles.checkLabel}>{c.name}</Text>
                    {c.email && <Text style={styles.subLabel}>{c.email}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
              {(contacts ?? []).length === 0 && (
                <Text style={styles.emptyText}>Нет контактов. Добавьте во вкладке «Связи».</Text>
              )}
              <View style={styles.switchRow}>
                <Text style={styles.checkLabel}>Разрешить редактирование</Text>
                <Switch value={grantCanEdit} onValueChange={setGrantCanEdit} />
              </View>
              <View style={styles.grantFormBtns}>
                <Button
                  title="Предоставить"
                  onPress={handleGrantAccess}
                  loading={shareToContact.isPending}
                  disabled={!grantContactId}
                  style={{ flex: 1 }}
                />
                <Button title="Отмена" variant="secondary" onPress={() => setShowingGrant(false)} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      )}

      {/* Links list panel */}
      {panel === 'links-list' && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setPanel(null)} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Публичные ссылки</Text>

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
                <Text style={styles.subLabel}>Действует до: {formatDateTime(createdLink.expires_at)}</Text>
              )}
              <Button title="Поделиться ссылкой" onPress={() => Share.share({ message: createdLink.url })} style={styles.btn} />
              <Button title="Создать ещё одну" variant="secondary" onPress={() => setCreatedLink(null)} style={styles.btn} />
            </>
          )}

          {fileLinks.isLoading && <Spinner />}
          {(fileLinks.data ?? []).length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Существующие ссылки</Text>
              {(fileLinks.data ?? []).map((link) => (
                <View key={link.id} style={styles.linkCard}>
                  <View style={styles.linkCardHeader}>
                    <View style={[
                      styles.linkStatusBadge,
                      link.status === 'active' ? styles.linkStatusActive :
                      link.status === 'expired' ? styles.linkStatusExpired : styles.linkStatusDisabled,
                    ]}>
                      <Text style={styles.linkStatusText}>
                        {link.status === 'active' ? 'Активна' : link.status === 'expired' ? 'Истекла' : 'Откл.'}
                      </Text>
                    </View>
                    {link.status === 'active' && (
                      <TouchableOpacity
                        style={styles.linkDisableBtn}
                        onPress={() => handleDisableLink(link.id)}
                        disabled={disableFileLink.isPending}
                      >
                        <Text style={styles.linkDisableBtnText}>Отключить</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.linkUrlSmall} selectable numberOfLines={1}>{link.url}</Text>
                  <TouchableOpacity onPress={() => Share.share({ message: link.url })}>
                    <Text style={styles.linkCopyText}>📋 Скопировать / поделиться</Text>
                  </TouchableOpacity>
                  {link.expires_at && (
                    <Text style={styles.subLabel}>До: {formatDateTime(link.expires_at)}</Text>
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      )}

    </ScrollView>
  );
}

function buildFolderTree(folders: SharedFolder[]): Array<{ folder: SharedFolder; depth: number }> {
  const result: Array<{ folder: SharedFolder; depth: number }> = [];
  function walk(parentId: string | null, depth: number) {
    for (const f of folders) {
      if ((f.parent_id ?? null) === parentId) {
        result.push({ folder: f, depth });
        walk(f.id, depth + 1);
      }
    }
  }
  walk(null, 0);
  const placed = new Set(result.map((r) => r.folder.id));
  for (const f of folders) {
    if (!placed.has(f.id)) result.push({ folder: f, depth: 0 });
  }
  return result;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ActionItem({ icon, label, badge, onPress, last = false }: { icon: string; label: string; badge?: number; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[styles.actionItem, !last && styles.actionItemBorder]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.actionItemIcon}>{icon}</Text>
      <Text style={styles.actionItemLabel}>{label}</Text>
      {badge != null && badge > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <Text style={styles.actionItemChevron}>›</Text>
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
  accessLimitBanner: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10, marginBottom: 12 },
  accessLimitText: { fontSize: 13, color: '#64748B' },
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

  // Action menu (list style)
  actionMenu: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  actionMenuDivider: { height: 1, backgroundColor: '#E2E8F0' },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 12, backgroundColor: '#fff' },
  actionItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actionItemIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  actionItemLabel: { flex: 1, fontSize: 15, color: '#1E293B' },
  actionItemChevron: { fontSize: 20, color: '#CBD5E1' },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

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

  // Date picker trigger
  datePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateClearBtn: { width: 36, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEE2E2', borderRadius: 10 },
  dateClearBtnText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },
  datePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0',
  },
  datePickerValue: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  datePickerPlaceholder: { fontSize: 15, color: '#94A3B8' },
  datePickerIcon: { fontSize: 18 },

  // Grant access
  grantBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  grantBtnText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  grantForm: { gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, marginTop: 4 },
  grantFormBtns: { flexDirection: 'row', gap: 8 },

  // Access management
  accessRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 8 },
  accessInfo: { flex: 1, gap: 4 },
  accessBadges: { flexDirection: 'row', gap: 6 },
  badgeOwner: { backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgePending: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeAccess: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeEdit: { backgroundColor: '#EFF6FF' },
  badgeText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  accessActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  accessToggle: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  accessToggleText: { fontSize: 12, color: '#475569' },
  revokeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  revokeBtnText: { fontSize: 14, color: '#EF4444', fontWeight: '700' },

  // Links management
  linkCard: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  linkCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkStatusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  linkStatusActive: { backgroundColor: '#D1FAE5' },
  linkStatusExpired: { backgroundColor: '#FEF3C7' },
  linkStatusDisabled: { backgroundColor: '#F1F5F9' },
  linkStatusText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  linkDisableBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  linkDisableBtnText: { fontSize: 12, color: '#EF4444' },
  linkUrlSmall: { fontSize: 12, color: '#2563EB' },
  linkCopyText: { fontSize: 13, color: '#2563EB' },

  // Media preview
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    aspectRatio: 1,
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%' },
  previewOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  previewOverlayText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Document actions
  docActions: { flexDirection: 'row', gap: 10 },
  docBtn: {
    flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  docBtnPrimary: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  docBtnText: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  docBtnPrimaryText: { fontSize: 15, color: '#fff', fontWeight: '600' },

  // Delete
  deleteBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  deleteBtnText: { fontSize: 15, color: '#EF4444', fontWeight: '500' },

  // Movie hero
  movieHero: { flexDirection: 'row', gap: 14, padding: 16, backgroundColor: '#fff' },
  moviePoster: { width: 100, height: 150, borderRadius: 8, backgroundColor: '#E2E8F0', flexShrink: 0 },
  moviePosterPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  moviePosterEmoji: { fontSize: 36 },
  movieMeta: { flex: 1, gap: 6, justifyContent: 'center' },
  movieTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', lineHeight: 24 },
  movieRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  movieYear: { fontSize: 14, color: '#64748B' },
  movieRating: { fontSize: 14, color: '#F59E0B', fontWeight: '600' },
  movieDirector: { fontSize: 13, color: '#94A3B8' },
  movieGenres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  genreTag: { backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  genreTagText: { fontSize: 11, color: '#475569' },
  movieDescription: { padding: 16, paddingTop: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  movieDescriptionText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  kpBtn: { marginHorizontal: 16, marginTop: 12, paddingVertical: 12, backgroundColor: '#FF6600', borderRadius: 10, alignItems: 'center' },
  kpBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  movieFavoriteRow: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  movieFavoriteBtn: { paddingVertical: 6 },
});
