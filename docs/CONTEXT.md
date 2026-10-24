# Travel Photo Journal

A private journal where each person keeps their own collection of travel photos with notes. Nothing a person stores is visible to anyone else.

## Language

### People and access

**User**:
A person with an account, identified by a unique, case-insensitive email address.
_Avoid_: Account, member, customer

**Unverified User**:
A **User** who has registered but not yet proven they own the email address; cannot sign in.
_Avoid_: Inactive user, pending user

**Verified User**:
A **User** whose email ownership has been confirmed through a **Verification Token**.
_Avoid_: Active user, confirmed user

**Verification Token**:
A single-use, time-limited secret emailed to a **User** to prove email ownership.
_Avoid_: Confirmation code, activation link

**Access Token**:
A short-lived credential presented with each request to prove who the caller is.
_Avoid_: Session token, auth token

**Refresh Token**:
A longer-lived, single-use credential that can be exchanged for a new **Access Token** and a new **Refresh Token**.
_Avoid_: Remember-me token

**Session**:
The chain of **Refresh Tokens** that descend from one sign-in; ends on logout, expiry, or detected reuse.
_Avoid_: Token family, login

**Two-Factor Authentication (2FA)**:
An extra sign-in step where a **User** supplies a time-based code from an authenticator app.
_Avoid_: MFA, OTP login

**TOTP Secret**:
The shared secret between a **User** and their authenticator app that produces the codes.
_Avoid_: 2FA key, seed

### Photos

**Photo**:
A **User**'s journal entry: one **Image** together with its name, location, description and **Summary**.
_Avoid_: Entry, post, memory, upload

**Image**:
The picture file belonging to a **Photo**.
_Avoid_: Picture, attachment, file

**Summary**:
A short text condensed from a **Photo**'s description by the system; never supplied by a **User**, and absent when it could not be produced.
_Avoid_: Caption, abstract

**Object Key**:
The private storage address of an **Image**; never shown to clients.
_Avoid_: Path, filename, URL

**Signed URL**:
A short-lived link that lets a client fetch one **Image** without being able to guess or reuse other addresses.
_Avoid_: Public URL, image link

**Ownership**:
The rule that a **Photo** can only be seen or changed by the **User** who created it.
_Avoid_: Permissions, access control

## Relationships

- A **User** has zero or more **Photos**; a **Photo** belongs to exactly one **User**
- A **Photo** has exactly one **Image** and at most one **Summary**
- A **Photo** belonging to someone else is indistinguishable from a **Photo** that does not exist
- A **User** has zero or more **Sessions**; a **Session** is made of one or more **Refresh Tokens**, only the latest of which is usable
- A **User** has at most one **TOTP Secret**; **2FA** is on only after the first code is confirmed

## Example dialogue

> **Dev:** "A new person signs up. Can they add a **Photo** right away?"
> **Domain expert:** "No. They're an **Unverified User** until they use the **Verification Token** we email. Only a **Verified User** can sign in at all."
>
> **Dev:** "After sign-in they get an **Access Token**. What happens when it expires?"
> **Domain expert:** "The client trades its **Refresh Token** for a fresh pair. The old one is spent. If a spent one is ever presented again, we assume it leaked and end the whole **Session**."
>
> **Dev:** "If I ask for a **Photo** that belongs to someone else?"
> **Domain expert:** "You get 'not found', exactly as if it never existed. **Ownership** must not leak what exists."
>
> **Dev:** "And the **Summary**: can the **User** edit it?"
> **Domain expert:** "No. The system produces it from the description. If that fails, the **Photo** still saves with no **Summary**."

## Flagged ambiguities

- "Inactive user" (used for a freshly registered account) and "unverified" were used for the same state — resolved: **Unverified User**. "Inactive" is not a state in this domain.
- "Session" was used loosely for both a signed-in period and a stored token — resolved: a **Session** is the chain; individual stored tokens are **Refresh Tokens**.
- "Image", "photo" and "picture" were used interchangeably — resolved: **Photo** is the record, **Image** is its file.
