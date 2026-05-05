<?php

namespace App\Http\Controllers\Contacts;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\ContactRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContactRequestController extends Controller
{
    /**
     * GET /api/v1/contact-requests
     * List pending incoming contact requests for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $items = ContactRequest::where('target_user_id', $request->user()->id)
            ->where('status', 'pending')
            ->with('requester')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (ContactRequest $cr) => [
                'id'             => $cr->id,
                'requester'      => [
                    'id'    => $cr->requester->id,
                    'email' => $cr->requester->email,
                    'name'  => $cr->requester->name,
                ],
                'status'         => $cr->status,
                'created_at'     => $cr->created_at?->toIso8601String(),
            ]);

        return $this->success('Запросы получены', ['items' => $items]);
    }

    /**
     * POST /api/v1/contact-requests/{id}/accept
     */
    public function accept(Request $request, string $id): JsonResponse
    {
        $contactRequest = ContactRequest::where('target_user_id', $request->user()->id)
            ->where('id', $id)
            ->where('status', 'pending')
            ->with('requester')
            ->first();

        if (!$contactRequest) {
            return $this->notFound('Запрос не найден');
        }

        DB::transaction(function () use ($contactRequest, $request) {
            // Resolve the contact on the requester's side
            if ($contactRequest->contact_id) {
                Contact::where('id', $contactRequest->contact_id)->update([
                    'resolved_user_id' => $request->user()->id,
                ]);
            }
            $contactRequest->update(['status' => 'accepted']);
        });

        return $this->success('Запрос принят');
    }

    /**
     * POST /api/v1/contact-requests/{id}/reject
     */
    public function reject(Request $request, string $id): JsonResponse
    {
        $contactRequest = ContactRequest::where('target_user_id', $request->user()->id)
            ->where('id', $id)
            ->where('status', 'pending')
            ->first();

        if (!$contactRequest) {
            return $this->notFound('Запрос не найден');
        }

        $contactRequest->update(['status' => 'rejected']);

        return $this->success('Запрос отклонён');
    }
}
