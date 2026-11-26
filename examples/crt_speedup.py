"""How much faster is decryption with the Chinese Remainder Theorem?

Run from the repo root:  python3 examples/crt_speedup.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from toyrsa import decrypt_int, decrypt_int_crt, encrypt_int, generate_keypair  # noqa: E402


def timed(fn, *args, repeat: int = 20) -> float:
    t0 = time.perf_counter()
    for _ in range(repeat):
        fn(*args)
    return (time.perf_counter() - t0) / repeat


def main() -> None:
    print(f"{'key size':>9} {'normal':>10} {'with CRT':>10} {'speedup':>8}")
    for bits in (512, 1024, 2048, 3072):
        public, private = generate_keypair(bits)
        c = encrypt_int(123456789, public)
        assert decrypt_int(c, private) == decrypt_int_crt(c, private) == 123456789
        slow = timed(decrypt_int, c, private)
        fast = timed(decrypt_int_crt, c, private)
        print(f"{bits:>5} bits {slow * 1000:>8.2f}ms {fast * 1000:>8.2f}ms {slow / fast:>7.1f}x")


if __name__ == "__main__":
    main()
