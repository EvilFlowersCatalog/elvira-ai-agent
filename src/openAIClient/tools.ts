import { Tool } from "openai/resources/responses/responses";

export function getTools(): Array<Tool> {
    return [
        {
            "type": "function",
            "name": "getEntryDetails",
            "description": "Elvira - Retrieve entry details using the provided ID",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Unique identifier of the entry to retrieve details for"
                    }
                },
                "required": [
                    "id"
                ],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "getEntries",
            "description": "Elvira - Retrieve entries with pagination and filtering support",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "page": {
                        "type": "integer",
                        "description": "Page number to retrieve, starting from 1"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of entries per page"
                    },
                    "title": {
                        "type": ["string", "null"],
                        "description": "Filter by title (unaccent, icontains)"
                    },
                    "summary": {
                        "type": ["string", "null"],
                        "description": "Filter by summary (unaccent, icontains)"
                    },
                    "category_term": {
                        "type": ["string", "null"],
                        "description": "Filter by category_term (exact)"
                    },
                    "author": {
                        "type": ["string", "null"],
                        "description": "Filter by author (exact)"
                    },
                    "language_code": {
                        "type": ["string", "null"],
                        "description": "Filter by language_code (exact)"
                    },
                    "published_at__gte": {
                        "type": ["string", "null"],
                        "description": "Filter by published date greater than or equal (ISO 8601 format)"
                    },
                    "published_at__lte": {
                        "type": ["string", "null"],
                        "description": "Filter by published date less than or equal (ISO 8601 format)"
                    },
                    "config__readium_enabled": {
                        "type": ["boolean", "null"],
                        "description": "Filter by readium enabled status"
                    },
                    "query": {
                        "type": ["string", "null"],
                        "description": "Filter by query (exact)"
                    }
                },
                "required": [
                    "page",
                    "limit",
                    'title',
                    'author',
                    'summary',
                    'category_term',
                    'language_code',
                    'published_at__gte',
                    'published_at__lte',
                    'config__readium_enabled',
                    'query'
                ],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "displayBooks",
            "description": "Display books in the UI given an array of book IDs",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "ids": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "description": "Unique identifier of a book"
                        },
                        "description": "Array of book IDs to display"
                    }
                },
                "required": [
                    "ids"
                ],
                "additionalProperties": false
            }
        }
    ];
}
