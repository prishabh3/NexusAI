"""File storage handler for dataset uploads."""
from __future__ import annotations

import hashlib
import logging
import uuid
from pathlib import Path

import aiofiles

from src.infrastructure.config import settings

logger = logging.getLogger(__name__)


class FileHandler:
    def __init__(self, base_path: str = settings.storage_path) -> None:
        self._base = Path(base_path)
        self._uploads_dir = self._base / "uploads"
        self._processed_dir = self._base / "processed"
        self._uploads_dir.mkdir(parents=True, exist_ok=True)
        self._processed_dir.mkdir(parents=True, exist_ok=True)

    async def save_upload(self, file_content: bytes, original_filename: str) -> tuple[str, str]:
        """Saves uploaded file. Returns (file_path, content_hash)."""
        ext = Path(original_filename).suffix.lower().lstrip(".")
        if ext not in settings.storage_allowed_extensions:
            raise ValueError(f"File extension '.{ext}' not allowed.")

        content_hash = hashlib.sha256(file_content).hexdigest()[:16]
        file_id = uuid.uuid4().hex
        filename = f"{file_id}_{content_hash}.{ext}"
        file_path = self._uploads_dir / filename

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_content)

        logger.info("Saved upload: %s (%d bytes)", file_path, len(file_content))
        return str(file_path), content_hash

    def get_upload_path(self, dataset_id: str, filename: str) -> Path:
        return self._uploads_dir / f"{dataset_id}_{filename}"

    def delete_file(self, file_path: str) -> None:
        path = Path(file_path)
        if path.exists():
            path.unlink()
            logger.info("Deleted file: %s", file_path)

    def get_file_size(self, file_path: str) -> int:
        return Path(file_path).stat().st_size

    def file_exists(self, file_path: str) -> bool:
        return Path(file_path).exists()
