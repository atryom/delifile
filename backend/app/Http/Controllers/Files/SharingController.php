<?php

namespace App\Http\Controllers\Files;

use App\Enums\AccessType;
use App\Enums\ActivityType;
use App\Enums\ShareLinkStatus;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\ContactPendingShare;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\ShareLink;
use App\Services\ActivityService;
use App\Services\FileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SharingController extends Controller
{
    public function __construct(
        private readonly FileService     $fileService,
        private readonly ActivityService $activityService
    ) {}

    /**
     * POST /api/v1/files/{fileId}/share-to-contact
     * Grant access to a contact.
     */
    public function shareToContact(Request $request, string $fileId): JsonResponse
    {
        $request->validate(['contact_id' => 'required|string']);

        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        if (!$file->isAvailable()) {
            return $this->error(__('messages.sharing.file_not_available'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        $contact = Contact::where('id', $request->contact_id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$contact) {
            return $this->notFound('Contact not found');
        }

        if (!$contact->isRegistered()) {
            // Contact hasn't accepted invitation yet — queue the file as pending
            DB::transaction(function () use ($file, $contact, $request) {
                ContactPendingShare::firstOrCreate([
                    'contact_id' => $contact->id,
                    'file_id'    => $file->id,
                ], [
                    'sender_user_id' => $request->user()->id,
                ]);

                $this->activityService->log($file, $request->user(), ActivityType::SharedToContact, [
                    'contact_id'   => $contact->id,
                    'contact_name' => $contact->name,
                    'pending'      => true,
                ]);
            });

            return $this->success(__('messages.sharing.access_pending'), [
                'share' => [
                    'contact_id' => $contact->id,
                    'status'     => 'pending',
                ],
            ]);
        }

        DB::transaction(function () use ($file, $contact, $request) {
            FileUserAccess::firstOrCreate([
                'file_id'     => $file->id,
                'user_id'     => $contact->resolved_user_id,
                'access_type' => AccessType::Shared,
            ], [
                'contact_id' => $contact->id,
            ]);

            $this->activityService->log($file, $request->user(), ActivityType::SharedToContact, [
                'contact_id'   => $contact->id,
                'contact_name' => $contact->name,
            ]);
        });

        return $this->success(__('messages.sharing.access_granted'), [
            'share' => [
                'contact_id' => $contact->id,
                'status'     => 'shared',
            ],
        ]);
    }

    /**
     * DELETE /api/v1/files/{fileId}/share-to-contact/{contactId}
     * Revoke access from a contact.
     */
    public function revokeContactAccess(Request $request, string $fileId, string $contactId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        $contact = Contact::where('id', $contactId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$contact) {
            return $this->notFound('Contact not found');
        }

        FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $contact->resolved_user_id)
            ->delete();

        $this->activityService->log($file, $request->user(), ActivityType::ShareRevoked, [
            'contact_id' => $contactId,
        ]);

        return $this->success(__('messages.sharing.access_revoked'));
    }

    /**
     * POST /api/v1/files/{fileId}/create-link
     * Create a public share link.
     */
    public function createLink(Request $request, string $fileId): JsonResponse
    {
        $request->validate([
            'ttl_hours' => 'nullable|integer|min:1|max:720',
        ]);

        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        if (!$file->isAvailable()) {
            return $this->error(__('messages.sharing.file_not_available_link'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        $ttlHours = $request->ttl_hours ?? config('app.file_default_ttl_hours', 12);

        $link = DB::transaction(function () use ($file, $request, $ttlHours) {
            $link = ShareLink::create([
                'file_id'    => $file->id,
                'created_by' => $request->user()->id,
                'status'     => ShareLinkStatus::Active,
                'ttl_hours'  => $ttlHours,
                'expires_at' => now()->addHours($ttlHours),
            ]);

            $this->activityService->log($file, $request->user(), ActivityType::LinkCreated, [
                'link_id'   => $link->id,
                'ttl_hours' => $ttlHours,
            ]);

            return $link;
        });

        return $this->success(__('messages.sharing.link_created'), [
            'link' => [
                'id'         => $link->id,
                'url'        => $link->url,
                'expires_at' => $link->expires_at?->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * GET /api/v1/files/{fileId}/links
     */
    public function listLinks(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        $links = $file->shareLinks()
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($l) => [
                'id'         => $l->id,
                'url'        => $l->url,
                'status'     => $l->status->value,
                'ttl_hours'  => $l->ttl_hours,
                'expires_at' => $l->expires_at?->toIso8601String(),
                'created_at' => $l->created_at?->toIso8601String(),
            ]);

        return $this->success(__('messages.sharing.links_fetched'), [
            'items' => $links,
        ]);
    }

    /**
     * POST /api/v1/links/{linkId}/disable
     */
    public function disableLink(Request $request, string $linkId): JsonResponse
    {
        $link = ShareLink::find($linkId);

        if (!$link) {
            return $this->notFound('Link not found');
        }

        // Verify ownership through file
        if (!$link->file->isOwnedBy($request->user())) {
            return $this->forbidden();
        }

        $link->update(['status' => ShareLinkStatus::Disabled]);

        $this->activityService->log($link->file, $request->user(), ActivityType::LinkDisabled, [
            'link_id' => $link->id,
        ]);

        return $this->success(__('messages.sharing.link_disabled'));
    }

    /**
     * POST /api/v1/links/{token}/resolve
     * Public endpoint — resolve link metadata without auth.
     */
    public function resolveLink(Request $request, string $token): JsonResponse
    {
        $link = ShareLink::where('token', $token)->with('file')->first();

        if (!$link || !$link->isValid()) {
            return $this->error(__('messages.sharing.link_invalid'), 'LINK_INVALID', [], 404);
        }

        return $this->success(__('messages.sharing.link_resolved'), [
            'file' => [
                'id'            => $link->file->id,
                'original_name' => $link->file->original_name,
                'size'          => $link->file->size,
                'mime_type'     => $link->file->mime_type,
            ],
            'link' => [
                'expires_at' => $link->expires_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * POST /api/v1/links/{token}/download
     * Public endpoint — generate download URL via link token.
     */
    public function downloadViaLink(Request $request, string $token): JsonResponse
    {
        $link = ShareLink::where('token', $token)->with('file')->first();

        if (!$link || !$link->isValid()) {
            return $this->error(__('messages.sharing.link_invalid'), 'LINK_INVALID', [], 404);
        }

        if (!$link->file->isAvailable()) {
            return $this->error(__('messages.files.not_available'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        // FileService without auth check (link IS the auth)
        $url = app(FileService::class)->generateDownloadUrl($link->file);

        return $this->success(__('messages.files.download_url'), [
            'url'        => $url,
            'expires_in' => 3600,
        ]);
    }
}
