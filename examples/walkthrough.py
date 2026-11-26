"""RSA by hand, with numbers small enough to check on paper.

Run from the repo root:  python3 examples/walkthrough.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from toyrsa import decrypt_int, encrypt_int, extended_gcd, gcd, make_keypair  # noqa: E402


def euclid_table(a: int, b: int) -> None:
    while b:
        print(f"    {a:>5} = {a // b:>3} × {b:>5} + {a % b}")
        a, b = b, a % b
    print(f"    so gcd = {a}")


def square_and_multiply(base: int, exponent: int, mod: int) -> int:
    bits = bin(exponent)[2:]
    print(f"    {exponent} in binary is {bits}, so we need {base}^(powers of 2) for each 1 bit")
    result, power, k = 1, base % mod, 1
    for bit in reversed(bits):
        if bit == "1":
            result = result * power % mod
            print(f"    {base}^{k:<5} ≡ {power:>5}   used (bit is 1): running product ≡ {result}")
        else:
            print(f"    {base}^{k:<5} ≡ {power:>5}   skipped")
        power = power * power % mod
        k *= 2
    return result


def main() -> None:
    p, q, e = 61, 53, 17
    print("1. Pick two primes")
    print(f"    p = {p}, q = {q}\n")

    n, phi = p * q, (p - 1) * (q - 1)
    print("2. Multiply them. n is public; p and q stay secret")
    print(f"    n = {p} × {q} = {n}\n")

    print("3. Euler's totient: how many numbers from 1 to n share no factor with n")
    print(f"    φ(n) = (p - 1)(q - 1) = {p - 1} × {q - 1} = {phi}\n")

    print(f"4. Pick a public exponent e that shares no factor with φ(n). Try e = {e}:")
    euclid_table(phi, e)
    assert gcd(e, phi) == 1
    print()

    _, x, _ = extended_gcd(e, phi)
    public, private = make_keypair(p, q, e)
    print("5. The private exponent d is the inverse of e mod φ(n), from extended Euclid")
    print(f"    {e} × {x} + {phi} × (something) = 1, so d ≡ {x} ≡ {private.d} (mod {phi})")
    print(f"    check: {e} × {private.d} = {e * private.d} = {(e * private.d) // phi} × {phi} + 1\n")

    print(f"    public key  (n, e) = ({n}, {e})")
    print(f"    private key (n, d) = ({n}, {private.d})\n")

    m = 65  # the letter "A"
    print(f"6. Encrypt the message m = {m} (the letter 'A'): c = m^e mod n")
    c = square_and_multiply(m, e, n)
    assert c == encrypt_int(m, public)
    print(f"    c = {c}\n")

    print(f"7. Decrypt: m = c^d mod n = {c}^{private.d} mod {n}")
    back = decrypt_int(c, private)
    print(f"    = {back}   ('{chr(back)}')\n")

    print("Why that works: e × d = 1 + k × φ(n) for some k, so")
    print("    c^d = m^(e×d) = m × (m^φ(n))^k ≡ m × 1^k = m (mod n)")
    print("using Euler's theorem, m^φ(n) ≡ 1 (mod n).")


if __name__ == "__main__":
    main()
