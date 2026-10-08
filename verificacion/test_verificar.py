#!/usr/bin/env python3
"""Prueba de la puerta de publicación del Verificador (Req. 8.9, 9.1–9.3, 9.7, 9.8).

Copia el lago y el catálogo reales a un directorio temporal, comprueba que el
Verificador los acepta (código 0) y que, ante cada mutación deliberada de una
Cifra o de una comprobación de dominio, termina con código distinto de cero e
imprime algún FAIL. "Una verificación que nunca falla no está verificando."

Solo biblioteca estándar (unittest + subprocess).
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
VERIFICADOR = RAIZ / "verificacion" / "verificar.py"
LAGO = RAIZ / "lago"
CATALOGO = RAIZ / "catalogo" / "fuentes.json"


def _ejecutar(lago: Path, catalogo: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(VERIFICADOR), "--lago", str(lago), "--catalogo", str(catalogo)],
        capture_output=True, text=True,
    )


class LagoRoto(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = Path(tempfile.mkdtemp(prefix="verificar-test-"))
        self.addCleanup(shutil.rmtree, self.dir, ignore_errors=True)
        self.lago = self.dir / "lago"
        self.catalogo = self.dir / "fuentes.json"
        shutil.copytree(LAGO, self.lago)
        shutil.copyfile(CATALOGO, self.catalogo)

    # -- utilidades --------------------------------------------------------
    def _cargar(self, tema: str) -> dict:
        return json.loads((self.lago / f"{tema}.json").read_text(encoding="utf-8"))

    def _guardar(self, tema: str, datos: dict) -> None:
        (self.lago / f"{tema}.json").write_text(
            json.dumps(datos, ensure_ascii=False), encoding="utf-8")

    def _assert_falla(self, mensaje: str) -> None:
        r = _ejecutar(self.lago, self.catalogo)
        self.assertNotEqual(r.returncode, 0, f"{mensaje}: se esperaba código ≠ 0\n{r.stdout}")
        self.assertIn("FAIL", r.stdout, f"{mensaje}: se esperaba algún FAIL en la salida")

    # -- casos -------------------------------------------------------------
    def test_lago_intacto_pasa(self) -> None:
        r = _ejecutar(self.lago, self.catalogo)
        self.assertEqual(r.returncode, 0, f"el lago intacto debería pasar\n{r.stdout}")
        self.assertIn("PASS", r.stdout)
        self.assertNotIn("\nFAIL", "\n" + r.stdout)

    def test_cifra_sin_unidad(self) -> None:
        datos = self._cargar("poblacion")
        del datos["cifras"]["poblacion_total"]["unidad"]
        self._guardar("poblacion", datos)
        self._assert_falla("una Cifra sin unidad")

    def test_falta_un_distrito(self) -> None:
        datos = self._cargar("poblacion")
        del datos["por_distrito"]["12"]
        self._guardar("poblacion", datos)
        self._assert_falla("un distrito ausente")

    def test_poblacion_fuera_de_rango(self) -> None:
        datos = self._cargar("poblacion")
        datos["cifras"]["poblacion_total"]["valor"] = 9_000_000
        self._guardar("poblacion", datos)
        self._assert_falla("población total fuera de rango")

    def test_suma_distritos_distinta_del_total(self) -> None:
        datos = self._cargar("poblacion")
        datos["por_distrito"]["01"]["poblacion"]["valor"] += 1000
        self._guardar("poblacion", datos)
        self._assert_falla("Σ distritos ≠ total")

    def test_perfil_trafico_con_23_valores(self) -> None:
        datos = self._cargar("trafico")
        datos["series"]["perfil_ciudad"]["valor"] = \
            datos["series"]["perfil_ciudad"]["valor"][:23]
        self._guardar("trafico", datos)
        self._assert_falla("perfil de tráfico de 23 valores")


if __name__ == "__main__":
    unittest.main()
