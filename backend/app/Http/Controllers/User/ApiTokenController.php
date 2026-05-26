<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiTokenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tokens = $request->user()
            ->tokens()
            ->where('name', 'not like', 'web-spa%')
            ->where('name', 'not like', 'resend-verification%')
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'created_at', 'last_used_at'])
            ->map(fn($t) => [
                'id'           => $t->id,
                'name'         => $t->name,
                'created_at'   => $t->created_at?->toIso8601String(),
                'last_used_at' => $t->last_used_at?->toIso8601String(),
            ]);

        return $this->success('OK', ['items' => $tokens]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $token = $request->user()->createToken($data['name']);

        return $this->success('Токен создан', [
            'token' => $token->plainTextToken,
            'item'  => [
                'id'           => $token->accessToken->id,
                'name'         => $token->accessToken->name,
                'created_at'   => $token->accessToken->created_at?->toIso8601String(),
                'last_used_at' => null,
            ],
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $deleted = $request->user()
            ->tokens()
            ->where('id', $id)
            ->where('name', 'not like', 'web-spa%')
            ->delete();

        if (! $deleted) {
            return $this->notFound('Токен не найден');
        }

        return $this->success('Токен отозван');
    }
}
