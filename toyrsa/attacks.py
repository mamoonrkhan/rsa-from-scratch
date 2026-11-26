"""Ways to break RSA when it's set up badly.

RSA is only as safe as the assumption that factoring n is hard. Each attack here
shows a way that assumption, or the way RSA is used, can fail.
"""

from __future__ import annotations

from .numbers import gcd, integer_root, mod_inverse
from .rsa import PrivateKey, PublicKey, make_keypair


def factor_by_trial_division(n: int) -> tuple[int, int]:
    """Finds p and q by trying every odd divisor up to sqrt(n).

    Fine for small n, hopeless for real keys. The work is about sqrt(n) = 2^(bits/2),
    so every extra bit in n multiplies the work by about 1.41, and every 2 extra bits
    double it. A 2048-bit key would take about 2^1024 steps.
    """
    if n % 2 == 0:
        return 2, n // 2
    d = 3
    while d * d <= n:
        if n % d == 0:
            return d, n // d
        d += 2
    raise ValueError(f"{n} is prime")


def recover_private_key(public: PublicKey, p: int, q: int) -> PrivateKey:
    """Once n is factored, the private key follows immediately."""
    _, private = make_keypair(p, q, public.e)
    return private


def shared_prime_attack(n1: int, n2: int) -> tuple[int, int, int] | None:
    """If two keys share a prime factor, gcd finds it instantly.

    Factoring n1 or n2 on its own is hard. But if both were made with the same p
    (which happens when a device's random number generator is weak), then
    gcd(n1, n2) = p, and Euclid's algorithm computes that in microseconds.
    In 2012, researchers ran this on millions of real public keys from the internet
    and could break tens of thousands of them this way.

    Returns (p, n1 // p, n2 // p), or None if the keys share no factor.
    """
    p = gcd(n1, n2)
    if p == 1 or p == n1 or p == n2:
        return None
    return p, n1 // p, n2 // p


def small_message_attack(c: int, e: int, n: int) -> int | None:
    """Undoes textbook RSA with a small e when the message is short.

    If m^e < n, then "mod n" never wraps around, so c = m^e exactly, as a normal
    integer, and m is just the e-th root of c. With e = 3 and a short message this
    happens easily. Real RSA adds random padding so m is always large.
    """
    m = integer_root(c, e)
    return m if m ** e == c else None


def same_message_to_three_people(ciphertexts: list[int], moduli: list[int]) -> int:
    """Hastad's broadcast attack: the same message sent to 3 people with e = 3.

    Each person gets c_i = m^3 mod n_i. The Chinese Remainder Theorem combines the
    three into m^3 mod (n1 * n2 * n3). Since m < each n_i, m^3 is smaller than that
    product, so the "mod" does nothing and a plain cube root gives m back.
    """
    product = 1
    for n in moduli:
        product *= n
    combined = 0
    for c, n in zip(ciphertexts, moduli):
        rest = product // n
        combined += c * rest * mod_inverse(rest, n)
    combined %= product
    return integer_root(combined, len(moduli))
