from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ResultadoDetector:
    clase_yolo: int
    confianza: float
    x1: float
    y1: float
    x2: float
    y2: float


class Detector(Protocol):
    @property
    def version(self) -> str:
        ...

    def detectar(self, image_path: str) -> list[ResultadoDetector]:
        ...