# Existing system design

This document describes the current Express application. It does not replace
the `DESIGN.md` required for the Durable Functions implementation.

## Structure

The npm workspace contains the Express API, React application, shared contracts,
payment simulator and checkout acceptance tests. PostgreSQL stores users,
inventory, holds, bookings and waitlists. Express hosts Socket.io and an
in-process expiry worker. The web application consumes the HTTP API and seat
updates.

## Inventory and pricing

Creating a show copies the venue layout into `ShowSeat` rows. The unique
constraint on `(showId, venueSeatId)` ensures one inventory row per physical
seat per show. It does not by itself guarantee one active booking: booking,
release and cancellation code must validate ownership and state correctly.

`ShowPricing` stores prices per show and category. `BookingSeat.priceAtBooking`
records the price used when the booking is created. Hold totals, payment
amounts and booking prices are calculated at separate points in the current
flow; a persisted checkout price snapshot has not been implemented.

## Holds and transactions

`createHold` locks the requested `ShowSeat` rows with `SELECT ... FOR UPDATE`,
checks availability and creates a hold inside a Prisma transaction. The hold
and booking transactions use `ReadCommitted`, a 10-second transaction timeout
and a 5-second transaction acquisition limit. Those limits are not separate
PostgreSQL lock or statement timeout settings. Lock queries do not explicitly
order seat IDs.

The expiry worker releases elapsed holds and processes waitlist offers every
`SWEEP_INTERVAL_SECONDS`. Seat-map reads also release expired holds. Hold
creation releases stale holds encountered on requested seats; booking checks
the hold's expiry and rejects an elapsed hold.

Release and cancellation paths include checks before their write transactions.
The current tests cover competing hold requests and selected expiry scenarios;
they do not prove every interaction between booking, cancellation, expiry and
process failure. Those interactions need explicit treatment in the checkout
refactor.

## Payments and bookings

`POST /api/bookings` charges the HTTP payment simulator, then attempts the
booking transaction. A new random payment idempotency key is generated for each
request. If booking fails after a known successful charge, the service attempts
a refund. Refund failures are logged. There is no persisted recovery workflow
for an unknown payment outcome or a process failure between the charge and the
database commit.

The booking transaction creates a reference and QR token, records booked seats,
updates inventory and marks the hold converted. Seat updates and the ticket
email follow the transaction. Cancelling an existing booking frees seats and
offers them to the waitlist; that legacy cancellation path does not issue a
payment refund.

## Waitlist

Waitlist entries are scoped to a show and seat category and ordered by creation
time. Offering a freed seat locks that seat and selects a waiting entry using
`FOR UPDATE SKIP LOCKED`. The resulting offer has a TTL and an emailed acceptance
link. Expired offers are processed by the worker and the seat is offered again
or released. Accepting an offer creates a booking through the waitlist service;
that path does not currently call the payment simulator.

## Realtime updates and ticket delivery

Socket.io rooms are scoped to a show. The React application updates its query
cache when seats are held, released, booked or offered. The HTTP seat map is
the initial inventory view.

Tickets contain a signed JWT over the booking reference. Verification checks
the signature and the current booking status. Email uses Resend when configured,
otherwise SMTP when `SMTP_URL` is set, then an Ethereal development account.
Local defaults use Mailpit. Mail errors are logged and rethrown only in production;
there is no persistent email outbox or delivery retry workflow.

## Assessment work remaining

The Functions checkout must share the domain rules with Express, persist
repeatable operations, reconcile uncertain external outcomes and define bounded
retries and compensation. Durable timers and events must coordinate payment,
expiry and cancellation. The final design must map its guarantees to concurrency,
failure and restart tests, and document operational diagnosis and correlation.
