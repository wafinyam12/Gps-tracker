<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UnauthenticatedApiTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_gets_401_when_unauthenticated()
    {
        // Ensure no authentication is active
        $response = $this->getJson('/api/v1/users');
        $response->assertStatus(401);
    }
}