# argon2id for password hashing

Passwords are hashed with argon2id using OWASP-recommended parameters. It is memory-hard, which makes GPU cracking expensive, and the id variant resists both side-channel and GPU attacks. bcrypt was rejected because it is not memory-hard and truncates input at 72 bytes.

Consequence: the `argon2` package is a native module, so the Docker image must use a base image that has a prebuilt binary or the build tools.
