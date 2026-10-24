# Duplicate registration returns 409

Registering with an email that already exists returns `409 EMAIL_TAKEN`. This is clear for real users but lets an attacker test whether an address is registered. The alternative (always answer 201 and email the existing owner) hides that fact but complicates the flow and its tests.

We accept the disclosure and limit its value with a strict rate limit on register, and by making login failures identical for an unknown email and a wrong password. Uniqueness is enforced by the database constraint (catching the violation) rather than a pre-query, so two concurrent registrations cannot both succeed.
