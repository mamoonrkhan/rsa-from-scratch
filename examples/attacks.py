"""Breaking RSA when it's used badly.

Run from the repo root:  python3 examples/attacks.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from toyrsa import decrypt_text, encrypt_int, encrypt_text, generate_keypair, make_keypair, random_prime  # noqa: E402
from toyrsa.attacks import (factor_by_trial_division, recover_private_key, same_message_to_three_people,  # noqa: E402
                            shared_prime_attack, small_message_attack)
from toyrsa.rsa import int_to_text, text_to_int  # noqa: E402


def factoring() -> None:
    print("Attack 1: just factor n")
    print("  How long does trial division take as the key gets bigger?\n")
    print(f"  {'key size':>9} {'time':>10}")
    for bits in range(24, 53, 4):
        times = []
        for _ in range(3):
            public, _ = generate_keypair(bits)
            t0 = time.perf_counter()
            factor_by_trial_division(public.n)
            times.append(time.perf_counter() - t0)
        print(f"  {bits:>5} bits {sorted(times)[1]:>9.4f}s")
    print("\n  Every 4 bits makes it about 4 times slower. Real keys are 2048 bits, which")
    print("  means about 2^1024 (roughly 10^308) divisions. Even at a billion a second,")
    print("  that's around 10^291 years.\n")

    public, _ = generate_keypair(40)
    secret = encrypt_int(42, public)
    p, q = factor_by_trial_division(public.n)
    private = recover_private_key(public, p, q)
    print(f"  Example: n = {public.n} = {p} × {q}, so we rebuild the private key and decrypt")
    print(f"  ciphertext {secret} -> {pow(secret, private.d, public.n)}\n")


def shared_prime() -> None:
    print("Attack 2: two keys that share a prime")
    shared = random_prime(512)
    a_pub, _ = make_keypair(shared, random_prime(512))
    b_pub, _ = make_keypair(shared, random_prime(512))
    t0 = time.perf_counter()
    p, q1, q2 = shared_prime_attack(a_pub.n, b_pub.n)
    took = time.perf_counter() - t0
    print("  Two 1024-bit keys, each impossible to factor on its own.")
    print(f"  gcd(n1, n2) found the shared prime in {took * 1e6:.0f} microseconds:")
    print(f"  p = {str(p)[:30]}...")
    print(f"  Both keys are now broken: n1 = p × {str(q1)[:12]}..., n2 = p × {str(q2)[:12]}...\n")


def small_e() -> None:
    print("Attack 3: tiny e, short message, no padding")
    public, _ = generate_keypair(1024, e=3)
    c = encrypt_text("meet at noon", public)
    m = small_message_attack(c, 3, public.n)
    print("  With e = 3, a short message cubed is still smaller than n, so 'mod n' does nothing.")
    print(f"  The cube root of the ciphertext is just the message: {int_to_text(m)!r}\n")

    print("Attack 4: the same message sent to three people, e = 3")
    keys = [generate_keypair(1024, e=3)[0] for _ in range(3)]
    message = "the password is hunter2, please don't share it with anyone at all"
    m = text_to_int(message)
    assert all(m ** 3 > k.n for k in keys), "message must be too long for attack 3"
    cts = [encrypt_int(m, k) for k in keys]
    recovered = same_message_to_three_people(cts, [k.n for k in keys])
    print("  This message is long enough that attack 3 fails on any single ciphertext.")
    print("  But the Chinese Remainder Theorem combines all three into m^3 mod (n1 n2 n3),")
    print(f"  and the cube root of that gives: {int_to_text(recovered)!r}\n")

    print("  This is why real RSA always adds random padding before encrypting.")


def main() -> None:
    factoring()
    shared_prime()
    small_e()
    # Sanity check that normal use still works.
    public, private = generate_keypair(1024)
    assert decrypt_text(encrypt_text("ok", public), private) == "ok"


if __name__ == "__main__":
    main()
