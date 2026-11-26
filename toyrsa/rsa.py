"""RSA key generation, encryption, decryption and signatures.

This is "textbook" RSA: the math exactly as taught, with nothing added. Real systems
also add random padding (OAEP for encryption, PSS for signatures), because textbook
RSA has weaknesses. Some of them are shown in attacks.py. Don't use this to protect
anything real.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from .numbers import gcd, mod_inverse, mod_pow, random_prime


@dataclass(frozen=True)
class PublicKey:
    n: int  # the modulus, p * q
    e: int  # the public exponent


@dataclass(frozen=True)
class PrivateKey:
    n: int
    d: int  # the private exponent: e * d ≡ 1 (mod φ(n))
    p: int
    q: int

    # Precomputed values for faster decryption with the Chinese Remainder Theorem.
    @property
    def dp(self) -> int:
        return self.d % (self.p - 1)

    @property
    def dq(self) -> int:
        return self.d % (self.q - 1)

    @property
    def q_inv(self) -> int:
        return mod_inverse(self.q, self.p)


def make_keypair(p: int, q: int, e: int = 65537) -> tuple[PublicKey, PrivateKey]:
    """Builds a key pair from two primes you choose. Handy for small examples."""
    if p == q:
        raise ValueError("p and q must be different primes")
    phi = (p - 1) * (q - 1)  # Euler's totient of n = p*q
    if gcd(e, phi) != 1:
        raise ValueError(f"e = {e} shares a factor with φ(n) = {phi}, so it has no inverse; pick another e")
    d = mod_inverse(e, phi)
    n = p * q
    return PublicKey(n, e), PrivateKey(n, d, p, q)


def generate_keypair(bits: int = 2048, e: int = 65537) -> tuple[PublicKey, PrivateKey]:
    """Generates a key pair whose modulus has `bits` bits."""
    while True:
        p = random_prime(bits // 2)
        q = random_prime(bits - bits // 2)
        if p != q and gcd(e, (p - 1) * (q - 1)) == 1 and (p * q).bit_length() == bits:
            return make_keypair(p, q, e)


def encrypt_int(m: int, key: PublicKey) -> int:
    """c = m^e mod n."""
    if not 0 <= m < key.n:
        raise ValueError("the message must be a number from 0 to n - 1")
    return mod_pow(m, key.e, key.n)


def decrypt_int(c: int, key: PrivateKey) -> int:
    """m = c^d mod n. Works because of Euler's theorem: m^(e*d) ≡ m (mod n)."""
    return mod_pow(c, key.d, key.n)


def decrypt_int_crt(c: int, key: PrivateKey) -> int:
    """Same answer as decrypt_int, about 3x faster.

    Instead of one exponentiation mod n, do two with half-size numbers: one mod p
    and one mod q. The Chinese Remainder Theorem says knowing m mod p and m mod q
    pins down m mod n (since p and q are coprime), and gives a formula to combine
    them.
    """
    mp = mod_pow(c, key.dp, key.p)
    mq = mod_pow(c, key.dq, key.q)
    h = key.q_inv * (mp - mq) % key.p
    return mq + h * key.q


def text_to_int(text: str) -> int:
    return int.from_bytes(text.encode("utf-8"), "big")


def int_to_text(m: int) -> str:
    return m.to_bytes((m.bit_length() + 7) // 8, "big").decode("utf-8")


def encrypt_text(text: str, key: PublicKey) -> int:
    m = text_to_int(text)
    if m >= key.n:
        raise ValueError("message too long for this key; use a bigger key or a shorter message")
    return encrypt_int(m, key)


def decrypt_text(c: int, key: PrivateKey) -> str:
    return int_to_text(decrypt_int_crt(c, key))


def _digest(message: str, n: int) -> int:
    return int.from_bytes(hashlib.sha256(message.encode("utf-8")).digest(), "big") % n


def sign(message: str, key: PrivateKey) -> int:
    """A signature is the hash "decrypted" with the private key: s = h^d mod n.

    Only the private key holder can make it, and anyone can check it with the
    public key, because s^e ≡ h (mod n).
    """
    return decrypt_int_crt(_digest(message, key.n), key)


def verify(message: str, signature: int, key: PublicKey) -> bool:
    return mod_pow(signature, key.e, key.n) == _digest(message, key.n)
