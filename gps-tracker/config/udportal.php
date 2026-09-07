<?php

return [
    'api_base_url' => env('UDPORTAL_API_BASE_URL', 'http://udportal.test/api/v1'),
    'api_token' => env('UDPORTAL_API_TOKEN'),
    'api_username' => env('UDPORTAL_API_USERNAME'),
    'api_password' => env('UDPORTAL_API_PASSWORD'),
    'api_timeout' => (int) env('UDPORTAL_API_TIMEOUT', 15),
    'api_token_cache_minutes' => (int) env('UDPORTAL_API_TOKEN_CACHE_MINUTES', 60),
];
