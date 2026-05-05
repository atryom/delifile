<?php

namespace App\Http\Controllers\Contacts;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\ContactRequest;
use App\Models\User;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContactController extends Controller
{
    public function __construct(private readonly InvitationService $invitationService) {}

    /**
     * GET /api/v1/contacts
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->get('search');

        $query = Contact::where('user_id', $request->user()->id)
            ->with('resolvedUser:id,email,name');

        if ($search) {
            $query->where(fn ($q) =>
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
            );
        }

        $contacts = $query->orderBy('name')->get()->map(fn ($c) => $this->formatContact($c));

        return $this->success(__('messages.contacts.fetched'), [
            'items' => $contacts,
        ]);
    }

    /**
     * POST /api/v1/contacts
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
        ]);

        if (empty($request->email) && empty($request->phone)) {
            return $this->error('Email или телефон обязателен', ['code' => 'VALIDATION_ERROR'], 422);
        }

        // Duplicate check
        $duplicateQuery = Contact::where('user_id', $request->user()->id);
        if ($request->email) {
            $duplicateQuery->where('email', $request->email);
        } elseif ($request->phone) {
            $duplicateQuery->where('phone', $request->phone);
        }
        if ($duplicateQuery->exists()) {
            return $this->error(__('messages.contacts.already_exists'), 'CONTACT_DUPLICATE', [], 422);
        }

        $invitationSent   = false;
        $requiresApproval = false;

        $contact = DB::transaction(function () use ($request, &$invitationSent, &$requiresApproval) {
            $resolved = $request->email
                ? User::where('email', $request->email)->first()
                : null;

            // If resolved user has disabled auto-add, create a pending request instead of resolving
            $resolvedUserId = null;
            if ($resolved) {
                $allowWithout = $resolved->allow_contacts_without_confirmation ?? true;
                if ($allowWithout) {
                    $resolvedUserId = $resolved->id;
                } else {
                    $requiresApproval = true;
                }
            }

            $contact = Contact::create([
                'user_id'          => $request->user()->id,
                'name'             => $request->name,
                'email'            => $request->email,
                'phone'            => $request->phone,
                'resolved_user_id' => $resolvedUserId,
            ]);

            // If approval needed, create a contact request
            if ($requiresApproval && $resolved) {
                ContactRequest::updateOrCreate(
                    [
                        'requester_id'   => $request->user()->id,
                        'target_user_id' => $resolved->id,
                    ],
                    [
                        'contact_id' => $contact->id,
                        'status'     => 'pending',
                    ]
                );
            }

            // Send invitation if email provided and user is not yet registered
            if ($request->email && !$resolved) {
                $this->invitationService->send($request->user(), ['email' => $request->email]);
                $invitationSent = true;
            }

            return $contact;
        });

        return $this->success(__('messages.contacts.created'), [
            'contact'           => $this->formatContact($contact),
            'invitation_sent'   => $invitationSent,
            'requires_approval' => $requiresApproval,
        ], 201);
    }

    /**
     * GET /api/v1/contacts/{contactId}
     */
    public function show(Request $request, string $contactId): JsonResponse
    {
        $contact = Contact::where('id', $contactId)
            ->where('user_id', $request->user()->id)
            ->with('resolvedUser:id,email,name')
            ->first();

        if (!$contact) {
            return $this->notFound('Contact not found');
        }

        return $this->success(__('messages.contacts.fetched_one'), [
            'contact' => $this->formatContact($contact),
        ]);
    }

    /**
     * POST /api/v1/contacts/import
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'contacts'         => 'required|array|min:1|max:500',
            'contacts.*.name'  => 'required|string|max:255',
            'contacts.*.email' => 'nullable|email|max:255',
            'contacts.*.phone' => 'nullable|string|max:20',
        ]);

        $user    = $request->user();
        $created = 0;

        DB::transaction(function () use ($request, $user, &$created) {
            foreach ($request->contacts as $item) {
                $resolved = !empty($item['email'])
                    ? User::where('email', $item['email'])->first()
                    : null;

                $key = !empty($item['email'])
                    ? ['user_id' => $user->id, 'email' => $item['email']]
                    : ['user_id' => $user->id, 'phone' => $item['phone']];

                Contact::updateOrCreate($key, [
                    'name'             => $item['name'],
                    'email'            => $item['email'] ?? null,
                    'phone'            => $item['phone'] ?? null,
                    'resolved_user_id' => $resolved?->id,
                ]);
                $created++;
            }
        });

        return $this->success(__('messages.contacts.imported'), [
            'imported' => $created,
        ]);
    }

    /**
     * POST /api/v1/contacts/resolve
     */
    public function resolve(Request $request): JsonResponse
    {
        $contacts = Contact::where('user_id', $request->user()->id)
            ->whereNull('resolved_user_id')
            ->get();

        $resolved = 0;
        foreach ($contacts as $contact) {
            $user = null;
            if ($contact->email) {
                $user = User::where('email', $contact->email)->first();
            }
            if (!$user && $contact->phone) {
                $user = User::where('phone', $contact->phone)->first();
            }
            if ($user) {
                $contact->update(['resolved_user_id' => $user->id]);
                $resolved++;
            }
        }

        return $this->success(__('messages.contacts.resolved'), [
            'newly_resolved' => $resolved,
        ]);
    }

    /**
     * GET /api/v1/contacts/{contactId}/history
     */
    public function history(Request $request, string $contactId): JsonResponse
    {
        $contact = Contact::where('id', $contactId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$contact) {
            return $this->notFound('Contact not found');
        }

        $sharedFiles = \App\Models\FileUserAccess::where('contact_id', $contact->id)
            ->with('file:id,original_name,status,created_at')
            ->get()
            ->map(fn ($a) => [
                'file'        => [
                    'id'     => $a->file?->id,
                    'name'   => $a->file?->original_name,
                    'status' => $a->file?->status?->value,
                ],
                'access_type' => $a->access_type?->value,
                'shared_at'   => $a->created_at?->toIso8601String(),
            ]);

        return $this->success(__('messages.contacts.history_fetched'), [
            'items' => $sharedFiles,
        ]);
    }

    /**
     * DELETE /api/v1/contacts/{contactId}
     */
    public function destroy(Request $request, string $contactId): JsonResponse
    {
        $contact = Contact::where('id', $contactId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$contact) {
            return $this->notFound('Contact not found');
        }

        $contact->delete();

        return $this->success(__('messages.contacts.deleted'));
    }

    private function formatContact(Contact $c): array
    {
        return [
            'id'            => $c->id,
            'name'          => $c->name,
            'email'         => $c->email,
            'phone'         => $c->phone,
            'is_registered' => $c->isRegistered(),
            'resolved_user' => $c->resolvedUser ? [
                'id'    => $c->resolvedUser->id,
                'name'  => $c->resolvedUser->name,
                'email' => $c->resolvedUser->email,
            ] : null,
        ];
    }
}
