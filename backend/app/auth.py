import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

TOKEN_TTL = timedelta(hours=8)
ALGORITHM = "HS256"

# scrypt cost: 16 MB and a few tens of ms per check, fine for one login form.
# The cost is written into each hash, so it can be raised later without locking anyone out.
COST_N, COST_R, COST_P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=COST_N, r=COST_R, p=COST_P)
    return f"scrypt${COST_N}${COST_R}${COST_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = bytes.fromhex(salt_hex), bytes.fromhex(digest_hex)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=int(n), r=int(r), p=int(p))
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


# verified against when the email is unknown, so "no such user" and "wrong
# password" take the same time and can't be told apart
DUMMY_HASH = hash_password(secrets.token_hex(8))


def create_token(email: str, secret: str, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return jwt.encode({"sub": email, "iat": now, "exp": now + TOKEN_TTL}, secret, algorithm=ALGORITHM)


def read_token(token: str, secret: str) -> str | None:
    """The email in a valid token, or None if it is expired, tampered with or malformed."""
    try:
        claims = jwt.decode(token, secret, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        return None
    return claims["sub"]
