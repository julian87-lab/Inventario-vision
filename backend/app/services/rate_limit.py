from collections import deque
from threading import Lock
from time import monotonic


class LimitadorVentana:
    """Límite por ventana deslizante, en memoria (un solo proceso)."""

    def __init__(self, maximo: int, ventana_segundos: float) -> None:
        self._maximo = maximo
        self._ventana = ventana_segundos
        self._eventos: dict[str, deque[float]] = {}
        self._lock = Lock()

    def permitir(self, clave: str) -> bool:
        ahora = monotonic()

        with self._lock:
            self._purgar(ahora)
            cola = self._eventos.setdefault(clave, deque())

            while cola and ahora - cola[0] >= self._ventana:
                cola.popleft()

            if len(cola) >= self._maximo:
                return False

            cola.append(ahora)
            return True

    def _purgar(self, ahora: float) -> None:
        if len(self._eventos) < 1000:
            return

        vacias = [
            clave
            for clave, cola in self._eventos.items()
            if not cola or ahora - cola[-1] >= self._ventana
        ]
        for clave in vacias:
            del self._eventos[clave]
            