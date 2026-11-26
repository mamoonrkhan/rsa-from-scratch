"""Run with:  python3 -m unittest discover tests"""

import math
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from toyrsa import (decrypt_int, decrypt_int_crt, decrypt_text, encrypt_int, encrypt_text, extended_gcd,  # noqa: E402
                    gcd, generate_keypair, is_probable_prime, make_keypair, mod_inverse, mod_pow, random_prime,
                    sign, verify)
from toyrsa.attacks import (factor_by_trial_division, recover_private_key, same_message_to_three_people,  # noqa: E402
                            shared_prime_attack, small_message_attack)
from toyrsa.numbers import integer_root  # noqa: E402
from toyrsa.rsa import int_to_text, text_to_int  # noqa: E402

rng = random.Random(2026)


def sieve(limit):
    is_p = [True] * (limit + 1)
    is_p[0] = is_p[1] = False
    for i in range(2, int(limit ** 0.5) + 1):
        if is_p[i]:
            is_p[i * i::i] = [False] * len(is_p[i * i::i])
    return is_p


class NumberTheory(unittest.TestCase):
    def test_gcd_matches_python(self):
        for _ in range(2000):
            a, b = rng.randrange(-10**12, 10**12), rng.randrange(-10**12, 10**12)
            self.assertEqual(gcd(a, b), math.gcd(a, b))

    def test_extended_gcd_gives_bezout_coefficients(self):
        for _ in range(2000):
            a, b = rng.randrange(1, 10**30), rng.randrange(1, 10**30)
            g, x, y = extended_gcd(a, b)
            self.assertEqual(g, math.gcd(a, b))
            self.assertEqual(a * x + b * y, g)

    def test_mod_inverse(self):
        for _ in range(2000):
            m = rng.randrange(2, 10**20)
            a = rng.randrange(1, m)
            if math.gcd(a, m) == 1:
                self.assertEqual(mod_inverse(a, m), pow(a, -1, m))
            else:
                with self.assertRaises(ValueError):
                    mod_inverse(a, m)

    def test_mod_pow_matches_python(self):
        for _ in range(2000):
            b, e, m = rng.randrange(0, 10**40), rng.randrange(0, 10**40), rng.randrange(1, 10**40)
            self.assertEqual(mod_pow(b, e, m), pow(b, e, m))
        self.assertEqual(mod_pow(5, 0, 7), 1)
        self.assertEqual(mod_pow(5, 3, 1), 0)

    def test_primality_against_a_sieve(self):
        is_p = sieve(20000)
        for n in range(20001):
            self.assertEqual(is_probable_prime(n), is_p[n], n)

    def test_carmichael_numbers_are_caught(self):
        # These fool the plain Fermat test for every base coprime to them.
        for n in (561, 1105, 1729, 2465, 2821, 6601, 8911, 41041, 825265, 321197185, 5394826801):
            self.assertFalse(is_probable_prime(n), n)

    def test_known_large_primes(self):
        self.assertTrue(is_probable_prime(2**127 - 1))       # Mersenne prime
        self.assertFalse(is_probable_prime(2**127 + 1))
        self.assertTrue(is_probable_prime(2**521 - 1))
        self.assertFalse(is_probable_prime((2**61 - 1) * (2**89 - 1)))

    def test_random_prime_has_right_size(self):
        for bits in (8, 16, 64, 256):
            p = random_prime(bits)
            self.assertEqual(p.bit_length(), bits)
            self.assertTrue(is_probable_prime(p))

    def test_integer_root(self):
        for _ in range(500):
            k = rng.randrange(2, 6)
            r = rng.randrange(0, 10**30)
            self.assertEqual(integer_root(r ** k, k), r)
            if r:
                self.assertEqual(integer_root(r ** k - 1, k), r - 1)


