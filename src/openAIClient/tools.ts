import { Tool } from "openai/resources/responses/responses";

export function getTools(): Array<Tool> {
    return [
        {
            "type": "function",
            "name": "getEntryDetails",
            "description": "Elvira - Retrieve entry details using the provided ID and catalogId",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Unique identifier of the entry to retrieve details for"
                    },
                    "catalogId": {
                        "type": "string",
                        "description": "REQUIRED: Catalog ID where this entry belongs. Extract from the displayBooks call or conversation history where this book was shown."
                    }
                },
                "required": [
                    "id",
                    "catalogId"
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
            "description": "Display books in the UI. Each book must include its catalogId from the entry's catalog_id field.",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "books": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "Unique identifier of the book"
                                },
                                "catalogId": {
                                    "type": "string",
                                    "description": "Catalog ID where this book belongs (from entry.catalog_id)"
                                }
                            },
                            "required": ["id", "catalogId"],
                            "additionalProperties": false
                        },
                        "description": "Array of books with their catalog IDs"
                    }
                },
                "required": [
                    "books"
                ],
                "additionalProperties": false
            }
        }
    ];
}
