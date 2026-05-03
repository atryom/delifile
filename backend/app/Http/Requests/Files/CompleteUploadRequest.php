<?php

namespace App\Http\Requests\Files;

use Illuminate\Foundation\Http\FormRequest;

class CompleteUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'file_id' => ['required', 'string'],
        ];
    }
}
