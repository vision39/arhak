/**
 * Archestra API Client
 * Uses the A2A (Agent-to-Agent) JSON-RPC protocol
 * Endpoint: /v1/a2a/{agentId}
 */

interface ArchestraConfig {
    baseUrl: string;
    apiKey: string;
}

function getConfig(): ArchestraConfig {
    const baseUrl = process.env.ARCHESTRA_BASE_URL;
    const apiKey = process.env.ARCHESTRA_API_KEY;

    if (!baseUrl || !apiKey) {
        throw new Error('ARCHESTRA_BASE_URL and ARCHESTRA_API_KEY must be set in .env');
    }

    return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

/**
 * Send a message to an Archestra agent via A2A protocol and get a response.
 */
export async function sendToAgent(
    agentId: string,
    messages: { role: string; content: string }[]
): Promise<string> {
    const { baseUrl, apiKey } = getConfig();

    // A2A endpoint: /v1/a2a/{agentId}
    const url = `${baseUrl}/v1/a2a/${agentId}`;

    // Combine all messages into a single text prompt for the agent
    const combinedText = messages
        .map(m => m.content)
        .join('\n\n');

    console.log(`  → Sending to agent ${agentId.substring(0, 8)}...`);

    // A2A JSON-RPC 2.0 request
    const body = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'message/send',
        params: {
            message: {
                parts: [{ kind: 'text', text: combinedText }],
            },
        },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`  ✗ A2A API error (${response.status}):`, errorText);
        throw new Error(`Archestra A2A error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    console.log(`  ✓ Agent responded`);

    // Extract text from A2A JSON-RPC response
    return extractA2AResponse(data);
}

/**
 * Send the full interview context to an agent and ask for an update.
 * The agent is expected to return a JSON object (partial or full session update).
 */
export async function sendContextToAgent<T>(
    agentId: string,
    context: Record<string, unknown>,
    instruction: string
): Promise<T> {
    const prompt = `
SYSTEM CONTEXT:
${JSON.stringify(context, null, 2)}

INSTRUCTION:
${instruction}

Respond with ONLY a JSON object representing the result/update.
`;

    const responseText = await sendToAgent(agentId, [
        { role: 'user', content: prompt }
    ]);

    return parseAgentJSON<T>(responseText);
}

/**
 * Extract text content from an A2A JSON-RPC response.
 *
 * Expected format:
 * {
 *   "jsonrpc": "2.0",
 *   "id": ...,
 *   "result": {
 *     "message": {
 *       "parts": [{ "kind": "text", "text": "..." }]
 *     }
 *   }
 * }
 */
function extractA2AResponse(data: Record<string, unknown>): string {
    // Check for JSON-RPC error
    if (data.error) {
        const err = data.error as Record<string, unknown>;
        throw new Error(`A2A error: ${err.message || JSON.stringify(err)}`);
    }

    // Try to get result.message.parts[].text
    const result = data.result as Record<string, unknown> | undefined;
    if (result) {
        // Direct artifacts/message in result
        const message = result.message as Record<string, unknown> | undefined;
        if (message) {
            const parts = message.parts as Array<Record<string, unknown>> | undefined;
            if (parts && parts.length > 0) {
                const textParts = parts
                    .filter(p => p.kind === 'text' && typeof p.text === 'string')
                    .map(p => p.text as string);
                if (textParts.length > 0) {
                    return textParts.join('\n');
                }
            }
        }

        // Maybe result itself has parts
        const resultParts = result.parts as Array<Record<string, unknown>> | undefined;
        if (resultParts && resultParts.length > 0) {
            const textParts = resultParts
                .filter(p => p.kind === 'text' && typeof p.text === 'string')
                .map(p => p.text as string);
            if (textParts.length > 0) {
                return textParts.join('\n');
            }
        }

        // Result might be a string directly
        if (typeof result.text === 'string') return result.text;
        if (typeof result.content === 'string') return result.content;
    }

    // Fallback: stringify the entire response for debugging
    console.warn('  ⚠ Unknown A2A response format:', JSON.stringify(data).substring(0, 300));
    return JSON.stringify(data);
}

/**
 * Parse a JSON response from an agent, handling markdown code blocks
 */
export function parseAgentJSON<T>(raw: string): T {
    // Remove markdown code blocks if present
    let cleaned = raw.trim();

    // Strip ```json ... ``` or ``` ... ```
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
    }

    // Sometimes agents wrap in extra text — try to find the JSON object
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }
    }

    try {
        return JSON.parse(cleaned) as T;
    } catch (e) {
        console.error('Failed to parse agent JSON:', cleaned.substring(0, 300));
        throw new Error(`Agent returned invalid JSON: ${(e as Error).message}`);
    }
}
