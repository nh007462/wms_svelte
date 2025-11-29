"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const ws_client_1 = require("./ws-client");
const rate_limiter_1 = require("./rate-limiter");
// Initialize WebSocket Client
const wsClient = new ws_client_1.WebSocketClient();
// Initialize Rate Limiter (e.g., 50 requests per minute)
const rateLimiter = new rate_limiter_1.RateLimiter(50, 60000);
// Create MCP Server
const server = new index_js_1.Server({
    name: 'AI Musician',
    version: '1.0.0'
}, {
    capabilities: {
        tools: {}
    }
});
// List Tools Handler
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'join_room',
                description: 'Join a specific room',
                inputSchema: {
                    type: 'object',
                    properties: {
                        roomId: { type: 'string', description: 'ID of the room to join' }
                    },
                    required: ['roomId']
                }
            },
            {
                name: 'play_note',
                description: 'Play a single note or chord',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instrument: {
                            type: 'string',
                            description: 'Instrument name (e.g., piano, guitar-acoustic)'
                        },
                        note: {
                            type: 'string',
                            description: 'Note name or comma-separated notes (e.g., C4, "C4,E4,G4")'
                        },
                        duration: { type: 'string', description: 'Duration of the note (e.g., 4n, 8n)' }
                    },
                    required: ['instrument', 'note']
                }
            },
            {
                name: 'play_sequence',
                description: 'Play a rhythmic sequence',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instrument: { type: 'string' },
                        bpm: { type: 'number' },
                        events: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    time: { type: 'string' },
                                    note: { type: 'string' },
                                    duration: { type: 'string' }
                                },
                                required: ['time', 'note', 'duration']
                            }
                        }
                    },
                    required: ['instrument', 'bpm', 'events']
                }
            }
        ]
    };
});
// Call Tool Handler
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        if (name === 'join_room') {
            const roomId = String(args?.roomId);
            wsClient.joinRoom(roomId);
            return { content: [{ type: 'text', text: `Joined room: ${roomId}` }] };
        }
        if (name === 'play_note') {
            rateLimiter.checkLimit();
            const instrument = String(args?.instrument);
            const note = String(args?.note);
            const duration = args?.duration ? String(args?.duration) : undefined;
            const payload = {
                type: 'data-channel-message',
                payload: {
                    message: { type: 'noteOn', instrument, note, duration }
                }
            };
            wsClient.send(payload);
            return { content: [{ type: 'text', text: `Played note: ${note} on ${instrument}` }] };
        }
        if (name === 'play_sequence') {
            rateLimiter.checkLimit();
            const payload = {
                type: 'data-channel-message',
                payload: {
                    message: {
                        type: 'playSequence',
                        instrument: args?.instrument,
                        bpm: args?.bpm,
                        events: args?.events
                    }
                }
            };
            wsClient.send(payload);
            return {
                content: [
                    { type: 'text', text: `Playing sequence with ${args?.events?.length} events` }
                ]
            };
        }
        throw new Error(`Unknown tool: ${name}`);
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true
        };
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('AI Musician MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
