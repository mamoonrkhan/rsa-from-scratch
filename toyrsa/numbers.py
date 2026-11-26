"""The number theory RSA is built on.

Everything here is a standard result from an intro discrete math course. Python
already has most of these built in (math.gcd, pow(a, b, m), pow(a, -1, m)); they're
written out by hand here so you can see how they work. The tests check each one
against Python's built-in version.
"""

from __future__ import annotations

import random

_rng = random.SystemRandom()


def gcd(a: int, b: int) -> int:
    """Greatest common divisor, by Euclid's algorithm.

    Key fact: gcd(a, b) = gcd(b, a mod b). Each step makes the numbers smaller,
    and when b reaches 0, a is the answer. It's fast: the number of steps grows
    with the number of digits, not with the size of the numbers.
    """
    a, b = abs(a), abs(b)
    while b:
        a, b = b, a % b
    return a


def extended_gcd(a: int, b: int) -> tuple[int, int, int]:
    """Returns (g, x, y) with a*x + b*y = g = gcd(a, b).

    That x and y always exist is Bezout's identity. We find them by running
    Euclid's algorithm while keeping track of how each remainder can be written
    as a combination of a and b.
    """
    old_r, r = a, b
    old_x, x = 1, 0
    old_y, y = 0, 1
    while r:
        q = old_r // r
        old_r, r = r, old_r - q * r
        old_x, x = x, old_x - q * x
        old_y, y = y, old_y - q * y
    return old_r, old_x, old_y


def mod_inverse(a: int, m: int) -> int:
    """The number x with a*x ≡ 1 (mod m).

    It exists exactly when gcd(a, m) = 1. From Bezout, a*x + m*y = 1, and reducing
    that mod m gives a*x ≡ 1. This is how RSA computes its private key.
    """
    g, x, _ = extended_gcd(a % m, m)
    if g != 1:
        raise ValueError(f"{a} has no inverse mod {m} (they share the factor {g})")
    return x % m


def mod_pow(base: int, exponent: int, modulus: int) -> int:
    """base**exponent mod modulus, by repeated squaring.

    Computing base**exponent first is hopeless when the exponent has hundreds of
    digits. Instead, write the exponent in binary. Squaring gives base^1, base^2,
    base^4, base^8, ..., and we multiply together the ones whose bit is 1, reducing
    mod modulus after every step so the numbers never get big. That's about
    2 * (number of bits) multiplications instead of `exponent` of them.
    """
    if modulus == 1:
        return 0
    result = 1
    base %= modulus
    while exponent > 0:
        if exponent & 1:
            result = result * base % modulus
        base = base * base % modulus
        exponent >>= 1
    return result


_SMALL_PRIMES = [p for p in range(2, 200) if all(p % d for d in range(2, int(p ** 0.5) + 1))]


def is_probable_prime(n: int, rounds: int = 40) -> bool:
    """Miller-Rabin primality test.

    Fermat's little theorem says that if n is prime, a^(n-1) ≡ 1 (mod n) for every
    a not divisible by n. So if we find an a where that fails, n is definitely
    composite. Miller-Rabin is a sharper version of that check that some composite
    numbers (Carmichael numbers like 561) can't fool. Each round catches a composite
    with probability at least 3/4, so 40 rounds leave an error chance below 1 in 10^24.
    """
    if n < 2:
        return False
    for p in _SMALL_PRIMES:
        if n % p == 0:
            return n == p

    # Write n - 1 = 2^s * d with d odd.
    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1

    for _ in range(rounds):
        a = _rng.randrange(2, n - 1)
        x = mod_pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = x * x % n
            if x == n - 1:
                break
        else:
            return False  # a is a witness: n is composite
    return True


def random_prime(bits: int) -> int:
    """A random prime with exactly `bits` bits.

    By the prime number theorem, about 1 in every ln(2^bits) numbers near 2^bits is
    prime (roughly 1 in 710 for 1024 bits), so guessing odd numbers finds one fast.
    """
    if bits < 2:
        raise ValueError("need at least 2 bits")
    while True:
        # Set the top bit so it really has `bits` bits, and the bottom bit so it's odd.
        candidate = _rng.getrandbits(bits) | (1 << (bits - 1)) | 1
        if is_probable_prime(candidate):
            return candidate


def integer_root(n: int, k: int) -> int:
    """The largest integer r with r**k <= n, by binary search."""
    if n < 0:
        raise ValueError("n must be non-negative")
    lo, hi = 0, 1 << (n.bit_length() // k + 1)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if mid ** k <= n:
            lo = mid
        else:
            hi = mid - 1
    return lo
