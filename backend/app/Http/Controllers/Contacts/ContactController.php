<?php

namespace App\Http\Controllers\Contacts;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContactController extends Controller
{
    /**
     * GET /api/v1/contacts
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->get('search');

        $query = Contact::where('user_id', $request->user()->id)
            ->with('resolvedUser:id,phone,name');

        if ($search) {
            $query->where(fn ($q) =>
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
            );
        }

        $contacts = $query->orderBy('name')->get()->map(fn ($c) => [
            'id'          => $c->id,
            'name'        => $c->name,
            'phone'       => $c->phone,
            'is_registered' => $c->isRegistered(),
            'resolved_user' => $c->resolvedUser ? [
                'id'    => $c->resolvedUser->id,
                'name'  => $c->resolvedUser->name,
                'phone' => $c->resolvedUser->phone,
            ] : null,
        ]);

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
            'phone' => 'required|string|max:20',
        ]);

        $contact = DB::transaction(function () use ($request) {
            $resolved = User::where('phone', $request->phone)->first();

            return Contact::create([
                'user_id'          => $request->user()->id,
                'name'             => $request->name,
                'phone'            => $request->phone,
                'resolved_user_id' => $resolved?->id,
            ]);
        });

        return $this->success(__('messages.contacts.created'), [
            'contact' => [
                'id'            => $contact->id,
                'name'          => $contact->name,
                'phone'         => $contact->phone,
                'is_registered' => $contact->isRegistered(),
            ],
        ], 201);
    }

    /**
     * GET /api/v1/contacts/{contactId}
     */
    public function show(Request $request, string $contactId): JsonResponse
    {
        $contact = Contact::where('id', $contactId)
            ->where('user_id', $request->user()->id)
            ->with('resolvedUser:id,phone,name')
            ->first();

        if (!$contact) {
            return $this->notFound('Contact not found');
        }

        return $this->success(__('messages.contacts.fetched_one'), [
            'contact' => [
                'id'            => $contact->id,
                'name'          => $contact->name,
                'phone'         => $contact->phone,
                'is_registered' => $contact->isRegistered(),
                'resolved_user' => $contact->resolvedUser ? [
                    'id'    => $contact->resolvedUser->id,
                    'name'  => $contact->resolvedUser->name,
                    'phone' => $contact->resolvedUser->phone,
                ] : null,
            ],
        ]);
    }

    /**
     * POST /api/v1/contacts/import
     * Bulk import contacts and resolve against registered users.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'contacts'        => 'required|array|min:1|max:500',
            'contacts.*.name' => 'required|string|max:255',
            'contacts.*.phone' => 'required|string|max:20',
        ]);

        $user    = $request->user();
        $created = 0;

        DB::transaction(function () use ($request, $user, &$created) {
            foreach ($request->contacts as $item) {
                $resolved = User::where('phone', $item['phone'])->first();

                Contact::updateOrCreate(
                    ['user_id' => $user->id, 'phone' => $item['phone']],
                    [
                        'name'             => $item['name'],
                        'resolved_user_id' => $resolved?->id,
                    ]
                );
                $created++;
            }
        });

        return $this->success(__('messages.contacts.imported'), [
            'imported' => $created,
        ]);
    }

    /**
     * POST /api/v1/contacts/resolve
     * Re-check which contacts are now registered users.
     */
    public function resolve(Request $request): JsonResponse
    {
        $contacts = Contact::where('user_id', $request->user()->id)
            ->whereNull('resolved_user_id')
            ->get();

        $resolved = 0;
        foreach ($contacts as $contact) {
            $user = User::where('phone', $contact->phone)->first();
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

        // Show files shared with this contact
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
}