class Rsa(unittest.TestCase):
    def test_textbook_example(self):
        public, private = make_keypair(61, 53, 17)
        self.assertEqual((public.n, private.d), (3233, 2753))
        self.assertEqual(encrypt_int(65, public), 2790)
        self.assertEqual(decrypt_int(2790, private), 65)

    def test_classroom_story(self):
        # The numbers in the "passing a note in class" story on the web page.
        public, private = make_keypair(5, 11, 3)
        self.assertEqual((public.n, private.d), (55, 27))
        self.assertEqual(3 * 27, 2 * 40 + 1)
        self.assertEqual([encrypt_int(m, public) for m in (8, 9)], [17, 14])  # H = 8, I = 9
        self.assertEqual([decrypt_int(c, private) for c in (17, 14)], [8, 9])
        self.assertEqual([8 ** 3, 9 ** 3], [9 * 55 + 17, 13 * 55 + 14])
        # Repeated squaring of 17, and 27 = 16 + 8 + 2 + 1.
        self.assertEqual([pow(17, k, 55) for k in (1, 2, 4, 8, 16)], [17, 14, 31, 26, 16])
        self.assertEqual(17 * 14 * 26 * 16 % 55, 8)
        self.assertEqual(len(str(17 ** 27)), 34)

    def test_every_message_round_trips_for_a_small_key(self):
        public, private = make_keypair(61, 53, 17)
        for m in range(public.n):
            c = encrypt_int(m, public)
            self.assertEqual(decrypt_int(c, private), m)
            self.assertEqual(decrypt_int_crt(c, private), m)

    def test_round_trip_with_real_size_keys(self):
        for bits in (512, 1024, 2048):
            public, private = generate_keypair(bits)
            self.assertEqual(public.n.bit_length(), bits)
            for _ in range(5):
                m = rng.randrange(public.n)
                c = encrypt_int(m, public)
                self.assertEqual(decrypt_int(c, private), m)
                self.assertEqual(decrypt_int_crt(c, private), m)

    def test_text(self):
        public, private = generate_keypair(1024)
        for text in ("hi", "discrete math ✓", "x" * 100):
            self.assertEqual(decrypt_text(encrypt_text(text, public), private), text)
        with self.assertRaises(ValueError):
            encrypt_text("y" * 200, public)  # longer than the key

    def test_bad_parameters(self):
        with self.assertRaises(ValueError):
            make_keypair(61, 61)
        with self.assertRaises(ValueError):
            make_keypair(61, 53, 3)  # 3 divides φ = 3120
        public, _ = make_keypair(61, 53, 17)
        with self.assertRaises(ValueError):
            encrypt_int(public.n, public)

    def test_signatures(self):
        public, private = generate_keypair(1024)
        s = sign("I owe you $5", private)
        self.assertTrue(verify("I owe you $5", s, public))
        self.assertFalse(verify("I owe you $500", s, public))
        self.assertFalse(verify("I owe you $5", s + 1, public))
        other, _ = generate_keypair(1024)
        self.assertFalse(verify("I owe you $5", s, other))


class Attacks(unittest.TestCase):
    def test_factoring_small_keys(self):
        for _ in range(10):
            public, private = generate_keypair(32)
            p, q = factor_by_trial_division(public.n)
            self.assertEqual(p * q, public.n)
            self.assertEqual(recover_private_key(public, p, q).d, private.d)

    def test_shared_prime(self):
        p = random_prime(256)
        q1, q2 = random_prime(256), random_prime(256)
        self.assertEqual(shared_prime_attack(p * q1, p * q2), (p, q1, q2))
        self.assertIsNone(shared_prime_attack(random_prime(64) * random_prime(64), random_prime(64) * random_prime(64)))

    def test_small_message(self):
        public, _ = generate_keypair(1024, e=3)
        c = encrypt_text("attack at dawn", public)
        self.assertEqual(int_to_text(small_message_attack(c, 3, public.n)), "attack at dawn")
        big = rng.randrange(public.n // 2, public.n)
        self.assertIsNone(small_message_attack(encrypt_int(big, public), 3, public.n))

    def test_broadcast(self):
        keys = [generate_keypair(512, e=3)[0] for _ in range(3)]
        m = text_to_int("y" * 60)
        cts = [encrypt_int(m, k) for k in keys]
        self.assertEqual(same_message_to_three_people(cts, [k.n for k in keys]), m)


if __name__ == "__main__":
    unittest.main()
