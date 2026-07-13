"""Bump when preview pipeline output or playback semantics change."""

# Increment when prepare_route_preview_runtime.py story/scene logic changes.
STORY_VERSION = "1"

# Increment when runtime.json schema or scene/timeline generation changes.
RUNTIME_VERSION = "2"

# Increment when camera, overlays, playback, or map rendering changes (Python + frontend).
CAMERA_VERSION = "3"

# Combined token — bump when any sub-version changes or on intentional full invalidation.
PREVIEW_PIPELINE_VERSION = f"story-{STORY_VERSION}-runtime-{RUNTIME_VERSION}-camera-{CAMERA_VERSION}"
