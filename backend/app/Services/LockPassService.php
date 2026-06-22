<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class LockPassService
{
    private function baseUrl(): string
    {
        return rtrim(config('lockpass.api_url'), '/');
    }

    private function projectToken(): string
    {
        return config('lockpass.api_token') ?? '';
    }

    private function projectId(): string
    {
        return config('lockpass.project_id') ?? '';
    }

    private function withProjectAuth()
    {
        return Http::withToken($this->projectToken())->timeout(10)->acceptJson();
    }

    private function publicClient()
    {
        return Http::timeout(10)->acceptJson();
    }

    /**
     * Create a 2FA session for the given LockPass user.
     * Returns: { session_id, qr_payload, status }
     *
     * @throws RuntimeException when LockPass is unavailable or returns an error
     */
    public function create2FASession(int $lockpassUserId, string $clientApp = 'delifile'): array
    {
        try {
            $response = $this->withProjectAuth()
                ->post($this->baseUrl() . '/2fa/session/create-v2', [
                    'user_id'    => $lockpassUserId,
                    'client_app' => $clientApp,
                ]);

            if (!$response->successful()) {
                throw new RuntimeException('LockPass create session failed: ' . $response->body());
            }

            return $response->json();
        } catch (ConnectionException $e) {
            throw new RuntimeException('LockPass недоступен: ' . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Get the status of a 2FA session.
     * Returns: { status: pending|approved|rejected|expired, ... }
     */
    public function getSessionStatus(string $sessionId): array
    {
        try {
            $response = $this->publicClient()
                ->get($this->baseUrl() . '/2fa/sessions/' . $sessionId);

            if (!$response->successful()) {
                throw new RuntimeException('LockPass session status failed: ' . $response->body());
            }

            return $response->json();
        } catch (ConnectionException $e) {
            throw new RuntimeException('LockPass недоступен: ' . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Check 2FA status for a user.
     * Returns: { two_factor_enabled: bool, devices_count: int }
     */
    public function check2FAStatus(int $lockpassUserId): array
    {
        try {
            $response = $this->withProjectAuth()
                ->get($this->baseUrl() . '/2fa/user/status', ['user_id' => $lockpassUserId]);

            if (!$response->successful()) {
                throw new RuntimeException('LockPass user status failed: ' . $response->body());
            }

            return $response->json();
        } catch (ConnectionException $e) {
            throw new RuntimeException('LockPass недоступен: ' . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Check 2FA status and update the user's cached fields in the DB.
     */
    public function sync2FAStatus(User $user): array
    {
        $status = $this->check2FAStatus((int) $user->lockpass_user_id);

        $user->update([
            'two_factor_enabled' => (bool) ($status['two_factor_enabled'] ?? false),
            'devices_count'      => (int) ($status['devices_count'] ?? 0),
        ]);

        return $status;
    }

    /**
     * Verify a 6-digit TOTP code for a session.
     * Returns raw LockPass response.
     *
     * @throws RuntimeException on network failure
     * @throws \Illuminate\Http\Client\RequestException on 4xx (e.g. invalid code)
     */
    public function verifyTOTPCode(string $sessionId, string $code): array
    {
        try {
            $response = $this->publicClient()
                ->post($this->baseUrl() . '/2fa/session/verify-code', [
                    'session_id' => $sessionId,
                    'code'       => $code,
                ]);

            if ($response->status() === 422) {
                throw new RequestException($response);
            }

            if (!$response->successful()) {
                throw new RuntimeException('LockPass verify-code failed: ' . $response->body());
            }

            return $response->json();
        } catch (ConnectionException $e) {
            throw new RuntimeException('LockPass недоступен: ' . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Verify a recovery code for a session.
     *
     * @throws RuntimeException on network failure
     * @throws \Illuminate\Http\Client\RequestException on 4xx (e.g. invalid code)
     */
    public function verifyRecoveryCode(string $sessionId, string $code): array
    {
        try {
            $response = $this->publicClient()
                ->post($this->baseUrl() . '/2fa/session/verify-recovery', [
                    'session_id' => $sessionId,
                    'code'       => $code,
                ]);

            if ($response->status() === 422) {
                throw new RequestException($response);
            }

            if (!$response->successful()) {
                throw new RuntimeException('LockPass verify-recovery failed: ' . $response->body());
            }

            return $response->json();
        } catch (ConnectionException $e) {
            throw new RuntimeException('LockPass недоступен: ' . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Get the project QR code for onboarding.
     */
    public function getProjectQR(): array
    {
        try {
            $response = $this->publicClient()
                ->get($this->baseUrl() . '/integration/qr/' . $this->projectId());

            if (!$response->successful()) {
                throw new RuntimeException('LockPass project QR failed: ' . $response->body());
            }

            return $response->json();
        } catch (ConnectionException $e) {
            throw new RuntimeException('LockPass недоступен: ' . $e->getMessage(), 0, $e);
        }
    }
}
