<?php

namespace App\Http\Requests\Files;

use Illuminate\Foundation\Http\FormRequest;

class InitUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $user     = $this->user();
        $maxBytes = $user ? $user->getPlan()->fileSizeLimitBytes() : (100 * 1024 * 1024);

        return [
            'original_name' => ['required', 'string', 'max:255'],
            'size'          => ['required', 'integer', 'min:1', 'max:' . $maxBytes],
            'mime_type'     => ['required', 'string', 'max:100'],
            'checksum'      => ['nullable', 'string', 'max:64'],
        ];
    }
}
