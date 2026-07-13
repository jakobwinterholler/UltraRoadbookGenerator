"""Extract contact details from preserved OSM tags."""


def extract_phone(tags: dict[str, str]) -> str | None:
    for key in ("phone", "contact:phone", "contact:mobile"):
        value = tags.get(key)
        if value:
            return value.strip()
    return None


def extract_website(tags: dict[str, str]) -> str | None:
    for key in ("website", "contact:website", "url"):
        value = tags.get(key)
        if value:
            return value.strip()
    return None
