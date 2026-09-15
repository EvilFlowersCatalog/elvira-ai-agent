import { ToolDefinition } from "./types";

export function getTools(): Array<ToolDefinition> {
    return [
        {
            "name": "getEntryDetails",
            "description": "Elvira - Retrieve entry details using the provided ID and catalogId",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Unique identifier of the entry to retrieve details for"
                    },
                    "catalogId": {
                        "type": "string",
                        "description": "REQUIRED: Catalog UUID where this entry belongs. Extract from the displayBooks call or conversation history where this book was shown. Must be UUID format."
                    }
                },
                "required": [
                    "id",
                    "catalogId"
                ]
            }
        },
        {
            "name": "getEntries",
            "description": "Elvira - Retrieve entries with pagination and filtering support. All filters are optional.",
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
                        "type": "string",
                        "description": "Filter by title (unaccent, icontains)"
                    },
                    "summary": {
                        "type": "string",
                        "description": "Filter by summary (unaccent, icontains)"
                    },
                    "category_term": {
                        "type": "string",
                        "description": "Filter by category_term (exact)"
                    },
                    "author": {
                        "type": "string",
                        "description": "Filter by author (exact)"
                    },
                    "language_code": {
                        "type": "string",
                        "description": "Filter by language_code (exact)"
                    },
                    "published_at__gte": {
                        "type": "string",
                        "description": "Filter by published date greater than or equal (ISO 8601 format)"
                    },
                    "published_at__lte": {
                        "type": "string",
                        "description": "Filter by published date less than or equal (ISO 8601 format)"
                    },
                    "config__readium_enabled": {
                        "type": "boolean",
                        "description": "Filter by readium enabled status"
                    },
                    "query": {
                        "type": "string",
                        "description": "Filter by query (exact)"
                    }
                },
                "required": [
                    "page",
                    "limit"
                ]
            }
        },
        {
            "name": "displayBooks",
            "description": "Display books in the UI. Each book must include its catalogId from the entry's catalog_id field.",
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
                                    "description": "Catalog UUID where this book belongs (from entry.catalog_id field - must be UUID, not slug)"
                                }
                            },
                            "required": ["id", "catalogId"]
                        },
                        "description": "Array of books with their catalog IDs"
                    }
                },
                "required": [
                    "books"
                ]
            }
        }
    ];
}
