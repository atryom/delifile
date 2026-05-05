<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSettingsController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    /**
     * PATCH /api/v1/user/settings
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'notifications_enabled'               => ['sometimes', 'boolean'],
            'notify_new_files'                    => ['sometimes', 'boolean'],
            'notify_contacts_added'               => ['sometimes', 'boolean'],
            'allow_contacts_without_confirmation' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();
        $user->update($data);

        return $this->success('Настройки сохранены', [
            'user' => $this->authService->formatUser($user->fresh()),
        ]);
    }
}
